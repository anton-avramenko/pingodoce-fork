'use client';

import Anthropic from '@anthropic-ai/sdk';
import { isValidEan13 } from './barcode';
import type { AiProvider, AppConfig, BarcodeFormat, CouponKind } from './types';

/**
 * AI-powered code extraction.
 *
 * The POC is a fully static site (no backend), so recognition calls the
 * provider API directly from the browser with a key the tester enters on the
 * device. The key is stored only on the phone and never bundled.
 *
 * Two providers are supported and share the same prompt, output schema and
 * post-processing:
 *  - Anthropic (Claude) via the official TypeScript SDK
 *  - Google AI Studio (Gemini) via the Generative Language REST API
 */

const ANTHROPIC_MODEL = 'claude-opus-5';
/** Default Gemini model; editable in setup because Google renames models often. */
export const DEFAULT_GOOGLE_MODEL = 'gemini-2.5-flash';

/** Longest edge sent to the model — larger images cost more without reading better. */
const MAX_IMAGE_EDGE = 1568;

export type ScanPurpose = 'coupon' | 'card';

/** Everything the scanner needs to know about the configured AI provider. */
export interface AiSettings {
  provider: AiProvider;
  anthropicApiKey: string;
  googleApiKey: string;
  googleModel: string;
}

export const AI_PROVIDER_LABEL: Record<AiProvider, string> = {
  anthropic: 'Anthropic (Claude)',
  google: 'Google AI Studio (Gemini)',
};

/** Pull the AI settings out of the persisted config. */
export function resolveAiSettings(config: AppConfig): AiSettings {
  return {
    provider: config.aiProvider ?? 'anthropic',
    anthropicApiKey: (config.aiApiKey ?? '').trim(),
    googleApiKey: (config.googleApiKey ?? '').trim(),
    googleModel: (config.googleModel ?? '').trim() || DEFAULT_GOOGLE_MODEL,
  };
}

/** The key for the selected provider, or '' when none is configured. */
export function activeApiKey(ai: AiSettings): string {
  return ai.provider === 'google' ? ai.googleApiKey : ai.anthropicApiKey;
}

export interface ScanCandidate {
  /** Normalised code (digits only for numeric barcodes). */
  code: string;
  /** Best symbology to render this code with. */
  format: BarcodeFormat;
  /** Where the code was read from, e.g. "Dígitos sob o código de barras". */
  label: string;
  kind: 'coupon' | 'loyalty_card' | 'other';
  confidence: 'high' | 'medium' | 'low';
}

export interface ScanResult {
  candidates: ScanCandidate[];
  /** Coupon metadata when clearly visible in the image. */
  title: string | null;
  discount: string | null;
  /** ISO date (yyyy-mm-dd). */
  expiresAt: string | null;
  couponKind: CouponKind | null;
  /** Short note from the model, e.g. why nothing was found. */
  notes: string | null;
}

/** Shape both providers are constrained to return. */
interface RawExtraction {
  codes: {
    value: string;
    label: string;
    kind: 'coupon' | 'loyalty_card' | 'other';
    confidence: 'high' | 'medium' | 'low';
  }[];
  title?: string | null;
  discount?: string | null;
  expires_at?: string | null;
  category?: 'fuel' | 'store' | null;
  notes?: string | null;
}

const FIELD_DOCS = {
  value: 'The code exactly as printed. For numeric barcodes return digits only, no spaces or separators.',
  label: 'Short Portuguese description of where the code was read, e.g. "Dígitos sob o código de barras".',
  title: 'Coupon title as printed, in Portuguese.',
  discount: 'Discount value as printed, e.g. "15€" or "0,06€/L".',
  expires_at: 'Expiry date in yyyy-mm-dd, only if printed.',
  notes: 'One short sentence in Portuguese if nothing readable was found or something is ambiguous.',
  codes: 'Every code a cashier could scan or type, best candidate first.',
};

const KIND_VALUES = ['coupon', 'loyalty_card', 'other'];
const CONFIDENCE_VALUES = ['high', 'medium', 'low'];
const CATEGORY_VALUES = ['fuel', 'store'];

