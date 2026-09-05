#!/usr/bin/env node
/**
 * Local recognition proxy for testers who don't have their own API key.
 *
 * Run it on a laptop, expose it with ngrok, and paste the ngrok URL in the
 * app's setup screen (Reconhecimento por IA → Servidor). The API key stays
 * here, in the environment; the phone only ever sees this server.
 *
 *   ANTHROPIC_API_KEY=sk-ant-… npm run server
 *   ngrok http 8787
 *
 * Environment:
 *   ANTHROPIC_API_KEY   use Anthropic (Claude)                 — one of the two keys is required
 *   GOOGLE_API_KEY      use Google AI Studio (Gemini)
 *   AI_PROVIDER         "anthropic" | "google" — only needed when both keys are set
 *   GOOGLE_MODEL        Gemini model name (default: gemini-2.5-flash)
 *   PROXY_TOKEN         optional shared secret; the app sends it as "Authorization: Bearer …"
 *   PORT                listen port (default 8787)
 *
 * Endpoints:
 *   GET  /health  → { ok, provider, model, requiresToken }
 *   POST /scan    ← { image: <base64>, mediaType: "image/jpeg", purpose: "coupon" | "card" }
 *                 → the raw extraction JSON (same shape as the in-browser providers)
 *                 ✗ { error: { code, detail } } with a matching HTTP status
 */

import { createServer } from 'node:http';
import {
  ANTHROPIC_MODEL,
  callAnthropic,
  callGemini,
  DEFAULT_GOOGLE_MODEL,
  ProviderError,
} from '../src/lib/scan-core.mjs';

const PORT = Number(process.env.PORT) || 8787;
const TOKEN = (process.env.PROXY_TOKEN ?? '').trim();
const ANTHROPIC_KEY = (process.env.ANTHROPIC_API_KEY ?? '').trim();
const GOOGLE_KEY = (process.env.GOOGLE_API_KEY ?? '').trim();
const GOOGLE_MODEL = (process.env.GOOGLE_MODEL ?? '').trim() || DEFAULT_GOOGLE_MODEL;

/** Base64 JPEG of a ~1.5k px photo is ~0.5–1 MB; leave headroom. */
const MAX_BODY_BYTES = 12 * 1024 * 1024;
const MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function pickProvider() {
  const wanted = (process.env.AI_PROVIDER ?? '').trim().toLowerCase();
  if (wanted === 'google') return GOOGLE_KEY ? 'google' : null;
  if (wanted === 'anthropic') return ANTHROPIC_KEY ? 'anthropic' : null;
  if (ANTHROPIC_KEY) return 'anthropic';
  if (GOOGLE_KEY) return 'google';
  return null;
}

const PROVIDER = pickProvider();
const MODEL = PROVIDER === 'google' ? GOOGLE_MODEL : ANTHROPIC_MODEL;

/** HTTP status for each ProviderError code (the code itself is forwarded too). */
const STATUS_FOR_CODE = {
  invalid_key: 502,
  forbidden: 502,
  model_not_found: 502,
  rate_limit: 429,
  network: 504,
  refused: 422,
  truncated: 502,
  bad_response: 502,
  provider_error: 502,
  not_configured: 503,
};

const CORS_HEADERS = {
  // The PWA is served from a different origin (GitHub Pages / localhost),
  // and the ngrok hostname changes on every restart — so allow any origin.
  // Authentication, when wanted, is the Bearer token, not the origin.
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, ngrok-skip-browser-warning',
  'Access-Control-Max-Age': '86400',
};

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    ...CORS_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
    'Cache-Control': 'no-store',
  });
  res.end(json);
}

function sendError(res, status, code, detail = '') {
  send(res, status, { error: { code, detail } });
}

function authorised(req) {
  if (!TOKEN) return true;
  const header = req.headers.authorization ?? '';
  return header === `Bearer ${TOKEN}`;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('payload too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(Object.assign(new Error('invalid JSON'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

async function handleScan(req, res) {
  if (!PROVIDER) return sendError(res, 503, 'not_configured', 'set ANTHROPIC_API_KEY or GOOGLE_API_KEY');

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    return sendError(res, error.status ?? 400, 'bad_request', error.message);
  }

  const image = typeof body?.image === 'string' ? body.image : '';
  const mediaType = typeof body?.mediaType === 'string' ? body.mediaType : 'image/jpeg';
  const purpose = body?.purpose === 'card' ? 'card' : 'coupon';
  if (!image || image.length < 100) return sendError(res, 400, 'bad_request', 'missing image');
  if (!MEDIA_TYPES.has(mediaType)) return sendError(res, 400, 'bad_request', `unsupported mediaType ${mediaType}`);

  const started = Date.now();
  try {
    const result =
      PROVIDER === 'google'
        ? await callGemini({ data: image, mediaType }, GOOGLE_KEY, GOOGLE_MODEL, purpose)
        : await callAnthropic({ data: image, mediaType }, ANTHROPIC_KEY, purpose);
    const found = Array.isArray(result?.codes) ? result.codes.length : 0;
    console.log(`[scan] ${purpose} via ${PROVIDER}/${MODEL}: ${found} code(s) in ${Date.now() - started} ms`);
    return send(res, 200, result);
  } catch (error) {
    if (error instanceof ProviderError) {
      console.warn(`[scan] ${PROVIDER} failed: ${error.message}`);
      return sendError(res, STATUS_FOR_CODE[error.code] ?? 502, error.code, error.detail);
    }
    console.error('[scan] unexpected error', error);
    return sendError(res, 500, 'provider_error', 'unexpected server error');
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    return res.end();
  }

  if (url.pathname === '/health' && req.method === 'GET') {
    if (!authorised(req)) return sendError(res, 401, 'unauthorised');
    return send(res, 200, { ok: true, provider: PROVIDER ?? 'none', model: MODEL, requiresToken: Boolean(TOKEN) });
  }

  if (url.pathname === '/scan' && req.method === 'POST') {
    if (!authorised(req)) return sendError(res, 401, 'unauthorised');
    return handleScan(req, res);
  }

  return sendError(res, 404, 'not_found');
});

server.listen(PORT, () => {
  console.log(`Recognition proxy listening on http://localhost:${PORT}`);
  if (PROVIDER) {
    console.log(`Provider: ${PROVIDER} (${MODEL})`);
  } else {
    console.warn('No API key configured — set ANTHROPIC_API_KEY or GOOGLE_API_KEY. /scan will return 503.');
  }
  console.log(TOKEN ? 'Token: required (PROXY_TOKEN set)' : 'Token: none (PROXY_TOKEN not set — anyone with the URL can use your key)');
  console.log(`Expose it with:  ngrok http ${PORT}`);
});
