/**
 * Provider-agnostic core of the AI code extraction.
 *
 * Plain ESM (no TypeScript, no browser globals) so the very same prompt,
 * output schema and provider calls run in two places:
 *  - the browser (src/lib/scan.ts) when the tester holds their own key, and
 *  - the optional local proxy (server/index.mjs) when the key lives on a
 *    laptop exposed through ngrok.
 */

import Anthropic from '@anthropic-ai/sdk';

export const ANTHROPIC_MODEL = 'claude-opus-5';
/** Default Gemini model; editable because Google renames models often. */
export const DEFAULT_GOOGLE_MODEL = 'gemini-2.5-flash';

/** Per-request timeout for provider calls (ms). */
const REQUEST_TIMEOUT_MS = 90_000;

export const KIND_VALUES = ['coupon', 'loyalty_card', 'other'];
export const CONFIDENCE_VALUES = ['high', 'medium', 'low'];
export const CATEGORY_VALUES = ['fuel', 'store'];

const FIELD_DOCS = {
  value: 'The code exactly as printed. For numeric barcodes return digits only, no spaces or separators.',
  label: 'Short Portuguese description of where the code was read, e.g. "Dígitos sob o código de barras".',
  title: 'Coupon title as printed, in Portuguese.',
  discount: 'Discount value as printed, e.g. "15€" or "0,06€/L".',
  expires_at: 'Expiry date in yyyy-mm-dd, only if printed.',
  notes: 'One short sentence in Portuguese if nothing readable was found or something is ambiguous.',
  codes: 'Every code a cashier could scan or type, best candidate first.',
};

/** JSON Schema for Anthropic structured outputs (draft 2020-12 subset). */
const nullable = (schema) => ({ anyOf: [schema, { type: 'null' }] });
export const ANTHROPIC_SCHEMA = {
  type: 'object',
  properties: {
    codes: {
      type: 'array',
      description: FIELD_DOCS.codes,
      items: {
        type: 'object',
        properties: {
          value: { type: 'string', description: FIELD_DOCS.value },
          label: { type: 'string', description: FIELD_DOCS.label },
          kind: { type: 'string', enum: KIND_VALUES },
          confidence: { type: 'string', enum: CONFIDENCE_VALUES },
        },
        required: ['value', 'label', 'kind', 'confidence'],
        additionalProperties: false,
      },
    },
    title: nullable({ type: 'string', description: FIELD_DOCS.title }),
    discount: nullable({ type: 'string', description: FIELD_DOCS.discount }),
    expires_at: nullable({ type: 'string', description: FIELD_DOCS.expires_at }),
    category: nullable({ type: 'string', enum: CATEGORY_VALUES }),
    notes: nullable({ type: 'string', description: FIELD_DOCS.notes }),
  },
  required: ['codes', 'title', 'discount', 'expires_at', 'category', 'notes'],
  additionalProperties: false,
};

/** Same schema in Gemini's OpenAPI-style `responseSchema` dialect. */
export const GEMINI_SCHEMA = {
  type: 'OBJECT',
  properties: {
    codes: {
      type: 'ARRAY',
      description: FIELD_DOCS.codes,
      items: {
        type: 'OBJECT',
        properties: {
          value: { type: 'STRING', description: FIELD_DOCS.value },
          label: { type: 'STRING', description: FIELD_DOCS.label },
          kind: { type: 'STRING', enum: KIND_VALUES },
          confidence: { type: 'STRING', enum: CONFIDENCE_VALUES },
        },
        required: ['value', 'label', 'kind', 'confidence'],
        propertyOrdering: ['value', 'label', 'kind', 'confidence'],
      },
    },
    title: { type: 'STRING', description: FIELD_DOCS.title, nullable: true },
    discount: { type: 'STRING', description: FIELD_DOCS.discount, nullable: true },
    expires_at: { type: 'STRING', description: FIELD_DOCS.expires_at, nullable: true },
    category: { type: 'STRING', enum: CATEGORY_VALUES, nullable: true },
    notes: { type: 'STRING', description: FIELD_DOCS.notes, nullable: true },
  },
  required: ['codes'],
  propertyOrdering: ['codes', 'title', 'discount', 'expires_at', 'category', 'notes'],
};

export const SYSTEM_PROMPT = `You read photos and screenshots for a Portuguese supermarket loyalty app (Pingo Doce, Poupa Mais, BP fuel coupons) and extract the codes a cashier would scan or type.

Inputs can be: a physical loyalty card, a printed or digital coupon, a fuel voucher, a till receipt, an SMS or email screenshot, or plain free text containing a code.

Rules:
- Return every code candidate you can actually read: digits printed under a barcode, coupon/voucher numbers, alphanumeric promo codes. Put the most likely code first.
- Transcribe characters exactly. For numeric barcodes return digits only. Pingo Doce, Poupa Mais and BP codes are usually EAN-13 (13 digits).
- Never invent or "complete" digits you cannot read. If part of a code is unreadable, return what you can read with confidence "low" and explain in notes.
- Ignore phone numbers, NIFs, prices, dates and store numbers unless nothing else looks like a code — then return them with kind "other".
- Only fill title, discount, expires_at and category when they are clearly printed on the coupon; otherwise null.`;