/** JSON Schema for Anthropic structured outputs (draft 2020-12 subset). */
const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: 'null' }] });
const ANTHROPIC_SCHEMA = {
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
const GEMINI_SCHEMA = {
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

const SYSTEM_PROMPT = `You read photos and screenshots for a Portuguese supermarket loyalty app (Pingo Doce, Poupa Mais, BP fuel coupons) and extract the codes a cashier would scan or type.

Inputs can be: a physical loyalty card, a printed or digital coupon, a fuel voucher, a till receipt, an SMS or email screenshot, or plain free text containing a code.

Rules:
- Return every code candidate you can actually read: digits printed under a barcode, coupon/voucher numbers, alphanumeric promo codes. Put the most likely code first.
- Transcribe characters exactly. For numeric barcodes return digits only. Pingo Doce, Poupa Mais and BP codes are usually EAN-13 (13 digits).
- Never invent or "complete" digits you cannot read. If part of a code is unreadable, return what you can read with confidence "low" and explain in notes.
- Ignore phone numbers, NIFs, prices, dates and store numbers unless nothing else looks like a code — then return them with kind "other".
- Only fill title, discount, expires_at and category when they are clearly printed on the coupon; otherwise null.`;

function userPrompt(purpose: ScanPurpose): string {
  return purpose === 'card'
    ? 'Extract the loyalty card number(s) from this image. If it is a Pingo Doce / Poupa Mais card, both the "O Meu Pingo Doce" and "Poupa Mais" numbers may be present — return each as its own candidate with a label saying which is which.'
    : 'Extract the coupon / voucher code(s) from this image, plus the coupon title, discount and expiry date when printed.';
}

/** Human-readable error for the scanner UI (Portuguese, like the rest of the app). */
export class ScanError extends Error {
  constructor(
    message: string,
    /** Whether a retry with the same key makes sense. */
    public readonly retryable = true
  ) {
    super(message);
    this.name = 'ScanError';
  }
}

interface PreparedImage {
  data: string;
  mediaType: 'image/jpeg';
}

/**
 * Downscale and re-encode a photo as JPEG.
 * Phone photos are 3–12 MP HEIC/JPEG; the model reads codes just as well at
 * ~1.5k px, and the smaller payload keeps the request fast on mobile data.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('decode'));
      el.src = url;
    });

    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas');
    ctx.drawImage(img, 0, 0, width, height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    return { data: dataUrl.slice(dataUrl.indexOf(',') + 1), mediaType: 'image/jpeg' };
  } catch {
    throw new ScanError(
      'Não foi possível ler esta imagem. Tente uma fotografia JPEG ou PNG.',
      true
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Keep only characters that can appear in a barcode value. */
function normaliseCode(raw: string): string {
  const trimmed = raw.trim();
  // Numeric codes are often printed in groups ("241 0000 000000 5")
  if (/^[\d\s\-.]+$/.test(trimmed)) return trimmed.replace(/[^\d]/g, '');
  return trimmed.replace(/\s+/g, '');
}

export function formatForCode(code: string): BarcodeFormat {
  return isValidEan13(code) ? 'EAN13' : 'CODE128';
}

function parseExtraction(text: string): RawExtraction {
  try {
    return JSON.parse(text) as RawExtraction;
  } catch {
    throw new ScanError('Resposta inesperada do serviço de reconhecimento. Tente de novo.');
  }
}

function toScanResult(raw: RawExtraction): ScanResult {
  const seen = new Set<string>();
  const candidates: ScanCandidate[] = [];
  for (const entry of raw.codes ?? []) {
    const code = normaliseCode(entry.value ?? '');
    if (code.length < 4 || seen.has(code)) continue;
    seen.add(code);
    candidates.push({
      code,
      format: formatForCode(code),
      label: entry.label || 'Código detetado',
      kind: KIND_VALUES.includes(entry.kind) ? entry.kind : 'other',
      confidence: CONFIDENCE_VALUES.includes(entry.confidence) ? entry.confidence : 'low',
    });
  }

  return {
    candidates,
    title: raw.title?.trim() || null,
    discount: raw.discount?.trim() || null,
    expiresAt: raw.expires_at && /^\d{4}-\d{2}-\d{2}$/.test(raw.expires_at) ? raw.expires_at : null,
    couponKind: raw.category === 'fuel' || raw.category === 'store' ? raw.category : null,
    notes: raw.notes?.trim() || null,
  };
}

/** Send a photo to the configured provider and return the codes found in it. */
export async function extractCodes(
  file: File,
  ai: AiSettings,
  purpose: ScanPurpose
): Promise<ScanResult> {
  if (!activeApiKey(ai)) {
    throw new ScanError(
      `Configure a chave API de ${AI_PROVIDER_LABEL[ai.provider]} no ecrã de configuração para usar o reconhecimento.`,
      false
    );
  }

  const image = await prepareImage(file);
  const raw =
    ai.provider === 'google'
      ? await extractWithGemini(image, ai, purpose)
      : await extractWithAnthropic(image, ai.anthropicApiKey, purpose);
  return toScanResult(raw);
}

// ---------------------------------------------------------------------------
// Anthropic (Claude)
// ---------------------------------------------------------------------------

async function extractWithAnthropic(
  image: PreparedImage,
  apiKey: string,
  purpose: ScanPurpose
): Promise<RawExtraction> {
  const client = new Anthropic({
    apiKey,
    // Deliberate: static site, key lives on the device (see file header).
    dangerouslyAllowBrowser: true,
    timeout: 90_000,
    maxRetries: 1,
  });

  let response: Anthropic.Beta.BetaMessage;
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
            {
              type: 'image',
              source: { type: 'base64', media_type: image.mediaType, data: image.data },
            },
            { type: 'text', text: userPrompt(purpose) },
          ],
        },
      ],
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      throw new ScanError('Chave API Anthropic inválida. Verifique-a no ecrã de configuração.', false);
    }
    if (error instanceof Anthropic.PermissionDeniedError) {
      throw new ScanError('Esta chave API não tem permissão para usar o modelo.', false);
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new ScanError('Limite de pedidos atingido. Aguarde um momento e tente de novo.');
    }
    if (error instanceof Anthropic.APIConnectionError) {
      throw new ScanError('Sem ligação ao serviço de reconhecimento. Verifique a internet e tente de novo.');
    }
    if (error instanceof Anthropic.APIError) {
      throw new ScanError(`Erro do serviço de reconhecimento (${error.status ?? 'desconhecido'}).`);
    }
    throw error;
  }

  if (response.stop_reason === 'refusal') {
    throw new ScanError('O serviço recusou analisar esta imagem. Tente outra fotografia.');
  }
  if (response.stop_reason === 'max_tokens') {
    throw new ScanError('A resposta foi cortada. Tente uma fotografia mais próxima do código.');
  }

  const text = response.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
  return parseExtraction(text);
}

