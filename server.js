'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const dns = require('node:dns').promises;
const net = require('node:net');
const { pipeline } = require('node:stream/promises');
const { Transform } = require('node:stream');
const { Worker } = require('node:worker_threads');
const unzipper = require('unzipper');
const { fetchTelegramPost, TelegramParserError } = require('./js/telegram-parser.js');
const matchCatalog = require('./js/data/hltv-match-data.js');
const { getMatchAnalytics } = require('./lib/analytics.js');

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT) || 3000;
const PROJECT_ROOT = __dirname;
const ALLOWED_ROLES = new Set(['root', 'admin', 'media_editor']);
const DEMO_ROLES = new Set(['root', 'admin']);
const DEMO_DATA_DIR = path.join(PROJECT_ROOT, '.private-data', 'demos');
const PLAYERS_DATA_FILE = path.join(PROJECT_ROOT, '.private-data', 'players.json');
const MAX_DEMO_BYTES = 1024 * 1024 * 1024;
const MAX_DEMO_ARCHIVE_BYTES = 5 * 1024 * 1024 * 1024;
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

function readJson(request, maxBytes = 20_000) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body, 'utf8') > maxBytes) request.destroy(new Error('Payload too large'));
    });
    request.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch (error) { reject(error); }
    });
    request.on('error', reject);
  });
}

function authorizedPlayerEditor(request) {
  return ALLOWED_ROLES.has(String(request.headers['x-cs2-role'] || '')) && Boolean(String(request.headers['x-cs2-user'] || ''));
}

async function readPlayerDatabase() {
  try {
    const value = JSON.parse(await fs.promises.readFile(PLAYERS_DATA_FILE, 'utf8'));
    return Array.isArray(value) ? value : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function getPlayersRoute(response) {
  try { return sendJson(response, 200, { players:await readPlayerDatabase() }); }
  catch (error) { console.error('Players database read error:', error); return sendJson(response, 500, { message:'Не удалось прочитать базу игроков' }); }
}

async function savePlayersRoute(request, response) {
  if (!authorizedPlayerEditor(request)) return sendJson(response, 403, { message:'Доступ запрещён' });
  try {
    const payload = await readJson(request, 5 * 1024 * 1024);
    const incoming = payload.players;
    if (!Array.isArray(incoming) || incoming.length > 10_000 || incoming.some((player) => !player || typeof player.id !== 'string' || !player.id || typeof player.nickname !== 'string' || !player.nickname.trim() || (player.steamId != null && typeof player.steamId !== 'string'))) {
      return sendJson(response, 400, { message:'Ожидался массив игроков с id, nickname и строковым SteamID' });
    }
    const current = await readPlayerDatabase();
    const merged = new Map(current.map((player) => [player.id, player]));
    const role = String(request.headers['x-cs2-role'] || '');
    incoming.forEach((player) => {
      const old = merged.get(player.id);
      if (role === 'media_editor' && old) {
        // Редактор медиа может менять привязки и обогащение, но не основной профиль.
        merged.set(player.id, { ...old, steamId:player.steamId ?? null, steamAvatarUrl:player.steamAvatarUrl || old.steamAvatarUrl || null,
          hltvId:player.hltvId || old.hltvId || null, hltvStats:player.hltvStats || old.hltvStats || null,
          hltvProfileUrl:player.hltvProfileUrl || old.hltvProfileUrl || null, faceitProfileUrl:player.faceitProfileUrl || old.faceitProfileUrl || null,
          steamProfileUrl:player.steamProfileUrl || old.steamProfileUrl || null });
      } else if (role !== 'media_editor') merged.set(player.id, player);
    });
    const saved = [...merged.values()];
    await fs.promises.mkdir(path.dirname(PLAYERS_DATA_FILE), { recursive:true });
    const temporary = `${PLAYERS_DATA_FILE}.${process.pid}.tmp`;
    await fs.promises.writeFile(temporary, JSON.stringify(saved, null, 2), 'utf8');
    await fs.promises.rename(temporary, PLAYERS_DATA_FILE);
    return sendJson(response, 200, { saved:saved.length });
  } catch (error) {
    console.error('Players database save error:', error);
    return sendJson(response, error.message === 'Payload too large' ? 413 : 400, { message:error.message === 'Payload too large' ? 'Файл базы игроков слишком большой' : 'Не удалось сохранить базу игроков' });
  }
}

function authorizedDemoAdmin(request) {
  return DEMO_ROLES.has(String(request.headers['x-cs2-role'] || '')) && Boolean(String(request.headers['x-cs2-user'] || ''));
}

function safeMatchId(value) {
  const id = String(value || '');
  return /^\d{1,20}$/.test(id) ? id : null;
}

async function writeBoundedStream(readable, targetPath, maxBytes = MAX_DEMO_BYTES) {
  let size = 0;
  const limiter = new Transform({
    transform(chunk, encoding, callback) {
      size += chunk.length;
      callback(size > maxBytes ? new Error('Файл демо превышает ограничение 1 ГБ') : null, chunk);
    }
  });
  await pipeline(readable, limiter, fs.createWriteStream(targetPath, { flags:'wx' }));
  return size;
}

function isPublicIp(address) {
  if (net.isIP(address) === 4) {
    const octets = address.split('.').map(Number);
    return !(octets[0] === 10 || octets[0] === 127 || octets[0] === 0 || octets[0] >= 224
      || (octets[0] === 169 && octets[1] === 254) || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
      || (octets[0] === 192 && octets[1] === 168) || (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127));
  }
  if (net.isIP(address) === 6) {
    const normalized = address.toLowerCase();
    // Разрешаем только глобальные IPv6 unicast адреса (2000::/3).
    // Loopback, unspecified, ULA, link-local и IPv4-mapped адреса сюда не входят.
    if (normalized.includes(':') && normalized.startsWith('::ffff:')) return false;
    const first = Number.parseInt(normalized.split(':')[0] || '0', 16);
    return first >= 0x2000 && first <= 0x3fff;
  }
  return false;
}

async function validatePublicUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Укажите корректную ссылку на .dem или .zip'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Поддерживаются только публичные HTTPS-ссылки на демо');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host)) {
    if (!isPublicIp(host)) throw new Error('Ссылка должна вести на публичный сервер');
  } else {
    const records = await dns.lookup(host, { all:true, verbatim:true }).catch(() => []);
    if (!records.length || records.some((record) => !isPublicIp(record.address))) throw new Error('Ссылка должна вести на публичный сервер');
  }
  return url;
}

