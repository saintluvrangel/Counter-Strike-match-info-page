(function initPlayers(root) {
  'use strict';
  const STORAGE_KEY = 'cs2_players';
  const PAGE_SIZE = 20;
  const ROLE_OPTIONS = ['AWPer', 'Rifler', 'IGL', 'Support'];
  let players = [];
  let page = 1;
  let boundPlayerId = null;
  let profilePlayerId = null;
  let checkedSteam = null;
  let lastFocusedElement = null;
  let initialized = false;
  let refreshing = new Set();
  let databaseLoaded = false;
  let databaseWriteQueue = Promise.resolve();
  let databaseReady = Promise.resolve();

  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]); }
  function steamIcon() { return '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="20.5" cy="10.5" r="6.5"></circle><circle cx="20.5" cy="10.5" r="2.4"></circle><circle cx="8" cy="23" r="4"></circle><path d="m11.1 20.1 5-4.7m-4.5 8.3 5.8-1.2"></path></svg>'; }
  function can(permission) { const user = root.Auth.getUser(); if (!user || root.Auth.isPreviewMode()) return false; return root.Auth.can(permission, user); }
  function canBind() { return can('players_bind'); }
  function canEdit() { return can('players_edit'); }
  function canRefresh() { return can('hltv_refresh'); }

  function readStored() { try { const value = JSON.parse(root.localStorage.getItem(STORAGE_KEY) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } }
  function writeStored() {
    const snapshot = JSON.stringify(players);
    root.localStorage.setItem(STORAGE_KEY, snapshot);
    if (!databaseLoaded) return;
    const user = root.Auth.getUser();
    if (!user || root.Auth.isPreviewMode() || !root.Auth.can('players_bind', user)) return;
    databaseWriteQueue = databaseWriteQueue.catch(() => {}).then(async () => {
      const response = await root.fetch('/api/players', { method:'PUT', headers:{ 'Content-Type':'application/json', 'X-CS2-Role':user.role, 'X-CS2-User':user.email }, body:JSON.stringify({ players:JSON.parse(snapshot) }) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    }).catch((error) => console.warn('Не удалось синхронизировать базу игроков:', error));
  }
  async function loadSharedDatabase() {
    try {
      const response = await root.fetch('/api/players', { cache:'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data.players)) throw new Error('Некорректный ответ базы игроков');
      // Серверная запись главнее локальной, чтобы в разных браузерах были одни привязки.
      const combined = new Map(readStored().filter((player) => player?.id).map((player) => [String(player.id), player]));
      data.players.forEach((player) => { if (player?.id) combined.set(String(player.id), { ...combined.get(String(player.id)), ...player }); });
      root.localStorage.setItem(STORAGE_KEY, JSON.stringify([...combined.values()]));
    } catch (error) { console.warn('Не удалось загрузить общую базу игроков:', error); }
    finally {
      databaseLoaded = true;
      if (initialized) render();
    }
  }
  function collectFromMatches() {
    const catalog = root.HltvMatchData;
    const found = new Map();
    Object.entries(catalog?.teams || {}).forEach(([teamId, team]) => (team.players || []).forEach((entry) => {
      const nickname = String(entry[0] || '').trim();
      if (!nickname) return;
      const id = `${teamId}:${nickname.toLowerCase()}`;
      const seed = root.PlayerEnrichment?.[nickname.toLowerCase()] || {};
      found.set(id, { id, nickname, team:team.name || teamId, role:null, steamId:seed.steamId || null, hltvId:seed.hltvId || null, hltvStats:seed.hltvStats || null, avatarUrl:null, sourceAvatar:entry[2] || null, createdAt:null, enrichmentVersion:1 });
    }));
    readStored().forEach((player) => { if (player?.id) {
      const base = found.get(String(player.id));
      // Один раз дополняем старые localStorage записи справочными данными.
      // После этого ручная отвязка SteamID и локальные правки остаются главнее.
      const applySeed = !player.enrichmentVersion;
      found.set(String(player.id), { ...base, ...player,
        id:String(player.id),
        steamId:typeof player.steamId === 'string' && player.steamId ? player.steamId : (applySeed ? base?.steamId || null : null),
        hltvId:player.hltvId || (applySeed ? base?.hltvId : null) || null,
        hltvStats:player.hltvStats || (applySeed ? base?.hltvStats : null) || null,
        sourceAvatar:player.sourceAvatar || base?.sourceAvatar || null,
        enrichmentVersion:1
      });
    } });
    return [...found.values()];
  }
  function getAllPlayers() { players = collectFromMatches(); writeStored(); return [...players]; }
  function getPlayerById(id) { return players.find((player) => player.id === String(id)) || null; }
  function bindSteamId(playerId, steamId) {
    if (!canBind()) throw new Error('Недостаточно прав для привязки SteamID');
    const player = getPlayerById(playerId); if (!player) throw new Error('Игрок не найден');
    const normalized = root.Steam.normalize(steamId); if (!normalized) throw new Error('Некорректный SteamID');
    player.steamId = normalized.value; writeStored(); return player;
  }
  function unbindSteamId(playerId) {
    if (!can('players_edit')) throw new Error('Недостаточно прав для отвязки SteamID');
    const player = getPlayerById(playerId); if (!player) throw new Error('Игрок не найден');
    player.steamId = null; writeStored(); return player;
  }
  function updateHltvStats(playerId, stats) {
    const player = getPlayerById(playerId); if (!player) throw new Error('Игрок не найден');
    player.hltvId = stats.hltvId || player.hltvId || null;
    player.hltvStats = { ...(player.hltvStats || {}), ...stats, lastUpdated:stats.lastUpdated || new Date().toISOString() };
    writeStored(); return player;
  }
  function filteredPlayers() {
    const query = document.getElementById('players-search').value.trim().toLowerCase();
    const team = document.getElementById('players-team').value;
    const role = document.getElementById('players-role').value;
    const steam = document.getElementById('players-steam-filter').value;
    const sort = document.getElementById('players-sort').value;
    const collator = new Intl.Collator('ru', { sensitivity:'base', numeric:true });
    const result = players.filter((player) => (!query || player.nickname.toLowerCase().includes(query) || (player.aliases || []).some((alias) => alias.toLowerCase().includes(query)) || String(player.steamId || '').toLowerCase().includes(query))
      && (!team || player.team === team) && (!role || player.role === role)
      && (!steam || (steam === 'linked' ? Boolean(player.steamId) : !player.steamId)));
    result.sort((a, b) => sort === 'rating'
      ? ((b.hltvStats?.rating ?? -Infinity) - (a.hltvStats?.rating ?? -Infinity)) || collator.compare(a.nickname, b.nickname)
      : sort === 'createdAt' ? ((Date.parse(b.createdAt || '') || 0) - (Date.parse(a.createdAt || '') || 0)) || collator.compare(a.nickname, b.nickname)
        : collator.compare(a.nickname, b.nickname));
    return result;
  }
  function renderPlayersTable() {
    const rows = filteredPlayers(); const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE)); page = Math.min(page, pages);
    const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const body = document.getElementById('players-table-body');
    body.innerHTML = pageRows.length ? pageRows.map((player) => {
      const steam = player.steamId ? `<span class="steam-cell"><a class="steam-link" href="${player.steamId.startsWith('https:') ? escapeHtml(player.steamId) : `https://steamcommunity.com/profiles/${encodeURIComponent(player.steamId)}`}" target="_blank" rel="noopener noreferrer" aria-label="Открыть Steam профиль ${escapeHtml(player.nickname)}" title="Открыть Steam профиль">${steamIcon()}</a><span>${escapeHtml(player.steamId.startsWith('https:') ? 'Vanity URL' : `…${player.steamId.slice(-5)}`)}</span></span>${can('players_edit') ? `<button class="player-mini-action" data-unbind="${escapeHtml(player.id)}" type="button">Отвязать</button>` : ''}` : `<span>—</span>${canBind() ? `<button class="player-mini-action" data-bind="${escapeHtml(player.id)}" type="button">Привязать</button>` : ''}`;
      const avatar = player.steamId ? (player.steamAvatarUrl || player.sourceAvatar) : null;
      const actionBind = !player.steamId && canBind() ? `<button type="button" class="player-action" data-bind="${escapeHtml(player.id)}">🔗 <span>Привязать SteamID</span></button>` : '';
      const actionRefresh = (player.hltvId || player.steamId) && canRefresh() ? `<button type="button" class="player-action" data-refresh="${escapeHtml(player.id)}" ${refreshing.has(player.id) ? 'disabled' : ''}>${refreshing.has(player.id) ? '<span class="players-spinner" aria-label="Загрузка"></span>' : '📊'} <span>Обновить статистику с HLTV</span></button>` : '';
      return `<tr><td data-label="Игрок"><button class="player-identity" type="button" data-profile="${escapeHtml(player.id)}">${avatar ? `<img src="${escapeHtml(avatar)}" alt="" loading="lazy">` : '<span class="player-avatar-placeholder" aria-hidden="true"></span>'}<strong>${escapeHtml(player.nickname)}</strong></button></td><td data-label="Команда">${escapeHtml(player.team || '—')}</td><td data-label="Роль">${escapeHtml(player.role || '—')}</td><td data-label="SteamID"><div class="steam-cell-wrap">${steam}</div></td><td data-label="HLTV рейтинг">${escapeHtml(player.hltvStats?.rating ?? '—')}</td><td data-label="Действия" class="player-actions">${actionBind}${actionRefresh}<button type="button" class="player-action" data-profile="${escapeHtml(player.id)}">👁 <span>Открыть профиль</span></button></td></tr>`;
    }).join('') : '<tr><td class="players-empty" colspan="6">Игроки не найдены</td></tr>';
    document.getElementById('players-count').textContent = `Всего: ${players.length} игроков`;
    const pagination = document.getElementById('players-pagination');
    pagination.innerHTML = `<button type="button" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Назад</button>${Array.from({ length:pages }, (_, index) => index + 1).map((number) => `<button type="button" data-page="${number}" aria-current="${number === page ? 'page' : 'false'}">${number}</button>`).join('')}<button type="button" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''}>Вперёд</button>`;
  }
  function renderFilters() {
    const select = document.getElementById('players-team'); const selected = select.value;
    const teams = [...new Set(players.map((player) => player.team).filter(Boolean))].sort(new Intl.Collator('ru').compare);
    select.innerHTML = '<option value="">Все команды</option>' + teams.map((team) => `<option value="${escapeHtml(team)}">${escapeHtml(team)}</option>`).join('');
    select.value = teams.includes(selected) ? selected : '';
  }
  function render() {
    getAllPlayers(); renderFilters();
    const settings = root.Hltv.settings(); document.getElementById('hltv-proxy-url').value = settings.proxyUrl; document.getElementById('hltv-delay').value = settings.delayMs;
    document.getElementById('players-api-card').hidden = !root.Auth.can('gsi');
    document.getElementById('players-export').hidden = !can('players_edit'); document.querySelector('.import-button').hidden = !can('players_edit');
    renderPlayersTable(); maybeAutoRefresh();
  }
  function message(text, state = 'info') { const node = document.getElementById('players-message'); node.textContent = text; node.dataset.state = state; node.hidden = !text; }
  function openBind(playerId) {
    if (!canBind()) return;
    const player = getPlayerById(playerId); if (!player) return;
    boundPlayerId = player.id; checkedSteam = null;
    document.getElementById('steam-bind-title').textContent = `Привязка SteamID для ${player.nickname}`;
    document.getElementById('steam-id-input').value = ''; document.getElementById('steam-profile-preview').hidden = true;
    document.getElementById('steam-bind-error').hidden = true; document.getElementById('steam-bind-success').hidden = true; document.getElementById('steam-save').disabled = true;
    openModal('steam-bind-modal'); document.getElementById('steam-id-input').focus();
  }
  function openModal(id) { lastFocusedElement = document.activeElement; const modal = document.getElementById(id); modal.hidden = false; document.body.classList.add('modal-open'); modal.querySelector('input, button, select, textarea, a[href]')?.focus(); }
  function closeModals() { document.querySelectorAll('#steam-bind-modal, #player-profile-modal').forEach((modal) => { modal.hidden = true; }); if (!document.querySelector('.modal-backdrop:not([hidden])')) document.body.classList.remove('modal-open'); if (lastFocusedElement?.isConnected) lastFocusedElement.focus(); }
  async function checkSteam() {
    const input = document.getElementById('steam-id-input').value;
    const error = document.getElementById('steam-bind-error'); const success = document.getElementById('steam-bind-success');
    error.hidden = success.hidden = true; document.getElementById('steam-save').disabled = true;
    const check = document.getElementById('steam-check'); check.disabled = true; check.textContent = 'Проверяю…';
    const result = await root.Steam.resolve(input, (url) => root.Hltv.request(url));
    check.disabled = false; check.textContent = 'Проверить';
    if (!result) { error.textContent = 'Введите корректный SteamID, SteamID32/3 или ссылку на профиль Steam.'; error.hidden = false; return; }
    checkedSteam = result;
    const preview = document.getElementById('steam-profile-preview');
    preview.innerHTML = `<span class="steam-avatar-fallback">♨</span><div><strong>${result.vanity ? escapeHtml(result.value.split('/').pop()) : `SteamID …${result.value.slice(-5)}`}</strong><span>Профиль Steam</span></div>`;
    preview.hidden = false; document.getElementById('steam-save').disabled = false;
    success.textContent = result.unresolved ? 'Не удалось разрешить vanity в SteamID64. Ссылка будет сохранена как резервный вариант.' : result.vanity ? 'Vanity URL принят; SteamID64 можно получить позже.' : 'Профиль распознан, SteamID64 будет сохранён строкой.'; success.hidden = false;
    try {
      const profileUrl = result.profileUrl || (result.vanity ? result.value : `https://steamcommunity.com/profiles/${result.value}`);
      const response = await root.Hltv.request(profileUrl);
      if (response.ok) {
        const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
        const image = doc.querySelector('link[rel="image_src"]')?.href || doc.querySelector('meta[property="og:image"]')?.content;
        const name = doc.querySelector('.actual_persona_name')?.textContent?.trim() || doc.querySelector('meta[property="og:title"]')?.content;
        const country = doc.querySelector('.profile_flag')?.getAttribute('title') || null;
        if (image || name || country) {
          preview.innerHTML = `${image ? `<img src="${escapeHtml(image)}" alt="" loading="lazy">` : '<span class="steam-avatar-fallback">♨</span>'}<div><strong>${escapeHtml(name || (result.vanity ? result.value.split('/').pop() : `SteamID …${result.value.slice(-5)}`))}</strong><span>${escapeHtml(country || 'Профиль Steam')}</span></div>`;
          const player = getPlayerById(boundPlayerId); if (player && image) { player.steamAvatarUrl = image; writeStored(); }
        }
      }
    } catch { /* preview is optional when Steam/proxy is unavailable */ }
  }
  async function discoverHltv(playerId) {
    if (!canBind()) return;
    const player = getPlayerById(playerId); const input = document.getElementById('player-hltv-url'); const status = document.getElementById('player-identity-status');
    if (!player || !input || !status) return;
    status.hidden = false; status.textContent = 'Ищу данные HLTV → FACEIT → Steam…'; status.dataset.state = 'info';
    const button = document.querySelector('[data-discover-hltv]'); if (button) button.disabled = true;
    try {
      const found = await root.Hltv.discoverPlayerIdentity(input.value.trim());
      player.hltvId = found.hltvId;
      const sameProfile = String(player.hltvId || '') === String(found.hltvId);
      player.hltvStats = { ...(sameProfile ? player.hltvStats || {} : {}), rating:found.rating ?? (sameProfile ? player.hltvStats?.rating : null), kd:found.kd ?? (sameProfile ? player.hltvStats?.kd : null), avatarUrl:found.avatarUrl ?? (sameProfile ? player.hltvStats?.avatarUrl : null), hltvProfileUrl:found.hltvProfileUrl, source:'hltv-profile', lastUpdated:found.lastUpdated };
      player.hltvProfileUrl = found.hltvProfileUrl;
      player.faceitProfileUrl = found.faceitProfileUrl || player.faceitProfileUrl || null;
      player.steamProfileUrl = found.steamProfileUrl || player.steamProfileUrl || null;
      const discoveredNick = found.nickname?.trim();
      player.aliases = [...new Set([...(player.aliases || []), ...(discoveredNick ? [discoveredNick] : [])].filter((alias) => alias.toLowerCase() !== player.nickname.toLowerCase()))];
      if (found.steamId) player.steamId = found.steamId;
      writeStored(); renderPlayersTable();
      status.textContent = [found.steamId ? 'SteamID64 привязан.' : 'SteamID не найден.', found.notice].filter(Boolean).join(' ');
      status.dataset.state = found.steamId ? 'success' : 'error';
      if (found.hltvId && canRefresh()) {
        status.textContent += ' Запрашиваю свежую статистику…';
        await refreshPlayer(playerId, true);
        status.textContent = [found.steamId ? 'SteamID64 привязан.' : '', found.notice].filter(Boolean).join(' ');
      }
    } catch (error) { status.textContent = error.message || 'Не удалось прочитать профиль.'; status.dataset.state = 'error'; }
    finally { if (button) button.disabled = false; }
  }
  async function saveSteam(event) {
    event.preventDefault(); if (!checkedSteam || !boundPlayerId) return;
    try {
      bindSteamId(boundPlayerId, checkedSteam.value); closeModals(); render(); message('SteamID привязан. Запрашиваем доступную статистику HLTV…');
      await refreshPlayer(boundPlayerId, true);
    } catch (error) { const node = document.getElementById('steam-bind-error'); node.textContent = error.message; node.hidden = false; }
  }
  async function refreshPlayer(playerId, force = true) {
    const player = getPlayerById(playerId); if (!player || (!player.hltvId && !player.steamId) || !canRefresh()) return;
    refreshing.add(playerId); renderPlayersTable();
    try { const stats = await root.Hltv.fetchHltvStats(player.nickname, player.hltvId, player.id, force, player.hltvProfileUrl || player.hltvStats?.hltvProfileUrl); updateHltvStats(playerId, stats); message(`Статистика HLTV обновлена для ${player.nickname}.`, 'success'); }
    catch (error) { message(error.message.includes('HLTV временно недоступен') ? error.message : 'HLTV временно недоступен. Попробуйте позже или введите статистику вручную', 'error'); }
    finally { refreshing.delete(playerId); renderPlayersTable(); }
  }
  function maybeAutoRefresh() {
    if (!canRefresh()) return;
    const now = Date.now();
    players.filter((player) => { const updated = Date.parse(player.hltvStats?.lastUpdated || ''); return (player.hltvId || player.steamId) && (!Number.isFinite(updated) || now - updated >= 86400000); })
      .forEach((player) => { if (!refreshing.has(player.id)) refreshPlayer(player.id, false); });
  }
  function openProfile(playerId) {
    const player = getPlayerById(playerId); if (!player) return;
    profilePlayerId = player.id;
    document.getElementById('player-profile-title').textContent = player.nickname;
    const edit = canEdit(); const body = document.getElementById('player-profile-content');
    const identityTools = canBind() ? `<section class="player-identity-tools"><label for="player-hltv-url">Ссылка на профиль HLTV<input id="player-hltv-url" type="url" value="${escapeHtml(player.hltvProfileUrl || player.hltvStats?.hltvProfileUrl || '')}" placeholder="https://www.hltv.org/player/7998/s1mple"></label><button type="button" class="secondary-button" data-discover-hltv>Найти профиль HLTV → FACEIT → Steam</button><p id="player-identity-status" role="status" aria-live="polite" hidden></p>${player.faceitProfileUrl ? `<a href="${escapeHtml(player.faceitProfileUrl)}" target="_blank" rel="noopener noreferrer">Профиль FACEIT</a>` : ''}</section>` : '';
    body.innerHTML = `<div class="player-profile-summary">${(player.hltvStats?.avatarUrl || player.sourceAvatar) ? `<img src="${escapeHtml(player.hltvStats?.avatarUrl || player.sourceAvatar)}" alt="">` : '<span class="player-avatar-placeholder"></span>'}<div><strong>${escapeHtml(player.nickname)}</strong><span>${escapeHtml(player.team || 'Команда не указана')} · ${escapeHtml(player.role || 'Роль не указана')}</span>${player.hltvProfileUrl || player.hltvStats?.hltvProfileUrl ? `<a href="${escapeHtml(player.hltvProfileUrl || player.hltvStats.hltvProfileUrl)}" target="_blank" rel="noopener noreferrer">Профиль HLTV</a>` : ''}</div></div><dl class="player-profile-stats"><div><dt>SteamID64</dt><dd>${player.steamId ? escapeHtml(player.steamId) : 'Не привязан'}</dd></div><div><dt>HLTV рейтинг</dt><dd>${escapeHtml(player.hltvStats?.rating ?? '—')}</dd></div><div><dt>K/D</dt><dd>${escapeHtml(player.hltvStats?.kd ?? '—')}</dd></div><div><dt>Добавлен</dt><dd>${escapeHtml(player.createdAt ? new Date(player.createdAt).toLocaleDateString('ru-RU') : '—')}</dd></div></dl>${identityTools}${edit ? `<form id="player-edit-form" class="player-edit-form"><label>Никнейм<input name="nickname" value="${escapeHtml(player.nickname)}" required></label><label>Команда<input name="team" value="${escapeHtml(player.team || '')}"></label><label>Роль<select name="role"><option value="">Не указана</option>${ROLE_OPTIONS.map((role) => `<option ${player.role === role ? 'selected' : ''}>${role}</option>`).join('')}</select></label><label>Игровые ники / aliases<input name="aliases" value="${escapeHtml((player.aliases || []).join(', '))}" placeholder="Разделяйте запятыми"></label><div class="player-manual-stats"><label>HLTV рейтинг<input name="rating" type="number" min="0" max="5" step="0.01" value="${escapeHtml(player.hltvStats?.rating ?? '')}" placeholder="Не указан"></label><label>K/D<input name="kd" type="number" min="0" max="10" step="0.01" value="${escapeHtml(player.hltvStats?.kd ?? '')}" placeholder="Не указан"></label></div><small>Nicknames из демо будут сопоставляться по SteamID, затем по этому списку aliases.</small><button class="primary-button" type="submit">Сохранить данные</button></form>` : ''}`;
    openModal('player-profile-modal');
  }
  function exportPlayers() {
    if (!canEdit()) return;
    const blob = new Blob([JSON.stringify(players, null, 2)], { type:'application/json' }); const link = document.createElement('a');
    link.href = URL.createObjectURL(blob); link.download = 'cs2_players.json'; link.click(); URL.revokeObjectURL(link.href);
  }
  async function importPlayers(file) {
    if (!canEdit() || !file) return;
    try { const imported = JSON.parse(await file.text()); if (!Array.isArray(imported) || imported.some((p) => !p || !p.id || !p.nickname || (p.steamId != null && typeof p.steamId !== 'string'))) throw new Error('JSON должен содержать массив игроков с id, nickname и строковым SteamID');
      const normalized = imported.map((p) => { const steamId = p.steamId ? root.Steam.normalize(p.steamId) : null; if (p.steamId && !steamId) throw new Error(`Некорректный SteamID для игрока ${p.nickname}`); return { ...p, id:String(p.id), steamId:steamId?.value || null }; });
      const merged = new Map(players.map((p) => [p.id, p])); normalized.forEach((p) => merged.set(p.id, p)); players = [...merged.values()]; writeStored(); render(); message(`Импортировано записей: ${imported.length}.`, 'success');
    } catch (error) { message(`Не удалось импортировать JSON: ${error.message}`, 'error'); }
  }
  function init() {
    if (initialized) return; initialized = true; getAllPlayers();
    databaseReady = loadSharedDatabase();
    ['players-search', 'players-team', 'players-role', 'players-steam-filter', 'players-sort'].forEach((id) => document.getElementById(id).addEventListener(id === 'players-search' ? 'input' : 'change', () => { page = 1; renderPlayersTable(); }));
    document.getElementById('players-table-body').addEventListener('click', (event) => {
      const bind = event.target.closest('[data-bind]'); const profile = event.target.closest('[data-profile]'); const refresh = event.target.closest('[data-refresh]'); const unbind = event.target.closest('[data-unbind]');
      if (bind) openBind(bind.dataset.bind); if (profile) openProfile(profile.dataset.profile); if (refresh) refreshPlayer(refresh.dataset.refresh); if (unbind && can('players_edit') && root.confirm('Отвязать SteamID от игрока?')) { unbindSteamId(unbind.dataset.unbind); render(); }
    });
    document.getElementById('players-pagination').addEventListener('click', (event) => { const button = event.target.closest('[data-page]'); if (button && !button.disabled) { page = Number(button.dataset.page); renderPlayersTable(); } });
    document.getElementById('players-export').addEventListener('click', exportPlayers);
    document.getElementById('players-import').addEventListener('change', (event) => { importPlayers(event.target.files[0]); event.target.value = ''; });
    document.getElementById('steam-check').addEventListener('click', checkSteam); document.getElementById('steam-bind-form').addEventListener('submit', saveSteam);
    document.querySelectorAll('[data-close-players-modal]').forEach((button) => button.addEventListener('click', closeModals));
    document.querySelectorAll('#steam-bind-modal, #player-profile-modal').forEach((modal) => modal.addEventListener('click', (event) => { if (event.target === modal) closeModals(); }));
    document.addEventListener('keydown', (event) => { const modal = document.querySelector('#steam-bind-modal:not([hidden]), #player-profile-modal:not([hidden])'); if (!modal) return; if (event.key === 'Escape') { closeModals(); return; } if (event.key !== 'Tab') return; const items = [...modal.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]')].filter((item) => item.getClientRects().length); if (!items.length) return; const first = items[0], last = items[items.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } });
    document.getElementById('player-profile-content').addEventListener('click', (event) => { const button = event.target.closest('[data-discover-hltv]'); if (button) discoverHltv(profilePlayerId); });
    document.getElementById('player-profile-content').addEventListener('submit', (event) => { if (event.target.id !== 'player-edit-form' || !canEdit()) return; event.preventDefault(); const target = getPlayerById(profilePlayerId); if (!target) return; const form = new FormData(event.target); target.nickname = String(form.get('nickname')).trim(); target.team = String(form.get('team') || '').trim(); target.role = ROLE_OPTIONS.includes(form.get('role')) ? form.get('role') : null; target.aliases = [...new Set(String(form.get('aliases') || '').split(/[\n,;]/).map((alias) => alias.trim()).filter((alias) => alias && alias.toLowerCase() !== target.nickname.toLowerCase()))]; const rating = String(form.get('rating') || '').trim(); const kd = String(form.get('kd') || '').trim(); if (rating || kd) target.hltvStats = { ...(target.hltvStats || {}), rating:rating ? Number.parseFloat(rating) : null, kd:kd ? Number.parseFloat(kd) : null, source:'manual', lastUpdated:new Date().toISOString() }; writeStored(); closeModals(); render(); });
    const proxyInput = document.getElementById('hltv-proxy-url'); const delayInput = document.getElementById('hltv-delay');
    const savedSettings = root.Hltv.settings(); proxyInput.value = savedSettings.proxyUrl; delayInput.value = savedSettings.delayMs;
    const persistSettings = () => root.Hltv.saveSettings({ proxyUrl:proxyInput.value, delayMs:delayInput.value }); proxyInput.addEventListener('change', persistSettings); delayInput.addEventListener('change', persistSettings);
    document.getElementById('hltv-test').addEventListener('click', async () => { if (!root.Auth.can('gsi')) return; const status = document.getElementById('hltv-api-status'); persistSettings(); status.textContent = 'Проверка…'; try { const result = await root.Hltv.fetchHltvStats('s1mple', '7998', 'hltv-test', true); status.textContent = result.rating ? `Подключение работает · рейтинг ${result.rating}` : 'Подключение отвечает'; } catch { status.textContent = 'HLTV временно недоступен. Проверьте прокси и попробуйте позже.'; } });
    document.getElementById('hltv-clear-cache').addEventListener('click', () => { if (!root.Auth.can('gsi')) return; root.Hltv.clearCache(); document.getElementById('hltv-api-status').textContent = 'Кеш HLTV очищен.'; });
    root.addEventListener('auth:change', render);
  }

  root.Players = { init, ready:() => databaseReady, render, getAllPlayers, getPlayerById, bindSteamId, unbindSteamId, updateHltvStats, renderPlayersTable, exportPlayers, importPlayers };
})(window);
