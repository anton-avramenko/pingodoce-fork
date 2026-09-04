'use client';

import Anthropic from '@anthropic-ai/sdk';
import { isValidEan13 } from './barcode';
import type { BarcodeFormat, CouponKind } from './types';

/**
 * AI-powered code extraction.
 *
 * The POC is a fully static site (no backend), so recognition calls the Claude
 * API directly from the browser with a key the tester enters on the device.
 * `dangerouslyAllowBrowser` is deliberate for that reason — the key never
 * leaves the phone except to reach Anthropic, and it is never bundled.
 */

/** Model used for recognition. */
const MODEL = 'claude-opus-5';

/** Longest edge sent to the model — larger images cost more without reading better. */
const MAX_IMAGE_EDGE = 1568;

export type ScanPurpose = 'coupon' | 'card';

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

/** Shape the model is constrained to return (structured outputs). */
interface RawExtraction {
  codes: {
    value: string;
    label: string;
    kind: 'coupon' | 'loyalty_card' | 'other';
    confidence: 'high' | 'medium' | 'low';
  }[];
  title: string | null;
  discount: string | null;
  expires_at: string | null;
  category: 'fuel' | 'store' | null;
  notes: string | null;
}

const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: 'null' }] });

const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    codes: {
      type: 'array',
      description: 'Every code a cashier could scan or type, best candidate first.',
      items: {
        type: 'object',
        properties: {
          value: {
            type: 'string',
            description:
              'The code exactly as printed. For numeric barcodes return digits only, no spaces or separators.',
          },
          label: {
            type: 'string',
            description: 'Short Portuguese description of where the code was read, e.g. "Dígitos sob o código de barras".',
          },
          kind: { type: 'string', enum: ['coupon', 'loyalty_card', 'other'] },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['value', 'label', 'kind', 'confidence'],
        additionalProperties: false,
      },
    },
    title: nullable({ type: 'string', description: 'Coupon title as printed, in Portuguese.' }),
    discount: nullable({ type: 'string', description: 'Discount value as printed, e.g. "15€" or "0,06€/L".' }),
    expires_at: nullable({ type: 'string', description: 'Expiry date in yyyy-mm-dd, only if printed.' }),
    category: nullable({ type: 'string', enum: ['fuel', 'store'] }),
    notes: nullable({ type: 'string', description: 'One short sentence in Portuguese if nothing readable was found or something is ambiguous.' }),
  },
  required: ['codes', 'title', 'discount', 'expires_at', 'category', 'notes'],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `You read photos and screenshots for a Portuguese supermarket loyalty app (Pingo Doce, Poupa Mais, BP fuel coupons) and extract the codes a cashier would scan or type.

Inputs can be: a physical loyalty card, a printed or digital coupon, a fuel voucher, a till receipt, an SMS or email screenshot, or plain free text containing a code.

Rules:
- Return every code candidate you can actually read: digits printed under a barcode, coupon/voucher numbers, alphanumeric promo codes. Put the most likely code first.
- Transcribe characters exactly. For numeric barcodes return digits only. Pingo Doce, Poupa Mais and BP codes are usually EAN-13 (13 digits).
- Never invent or "complete" digits you cannot read. If part of a code is unreadable, return what you can read with confidence "low" and explain in notes.
- Ignore phone numbers, NIFs, prices, dates and store numbers unless nothing else looks like a code — then return them with kind "other".
- Only fill title, discount, expires_at and category when they are clearly printed on the coupon; otherwise null.`;

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

/**
 * Downscale and re-encode a photo as JPEG.
 * Phone photos are 3–12 MP HEIC/JPEG; the model reads codes just as well at
 * ~1.5k px, and the smaller payload keeps the request fast on mobile data.
 */
export async function prepareImage(file: File): Promise<{ data: string; mediaType: 'image/jpeg' }> {
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

/**
 * The key comes only from the on-device setting. There is intentionally no
 * build-time (`NEXT_PUBLIC_*`) fallback: this repo deploys to a public static
 * host, and anything inlined at build time would ship to every visitor.
 */
export function resolveApiKey(configured: string | undefined): string {
  return (configured ?? '').trim();
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

/** Send a photo to Claude and return the codes found in it. */
export async function extractCodes(
  file: File,
  apiKey: string,
  purpose: ScanPurpose
): Promise<ScanResult> {
  if (!apiKey) {
    throw new ScanError('Configure a chave API no ecrã de configuração para usar o reconhecimento.', false);
  }

  const image = await prepareImage(file);

  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
    timeout: 90_000,
    maxRetries: 1,
  });

  const ask =
    purpose === 'card'
      ? 'Extract the loyalty card number(s) from this image. If it is a Pingo Doce / Poupa Mais card, both the "O Meu Pingo Doce" and "Poupa Mais" numbers may be present — return each as its own candidate with a label saying which is which.'
      : 'Extract the coupon / voucher code(s) from this image, plus the coupon title, discount and expiry date when printed.';

  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 2048,
      // If the primary model declines the request, Anthropic re-runs it on a
      // fallback model inside the same call instead of failing the scan.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM_PROMPT,
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema: EXTRACTION_SCHEMA as unknown as Record<string, unknown> },
      },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: image.mediaType, data: image.data },
            },
            { type: 'text', text: ask },
          ],
        },
      ],
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      throw new ScanError('Chave API inválida. Verifique-a no ecrã de configuração.', false);
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

  let raw: RawExtraction;
  try {
    raw = JSON.parse(text) as RawExtraction;
  } catch {
    throw new ScanError('Resposta inesperada do serviço de reconhecimento. Tente de novo.');
  }

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
      kind: entry.kind,
      confidence: entry.confidence,
    });
  }

  return {
    candidates,
    title: raw.title?.trim() || null,
    discount: raw.discount?.trim() || null,
    expiresAt: raw.expires_at && /^\d{4}-\d{2}-\d{2}$/.test(raw.expires_at) ? raw.expires_at : null,
    couponKind: raw.category ?? null,
    notes: raw.notes?.trim() || null,
  };
}