async function downloadDemoUrl(value, targetPath, maxBytes = MAX_DEMO_ARCHIVE_BYTES) {
  let url = await validatePublicUrl(value);
  for (let redirect = 0; redirect <= 5; redirect += 1) {
    // Не следуем редиректу до повторной проверки домена и его публичного IP.
    const response = await fetch(url, { redirect:'manual', signal:AbortSignal.timeout(120_000) });
    if ([301,302,303,307,308].includes(response.status)) {
      if (redirect === 5) throw new Error('Слишком много перенаправлений у ссылки на демо');
      const location = response.headers.get('location');
      if (!location) throw new Error('Некорректное перенаправление при скачивании демо');
      url = await validatePublicUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok || !response.body) throw new Error(`Сервер демо ответил ${response.status}`);
    await writeBoundedStream(response.body, targetPath, maxBytes);
    return;
  }
}

async function extractDemoFiles(sourcePath, tempDir) {
  if (sourcePath.toLowerCase().endsWith('.dem')) return [sourcePath];
  const directory = await unzipper.Open.file(sourcePath);
  const entries = directory.files.filter((entry) => entry.type === 'File' && path.extname(entry.path).toLowerCase() === '.dem');
  if (!entries.length) throw new Error('В ZIP архиве не найден файл .dem');
  if (entries.length > 5) throw new Error('В ZIP архиве больше пяти демо. Разделите их на несколько загрузок');
  const extracted = [];
  const totalUncompressed = entries.reduce((sum, entry) => sum + entry.uncompressedSize, 0);
  if (totalUncompressed > MAX_DEMO_ARCHIVE_BYTES) throw new Error('Распакованный ZIP архив превышает ограничение 5 ГБ');
  let totalExtracted = 0;
  for (const [index, entry] of entries.entries()) {
    if (entry.uncompressedSize > MAX_DEMO_BYTES || entry.uncompressedSize > Math.max(32 * 1024 * 1024, entry.compressedSize * 80)) {
      throw new Error('В архиве найдено демо с небезопасным размером распаковки');
    }
    const target = path.join(tempDir, `demo-${index}.dem`);
    const written = await writeBoundedStream(entry.stream(), target, MAX_DEMO_ARCHIVE_BYTES - totalExtracted);
    totalExtracted += written;
    extracted.push(target);
  }
  return extracted;
}