// ---------------------------------------------------------------------------
// Google AI Studio (Gemini)
// ---------------------------------------------------------------------------

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Minimal slice of the generateContent response we read. */
interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
  error?: { code?: number; status?: string; message?: string };
}

async function extractWithGemini(
  image: PreparedImage,
  ai: AiSettings,
  purpose: ScanPurpose
): Promise<RawExtraction> {
  const model = encodeURIComponent(ai.googleModel || DEFAULT_GOOGLE_MODEL);
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

  let res: Response;
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 90_000);
    res = await fetch(`${GEMINI_ENDPOINT}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': ai.googleApiKey },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    window.clearTimeout(timer);
  } catch {
    throw new ScanError('Sem ligação ao serviço de reconhecimento. Verifique a internet e tente de novo.');
  }

  let payload: GeminiResponse;
  try {
    payload = (await res.json()) as GeminiResponse;
  } catch {
    throw new ScanError(`Erro do serviço de reconhecimento (${res.status}).`);
  }

  if (!res.ok) {
    const status = payload.error?.status ?? '';
    const message = payload.error?.message ?? '';
    if (res.status === 400 && /API key not valid|API_KEY_INVALID/i.test(`${status} ${message}`)) {
      throw new ScanError('Chave API Google inválida. Verifique-a no ecrã de configuração.', false);
    }
    if (res.status === 401 || res.status === 403) {
      throw new ScanError('Esta chave API Google não tem permissão para usar o modelo.', false);
    }
    if (res.status === 404) {
      throw new ScanError(
        `Modelo Gemini "${ai.googleModel}" não encontrado. Verifique o nome no ecrã de configuração.`,
        false
      );
    }
    if (res.status === 429) {
      throw new ScanError('Limite de pedidos atingido. Aguarde um momento e tente de novo.');
    }
    throw new ScanError(`Erro do serviço de reconhecimento (${res.status}).`);
  }

  if (payload.promptFeedback?.blockReason) {
    throw new ScanError('O serviço recusou analisar esta imagem. Tente outra fotografia.');
  }
  const candidate = payload.candidates?.[0];
  if (candidate?.finishReason === 'MAX_TOKENS') {
    throw new ScanError('A resposta foi cortada. Tente uma fotografia mais próxima do código.');
  }
  if (candidate?.finishReason && !['STOP', 'MAX_TOKENS'].includes(candidate.finishReason) && !candidate.content) {
    throw new ScanError('O serviço recusou analisar esta imagem. Tente outra fotografia.');
  }

  const text = (candidate?.content?.parts ?? []).map((p) => p.text ?? '').join('');
  return parseExtraction(text);
}
