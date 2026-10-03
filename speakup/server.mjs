import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.md': 'text/plain; charset=utf-8',
};
const recentRequests = new Map();

function reply(res, status, obj) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(obj));
}
function withinRateLimit(req) {
  const now = Date.now();
  const key = req.socket.remoteAddress || 'local';
  const timestamps = (recentRequests.get(key) || []).filter((time) => now - time < 60_000);
  if (timestamps.length >= 20) {
    recentRequests.set(key, timestamps);
    return false;
  }
  timestamps.push(now);
  recentRequests.set(key, timestamps);
  return true;
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://local');

    if (url.pathname === '/api/status' && req.method === 'GET') {
      return reply(res, 200, { configured: Boolean(process.env.GEMINI_API_KEY) });
    }

    if (url.pathname === '/api/gemini') {
      if (req.method !== 'POST') return reply(res, 405, { error: 'Method not allowed.' });
      if (!withinRateLimit(req)) return reply(res, 429, { error: 'This app is sending requests too quickly. Please wait a minute and try again.' });
      let raw = '';
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 12 * 1024 * 1024) return reply(res, 413, { error: 'Recording is too large. Keep spoken turns under 55 seconds.' });
        raw += chunk;
      }
      let request;
      try { request = JSON.parse(raw); }
      catch { return reply(res, 400, { error: 'Invalid request body.' }); }
      if (!request || typeof request !== 'object' || Array.isArray(request)) return reply(res, 400, { error: 'Invalid request body.' });
      const key = typeof request.key === 'string' ? request.key.trim() : '';
      const model = typeof request.model === 'string' ? request.model : '';
      const body = request.body;
      const apiKey = process.env.GEMINI_API_KEY || key;
      if (!apiKey) return reply(res, 401, { error: 'Add a Gemini API key in Settings, or configure a private server key.' });
      if (apiKey.length > 300) return reply(res, 400, { error: 'Invalid API key.' });
      if (!/^gemini-[a-z0-9.-]+$/.test(model)) return reply(res, 400, { error: 'Invalid Gemini model name.' });
      if (!body || typeof body !== 'object' || !Array.isArray(body.contents)) return reply(res, 400, { error: 'Invalid Gemini request.' });

      const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      });
      const data = await upstream.json();
      return reply(res, upstream.status, data);
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') return reply(res, 405, { error: 'Method not allowed.' });
    const requested = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const filename = path.resolve(root, `.${requested}`);
    if (!filename.startsWith(`${root}${path.sep}`) || filename.endsWith(`${path.sep}server.mjs`) || filename.includes(`${path.sep}.`)) {
      return reply(res, 403, { error: 'Forbidden.' });
    }
    const file = await fs.readFile(filename);
    res.writeHead(200, {
      'Content-Type': types[path.extname(filename)] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Cache-Control': 'no-cache',
      'Permissions-Policy': 'microphone=(self), autoplay=(self)',
    });
    if (req.method === 'HEAD') return res.end();
    return res.end(file);
  } catch (error) {
    const status = error?.code === 'ENOENT' ? 404 : 500;
    const message = error?.name === 'TimeoutError' ? 'Gemini took too long. Please try again.' : 'Request failed. Please try again.';
    return reply(res, status, { error: message });
  }
}).listen(port, '0.0.0.0', () => console.log(`SpeakUp running on 0.0.0.0:${port}`));
