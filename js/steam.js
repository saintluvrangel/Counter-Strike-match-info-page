(function initSteam(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.Steam = api;
})(typeof window !== 'undefined' ? window : globalThis, function createSteam() {
  'use strict';
  const ACCOUNT_BASE = 76561197960265728n;
  const STEAM_ID64_MAX = ACCOUNT_BASE + 4294967295n;

  function steamId32ToSteamId64(value) {
    const match = String(value || '').trim().match(/^STEAM_[0-5]:([01]):(\d+)$/i);
    if (!match) return null;
    const accountId = BigInt(match[2]) * 2n + BigInt(match[1]);
    if (accountId > 4294967295n) return null;
    return (ACCOUNT_BASE + accountId).toString();
  }

  function steamId3ToSteamId64(value) {
    const match = String(value || '').trim().match(/^\[U:1:(\d+)\]$/i);
    if (!match) return null;
    const accountId = BigInt(match[1]);
    if (accountId > 4294967295n) return null;
    return (ACCOUNT_BASE + accountId).toString();
  }

  function normalize(value) {
    const input = String(value || '').trim();
    const as32 = steamId32ToSteamId64(input);
    if (as32) return { value:as32, type:'id64', vanity:false };
    const as3 = steamId3ToSteamId64(input);
    if (as3) return { value:as3, type:'id64', vanity:false };
    if (/^\d{17}$/.test(input)) {
      const id = BigInt(input);
      if (id >= ACCOUNT_BASE && id <= STEAM_ID64_MAX) return { value:input, type:'id64', vanity:false };
      return null;
    }
    let url;
    try { url = new URL(input); } catch { return null; }
    if (url.protocol !== 'https:' || !/(^|\.)steamcommunity\.com$/i.test(url.hostname)) return null;
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] === 'profiles' && /^\d{17}$/.test(parts[1] || '')) {
      const id = BigInt(parts[1]);
      return id >= ACCOUNT_BASE && id <= STEAM_ID64_MAX ? { value:parts[1], type:'id64', vanity:false } : null;
    }
    if (parts[0] === 'id' && /^[\w-]{2,64}$/.test(parts[1] || '')) return { value:`https://steamcommunity.com/id/${parts[1]}`, type:'vanity', vanity:true };
    return null;
  }

  // Vanity-ссылки Steam разрешаем через публичный XML-профиль и настроенный прокси.
  async function resolve(value, requestThroughProxy) {
    const normalized = normalize(value);
    if (!normalized) return null;
    if (!normalized.vanity) return normalized;
    if (typeof requestThroughProxy !== 'function') return { ...normalized, unresolved:true };
    try {
      const response = await requestThroughProxy(`${normalized.value}?xml=1`);
      const xml = await response.text();
      const doc = new DOMParser().parseFromString(xml, 'application/xml');
      const id = doc.querySelector('steamID64')?.textContent?.trim() || xml.match(/<steamID64>(\d{17})<\/steamID64>/)?.[1];
      const verified = id && /^\d{17}$/.test(id) ? normalize(id) : null;
      if (verified && !verified.vanity) return { ...verified, profileUrl:normalized.value };
    } catch { /* Публичный XML/proxy может быть недоступен; URL останется ручным fallback. */ }
    return { ...normalized, unresolved:true };
  }

  return { steamId32ToSteamId64, steamId3ToSteamId64, normalize, resolve };
});