function mergeParsedMaps(parsedDemos, matchId) {
  const maps = Object.create(null);
  parsedDemos.forEach((parsed) => {
    const previous = maps[parsed.mapName];
    if (!previous) maps[parsed.mapName] = parsed;
    else {
      const offset = previous.rounds.length;
      maps[parsed.mapName] = {
        ...parsed,
        rounds:[...previous.rounds, ...parsed.rounds.map((round) => ({ ...round, number:round.number + offset, events:round.events.map((event) => ({ ...event, roundNumber:event.roundNumber + offset })) }))],
        stats:Object.fromEntries([...new Set([...Object.keys(previous.stats), ...Object.keys(parsed.stats)])].map((name) => {
          const a = previous.stats[name] || { kills:0, deaths:0, assists:0, damage:0, adr:0 };
          const b = parsed.stats[name] || { kills:0, deaths:0, assists:0, damage:0, adr:0 };
          return [name, { kills:a.kills + b.kills, deaths:a.deaths + b.deaths, assists:a.assists + b.assists, damage:a.damage + b.damage, adr:Number(((a.damage + b.damage) / Math.max(1, previous.rounds.length + parsed.rounds.length)).toFixed(1)), rating:null }];
        }))
      };
    }
  });
  return { matchId, importedAt:new Date().toISOString(), maps };
}

// Привязывает результат к карте матча, сохраняя настоящую карту из заголовка демо.
function applyMatchMapSelection(parsed, matchId, targetMap) {
  const match = matchCatalog.matches.find((entry) => entry.id === String(matchId));
  if (!match) throw new Error('Выбранный матч не найден в каталоге сайта');
  const scheduledMaps = (match.maps || []).map(([name]) => name).filter((name) => name && name !== 'TBA');
  const canonical = (name) => scheduledMaps.find((candidate) => candidate.toLowerCase() === String(name).toLowerCase()) || null;
  const entries = Object.entries(parsed.maps);
  const mapped = Object.create(null);

  if (targetMap === 'all' && scheduledMaps.length) {
    const missing = scheduledMaps.filter((name) => !entries.some(([demoMap]) => demoMap.toLowerCase() === name.toLowerCase()));
    if (missing.length) throw new Error(`В ZIP не найдены демо для всех карт серии. Нет: ${missing.join(', ')}`);
  }

  if (targetMap !== 'auto' && targetMap !== 'all' && entries.length !== 1) {
    throw new Error('Для выбора одной карты загрузите один файл .dem. ZIP с несколькими картами импортируйте в режиме «Все карты»');
  }
  for (const [demoMap, data] of entries) {
    const siteMap = canonical(demoMap);
    if (targetMap === 'all' || targetMap === 'auto') {
      if (scheduledMaps.length && !siteMap) throw new Error(`Карта ${demoMap} из демо не входит в список карт матча. Выберите правильный матч или карту вручную`);
      mapped[siteMap || demoMap] = { ...data, mapName:demoMap };
      continue;
    }
    if (targetMap.toLowerCase() !== demoMap.toLowerCase()) {
      throw new Error(`В демо обнаружена карта ${demoMap}, а выбрана ${targetMap}. Выберите карту, указанную в демо`);
    }
    if (scheduledMaps.length && !canonical(targetMap)) throw new Error(`Карта ${targetMap} отсутствует в выбранной серии`);
    mapped[siteMap || demoMap] = { ...data, mapName:demoMap };
  }
  parsed.maps = mapped;
  return parsed;
}

function parseDemoInWorker(filePath) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(PROJECT_ROOT, 'js', 'demo-worker.js'), { workerData:{ filePath } });
    worker.once('message', (result) => result.error ? reject(new Error(result.error)) : resolve(result.parsed));
    worker.once('error', reject);
    worker.once('exit', (code) => { if (code && code !== 0) reject(new Error(`Демо парсер завершился с кодом ${code}`)); });
  });
}

