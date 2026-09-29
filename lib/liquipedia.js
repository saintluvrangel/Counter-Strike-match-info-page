'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const packageInfo = require('../package.json');

const BASE_URL = 'https://liquipedia.net/counterstrike/api.php';
const CACHE_DIR = path.join(__dirname, '..', '.private-data', 'liquipedia-mediawiki-cache');
const TTL_MS = 60 * 60 * 1000;
const MIN_INTERVAL_MS = 2000;
const PARSE_INTERVAL_MS = 30000;
const pending = new Map();
let queue = Promise.resolve();
let lastStart = 0;
let lastParseStart = 0;

function loadEnv() {
  const file = path.join(__dirname, '..', '.env');
  try {
    for (const line of require('node:fs').readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}

function endpointUrl(params) {
  if (!['query', 'parse'].includes(params.action)) throw new Error('Unsupported MediaWiki action');
  const url = new URL(BASE_URL);
  url.searchParams.set('format', 'json');
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  return url;
}

function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function enqueue(action, task) {
  const next = queue.then(async () => {
    await wait(Math.max(0, lastStart + MIN_INTERVAL_MS - Date.now(), action === 'parse' ? lastParseStart + PARSE_INTERVAL_MS - Date.now() : 0));
    const now = Date.now();
    lastStart = now;
    if (action === 'parse') lastParseStart = now;
    return task();
  });
  queue = next.catch(() => {});
  return next;
}

async function request(params, options = {}) {
  loadEnv();
  const contact = process.env.LIQUIPEDIA_CONTACT || packageInfo.homepage;
  if (!contact) throw new Error('Liquipedia User-Agent contact is not configured');
  const url = endpointUrl(params);
  const key = crypto.createHash('sha256').update(url.href).digest('hex');
  const cachePath = path.join(CACHE_DIR, `${key}.json`);
  const cached = await fs.readFile(cachePath, 'utf8').then(JSON.parse).catch(() => null);
  if (cached && cached.expiresAt > Date.now()) return cached.data;
  if (pending.has(key)) return pending.get(key);
  const promise = enqueue(params.action, async () => {
    const response = await (options.fetch || fetch)(url, {
      headers: {
        'User-Agent':`${packageInfo.name}/${packageInfo.version} (${contact})`,
        Accept:'application/json',
        'Accept-Encoding':'gzip, br'
      }
    });
    if (!response.ok) throw new Error(`Liquipedia MediaWiki API returned ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(`Liquipedia MediaWiki API: ${data.error.code || data.error.info || 'unknown error'}`);
    await fs.mkdir(CACHE_DIR, { recursive:true });
    await fs.writeFile(cachePath, JSON.stringify({ expiresAt:Date.now() + TTL_MS, data }), 'utf8');
    return data;
  }).finally(() => pending.delete(key));
  pending.set(key, promise);
  return promise;
}

async function resolveTitles(names, options = {}) {
  const data = await request({ action:'query', titles:names.join('|'), redirects:1, prop:'info' }, options);
  const aliases = new Map();
  for (const item of [...(data.query?.normalized || []), ...(data.query?.redirects || [])]) aliases.set(item.from, item.to);
  const pages = Object.values(data.query?.pages || {});
  return names.map((name) => {
    let title = name;
    while (aliases.has(title)) title = aliases.get(title);
    return pages.some((page) => page.title === title && page.missing === undefined) ? title : null;
  });
}

async function parsePage(title, options = {}) {
  const data = await request({ action:'parse', page:title, prop:'text' }, options);
  return data.parse?.text?.['*'] || '';
}

function simpleTeamName(value) {
  return String(value).toLocaleLowerCase('en').replace(/\b(team|gaming|esports|e-sports|club)\b/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

async function resolveMatchPages(names, options = {}) {
  const mainTitles = await resolveTitles(names, options);
  const candidates = mainTitles.map((title, index) => `${title || names[index]}/Matches`);
  const pages = await resolveTitles(candidates, options);
  for (const [index, page] of pages.entries()) {
    if (page) continue;
    const data = await request({ action:'query', list:'prefixsearch', pssearch:names[index], psnamespace:0, pslimit:50 }, options);
    const matches = (data.query?.prefixsearch || []).map((entry) => entry.title)
      .filter((title) => title.endsWith('/Matches') && simpleTeamName(title.slice(0, -8)) === simpleTeamName(names[index]));
    if (matches.length === 1) pages[index] = matches[0];
  }
  return pages;
}

module.exports = { request, resolveTitles, resolveMatchPages, parsePage, endpointUrl, enqueue, TTL_MS };
