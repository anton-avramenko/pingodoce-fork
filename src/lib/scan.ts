'use client';

import { isValidEan13 } from './barcode';
import {
  callAnthropic,
  callGemini,
  DEFAULT_GOOGLE_MODEL,
  PROVIDER_ERROR_CODES,
  ProviderError,
} from './scan-core.mjs';
import type { AiProvider, AppConfig, BarcodeFormat, CouponKind } from './types';

export { DEFAULT_GOOGLE_MODEL };

/**
 * Browser side of the AI code extraction.
 *
 * The POC is a fully static site (no backend of its own), so there are three
 * ways to reach a vision model, chosen in the setup screen:
 *  - Anthropic (Claude) directly, with a key stored on the device
 *  - Google AI Studio (Gemini) directly, with a key stored on the device
 *  - a proxy server (server/index.mjs) that holds the key — for testers
 *    without one; typically a laptop exposed through ngrok
 *
 * Prompt, schema and provider calls live in scan-core.mjs and are shared with
 * the proxy, so all three paths return the same shape.
 */

/** Longest edge sent to the model — larger images cost more without reading better. */
const MAX_IMAGE_EDGE = 1568;

/**
 * Proxy used when the tester leaves the server address empty: the POC
 * author's laptop exposed through a static ngrok domain. Testers with their
 * own proxy override it in setup.
 */
export const DEFAULT_SERVER_URL = 'https://oralee-dieretic-contemplatively.ngrok-free.dev';

export type ScanPurpose = 'coupon' | 'card';

/** Everything the scanner needs to know about the configured AI provider. */
export interface AiSettings {
  provider: AiProvider;
  anthropicApiKey: string;
  googleApiKey: string;
  googleModel: string;
  /** Base URL of the proxy (no trailing slash). Falls back to DEFAULT_SERVER_URL. */
  serverUrl: string;
  /** True when serverUrl came from DEFAULT_SERVER_URL rather than the tester. */
  serverIsDefault: boolean;
  /** Optional shared secret sent as a Bearer token to the proxy. */
  serverToken: string;
}

export const AI_PROVIDER_LABEL: Record<AiProvider, string> = {
  anthropic: 'Anthropic (Claude)',
  google: 'Google AI Studio (Gemini)',
  server: 'Servidor (proxy, sem chave no telemóvel)',
};

/** Pull the AI settings out of the persisted config. */
export function resolveAiSettings(config: AppConfig): AiSettings {
  const ownServer = normaliseServerUrl(config.serverUrl ?? '');
  return {
    provider: config.aiProvider ?? 'server',
    anthropicApiKey: (config.aiApiKey ?? '').trim(),
    googleApiKey: (config.googleApiKey ?? '').trim(),
    googleModel: (config.googleModel ?? '').trim() || DEFAULT_GOOGLE_MODEL,
    serverUrl: ownServer || DEFAULT_SERVER_URL,
    serverIsDefault: !ownServer,
    serverToken: (config.serverToken ?? '').trim(),
  };
}

/** Trim, add https:// when the scheme is missing, drop trailing slashes. */
export function normaliseServerUrl(raw: string): string {
  let url = raw.trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url.replace(/\/+$/, '');
}

/** True when the selected provider has what it needs to run a scan. */
export function isAiConfigured(ai: AiSettings): boolean {
  switch (ai.provider) {
    case 'google':
      return Boolean(ai.googleApiKey);
    case 'server':
      return Boolean(ai.serverUrl);
    default:
      return Boolean(ai.anthropicApiKey);
  }
}