async function parseDemoImport(request, response, matchId, inputPath, targetMap = 'auto') {
  let tempDir;
  try {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'cs2-demo-'));
    const demoFiles = await extractDemoFiles(inputPath, tempDir);
    const parsedDemos = [];
    for (const filePath of demoFiles) parsedDemos.push(await parseDemoInWorker(filePath));
    const parsed = applyMatchMapSelection(mergeParsedMaps(parsedDemos, matchId), matchId, targetMap);
    if (!Object.keys(parsed.maps).length) throw new Error('В демо не найдены игровые карты');
    await persistDemoMaps(parsed);
    return sendJson(response, 200, { matchId, importedAt:parsed.importedAt, maps:Object.keys(parsed.maps), rounds:Object.values(parsed.maps).reduce((sum, map) => sum + map.rounds.length, 0), grenadePoints:Object.values(parsed.maps).reduce((sum, map) => sum + map.grenadeCount, 0) });
  } catch (error) {
    console.error('Demo import error:', error);
    return sendJson(response, 422, { error:'DEMO_PARSE_FAILED', message:error.message || 'Не удалось разобрать демо' });
  } finally {
    if (tempDir) await fs.promises.rm(tempDir, { recursive:true, force:true });
  }
}

// Храним каждую карту отдельно, чтобы повторные загрузки карты матча дополняли серию.
async function persistDemoMaps(parsed) {
  const matchDir = path.join(DEMO_DATA_DIR, parsed.matchId);
  await fs.promises.mkdir(matchDir, { recursive:true });
  for (const [mapKey, mapData] of Object.entries(parsed.maps)) {
    if (!/^[A-Za-z0-9_-]{2,32}$/.test(mapKey)) throw new Error(`Некорректное название карты: ${mapKey}`);
    const record = JSON.stringify({ matchId:parsed.matchId, importedAt:parsed.importedAt, mapKey, data:mapData });
    const destination = path.join(matchDir, `${mapKey}.json`);
    const temporary = `${destination}.${process.pid}.tmp`;
    await fs.promises.writeFile(temporary, record, 'utf8');
    await fs.promises.rename(temporary, destination);
  }
}

async function importDemoRoute(request, response) {
  if (!authorizedDemoAdmin(request)) return sendJson(response, 403, { error:'ACCESS_DENIED', message:'Импорт демо доступен только root и admin' });
  const contentType = String(request.headers['content-type'] || '');
  let matchId = safeMatchId(request.headers['x-demo-match-id']);
  let inputPath = null;
  let filename = String(request.headers['x-demo-filename'] || 'demo.dem');
  try { filename = decodeURIComponent(filename); } catch { return sendJson(response, 400, { error:'INVALID_FILENAME', message:'Некорректное имя файла' }); }
  let targetMap = 'auto';
  let tempDir = null;
  try {
    if (contentType.includes('application/json')) {
      const payload = await readJson(request);
      matchId = safeMatchId(payload.matchId);
      if (!matchId) return sendJson(response, 400, { error:'INVALID_MATCH', message:'Выберите матч из списка' });
      targetMap = String(payload.targetMap || 'auto');
      tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'cs2-demo-source-'));
      inputPath = path.join(tempDir, 'download');
      filename = new URL(payload.url).pathname.toLowerCase().endsWith('.zip') ? 'download.zip' : 'download.dem';
      await downloadDemoUrl(payload.url, inputPath, filename.endsWith('.zip') ? MAX_DEMO_ARCHIVE_BYTES : MAX_DEMO_BYTES);
    } else if (contentType.includes('application/octet-stream')) {
      if (!matchId) return sendJson(response, 400, { error:'INVALID_MATCH', message:'Выберите матч из списка' });
      targetMap = String(request.headers['x-demo-target-map'] || 'auto');
      tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'cs2-demo-source-'));
      inputPath = path.join(tempDir, filename.toLowerCase().endsWith('.zip') ? 'upload.zip' : 'upload.dem');
      await writeBoundedStream(request, inputPath, filename.toLowerCase().endsWith('.zip') ? MAX_DEMO_ARCHIVE_BYTES : MAX_DEMO_BYTES);
    } else {
      return sendJson(response, 415, { error:'UNSUPPORTED_MEDIA', message:'Отправьте файл .dem/.zip или HTTPS-ссылку' });
    }
    if (!['auto','all'].includes(targetMap) && !/^[A-Za-z0-9_-]{2,24}$/.test(targetMap)) return sendJson(response, 400, { error:'INVALID_MAP', message:'Выберите карту из списка' });
    return await parseDemoImport(request, response, matchId, inputPath, targetMap);
  } catch (error) {
    return sendJson(response, 422, { error:'DEMO_DOWNLOAD_FAILED', message:error.message || 'Не удалось загрузить демо' });
  } finally {
    if (tempDir) await fs.promises.rm(tempDir, { recursive:true, force:true });
  }
}

