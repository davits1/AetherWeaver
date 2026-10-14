// proxy.mjs — AetherWeaver local server + hardened API proxy (zero dependencies, Node 18+)
//
// Run:   node proxy.mjs
// Open:  http://127.0.0.1:8787/
//
// Environment (process env wins over a local .env file next to this script):
//   NOVELAI_TOKEN   Persistent NovelAI API token (injected server-side; never sent to the browser)
//   HOST            Bind address (default 127.0.0.1). Use your Tailscale IP (100.x.y.z) or
//                   LAN IP (192.168.x.y) — or 0.0.0.0 for all interfaces — to reach it from a phone.
//                   WARNING: anyone who can reach that address can spend your NovelAI quota.
//                   Prefer a Tailscale IP over 0.0.0.0 on shared networks.
//   PORT            Port (default 8787)
//   LOCAL_LLM_URL   Optional base URL of a local OpenAI-compatible server (e.g. http://127.0.0.1:5001/v1)
//
// Routes:
//   GET  /proxy/health          -> { ok, tokenConfigured, localLlmConfigured }
//   ANY  /proxy/text/<path>     -> https://text.novelai.net/<path>
//   ANY  /proxy/image/<path>    -> https://image.novelai.net/<path>
//   ANY  /proxy/api/<path>      -> https://api.novelai.net/<path>
//   ANY  /proxy/local/<path>    -> LOCAL_LLM_URL/<path>   (only when LOCAL_LLM_URL is set)
//   anything else under /proxy/ -> 403
//   everything else             -> static app files from this folder (dotfiles never served)

import http from 'node:http';
import os from 'node:os';
import { readFileSync, createReadStream, mkdirSync, writeFileSync } from 'node:fs';
import zlib from 'node:zlib';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

/* ---------------------------------------------------------------- env --- */
function loadDotEnv(file) {
  const out = {};
  let raw;
  try { raw = readFileSync(file, 'utf8'); } catch { return out; }
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[m[1]] = val;
  }
  return out;
}
const dotenv = loadDotEnv(path.join(ROOT, '.env'));
const env = (k, d = '') => (process.env[k] ?? dotenv[k] ?? d).toString().trim();

const HOST = env('HOST', '127.0.0.1');
const PORT = parseInt(env('PORT', '8787'), 10) || 8787;
const NOVELAI_TOKEN = env('NOVELAI_TOKEN');
const LOCAL_LLM_URL = env('LOCAL_LLM_URL').replace(/\/+$/, '');
const MAX_BODY_BYTES = 25 * 1024 * 1024; // room for base64 images in a later task

/* ---------------------------------------------------------- allowlist --- */
// Fixed route prefix -> fixed upstream origin. The client can only choose the path.
const ROUTES = {
  text: { base: 'https://text.novelai.net', novelai: true },
  image: { base: 'https://image.novelai.net', novelai: true },
  api: { base: 'https://api.novelai.net', novelai: true }
};
if (LOCAL_LLM_URL) {
  try {
    const u = new URL(LOCAL_LLM_URL);
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      ROUTES.local = { base: LOCAL_LLM_URL, novelai: false };
    }
  } catch {
    console.warn('[proxy] LOCAL_LLM_URL is not a valid URL; /proxy/local disabled.');
  }
}
const ALLOWED_HOSTS = new Set(Object.values(ROUTES).map(r => new URL(r.base).host));

/* ------------------------------------------------------------ helpers --- */
function sendJson(res, status, obj) {
  if (res.headersSent) { res.destroy(); return; }
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY_BYTES) {
      const err = new Error('Request body too large');
      err.status = 413;
      throw err;
    }
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

function log(...args) {
  console.log(new Date().toISOString().slice(11, 19), ...args);
}

function extractPngBuffer(buf) {
  if (!buf || buf.length === 0) return null;

  // Case 1: Already raw PNG (magic bytes: 89 50 4E 47 0D 0A 1A 0A)
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return buf;
  }

  // Case 2: JSON response containing base64 image (NovelAI returns JSON when Accept: application/json is present)
  try {
    const text = buf.toString('utf8');
    if (text.startsWith('{')) {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed.images) && parsed.images[0]?.image) {
        return Buffer.from(parsed.images[0].image, 'base64');
      }
      if (parsed.image && typeof parsed.image === 'string') {
        return Buffer.from(parsed.image, 'base64');
      }
    }
  } catch {}

  // Case 3: ZIP archive (magic bytes: 50 4B 03 04)
  if (buf.length >= 30 && buf.readUInt32LE(0) !== 0x04034b50) {
    const eocdOffset = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (eocdOffset !== -1) {
      const cdOffset = buf.readUInt32LE(eocdOffset + 16);
      if (buf.length >= cdOffset + 46 && buf.readUInt32LE(cdOffset) === 0x02014b50) {
        const method = buf.readUInt16LE(cdOffset + 10);
        const compSize = buf.readUInt32LE(cdOffset + 20);
        const localHeaderOffset = buf.readUInt32LE(cdOffset + 42);

        if (buf.length >= localHeaderOffset + 30) {
          const localNameLen = buf.readUInt16LE(localHeaderOffset + 26);
          const localExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
          const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
          const compData = buf.subarray(dataStart, dataStart + compSize);

          if (method === 0) {
            return compData;
          } else if (method === 8) {
            return zlib.inflateRawSync(compData);
          }
          return compData;
        }
      }
    }
  }

  return buf;
}

