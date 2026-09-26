(function initHltv(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.Hltv = api;
})(typeof window !== 'undefined' ? window : globalThis, function createHltv(root) {
  'use strict';
  const CACHE_KEY = 'cs2_hltv_cache';
  const SETTINGS_KEY = 'cs2_hltv_settings';
  const COMMUNITY_API = 'https://hltv-api.vercel.app/api/player/';
  let lastRequestAt = 0;
  let requestTimes = [];
  let requestQueue = Promise.resolve();

  function settings() {
    try { return { proxyUrl:'https://corsproxy.io/?url=', delayMs:2000, ...JSON.parse(root.localStorage.getItem(SETTINGS_KEY) || '{}') }; }
    catch { return { proxyUrl:'https://corsproxy.io/?url=', delayMs:2000 }; }
  }
  function saveSettings(value) {
    const safe = { proxyUrl:String(value.proxyUrl || '').trim(), delayMs:Math.max(2000, Number(value.delayMs) || 2000) };
    root.localStorage.setItem(SETTINGS_KEY, JSON.stringify(safe)); return safe;
  }
  function proxyUrl(url) {
    const prefix = settings().proxyUrl;
    if (!prefix) throw new Error('Укажите URL прокси HLTV');
    return `${prefix}${encodeURIComponent(url)}`;
  }
  function request(url) {
    // Очередь сериализует и ограничивает темп независимо от числа автообновлений.
    const run = async () => {
      let now = Date.now();
      requestTimes = requestTimes.filter((stamp) => now - stamp < 60000);
      if (requestTimes.length >= 10) await new Promise((resolve) => setTimeout(resolve, 60000 - (now - requestTimes[0])));
      const delay = Math.max(2000, Number(settings().delayMs) || 2000);
      const wait = Math.max(0, lastRequestAt + delay - Date.now());
      if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
      now = Date.now(); requestTimes = requestTimes.filter((stamp) => now - stamp < 60000);
      lastRequestAt = now; requestTimes.push(now);
      const response = await root.fetch(proxyUrl(url), { headers:{ 'Accept':'text/html,application/json' } });
      if (!response.ok) throw new Error(`HLTV proxy: HTTP ${response.status}`);
      return response;
    };
    const task = requestQueue.then(run, run);
    requestQueue = task.catch(() => {});
    return task;
  }
  function readCache() { try { return JSON.parse(root.localStorage.getItem(CACHE_KEY) || '{}'); } catch { return {}; } }
  function cacheStats(playerId, stats) { const cache = readCache(); cache[String(playerId)] = stats; root.localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); }
  function cachedStats(playerId) { return readCache()[String(playerId)] || null; }
  function parseHtml(html, nickname) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const number = (selector) => { const value = doc.querySelector(selector)?.textContent?.trim()?.replace(',', '.'); const parsed = Number.parseFloat(value); return Number.isFinite(parsed) ? parsed : null; };
    const anchor = [...doc.querySelectorAll('a[href*="/player/"]')].find((item) => item.textContent.trim().toLowerCase() === String(nickname).toLowerCase()) || doc.querySelector('a[href*="/player/"]');
    const href = anchor?.getAttribute('href') || '';
    const match = href.match(/\/player\/(\d+)\/([^/?#]+)/);
    const image = doc.querySelector('.player-img')?.getAttribute('src') || null;
    const bodyText = doc.body?.innerText || doc.body?.textContent || '';
    const ratingFallback = Number.parseFloat(bodyText.match(/Rating\s*3\.0\s*([0-9]+(?:[.,][0-9]+)?)/i)?.[1]?.replace(',', '.') || '');
    const kdFallback = Number.parseFloat(bodyText.match(/K\s*\/\s*D(?:\s*ratio)?\s*([0-9]+(?:[.,][0-9]+)?)/i)?.[1]?.replace(',', '.') || '');
    const rating = number('.player-summary-stat .rating') ?? (Number.isFinite(ratingFallback) ? ratingFallback : null);
    const kd = number('.player-summary-stat .kd') ?? (Number.isFinite(kdFallback) ? kdFallback : null);
    const playerName = doc.querySelector('.summaryNickname, h1')?.textContent?.trim() || String(nickname || '');
    return { hltvId:match?.[1] || null, hltvProfileUrl:match ? `https://www.hltv.org${href}` : null, nickname:playerName, rating:Number.isFinite(rating) ? rating : null, kd:Number.isFinite(kd) ? kd : null, avatarUrl:image, team:doc.querySelector('.playerTeam a')?.textContent.trim() || null, age:number('.playerAge'), lastUpdated:new Date().toISOString() };
  }
  function validHltvProfile(input) {
    try {
      const url = new URL(input);
      const match = url.pathname.match(/^\/player\/(\d+)\/([^/]+)/);
      return ['www.hltv.org','hltv.org'].includes(url.hostname.toLowerCase()) && match ? { url:`https://www.hltv.org/player/${match[1]}/${match[2]}`, id:match[1], slug:match[2] } : null;
    } catch { return null; }
  }
  function linksFromHtml(html, baseUrl) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const links = [...doc.querySelectorAll('a[href]')].map((anchor) => { try { return new URL(anchor.getAttribute('href'), baseUrl || 'https://www.hltv.org'); } catch { return null; } }).filter(Boolean);
    return {
      faceit:links.find((url) => /(^|\.)faceit\.com$/i.test(url.hostname) && /\/players?\//i.test(url.pathname))?.href || null,
      steam:links.find((url) => /(^|\.)steamcommunity\.com$/i.test(url.hostname) && /^\/(?:profiles|id)\//i.test(url.pathname))?.href || null
    };
  }
  async function discoverPlayerIdentity(input) {
    const profile = validHltvProfile(input);
    if (!profile) throw new Error('Введите ссылку вида https://www.hltv.org/player/7998/s1mple');
    let stats = { hltvId:profile.id, hltvProfileUrl:profile.url, nickname:profile.slug.replace(/-/g, ' '), rating:null, kd:null, avatarUrl:null, lastUpdated:new Date().toISOString() };
    let faceitProfileUrl = null; let steamProfileUrl = null; let steamId = null; let notice = '';
    try {
      const page = await request(profile.url); const html = await page.text();
      stats = { ...stats, ...parseHtml(html, stats.nickname), hltvId:profile.id, hltvProfileUrl:profile.url };
      const discovered = linksFromHtml(html, profile.url); faceitProfileUrl = discovered.faceit; steamProfileUrl = discovered.steam;
      if (faceitProfileUrl && !steamProfileUrl) {
        try { const faceit = await request(faceitProfileUrl); steamProfileUrl = linksFromHtml(await faceit.text(), faceitProfileUrl).steam; }
        catch { notice = 'FACEIT закрыт прокси; Steam-ссылку можно вставить вручную.'; }
      }
      if (steamProfileUrl) {
        const resolved = await root.Steam.resolve(steamProfileUrl, request);
        steamId = resolved?.vanity ? null : resolved?.value || null;
        if (!steamId && resolved?.vanity) notice = 'Нашёл Steam vanity-профиль, но не смог получить SteamID64 через публичный XML.';
      } else if (!notice) notice = 'Профиль HLTV/FACEIT не содержит доступной ссылки Steam. Можно вставить её вручную.';
    } catch {
      // Даже при блокировке прокси ссылка HLTV и ID из URL остаются полезными.
      notice = 'Прокси не отдал страницу HLTV. Сохранил ID из ссылки; SteamID можно вставить вручную.';
    }
    return { ...stats, hltvId:profile.id, hltvProfileUrl:profile.url, faceitProfileUrl, steamProfileUrl, steamId, notice };
  }
  async function fetchHltvStats(nickname, hltvId, playerId, force = false, hltvProfileUrl = null) {
    const cacheId = playerId || hltvId;
    const cached = cachedStats(cacheId);
    if (!force && cached?.lastUpdated && Date.now() - new Date(cached.lastUpdated).getTime() < 24 * 60 * 60 * 1000) return cached;
    if (hltvId) {
      try {
        const response = await request(`${COMMUNITY_API}${encodeURIComponent(hltvId)}`);
        const data = await response.json();
        const rating = Number.parseFloat(data.rating ?? data.rating3 ?? data.stats?.rating ?? '');
        const kd = Number.parseFloat(data.kd ?? data.kdRatio ?? data.stats?.kd ?? '');
        if (Number.isFinite(rating) || Number.isFinite(kd)) {
          const result = { ...data, hltvId:String(hltvId), rating:Number.isFinite(rating) ? rating : null, kd:Number.isFinite(kd) ? kd : null, lastUpdated:new Date().toISOString() };
          cacheStats(cacheId, result); return result;
        }
      } catch { /* Community endpoint unavailable: try the public player page through proxy. */ }
      try {
        const profileUrl = hltvProfileUrl || `https://www.hltv.org/player/${encodeURIComponent(hltvId)}/${encodeURIComponent(String(nickname).toLowerCase())}`;
        const profile = await request(profileUrl);
        const result = { ...parseHtml(await profile.text(), nickname), hltvId:String(hltvId), hltvProfileUrl:profileUrl };
        if (result.rating !== null || result.kd !== null) { cacheStats(cacheId || hltvId, result); return result; }
      } catch { /* Profile page unavailable; the search fallback may still respond. */ }
    }
    const search = await request(`https://www.hltv.org/search?query=${encodeURIComponent(nickname)}`);
    const searchHtml = await search.text();
    let result = parseHtml(searchHtml, nickname);
    if (!result.hltvId) throw new Error('HLTV временно недоступен. Попробуйте позже или введите статистику вручную');
    const profile = await request(result.hltvProfileUrl);
    result = { ...result, ...parseHtml(await profile.text(), nickname), hltvId:result.hltvId, hltvProfileUrl:result.hltvProfileUrl };
    if (result.rating === null && result.kd === null) throw new Error('HLTV временно недоступен. Попробуйте позже или введите статистику вручную');
    cacheStats(cacheId || result.hltvId, result); return result;
  }
  function clearCache() { root.localStorage.removeItem(CACHE_KEY); }
  return { fetchHltvStats, discoverPlayerIdentity, cachedStats, cacheStats, clearCache, settings, saveSettings, request };
});
