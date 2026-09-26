/* Сопоставление профиля игрока с никнеймами из разных источников. */
(function initPlayerIdentity(root) {
  'use strict';
  const STORAGE_KEY = 'cs2_players';
  const cleanName = (value) => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const cleanSteam = (value) => {
    const normalized = root.Steam?.normalize(value);
    return normalized && !normalized.vanity ? normalized.value : null;
  };
  function profiles() {
    try { const value = JSON.parse(root.localStorage.getItem(STORAGE_KEY) || '[]'); return Array.isArray(value) ? value : []; }
    catch { return []; }
  }
  function findProfile(nickname, steamId) {
    const all = profiles();
    const steam = cleanSteam(steamId);
    if (steam) {
      const exact = all.find((player) => cleanSteam(player.steamId) === steam);
      if (exact) return exact;
    }
    const key = cleanName(nickname);
    if (!key) return null;
    return all.find((player) => [player.nickname, player.fullName, ...(player.aliases || [])].some((alias) => cleanName(alias) === key)) || null;
  }
  function resolveRosterPlayer(roster, nickname, steamId) {
    const list = Array.isArray(roster) ? roster : [];
    const steam = cleanSteam(steamId);
    if (steam) {
      const direct = list.find((player) => cleanSteam(player.steamId) === steam);
      if (direct) return direct;
      const profile = profiles().find((player) => cleanSteam(player.steamId) === steam);
      if (profile) {
        const linked = list.find((player) => player.identityId === profile.id || [player.name, player.full, ...(player.aliases || [])].some((name) => [profile.nickname, profile.fullName, ...(profile.aliases || [])].some((alias) => cleanName(alias) && cleanName(alias) === cleanName(name))));
        if (linked) return linked;
      }
    }
    const key = cleanName(nickname);
    if (!key) return null;
    const direct = list.find((player) => [player.name, player.full, ...(player.aliases || [])].some((alias) => cleanName(alias) === key));
    if (direct) return direct;
    const profile = findProfile(nickname, steamId);
    if (!profile) return null;
    return list.find((player) => player.identityId === profile.id || [player.name, player.full, ...(player.aliases || [])].some((name) => [profile.nickname, profile.fullName, ...(profile.aliases || [])].some((alias) => cleanName(alias) && cleanName(alias) === cleanName(name)))) || null;
  }
  function matchMapStats(roster, map) {
    const merged = new Map();
    Object.entries(map?.stats || {}).forEach(([nickname, stat]) => {
      const key = cleanName(nickname);
      const steamId = map?.playerSteamIds?.[key] || map?.playerSteamIds?.[nickname] || null;
      const player = resolveRosterPlayer(roster, nickname, steamId);
      if (!player) return;
      const row = merged.get(player.id) || { kills:0, deaths:0, assists:0, damage:0 };
      row.kills += Number(stat.kills) || 0; row.deaths += Number(stat.deaths) || 0;
      row.assists += Number(stat.assists) || 0; row.damage += Number(stat.damage) || 0;
      merged.set(player.id, row);
    });
    const rounds = Math.max(1, map?.rounds?.length || 1);
    return Object.fromEntries([...merged].map(([id, row]) => [id, { ...row, adr:Number((row.damage / rounds).toFixed(1)) }]));
  }
  root.PlayerIdentity = { cleanName, cleanSteam, profiles, findProfile, resolveRosterPlayer, matchMapStats };
})(window);