/* -------------------------------------------------------------- proxy --- */
async function handleProxy(req, res, url) {
  // /proxy/<route>/<rest...>
  const parts = url.pathname.split('/'); // ['', 'proxy', route, ...rest]
  const routeName = parts[2] || '';

  if (routeName === 'health' && parts.length === 3) {
    return sendJson(res, 200, {
      ok: true,
      tokenConfigured: Boolean(NOVELAI_TOKEN),
      localLlmConfigured: Boolean(ROUTES.local)
    });
  }

  const route = Object.prototype.hasOwnProperty.call(ROUTES, routeName) ? ROUTES[routeName] : null;
  if (!route) return sendJson(res, 403, { error: `Route "/proxy/${routeName}" is not allowed.` });

  if (!['GET', 'POST', 'HEAD'].includes(req.method)) {
    return sendJson(res, 405, { error: `Method ${req.method} not allowed.` });
  }

  // Build target by string concatenation onto the fixed base, then re-verify the host.
  const restPath = '/' + parts.slice(3).join('/');
  const target = new URL(route.base + restPath + url.search);
  if (!ALLOWED_HOSTS.has(target.host) || target.host !== new URL(route.base).host) {
    return sendJson(res, 403, { error: 'Target host not allowed.' });
  }

  // Headers: forward only what upstream needs. Accept is forwarded unchanged.
  const headers = {};
  if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];
  if (req.headers['accept']) headers['Accept'] = req.headers['accept'];

  const clientAuth = req.headers['authorization'];
  if (clientAuth) {
    headers['Authorization'] = clientAuth; // optional per-browser override from Settings
  } else if (route.novelai) {
    if (!NOVELAI_TOKEN) {
      return sendJson(res, 401, {
        error: 'No NovelAI token configured. Set NOVELAI_TOKEN in the environment or .env, or enter a token override in Settings.'
      });
    }
    headers['Authorization'] = `Bearer ${NOVELAI_TOKEN}`;
  }

  const body = (req.method === 'GET' || req.method === 'HEAD') ? undefined : await readBody(req);

  // Abort upstream if the browser goes away (Stop button, tab closed, network drop).
  const upstreamAbort = new AbortController();
  const onClientClose = () => {
    if (!res.writableFinished) upstreamAbort.abort();
  };
  res.on('close', onClientClose);

  const started = Date.now();
  let upstream;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body,
      signal: upstreamAbort.signal,
      redirect: 'manual'
    });
  } catch (err) {
    if (upstreamAbort.signal.aborted) { log(`${req.method} ${url.pathname} client aborted before response`); return; }
    throw err;
  }

  // Intercept NovelAI image generation: unpack the ZIP archive in-memory, save PNG locally, and serve
  if (routeName === 'image' && restPath === '/ai/generate-image' && upstream.status === 200) {
    const chunks = [];
    if (upstream.body) {
      for await (const chunk of upstream.body) {
        chunks.push(chunk);
      }
    }
    const rawZip = Buffer.concat(chunks);
    const pngBuf = extractPngBuffer(rawZip);
    const filename = `nai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
    const genDir = path.join(ROOT, 'generated_images');
    try { mkdirSync(genDir, { recursive: true }); } catch {}
    writeFileSync(path.join(genDir, filename), pngBuf);

    const wantsJson = (req.headers['accept'] || '').includes('application/json') ||
                      (req.headers['x-return-format'] === 'json');
    if (wantsJson) {
      log(`${req.method} ${url.pathname} -> 200 saved /generated_images/${filename} (${pngBuf.length}B) in ${Date.now() - started}ms`);
      return sendJson(res, 200, {
        ok: true,
        url: `/generated_images/${filename}`,
        filename,
        size: pngBuf.length
      });
    }

    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': pngBuf.length,
      'X-Image-Url': `/generated_images/${filename}`,
      'Cache-Control': 'public, max-age=31536000, immutable'
    });
    res.end(pngBuf);
    log(`${req.method} ${url.pathname} -> 200 saved /generated_images/${filename} (${pngBuf.length}B) in ${Date.now() - started}ms`);
    return;
  }

  // Pass through status + content-type. Node's fetch already decoded any gzip/br body,
  // so content-encoding/content-length must NOT be forwarded.
  const outHeaders = {
    'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
    'Cache-Control': 'no-store',
    'X-Accel-Buffering': 'no'
  };
  res.writeHead(upstream.status, outHeaders);
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  let bytes = 0;
  try {
    if (upstream.body && req.method !== 'HEAD') {
      for await (const chunk of upstream.body) {
        bytes += chunk.length;
        if (!res.write(chunk)) {
          await new Promise((resolve) => {
            const done = () => { res.off('drain', done); res.off('close', done); resolve(); };
            res.on('drain', done);
            res.on('close', done);
          });
        }
        if (res.destroyed) break;
      }
    }
    res.end();
    log(`${req.method} ${url.pathname} -> ${upstream.status} ${bytes}B ${Date.now() - started}ms`);
  } catch (err) {
    if (upstreamAbort.signal.aborted) {
      log(`${req.method} ${url.pathname} -> ${upstream.status} client aborted after ${bytes}B`);
      return;
    }
    // Headers are already sent; the only honest signal left is to cut the connection.
    log(`${req.method} ${url.pathname} stream error: ${err.message}`);
    res.destroy(err);
  } finally {
    res.off('close', onClientClose);
  }
}

/* ------------------------------------------------------------- static --- */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

async function handleStatic(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }
  let rel;
  try { rel = decodeURIComponent(url.pathname); } catch { return sendJson(res, 400, { error: 'Bad path.' }); }
  if (rel === '/' || rel === '') rel = '/index.html';

  const segments = rel.split('/').filter(Boolean);
  if (segments.some(s => s.startsWith('.') || s.includes('\\') || s.includes('\0'))) {
    return sendJson(res, 404, { error: 'Not found.' }); // never serve .env, .git, ..
  }
  const ext = path.extname(rel).toLowerCase();
  if (!MIME[ext]) return sendJson(res, 404, { error: 'Not found.' });

  const filePath = path.resolve(ROOT, ...segments);
  if (!filePath.startsWith(ROOT + path.sep)) return sendJson(res, 404, { error: 'Not found.' });

  let info;
  try { info = await stat(filePath); } catch { return sendJson(res, 404, { error: 'Not found.' }); }
  if (!info.isFile()) return sendJson(res, 404, { error: 'Not found.' });

  res.writeHead(200, {
    'Content-Type': MIME[ext],
    'Content-Length': info.size,
    'Access-Control-Allow-Origin': '*',
    // App files change often during development; always revalidate.
    'Cache-Control': ext === '.png' ? 'public, max-age=31536000, immutable' : 'no-cache'
  });
  if (req.method === 'HEAD') return res.end();
  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on('error', reject);
    stream.on('end', () => {
      log(`${req.method} ${url.pathname} -> 200 ${info.size}B`);
      resolve();
    });
    res.on('close', () => { stream.destroy(); resolve(); });
    stream.pipe(res);
  });
}

/* ------------------------------------------------------------- server --- */
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    if (url.pathname === '/proxy' || url.pathname.startsWith('/proxy/')) {
      await handleProxy(req, res, url);
    } else {
      await handleStatic(req, res, url);
    }
  } catch (err) {
    const status = err && err.status === 413 ? 413 : 502;
    log(`${req.method} ${req.url} failed: ${err && err.message}`);
    try {
      sendJson(res, status, { error: status === 413 ? 'Request body too large.' : `Proxy error: ${err && err.message ? err.message : 'unknown'}` });
    } catch {
      res.destroy();
    }
  }
});

server.on('clientError', (err, socket) => {
  try { socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'); } catch { /* ignore */ }
});

server.listen(PORT, HOST, () => {
  console.log(`AetherWeaver proxy listening on http://${HOST.includes(':') ? `[${HOST}]` : HOST}:${PORT}/`);
  console.log(`  NovelAI token: ${NOVELAI_TOKEN ? 'configured' : 'NOT configured (set NOVELAI_TOKEN or use a Settings override)'}`);
  console.log(`  Local LLM route: ${ROUTES.local ? 'enabled' : 'disabled'}`);
  if (HOST === '0.0.0.0' || HOST === '::') {
    const addrs = Object.values(os.networkInterfaces()).flat()
      .filter(a => a && a.family === 'IPv4' && !a.internal)
      .map(a => `http://${a.address}:${PORT}/`);
    if (addrs.length) console.log('  Reachable at:', addrs.join('  '));
    console.log('  WARNING: bound to all interfaces; anyone on these networks can use your NovelAI token.');
  }
});