/** What the tester must fill in for the selected provider (for the missing-config notice). */
export function missingConfigHint(ai: AiSettings): string {
  return ai.provider === 'server'
    ? 'Introduza o endereço do servidor na secção “Reconhecimento por IA” do ecrã de configuração.'
    : `O reconhecimento usa ${AI_PROVIDER_LABEL[ai.provider]}. Introduza a chave na secção “Reconhecimento por IA” do ecrã de configuração.`;
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

/** Shape every provider (and the proxy) returns. */
interface RawExtraction {
  codes?: {
    value?: string;
    label?: string;
    kind?: string;
    confidence?: string;
  }[];
  title?: string | null;
  discount?: string | null;
  expires_at?: string | null;
  category?: string | null;
  notes?: string | null;
}

type ProviderErrorCode = (typeof PROVIDER_ERROR_CODES)[number];

/** Human-readable error for the scanner UI (Portuguese, like the rest of the app). */
export class ScanError extends Error {
  constructor(
    message: string,
    /** Whether a retry with the same settings makes sense. */
    public readonly retryable = true
  ) {
    super(message);
    this.name = 'ScanError';
  }
}

/** Map a provider failure code to the message shown in the sheet. */
function scanErrorFromCode(code: string, detail: string, provider: AiProvider): ScanError {
  const viaServer = provider === 'server';
  switch (code as ProviderErrorCode) {
    case 'invalid_key':
      return new ScanError(
        viaServer
          ? 'A chave API configurada no servidor é inválida.'
          : 'Chave API inválida. Verifique-a no ecrã de configuração.',
        false
      );
    case 'forbidden':
      return new ScanError('Esta chave API não tem permissão para usar o modelo.', false);
    case 'model_not_found':
      return new ScanError(
        `Modelo "${detail}" não encontrado. Verifique o nome do modelo${viaServer ? ' no servidor' : ' no ecrã de configuração'}.`,
        false
      );
    case 'rate_limit':
      return new ScanError('Limite de pedidos atingido. Aguarde um momento e tente de novo.');
    case 'network':
      return new ScanError(
        viaServer
          ? 'O servidor não conseguiu contactar o serviço de reconhecimento. Tente de novo.'
          : 'Sem ligação ao serviço de reconhecimento. Verifique a internet e tente de novo.'
      );
    case 'refused':
      return new ScanError('O serviço recusou analisar esta imagem. Tente outra fotografia.');
    case 'truncated':
      return new ScanError('A resposta foi cortada. Tente uma fotografia mais próxima do código.');
    case 'bad_response':
      return new ScanError('Resposta inesperada do serviço de reconhecimento. Tente de novo.');
    case 'not_configured':
      return new ScanError('O servidor não tem nenhuma chave API configurada.', false);
    default:
      return new ScanError(`Erro do serviço de reconhecimento${detail ? ` (${detail})` : ''}.`);
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

function toScanResult(raw: RawExtraction): ScanResult {
  const seen = new Set<string>();
  const candidates: ScanCandidate[] = [];
  for (const entry of raw.codes ?? []) {
    const code = normaliseCode(entry.value ?? '');
    if (code.length < 4 || seen.has(code)) continue;
    seen.add(code);
    const kind = entry.kind;
    const confidence = entry.confidence;
    candidates.push({
      code,
      format: formatForCode(code),
      label: entry.label || 'Código detetado',
      kind: kind === 'coupon' || kind === 'loyalty_card' ? kind : 'other',
      confidence: confidence === 'high' || confidence === 'medium' ? confidence : 'low',
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
  if (!isAiConfigured(ai)) throw new ScanError(missingConfigHint(ai), false);

  const image = await prepareImage(file);

  let raw: RawExtraction;
  try {
    if (ai.provider === 'server') {
      raw = await callProxy(image, ai, purpose);
    } else if (ai.provider === 'google') {
      raw = (await callGemini(image, ai.googleApiKey, ai.googleModel, purpose)) as RawExtraction;
    } else {
      raw = (await callAnthropic(image, ai.anthropicApiKey, purpose, { browser: true })) as RawExtraction;
    }
  } catch (error) {
    if (error instanceof ProviderError) throw scanErrorFromCode(error.code, error.detail, ai.provider);
    throw error;
  }
  return toScanResult(raw);
}

// ---------------------------------------------------------------------------
// Proxy server (server/index.mjs)
// ---------------------------------------------------------------------------

/** Shape of the proxy's JSON responses. */
interface ProxyErrorBody {
  error?: { code?: string; detail?: string };
}

export interface ProxyHealth {
  ok: boolean;
  provider: string;
  model: string;
  requiresToken: boolean;
  allowedOrigins: string[];
}

/** Headers every proxy request carries (auth + ngrok's interstitial bypass). */
function proxyHeaders(ai: AiSettings): Record<string, string> {
  const headers: Record<string, string> = {
    // ngrok's free tier answers browser-looking requests with an HTML warning
    // page unless this header is present.
    'ngrok-skip-browser-warning': '1',
  };
  if (ai.serverToken) headers.Authorization = `Bearer ${ai.serverToken}`;
  return headers;
}

async function callProxy(
  image: PreparedImage,
  ai: AiSettings,
  purpose: ScanPurpose
): Promise<RawExtraction> {
  let res: Response;
  try {
    res = await fetch(`${ai.serverUrl}/scan`, {
      method: 'POST',
      headers: { ...proxyHeaders(ai), 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: image.data, mediaType: image.mediaType, purpose }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    throw new ScanError(
      'Sem ligação ao servidor. Confirme que está ligado e que o endereço (ngrok) está atualizado.'
    );
  }

  if (res.status === 401) {
    throw new ScanError('O servidor rejeitou o token. Verifique-o no ecrã de configuração.', false);
  }
  if (res.status === 403) {
    throw new ScanError(
      'O servidor não aceita pedidos deste site (origem não autorizada). Ajuste ALLOWED_ORIGINS no servidor.',
      false
    );
  }

  let payload: RawExtraction & ProxyErrorBody;
  try {
    payload = (await res.json()) as RawExtraction & ProxyErrorBody;
  } catch {
    throw new ScanError(
      res.ok
        ? 'Resposta inesperada do servidor. Tente de novo.'
        : `O servidor respondeu com erro (${res.status}). Confirme o endereço no ecrã de configuração.`
    );
  }

  if (!res.ok) {
    if (payload.error?.code) throw scanErrorFromCode(payload.error.code, payload.error.detail ?? '', 'server');
    throw new ScanError(`O servidor respondeu com erro (${res.status}).`);
  }
  return payload;
}

/** GET /health on the proxy — used by the "Testar ligação" button in setup. */
export async function checkProxy(ai: AiSettings): Promise<ProxyHealth> {
  if (!ai.serverUrl) throw new ScanError('Introduza o endereço do servidor.', false);
  let res: Response;
  try {
    res = await fetch(`${ai.serverUrl}/health`, {
      headers: proxyHeaders(ai),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new ScanError('Sem ligação ao servidor. Confirme que está ligado e que o endereço está correto.');
  }
  if (res.status === 401) {
    throw new ScanError('O servidor rejeitou o token.', false);
  }
  let body: Partial<ProxyHealth>;
  try {
    body = (await res.json()) as Partial<ProxyHealth>;
  } catch {
    throw new ScanError(`Este endereço não parece ser o servidor do POC (resposta ${res.status}).`, false);
  }
  if (!res.ok || body.ok !== true) {
    throw new ScanError(`O servidor respondeu com erro (${res.status}).`);
  }
  return {
    ok: true,
    provider: body.provider ?? '',
    model: body.model ?? '',
    requiresToken: Boolean(body.requiresToken),
    allowedOrigins: Array.isArray(body.allowedOrigins) ? body.allowedOrigins : [],
  };
}
