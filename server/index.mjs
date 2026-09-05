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
 * Environment (or a server/.env file — see server/.env.example; real env vars win):
 *   ANTHROPIC_API_KEY   use Anthropic (Claude)                 — one of the two keys is required
 *   GOOGLE_API_KEY      use Google AI Studio (Gemini)
 *   AI_PROVIDER         "anthropic" | "google" — only needed when both keys are set
 *   GOOGLE_MODEL        Gemini model name (default: gemini-2.5-flash)
 *   ALLOWED_ORIGINS     comma-separated browser origins allowed to call /scan
 *                       (default: the GitHub Pages site + localhost dev servers; "*" = any)
 *   PROXY_TOKEN         optional shared secret on top of the origin check
 *   PORT                listen port (default 8787)
 *
 * Endpoints:
 *   GET  /health  → { ok, provider, model, requiresToken }
 *   POST /scan    ← { image: <base64>, mediaType: "image/jpeg", purpose: "coupon" | "card" }
 *                 → the raw extraction JSON (same shape as the in-browser providers)
 *                 ✗ { error: { code, detail } } with a matching HTTP status
 */

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ANTHROPIC_MODEL,
  callAnthropic,
  callGemini,
  DEFAULT_GOOGLE_MODEL,
  ProviderError,
} from '../src/lib/scan-core.mjs';

/**
 * Load server/.env if present (KEY=value lines, # comments, optional quotes).
 * Lets Windows/PowerShell users avoid shell-specific env syntax. Variables
 * already set in the real environment take precedence.
 */
function loadDotEnv() {
  const file = join(dirname(fileURLToPath(import.meta.url)), '.env');
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return false;
  }
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
  return true;
}
const DOTENV_LOADED = loadDotEnv();

const PORT = Number(process.env.PORT) || 8787;
const TOKEN = (process.env.PROXY_TOKEN ?? '').trim();

/**
 * Browser origins allowed to spend the key. The deployed PWA plus the local
 * dev servers. This is a browser-side guard only: it stops other websites
 * from calling the proxy from a visitor's browser, not a script with curl —
 * set PROXY_TOKEN as well when that matters.
 */
const DEFAULT_ALLOWED_ORIGINS = [
  'https://anton-avramenko.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);
const ORIGINS = ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : DEFAULT_ALLOWED_ORIGINS;
const ANY_ORIGIN = ORIGINS.includes('*');

/** @param {string | undefined} origin */
function originAllowed(origin) {
  if (ANY_ORIGIN) return true;
  return Boolean(origin) && ORIGINS.includes(origin.replace(/\/+$/, ''));
}
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

/** CORS headers for an allowed origin (echoed, never "*", unless configured so). */
function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': ANY_ORIGIN ? '*' : origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, ngrok-skip-browser-warning',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function send(req, res, status, body) {
  const origin = req.headers.origin;
  const json = JSON.stringify(body);
  res.writeHead(status, {
    ...(originAllowed(origin) ? corsHeaders(origin) : { Vary: 'Origin' }),
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
    'Cache-Control': 'no-store',
  });
  res.end(json);
}

function sendError(req, res, status, code, detail = '') {
  send(req, res, status, { error: { code, detail } });
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
  if (!PROVIDER) return sendError(req, res, 503, 'not_configured', 'set ANTHROPIC_API_KEY or GOOGLE_API_KEY');

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    return sendError(req, res, error.status ?? 400, 'bad_request', error.message);
  }

  const image = typeof body?.image === 'string' ? body.image : '';
  const mediaType = typeof body?.mediaType === 'string' ? body.mediaType : 'image/jpeg';
  const purpose = body?.purpose === 'card' ? 'card' : 'coupon';
  if (!image || image.length < 100) return sendError(req, res, 400, 'bad_request', 'missing image');
  if (!MEDIA_TYPES.has(mediaType)) return sendError(req, res, 400, 'bad_request', `unsupported mediaType ${mediaType}`);

  const started = Date.now();
  try {
    const result =
      PROVIDER === 'google'
        ? await callGemini({ data: image, mediaType }, GOOGLE_KEY, GOOGLE_MODEL, purpose)
        : await callAnthropic({ data: image, mediaType }, ANTHROPIC_KEY, purpose);
    const found = Array.isArray(result?.codes) ? result.codes.length : 0;
    console.log(`[scan] ${purpose} via ${PROVIDER}/${MODEL}: ${found} code(s) in ${Date.now() - started} ms`);
    return send(req, res, 200, result);
  } catch (error) {
    if (error instanceof ProviderError) {
      console.warn(`[scan] ${PROVIDER} failed: ${error.message}`);
      return sendError(req, res, STATUS_FOR_CODE[error.code] ?? 502, error.code, error.detail);
    }
    console.error('[scan] unexpected error', error);
    return sendError(req, res, 500, 'provider_error', 'unexpected server error');
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const origin = req.headers.origin;

  if (req.method === 'OPTIONS') {
    if (!originAllowed(origin)) {
      // No CORS headers → the browser refuses to send the real request.
      res.writeHead(403, { Vary: 'Origin' });
      return res.end();
    }
    res.writeHead(204, corsHeaders(origin));
    return res.end();
  }

  if (url.pathname === '/health' && req.method === 'GET') {
    // Health is harmless (no key spent) — answer curl/PowerShell checks too,
    // but browsers from other origins still get no CORS headers.
    if (!authorised(req)) return sendError(req, res, 401, 'unauthorised');
    return send(req, res, 200, {
      ok: true,
      provider: PROVIDER ?? 'none',
      model: MODEL,
      requiresToken: Boolean(TOKEN),
      allowedOrigins: ANY_ORIGIN ? ['*'] : ORIGINS,
    });
  }

  if (url.pathname === '/scan' && req.method === 'POST') {
    // /scan spends the key: require a whitelisted Origin (unless "*"),
    // then the token when one is configured.
    if (!originAllowed(origin)) {
      console.warn(`[scan] rejected origin ${origin ?? '(none)'}`);
      return sendError(req, res, 403, 'origin_not_allowed', origin ?? 'missing Origin header');
    }
    if (!authorised(req)) return sendError(req, res, 401, 'unauthorised');
    return handleScan(req, res);
  }

  return sendError(req, res, 404, 'not_found');
});

server.listen(PORT, () => {
  console.log(`Recognition proxy listening on http://localhost:${PORT}`);
  if (DOTENV_LOADED) console.log('Loaded settings from server/.env');
  if (PROVIDER) {
    console.log(`Provider: ${PROVIDER} (${MODEL})`);
  } else {
    console.warn('No API key configured — set ANTHROPIC_API_KEY or GOOGLE_API_KEY (env or server/.env). /scan will return 503.');
  }
  console.log(`Allowed origins: ${ANY_ORIGIN ? 'any (*)' : ORIGINS.join(', ')}`);
  console.log(
    TOKEN
      ? 'Token: required (PROXY_TOKEN set)'
      : `Token: none — only the origin check above protects the key${ANY_ORIGIN ? ' (and it is disabled!)' : ''}`
  );
  console.log(`Expose it with:  ngrok http ${PORT}`);
});