async function getDemoRoute(request, response, matchId) {
  const id = safeMatchId(matchId);
  if (!id) return sendJson(response, 400, { message:'Некорректный ID матча' });
  try {
    const matchDir = path.join(DEMO_DATA_DIR, id);
    const mapFiles = await fs.promises.readdir(matchDir).catch((error) => error.code === 'ENOENT' ? [] : Promise.reject(error));
    const jsonFiles = mapFiles.filter((file) => /^[A-Za-z0-9_-]{2,32}\.json$/.test(file));
    if (jsonFiles.length) {
      const maps = Object.create(null);
      let importedAt = null;
      for (const file of jsonFiles) {
        const record = JSON.parse(await fs.promises.readFile(path.join(matchDir, file), 'utf8'));
        if (record.matchId !== id || !record.mapKey || !record.data) continue;
        maps[record.mapKey] = record.data;
        if (!importedAt || record.importedAt > importedAt) importedAt = record.importedAt;
      }
      response.writeHead(200, { ...corsHeaders(), 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store' });
      response.end(JSON.stringify({ matchId:id, importedAt, maps }));
      return;
    }
    const content = await fs.promises.readFile(path.join(DEMO_DATA_DIR, `${id}.json`), 'utf8');
    response.writeHead(200, { ...corsHeaders(), 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store' });
    response.end(content);
  } catch (error) {
    return sendJson(response, error.code === 'ENOENT' ? 404 : 500, { message:error.code === 'ENOENT' ? 'Для этого матча ещё не импортировано демо' : 'Не удалось прочитать данные демо' });
  }
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
  if (relative.split(path.sep).some((part) => part.startsWith('.')) || ['lib', 'types', 'tests'].includes(relative.split(path.sep)[0]) || relative === 'server.js') return sendJson(response, 403, { message:'Доступ запрещён' });

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
  if (request.method === 'GET' && request.url === '/api/players') return getPlayersRoute(response);
  const analyticsMatch = request.method === 'GET' && request.url.match(/^\/api\/matches\/([A-Za-z0-9_-]{1,80})\/analytics$/);
  if (analyticsMatch) {
    const match = matchCatalog.matches.find((entry) => entry.id === analyticsMatch[1]);
    if (!match) return sendJson(response, 404, { message:'Матч не найден' });
    const monthNames = { января:0, февраля:1, марта:2, апреля:3, мая:4, июня:5, июля:6, августа:7, сентября:8, октября:9, ноября:10, декабря:11 };
    const parts = match.date.match(/^(\d{1,2})\s+(\S+)\s+(\d{4})(?:\s*·\s*(\d{1,2}):(\d{2}))?/);
    const matchDate = parts && monthNames[parts[2]] !== undefined
      ? new Date(Date.UTC(Number(parts[3]), monthNames[parts[2]], Number(parts[1]), Number(parts[4] || 0), Number(parts[5] || 0))).toISOString()
      : undefined;
    try {
      const data = await getMatchAnalytics(
        { id:match.teamA, ...matchCatalog.teams[match.teamA] },
        { id:match.teamB, ...matchCatalog.teams[match.teamB] },
        matchDate, match.tournament
      );
      return sendJson(response, 200, { matchId:match.id, tournament:match.tournament, matchDate, ...data });
    } catch (error) {
      console.error('Analytics error:', error);
      return sendJson(response, 502, { message:'Не удалось загрузить аналитику Liquipedia' });
    }
  }
  if (request.method === 'PUT' && request.url === '/api/players') return savePlayersRoute(request, response);
  if (request.method === 'POST' && request.url === '/api/telegram/parse') return parseTelegramRoute(request, response);
  if (request.method === 'POST' && request.url === '/api/demos/import') return importDemoRoute(request, response);
  const demoMatch = request.method === 'GET' && request.url.match(/^\/api\/demos\/(\d+)$/);
  if (demoMatch) return getDemoRoute(request, response, demoMatch[1]);
  if (request.method === 'GET' || request.method === 'HEAD') return serveStatic(request, response);
  return sendJson(response, 405, { message:'Метод не поддерживается' });
});

if (require.main === module) {
  server.listen(PORT, HOST, () => console.log(`CS2 dashboard: http://${HOST}:${PORT}`));
}

module.exports = { server, normalizeParsedRows:require('./js/demo-parser.js').normalizeParsedRows, applyMatchMapSelection };