/** @param {'coupon' | 'card'} purpose */
export function userPrompt(purpose) {
  return purpose === 'card'
    ? 'Extract the loyalty card number(s) from this image. If it is a Pingo Doce / Poupa Mais card, both the "O Meu Pingo Doce" and "Poupa Mais" numbers may be present — return each as its own candidate with a label saying which is which.'
    : 'Extract the coupon / voucher code(s) from this image, plus the coupon title, discount and expiry date when printed.';
}

/**
 * Machine-readable failure codes. The browser maps them to Portuguese
 * messages; the proxy maps them to HTTP statuses and forwards the code so the
 * browser can show the same message either way.
 * @typedef {'invalid_key' | 'forbidden' | 'model_not_found' | 'rate_limit' | 'network'
 *   | 'refused' | 'truncated' | 'bad_response' | 'provider_error' | 'not_configured'} ProviderErrorCode
 */

export class ProviderError extends Error {
  /**
   * @param {ProviderErrorCode} code
   * @param {string} [detail] Extra context (HTTP status, model name) for logs/messages.
   */
  constructor(code, detail = '') {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'ProviderError';
    this.code = code;
    this.detail = detail;
  }
}

export const PROVIDER_ERROR_CODES = [
  'invalid_key', 'forbidden', 'model_not_found', 'rate_limit', 'network',
  'refused', 'truncated', 'bad_response', 'provider_error', 'not_configured',
];

/** @param {string} text */
function parseExtraction(text) {
  try {
    return JSON.parse(text);
  } catch {
    throw new ProviderError('bad_response', 'response was not valid JSON');
  }
}

/**
 * @typedef {{ data: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' }} ImageInput
 */

// ---------------------------------------------------------------------------
// Anthropic (Claude)
// ---------------------------------------------------------------------------

/**
 * @param {ImageInput} image
 * @param {string} apiKey
 * @param {'coupon' | 'card'} purpose
 * @param {{ browser?: boolean }} [opts] `browser: true` when called from a web page (static site, key on the device).
 */
export async function callAnthropic(image, apiKey, purpose, opts = {}) {
  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: Boolean(opts.browser),
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: 1,
  });

  let response;
  try {
    response = await client.beta.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 2048,
      // If the primary model declines the request, Anthropic re-runs it on a
      // fallback model inside the same call instead of failing the scan.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM_PROMPT,
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema: ANTHROPIC_SCHEMA },
      },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.data } },
            { type: 'text', text: userPrompt(purpose) },
          ],
        },
      ],
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) throw new ProviderError('invalid_key');
    if (error instanceof Anthropic.PermissionDeniedError) throw new ProviderError('forbidden');
    if (error instanceof Anthropic.NotFoundError) throw new ProviderError('model_not_found', ANTHROPIC_MODEL);
    if (error instanceof Anthropic.RateLimitError) throw new ProviderError('rate_limit');
    if (error instanceof Anthropic.APIConnectionError) throw new ProviderError('network');
    if (error instanceof Anthropic.APIError) throw new ProviderError('provider_error', String(error.status ?? ''));
    throw error;
  }

  if (response.stop_reason === 'refusal') throw new ProviderError('refused');
  if (response.stop_reason === 'max_tokens') throw new ProviderError('truncated');

  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');
  return parseExtraction(text);
}

// ---------------------------------------------------------------------------
// Google AI Studio (Gemini)
// ---------------------------------------------------------------------------

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * @param {ImageInput} image
 * @param {string} apiKey
 * @param {string} model Gemini model name; empty falls back to DEFAULT_GOOGLE_MODEL.
 * @param {'coupon' | 'card'} purpose
 */
export async function callGemini(image, apiKey, model, purpose) {
  const modelName = model || DEFAULT_GOOGLE_MODEL;
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType: image.mediaType, data: image.data } },
          { text: userPrompt(purpose) },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: GEMINI_SCHEMA,
    },
  };

  let res;
  try {
    res = await fetch(`${GEMINI_ENDPOINT}/${encodeURIComponent(modelName)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new ProviderError('network');
  }

  let payload;
  try {
    payload = await res.json();
  } catch {
    throw new ProviderError('provider_error', String(res.status));
  }

  if (!res.ok) {
    const status = payload?.error?.status ?? '';
    const message = payload?.error?.message ?? '';
    if (res.status === 400 && /API key not valid|API_KEY_INVALID/i.test(`${status} ${message}`)) {
      throw new ProviderError('invalid_key');
    }
    if (res.status === 401 || res.status === 403) throw new ProviderError('forbidden');
    if (res.status === 404) throw new ProviderError('model_not_found', modelName);
    if (res.status === 429) throw new ProviderError('rate_limit');
    throw new ProviderError('provider_error', String(res.status));
  }

  if (payload?.promptFeedback?.blockReason) throw new ProviderError('refused');
  const candidate = payload?.candidates?.[0];
  if (candidate?.finishReason === 'MAX_TOKENS') throw new ProviderError('truncated');
  if (candidate?.finishReason && candidate.finishReason !== 'STOP' && !candidate.content) {
    throw new ProviderError('refused');
  }

  const text = (candidate?.content?.parts ?? []).map((p) => p.text ?? '').join('');
  return parseExtraction(text);
}
