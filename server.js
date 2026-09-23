'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { fetchTelegramPost, TelegramParserError } = require('./js/telegram-parser.js');

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT) || 3000;
const PROJECT_ROOT = __dirname;
const ALLOWED_ROLES = new Set(['root', 'admin', 'media_editor']);
const CONTENT_TYPES = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.dds':'application/octet-stream' };

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':'*',
    'Access-Control-Allow-Headers':'Content-Type, X-CS2-Role, X-CS2-User',
    'Access-Control-Allow-Methods':'GET, POST, OPTIONS'
  };
}

function sendJson(response, status, body) {
  response.writeHead(status, { ...corsHeaders(), 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store' });
  response.end(JSON.stringify(body));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 20_000) request.destroy(new Error('Payload too large'));
    });
    request.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch (error) { reject(error); }
    });
    request.on('error', reject);
  });
}

async function parseTelegramRoute(request, response) {
  const role = String(request.headers['x-cs2-role'] || '');
  const user = String(request.headers['x-cs2-user'] || '');
  if (!user || !ALLOWED_ROLES.has(role)) return sendJson(response, 403, { error:'ACCESS_DENIED', message:'Доступ запрещён' });

  try {
    const { url } = await readJson(request);
    const post = await fetchTelegramPost(url);
    return sendJson(response, 200, post);
  } catch (error) {
    if (error instanceof TelegramParserError) {
      const status = error.code === 'INVALID_URL' ? 400 : error.code === 'NETWORK_ERROR' ? 502 : 404;
      return sendJson(response, status, { error:error.code, message:error.message });
    }
    console.error('Telegram parser error:', error);
    return sendJson(response, 500, { error:'UNKNOWN_ERROR', message:'Не удалось загрузить пост. Возможно, канал приватный или у него отключено превью' });
  }
}

function serveStatic(request, response) {
  const requestPath = decodeURIComponent(new URL(request.url, `http://${HOST}`).pathname);
  const relativePath = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
  const filePath = path.resolve(PROJECT_ROOT, relativePath);
  const relative = path.relative(PROJECT_ROOT, filePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return sendJson(response, 403, { message:'Доступ запрещён' });

  fs.readFile(filePath, (error, content) => {
    if (error) return sendJson(response, error.code === 'ENOENT' ? 404 : 500, { message:'Файл не найден' });
    response.writeHead(200, { 'Content-Type':CONTENT_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
    response.end(content);
  });
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, corsHeaders());
    return response.end();
  }
  if (request.method === 'POST' && request.url === '/api/telegram/parse') return parseTelegramRoute(request, response);
  if (request.method === 'GET' || request.method === 'HEAD') return serveStatic(request, response);
  return sendJson(response, 405, { message:'Метод не поддерживается' });
});

if (require.main === module) {
  server.listen(PORT, HOST, () => console.log(`CS2 dashboard: http://${HOST}:${PORT}`));
}

module.exports = { server };
