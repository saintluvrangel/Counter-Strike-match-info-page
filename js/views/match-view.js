(function initMatchViewModule(root) {
  'use strict';

  const data = root.MatchData;
  let selectedMap = 'Anubis';
  let scoreboardMode = 'map';
  let minimapController = null;
  let roundReplay = null;
  let replayTimer = null;
  let replayTime = 0;
  let replaySpeed = 1;
  let selectedPlayerId = null;
  let replayPlaying = false;
  let initialized = false;
  let importedDemo = null;
  let activeRound = null;
  let demoLoadToken = 0;
  let isExternalMatch = false;
  // SVG-узлы эффектов сохраняются между кадрами реплея: пересоздание SVG
  // каждые 100 мс перезапускало CSS-анимации и визуально дёргало гранаты.
  const persistentMapNodes = new Map();
  let currentTeams = [
    { name:'Nuclear TigeRES', logo:data.teamLogo.nuclear, rank:'HLTV #123' },
    { name:'K27', logo:data.teamLogo.k27, rank:'HLTV #87' }
  ];
  const mutableDataKeys = ['players','stats','mapMeta','mapLogs','radarImages','firstRoundState','bombCarrierByMap','primaryWeaponsByMap'];
  const legacyState = Object.fromEntries(mutableDataKeys.map((key) => [key, JSON.parse(JSON.stringify(data[key]))]));

  function clearPersistentMapNodes() {
    persistentMapNodes.forEach((node) => node.remove());
    persistentMapNodes.clear();
  }

  function restoreLegacyState() {
    mutableDataKeys.forEach((key) => { data[key] = JSON.parse(JSON.stringify(legacyState[key])); });
    // Старый матч использует отдельный статический ростер. Подмешиваем к нему
    // идентификаторы из реестра, чтобы SteamID из демо находил игрока даже при
    // смене игрового никнейма.
    data.players = data.players.map((player) => {
      const identity = root.PlayerIdentity?.findProfile(player.name || player.full);
      return identity ? {
        ...player,
        identityId:identity.id || null,
        steamId:identity.steamId || null,
        aliases:[...new Set([...(player.aliases || []), identity.nickname, identity.fullName, ...(identity.aliases || [])].filter(Boolean))]
      } : player;
    });
  }

  function kdClass(kills, deaths) {
    if (!Number.isFinite(Number(kills)) || !Number.isFinite(Number(deaths))) return '';
    const difference = Number(kills) - Number(deaths);
    if (difference > 0) return 'kd-good';
    if (difference < 0) return 'kd-bad';
    return 'kd-even';
  }

  function kdValue(row) {
    return Number.isFinite(Number(row?.[0])) ? Number(row[0]) / Math.max(1, Number(row[1])) : -1;
  }

  function formatRating(value) {
    if (value === null || value === undefined || value === '') return '—';
    return Number.isFinite(Number(value)) ? Number(value).toFixed(2) : '—';
  }

  function avatarFor(player) {
    return player.photo || data.fallbackAvatar;
  }

  function sideNameClass(side) {
    if (side === 't') return 't-name';
    if (side === 'ct') return 'ct-name';
    return '';
  }

  function setSideBadge(elementId, side) {
    const element = document.getElementById(elementId);
    element.textContent = side || '—';
    element.className = side ? `side ${side.toLowerCase()}` : 'side unknown';
  }

  // Game log component
  function renderLogItem(item) {
    if (item.type === 'system') {
      return `<div class="log-item system">${item.text}</div>`;
    }

    if (item.type === 'round') {
      return `<div class="log-item round">
        <span class="round-line"><span class="round-label">Round over</span><span></span></span>
        <span class="round-line"><span class="round-label">Winner:</span><span class="round-value ${sideNameClass(item.winnerSide)}">${item.winner}</span></span>
        <span class="round-line"><span class="round-label">Reason:</span><span class="round-value">${item.reason}</span></span>
      </div>`;
    }

    return `<div class="log-item kill">
      <span class="log-player ${sideNameClass(item.actorSide)}">${item.actor}</span>
      <span class="weapon-icon" aria-label="${item.weapon}${item.headshot ? ', headshot' : ''}">
        <img src="${data.equipmentIcons[item.weapon]}" alt="">
        ${item.headshot ? `<img class="headshot-icon" src="${data.headshotIcon}" alt="Headshot" title="Headshot">` : ''}
      </span>
      <span class="log-player ${sideNameClass(item.victimSide)}">${item.victim}</span>
    </div>`;
  }

  function renderHalfScore(halfScore) {
    return halfScore
      .map(([tRounds, ctRounds]) => `<span class="half-pair">(<span class="t-rounds">${tRounds}</span>:<span class="ct-rounds">${ctRounds}</span>)</span>`)
      .join(' ');
  }

  // Team player panels component
  function renderPlayerList(target, teamName) {
    const source = importedDemo?.maps?.[selectedMap] ? (data.stats[selectedMap] || data.stats.total) : (isExternalMatch ? data.stats.total : (data.stats[selectedMap] || data.stats.total));
    const currentSide = teamName === currentTeams[0].name
      ? data.mapMeta[selectedMap].nuclearSide
      : data.mapMeta[selectedMap].k27Side;

    document.getElementById(target).innerHTML = data.players
      .filter((player) => player.team === teamName)
      .map((player, index) => {
        const emptyRow = importedDemo?.maps?.[selectedMap] ? ['—','—','—','—','—'] : (data.stats.total.rows[player.id] || ['—','—','—','—','—']);
        const row = source?.rows[player.id] || emptyRow;
        const roundState = importedDemo?.maps?.[selectedMap] ? null : data.firstRoundState[player.id];
        const combat = roundState || { kills:row[0], assists:'—', deaths:row[1] };
        const hasBomb = currentSide === 'T' && data.bombCarrierByMap[selectedMap] === player.id;
        const primaryWeapon = data.primaryWeaponsByMap[selectedMap]?.[player.id] || (currentSide === 'T' ? 'glock.svg' : 'usp_silencer.svg');
        const utility = roundState ? `${hasBomb ? '<img src="assets/equipment/c4.svg" alt="Бомба" title="Бомба">' : ''}${roundState.grenades.map((icon) => `<img src="assets/equipment/${icon}" alt="" aria-hidden="true">`).join('')}` : '';
        const stateRow = roundState ? `<div class="player-money" aria-label="Деньги игрока">${roundState.money}</div>
          <div class="player-vitals" aria-label="Здоровье и броня игрока">
            <span class="vital-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 21S4 16.2 4 9.4A4.4 4.4 0 0 1 12 6a4.4 4.4 0 0 1 8 3.4C20 16.2 12 21 12 21Z"/><path d="M12 8v7M8.5 11.5h7"/></svg></span>
            <span class="vital-value">${roundState.hp}</span><span class="vital-track" aria-hidden="true"><i style="width:${roundState.hp}%"></i></span>
            <span class="vital-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m12 3 7 3v5c0 4.5-2.7 7.9-7 10-4.3-2.1-7-5.5-7-10V6l7-3Z"/><path d="m9 12 2 2 4-4"/></svg></span>
            <span class="vital-value">${roundState.armor}</span><span class="player-utility">${utility}</span><span class="weapon-placeholder"><img src="assets/equipment/${primaryWeapon}" alt=""></span>
          </div>` : `<div class="player-hltv-row"><span>Match K/D <b>${row[0]}/${row[1]}</b></span><span>ADR <b>${row[3]}</b></span><span>RTG <b>${formatRating(row[4])}</b></span></div>`;

        const sideClass = currentSide ? `player-${currentSide.toLowerCase()}` : 'player-side-unknown';
        return `<li class="player ${sideClass}" data-player-id="${player.id}" tabindex="0">
          <div class="player-head">
            <span class="player-index">${index + 1}</span>
            <b class="player-nick">${player.name}</b>
            <span class="player-mini-stat" aria-label="Убийства"><b class="stat-letter">K</b><b data-round-stat="kills">${combat.kills}</b></span>
            <span class="player-mini-stat" aria-label="Смерти"><b class="stat-letter">D</b><b data-round-stat="deaths">${combat.deaths}</b></span>
            <span class="player-mini-stat" aria-label="Помощь"><b class="stat-letter">A</b><b data-round-stat="assists">${combat.assists}</b></span>
          </div>
          ${stateRow}
          <span class="player-popover"><strong>${player.name} · HLTV summary</strong><span class="mini-grid"><span>K-D<br><b>${row[0]}-${row[1]}</b></span><span>ADR<br><b>${row[3]}</b></span><span>Rating<br><b>${formatRating(row[4])}</b></span><span>Profile<br><b>${player.rank}</b></span></span></span>
        </li>`;
      })
      .join('');
  }

  // Protected Scoreboard component: rendering and layout are preserved.
  function renderScoreboard() {
    const source = scoreboardMode === 'total' ? data.stats.total : (data.stats[selectedMap] || data.stats.total);
    document.getElementById('scoreboard-subtitle').textContent = scoreboardMode === 'total'
      ? 'Статистика по всему матчу'
      : `Статистика карты ${selectedMap}`;
    const teams = currentTeams;

    document.getElementById('scoreboard-body').innerHTML = `<div class="scoreboard-grid">${teams.map((team) => {
      const teamPlayers = data.players
        .filter((player) => player.team === team.name)
        .sort((a, b) => kdValue(source.rows[b.id]) - kdValue(source.rows[a.id]));

      return `<section class="score-team" aria-label="${team.name} scoreboard">
        <div class="score-team-head">
          <div class="score-team-title"><img src="${team.logo}" alt="${team.name} logo"><span><b>${team.name}</b><small>${team.rank}</small></span></div>
        </div>
        <div class="stat-row stat-labels" aria-hidden="true"><div>Игрок</div><div class="stat-kd">K/D</div><div class="stat-adr">ADR</div><div class="stat-rating">RTG</div></div>
        ${teamPlayers.map((player) => {
          const row = source.rows[player.id] || ['—','—','—','—','—'];
          return `<div class="stat-row">
            <div class="stat-player"><span class="avatar"><img src="${avatarFor(player)}" alt="${player.name} avatar" onerror="this.remove(); this.parentElement.textContent='${player.name.slice(0,2).toUpperCase()}'"></span><span><b>${player.name}</b><small>${player.team}</small></span></div>
            <div class="stat-kd ${kdClass(row[0], row[1])}">${row[0]}/${row[1]}</div>
            <div class="stat-adr">${row[3]}</div>
            <div class="stat-rating">${formatRating(row[4])}</div>
          </div>`;
        }).join('')}
      </section>`;
    }).join('')}</div>`;
  }

  // Minimap data adapter
  function minimapPlayersFor(mapName) {
    const meta = data.mapMeta[mapName];
    const teamIndexes = { [currentTeams[0].name]:0, [currentTeams[1].name]:0 };

    return data.players.map((player) => {
      const weaponFile = data.primaryWeaponsByMap[mapName]?.[player.id] || 'glock.svg';
      const side = player.team === currentTeams[0].name ? meta.nuclearSide : meta.k27Side;

      return {
        id:player.id,
        nick:player.name,
        side,
        number:++teamIndexes[player.team],
        weapon:weaponFile.replace('.svg', '').replace('m4a1_silencer', 'M4A1-S').toUpperCase(),
        weaponUrl:`assets/equipment/${weaponFile}`
      };
    });
  }

  function stopReplay() {
    if (replayTimer) clearInterval(replayTimer);
    replayTimer = null;
    replayPlaying = false;
    const playButton = document.getElementById('round-play');
    if (playButton) { playButton.textContent = '▶'; playButton.setAttribute('aria-label', 'Воспроизвести раунд'); }
  }

  function timeLabel(seconds) {
    const value = Math.max(0, Math.floor(seconds));
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
  }

  function renderReplayEvents(events) {
    const container = document.getElementById('map-log');
    const previousScroll = container.querySelector('.log-stack')?.scrollTop || 0;
    const recent = events.filter((event) => ['kill','bomb_plant','bomb_defuse_start','bomb_defuse_abort','bomb_defuse','bomb_explode','round_start','round_end'].includes(event.type)).slice(-7).reverse();
    container.replaceChildren();
    const stack = document.createElement('div');
    stack.className = 'log-stack';
    recent.forEach((event) => {
      const row = document.createElement('div');
      row.className = `log-item replay-log-item ${event.type === 'kill' ? 'kill' : ['bomb_plant','bomb_defuse','bomb_explode'].includes(event.type) ? 'round' : 'system'}`;
      const timestamp = document.createElement('time');
      timestamp.className = 'replay-event-time';
      timestamp.textContent = timeLabel(event.at);
      const description = document.createElement('span');
      const source = event.actor?.nick || event.actor?.name || event.side;
      const target = event.target?.nick || event.target?.name;
      if (event.type === 'kill') {
        const iconName = weaponAsset(event.weapon);
        description.className = 'kill-event-content';
        const killer = document.createElement('span'); killer.className = `log-player ${event.side === 'CT' ? 'ct-name' : event.side === 'T' ? 't-name' : ''}`;
        killer.textContent = source || '—'; killer.title = killer.textContent;
        const victim = document.createElement('span'); victim.className = `log-player ${event.targetSide === 'CT' ? 'ct-name' : event.targetSide === 'T' ? 't-name' : ''}`;
        victim.textContent = target || '—'; victim.title = victim.textContent;
        const weapon = document.createElement('span'); weapon.className = 'kill-event-weapon';
        if (iconName) {
          const icon = document.createElement('img'); icon.className = 'replay-weapon-icon'; icon.src = `assets/equipment/${iconName}`; icon.alt = event.weapon; icon.title = event.weapon;
          weapon.append(icon);
        } else if (event.weapon) {
          weapon.textContent = weaponLabel(event.weapon);
        } else { weapon.textContent = '→'; }
        if (event.headshot) {
          const headshot = document.createElement('img'); headshot.src = 'assets/icons/headshot.png'; headshot.alt = 'В голову'; headshot.className = 'kill-headshot'; weapon.append(headshot);
        }
        description.append(killer, weapon, victim);
      } else {
      const effectTime = ['smoke','molotov'].includes(event.type) ? ` · ${Math.max(0, event.duration - (replayTime - event.at)).toFixed(0)} с` : '';
      description.textContent = `${source ? `${source} · ` : ''}${event.label}${target ? ` → ${target}` : ''}${effectTime}`;
      }
      row.append(timestamp, description);
      stack.appendChild(row);
    });
    if (!recent.length) {
      const empty = document.createElement('div');
      empty.className = 'log-item system';
      empty.textContent = 'Ожидание начала сценария';
      stack.appendChild(empty);
    }
    container.appendChild(stack);
    stack.scrollTop = previousScroll;
  }

  function renderMapEffects(snapshot) {
    const svg = document.getElementById('map-effects');
    const ns = 'http://www.w3.org/2000/svg';
    const activeKeys = new Set();
    const keepNode = (key, create) => {
      activeKeys.add(key);
      let node = persistentMapNodes.get(key);
      if (!node) {
        node = create();
        persistentMapNodes.set(key, node);
        svg.appendChild(node);
      }
      return node;
    };
    const pointAttr = (point, axis) => Math.round((point?.[axis] || 0) * 1000);
    const addLine = (key, from, to, className, color) => {
      if (!from || !to) return;
      const line = keepNode(key, () => document.createElementNS(ns, 'line'));
      line.setAttribute('x1', pointAttr(from, 'x')); line.setAttribute('y1', pointAttr(from, 'y'));
      line.setAttribute('x2', pointAttr(to, 'x')); line.setAttribute('y2', pointAttr(to, 'y'));
      line.setAttribute('class', className);
      if (color) line.style.stroke = color;
    };
    snapshot.activeEffects.forEach((effect) => {
      if (!effect.point) return;
      const center = { x:pointAttr({ x:effect.point[0], y:effect.point[1] }, 'x'), y:pointAttr({ x:effect.point[0], y:effect.point[1] }, 'y') };
      const elapsed = Math.max(0, snapshot.time - effect.at);
      const remaining = Math.max(0, effect.duration - elapsed);
      const fade = effect.duration > 3 ? Math.min(1, remaining / .9) : 1;
      const kind = effect.effectKind || effect.type;
      const key = `effect:${effect.id || `${kind}:${effect.at}`}`;
      const group = keepNode(key, () => {
        const created = document.createElementNS(ns, 'g');
        created.setAttribute('class', `effect-lifetime effect-${kind}`);
        const animated = document.createElementNS(ns, 'g'); animated.setAttribute('class', `detonation-effect detonation-${kind}`); created.appendChild(animated);
        const circle = (className, attrs) => { const el = document.createElementNS(ns, 'circle'); el.setAttribute('class', className); Object.entries(attrs).forEach(([name, value]) => el.setAttribute(name, String(value))); animated.appendChild(el); return el; };
        if (kind === 'smoke') {
          // Облако располагается в точке детонации под маркерами игроков.
          [[0,0,46],[14,-8,37],[-13,9,39],[5,15,33],[-23,-4,26],[23,13,27]].forEach(([x,y,r], i) => circle(`smoke-puff smoke-puff-${i + 1}`, {cx:x,cy:y,r}));
        } else if (kind === 'molotov' || kind === 'incendiary') {
          const ground = document.createElementNS(ns, 'ellipse'); ground.setAttribute('class', 'fire-ground'); ground.setAttribute('rx', '49'); ground.setAttribute('ry', '39'); animated.appendChild(ground);
          const spread = document.createElementNS(ns, 'ellipse'); spread.setAttribute('class', 'fire-spread'); spread.setAttribute('rx', '49'); spread.setAttribute('ry', '39'); animated.appendChild(spread);
          // Мягкие языки огня повторяют размытый всполох из референса без старых острых SVG-«лепестков».
          for (const [index, [x,y,rx,ry]] of [[-23,-7,10,15],[9,-18,11,17],[-5,10,13,16],[23,5,10,15],[-30,13,8,12],[28,-13,9,14]].entries()) {
            const flame = document.createElementNS(ns, 'ellipse'); flame.setAttribute('class', `fire-flame fire-flame-${index + 1}`);
            flame.setAttribute('cx', String(x)); flame.setAttribute('cy', String(y)); flame.setAttribute('rx', String(rx)); flame.setAttribute('ry', String(ry)); animated.appendChild(flame);
          }
        } else if (kind === 'he') {
          circle('he-blast-core', {cx:0,cy:0,r:16});
          circle('he-blast-ring he-blast-ring-1', {cx:0,cy:0,r:15});
          circle('he-blast-ring he-blast-ring-2', {cx:0,cy:0,r:15});
          circle('he-blast-ring he-blast-ring-3', {cx:0,cy:0,r:15});
          circle('detonation-pulse', {cx:0,cy:0,r:43});
        } else if (kind === 'flash') {
          circle('flash-burst-core', {cx:0,cy:0,r:21});
          circle('flash-burst-ring flash-burst-ring-1', {cx:0,cy:0,r:16});
          circle('flash-burst-ring flash-burst-ring-2', {cx:0,cy:0,r:16});
        } else circle('detonation-pulse', {cx:0,cy:0,r:22});
        // После раскрытия оставляем только время эффекта, без подписи и иконки гранаты.
        if (['smoke','molotov','incendiary'].includes(kind)) { const timer = document.createElementNS(ns, 'text'); timer.setAttribute('class', 'utility-timer'); timer.setAttribute('x', '0'); timer.setAttribute('y', '4'); animated.appendChild(timer); }
        return created;
      });
      group.setAttribute('transform', `translate(${center.x} ${center.y})`);
      group.style.opacity = String(fade);
      const timer = group.querySelector('.utility-timer');
      if (timer) timer.textContent = `${remaining.toFixed(1)}с`;
    });
    (snapshot.grenadeTracks || []).forEach((grenade) => {
      if (!grenade.path?.length) return;
      if (grenade.path.length > 1) {
        const points = grenade.path.map((point) => `${pointAttr(point, 'x')},${pointAttr(point, 'y')}`).join(' ');
        const trail = keepNode(`trail:${grenade.id}`, () => document.createElementNS(ns, 'polyline')); trail.setAttribute('points', points); trail.setAttribute('class', `grenade-trace${grenade.side ? ` side-${grenade.side.toLowerCase()}` : ''}`);
      }
      if (grenade.flying && grenade.icon) {
        const marker = keepNode(`flight:${grenade.id}`, () => document.createElementNS(ns, 'image'));
        marker.setAttribute('x', String(pointAttr(grenade.point, 'x') - 15)); marker.setAttribute('y', String(pointAttr(grenade.point, 'y') - 15));
        marker.setAttribute('width', '30'); marker.setAttribute('height', '30'); marker.setAttribute('href', `assets/equipment/${grenade.icon}`);
        marker.setAttribute('class', 'grenade-flight-icon'); marker.setAttribute('aria-label', `${grenade.type} · ${grenade.thrower || 'граната'}`);
      }
    });
    if (snapshot.bomb?.active && snapshot.bomb.point) {
      const group = keepNode('bomb', () => {
        const created = document.createElementNS(ns, 'g'); created.setAttribute('class', 'planted-bomb-marker');
        for (let i = 0; i < 2; i++) { const wave = document.createElementNS(ns, 'circle'); wave.setAttribute('r', '10'); wave.setAttribute('class', `bomb-wave bomb-wave-${i + 1}`); created.appendChild(wave); }
        const icon = document.createElementNS(ns, 'image'); icon.setAttribute('href', 'assets/equipment/c4.svg'); icon.setAttribute('x', '-11'); icon.setAttribute('y', '-11'); icon.setAttribute('width', '22'); icon.setAttribute('height', '22');
        const title = document.createElementNS(ns, 'title'); title.textContent = 'Бомба установлена'; created.append(icon, title); return created;
      });
      // В модели события точка хранится как [x, y], как и эффекты гранат.
      const bombPoint = { x:snapshot.bomb.point[0], y:snapshot.bomb.point[1] };
      group.setAttribute('transform', `translate(${pointAttr(bombPoint, 'x')} ${pointAttr(bombPoint, 'y')})`);
    }
    if (snapshot.activeShot) {
      const shotSideClass = snapshot.activeShot.side ? ` side-${snapshot.activeShot.side.toLowerCase()}` : '';
      addLine(`shot:${snapshot.activeShot.id}`, snapshot.activeShot.sourcePoint, snapshot.activeShot.targetPoint, `shot-trace${shotSideClass}`);
      if (snapshot.activeShot.sourcePoint && !snapshot.activeShot.targetPoint) {
        const pulse = keepNode(`shot-pulse:${snapshot.activeShot.id}`, () => document.createElementNS(ns, 'circle'));
        pulse.setAttribute('cx', pointAttr(snapshot.activeShot.sourcePoint, 'x'));
        pulse.setAttribute('cy', pointAttr(snapshot.activeShot.sourcePoint, 'y'));
        pulse.setAttribute('r', '18'); pulse.setAttribute('class', `shot-pulse${shotSideClass}`);
      }
    }
    for (const [key, node] of persistentMapNodes) {
      if (activeKeys.has(key)) continue;
      node.remove(); persistentMapNodes.delete(key);
    }
  }

  function weaponAsset(name) { return root.CSEquipment.asset(name); }

  function weaponLabel(name) {
    const key = String(name || '').toLowerCase().replace(/^weapon_/, '').replace(/[^a-z0-9]/g, '');
    const labels = { ak47:'AK-47', m4a1:'M4A4', m4a1s:'M4A1-S', awp:'AWP', galil:'Galil AR', galilar:'Galil AR', usp:'USP-S', usps:'USP-S', m4a1silencer:'M4A1-S', glock18:'Glock-18', glock:'Glock-18', famas:'FAMAS', aug:'AUG', sg553:'SG 553', sg556:'SG 553', deagle:'Desert Eagle', deserteagle:'Desert Eagle', p250:'P250', mp9:'MP9', mac10:'MAC-10', mp7:'MP7', mp5sd:'MP5-SD', ump45:'UMP-45', p90:'P90', ssg08:'SSG 08', scar20:'SCAR-20', negev:'Negev', m249:'M249', bizon:'PP-Bizon', nova:'Nova', xm1014:'XM1014', mag7:'MAG-7', sawedoff:'Sawed-Off', taser:'Zeus x27', knife:'Нож' };
    return labels[key] || String(name || 'Оружие').replace(/^weapon_/, '').replace(/_/g, ' ');
  }

  function utilityIcons(inventory) {
    const items = Array.isArray(inventory) ? inventory : [];
    const kinds = [
      [/smoke/i, 'smokegrenade.svg', 'Дымовая граната'], [/flash/i, 'flashbang.svg', 'Световая граната'],
      [/(he.?grenade|high explosive)/i, 'hegrenade.svg', 'Осколочная граната'], [/molotov/i, 'molotov.svg', 'Молотов'],
      [/incendiary/i, 'incgrenade.svg', 'Зажигательная граната'], [/decoy/i, 'decoy.svg', 'Ложная цель'], [/defus/i, 'defuser.svg', 'Набор сапёра']
    ];
    return kinds.filter(([pattern]) => items.some((item) => pattern.test(item))).map(([, icon, label]) => `<img src="assets/equipment/${icon}" alt="${label}" title="${label}">`).join('');
  }

  function updateRoundPlayerPanels(snapshot) {
    if (snapshot.source !== 'imported') return;
    const resolveRoster = (name, steamId) => root.PlayerIdentity?.resolveRosterPlayer(data.players, name, steamId)
      || data.players.find((player) => root.PlayerIdentity?.cleanName(player.name) === root.PlayerIdentity?.cleanName(name));
    const counts = new Map(data.players.map((player) => [player.id, { kills:0, deaths:0, assists:0 }]));
    const earlier = importedDemo?.maps?.[selectedMap]?.rounds?.filter(round => round.number < activeRound.number).flatMap(round => round.events) || [];
    const roundKills = new Map();
    snapshot.events.filter(event => event.type === 'kill' && event.actor?.id !== event.target?.id).forEach(event => {
      const killer = resolveRoster(event.actor?.name, event.actor?.id);
      if (killer) roundKills.set(killer.id, (roundKills.get(killer.id) || 0) + 1);
    });
    [...earlier, ...snapshot.events].filter((event) => event.type === 'kill').forEach((event) => {
      const killer = resolveRoster(event.actor?.name, event.actor?.id);
      const victim = resolveRoster(event.target?.name, event.target?.id);
      const assister = resolveRoster(event.assister, event.assisterId);
      if (killer && killer.id !== victim?.id && counts.has(killer.id)) counts.get(killer.id).kills += 1;
      if (victim && counts.has(victim.id)) counts.get(victim.id).deaths += 1;
      if (assister && counts.has(assister.id)) counts.get(assister.id).assists += 1;
    });
    const states = new Map(snapshot.players.map((player) => {
      const roster = resolveRoster(player.demoNick || player.nick, player.id);
      return roster ? [roster.id, player] : null;
    }).filter(Boolean));
    data.players.forEach((roster) => {
      const card = document.querySelector(`.player[data-player-id="${CSS.escape(String(roster.id))}"]`);
      if (!card) return;
      const combat = counts.get(roster.id);
      if (combat) Object.entries(combat).forEach(([key, value]) => { const node = card.querySelector(`[data-round-stat="${key}"]`); if (node) node.textContent = String(value); });
      const player = states.get(roster.id);
      if (!player) return;
      card.classList.toggle('is-round-dead', !player.alive);
      let state = card.querySelector('.player-round-vitals');
      if (!state) {
        state = document.createElement('div'); state.className = 'player-vitals player-round-vitals';
        card.querySelector('.player-hltv-row')?.replaceWith(state);
        if (!state.isConnected) card.appendChild(state);
      }
      const health = player.health == null ? '—' : String(player.health);
      const armor = player.armor == null ? '—' : String(player.armor);
      const weapon = weaponAsset(player.weapon);
      let summary = card.querySelector('.round-player-summary');
      if (!summary) { summary = document.createElement('div'); summary.className = 'round-player-summary'; card.insertBefore(summary, state); }
      summary.innerHTML = `<span class="player-money" aria-label="Деньги игрока">${player.money == null ? '—' : player.money}</span><span class="round-kills" title="Убийства в этом раунде" aria-label="Убийств в раунде: ${roundKills.get(roster.id) || 0}"><img src="assets/icons/kill.png" alt=""><b>${roundKills.get(roster.id) || 0}</b></span>`;
      state.innerHTML = `<span class="vital-icon"><img src="assets/icons/health.webp" alt="HP"></span><span class="vital-value">${health}</span><span class="vital-track" aria-hidden="true"><i style="width:${Math.max(0, Math.min(100, Number(health) || 0))}%"></i></span><span class="vital-icon"><img src="assets/equipment/armor.svg" alt="Броня"></span><span class="vital-value">${armor}</span><span class="player-utility">${utilityIcons(player.inventory)}</span><span class="weapon-placeholder">${weapon ? `<img src="assets/equipment/${weapon}" alt="Оружие">` : ''}</span>`;
    });
  }

  function updateReplayHud(snapshot) {
    document.getElementById('round-clock').textContent = timeLabel(snapshot.time);
    const bombClock = document.getElementById('bomb-clock');
    bombClock.classList.toggle('is-planted', snapshot.bomb.planted && snapshot.bomb.secondsRemaining > 0);
      bombClock.textContent = snapshot.bomb.planted ? (snapshot.bomb.result === 'defused' ? 'Снята' : snapshot.bomb.result === 'exploded' || snapshot.bomb.secondsRemaining === 0 ? 'Взорвалась' : timeLabel(snapshot.bomb.secondsRemaining)) : '—';
    const defuseLabel = document.getElementById('bomb-defuse-label');
    const defuseClock = document.getElementById('bomb-defuse-clock');
    defuseLabel.hidden = defuseClock.hidden = !snapshot.bomb.defuseActive;
    if (snapshot.bomb.defuseActive) defuseClock.textContent = timeLabel(snapshot.bomb.defuseSecondsRemaining);
    const chance = document.getElementById('round-chance');
    chance.textContent = snapshot.source === 'imported' ? `${snapshot.aliveT} : ${snapshot.aliveCt}` : `${snapshot.chanceT}% · T`;
    chance.title = snapshot.source === 'imported' ? 'Живые игроки: T : CT. Это фактический счёт игроков в демо, не вероятность исхода.' : 'Демонстрационная оценка по числу оставшихся игроков, не предсказание исхода раунда.';
    chance.previousElementSibling.textContent = snapshot.source === 'imported' ? 'ЖИВЫ · T : CT' : 'ШАНС · ДЕМО';
    document.querySelector('.map-demo-badge').textContent = snapshot.source === 'imported' ? `Импорт демо · раунд ${activeRound?.number || ''} · реальные координаты` : 'Демонстрационный сценарий · не live-данные';
    if (snapshot.source === 'imported') {
      updateRoundTeamSides(snapshot.players);
      updateMapFloor(snapshot.mapName, snapshot.players);
      updateRoundPlayerPanels(snapshot);
    }
    document.getElementById('round-seek').value = String(snapshot.time);
    document.getElementById('round-seek').max = String(snapshot.duration);
    document.getElementById('round-time-readout').textContent = `${timeLabel(snapshot.time)} / ${timeLabel(snapshot.duration)}`;
    renderMapEffects(snapshot);
    renderReplayEvents(snapshot.events);
    minimapController.update({ mapName:selectedMap, players:snapshot.players.map(player => ({ ...player, weaponUrl:weaponAsset(player.weapon) ? 'assets/equipment/' + weaponAsset(player.weapon) : '' })), recentDamage:snapshot.recentDamage, source:'demo' });
    minimapController.selectPlayer(selectedPlayerId);
    if (selectedPlayerId) {
      const selected = snapshot.players.find((player) => player.id === selectedPlayerId && player.alive);
      if (!selected) { selectedPlayerId = null; applyCamera(); }
      else applyCamera(selected.position);
    }
  }

  function updateMapFloor(mapName, players) {
    const sections = root.CSRadarConfig.MAP_OVERVIEWS[mapName]?.verticalSections;
    if (!sections) return;
    const heights = players.map((player) => Number(player.position?.z)).filter(Number.isFinite).sort((a, b) => a - b);
    if (!heights.length) return;
    const median = heights[Math.floor(heights.length / 2)];
    const floor = median < sections.upper.min ? 'lower' : 'upper';
    setRadarAsset(mapName, floor);
  }

  function updateRoundTeamSides(players) {
    const teams = [root.ActiveMatch?.teamA, root.ActiveMatch?.teamB];
    const sideForTeam = (team) => {
      const roster = new Set((team?.players || []).map(([nick]) => String(nick).toLowerCase()));
      const counts = { T:0, CT:0 };
      players.forEach((player) => { if (roster.has(player.nick.toLowerCase()) && counts[player.side] !== undefined) counts[player.side] += 1; });
      return counts.CT === counts.T ? null : counts.CT > counts.T ? 'CT' : 'T';
    };
    const [sideA, sideB] = teams.map(sideForTeam);
    if (sideA) { data.mapMeta[selectedMap].nuclearSide = sideA; setSideBadge('nuclear-map-side', sideA); }
    if (sideB) { data.mapMeta[selectedMap].k27Side = sideB; setSideBadge('k27-map-side', sideB); }
    [['t-players', sideA], ['ct-players', sideB]].forEach(([id, side]) => {
      if (!side) return;
      document.querySelectorAll(`#${id} .player`).forEach((player) => {
        player.classList.toggle('player-t', side === 'T');
        player.classList.toggle('player-ct', side === 'CT');
      });
    });
  }

  function applyCamera(position) {
    const world = document.getElementById('map-world');
    const followButton = document.getElementById('map-follow');
    followButton.setAttribute('aria-pressed', String(Boolean(position)));
    followButton.textContent = position ? '⊙ Сбросить камеру' : '◎ Выбрать игрока';
    if (!position) { world.style.transform = ''; return; }
    const radar = root.CSMinimap.worldToRadar(selectedMap, position);
    const width = world.clientWidth;
    const height = world.clientHeight;
    const imageRatio = minimapController.radarImage.naturalWidth / minimapController.radarImage.naturalHeight || 1;
    const scale = Math.min(width / minimapController.radarImage.naturalWidth, height / minimapController.radarImage.naturalHeight);
    const imageWidth = minimapController.radarImage.naturalWidth * scale;
    const imageHeight = minimapController.radarImage.naturalHeight * scale;
    const x = (width - imageWidth) / 2 + radar.x * imageWidth;
    const y = (height - imageHeight) / 2 + radar.y * imageHeight;
    const zoom = 1.75;
    world.style.transform = `translate(${width / 2 - x * zoom}px, ${height / 2 - y * zoom}px) scale(${zoom})`;
  }

  function renderReplayAt(seconds) {
    if (!roundReplay) return;
    replayTime = Math.max(0, Math.min(roundReplay.length, Number(seconds) || 0));
    updateReplayHud(roundReplay.getSnapshot(replayTime));
  }

  function startReplay(mapName) {
    if (!root.CSRadarConfig.MAP_OVERVIEWS[mapName] || (!root.CSMockCoordinates.hasMap(mapName) && !importedDemo?.maps?.[mapName])) {
      stopReplay();
      minimapController.disconnect();
      document.getElementById('player-layer').innerHTML = '';
      clearPersistentMapNodes();
      document.getElementById('map-live-state').textContent = 'Нет координат';
      return;
    }
    const radarImage = minimapController.radarImage;
    if (!radarImage.complete || radarImage.dataset.radarLoading === 'true') {
      if (radarImage.dataset.mockNavigationPending !== mapName) {
        radarImage.dataset.mockNavigationPending = mapName;
        radarImage.addEventListener('load', () => {
          if (selectedMap === mapName && root.ActiveMatch) startReplay(mapName);
        }, { once:true });
      }
      return;
    }
    minimapController.setMap(mapName);
    minimapController.disconnect();
    const mapDemo = importedDemo?.maps?.[mapName];
    const selector = document.getElementById('round-select');
    activeRound = mapDemo?.rounds?.find((round) => round.number === Number(selector.value)) || mapDemo?.rounds?.[0] || null;
    if (activeRound) {
      const playerNicknames = Object.create(null);
      const playerNumbers = Object.create(null);
      data.players.forEach((player, index) => {
        const identity = root.PlayerIdentity?.findProfile(player.name || player.full, player.steamId);
        const steamId = identity?.steamId || player.steamId;
        if (steamId) { playerNicknames[String(steamId)] = player.name; playerNumbers[String(steamId)] = index + 1; }
      });
      roundReplay = root.CSRoundReplay.createFromDemo(mapName, activeRound, { tickRate:mapDemo.tickRate, playerNicknames, playerNumbers });
      selector.innerHTML = mapDemo.rounds.map((round) => `<option value="${round.number}">Раунд ${round.number}</option>`).join('');
      selector.value = String(activeRound.number);
      document.getElementById('map-live-state').textContent = 'ИМПОРТ · ДЕМО';
      document.getElementById('round-console-hint').textContent = 'Координаты игроков и траектории гранат разобраны из загруженного демо.' + (mapDemo.skippedRounds?.some(round => round.retained) ? ' Пистолетный раунд сохранён; технические убийства world не входят в KDA.' : '');
    } else {
      roundReplay = root.CSRoundReplay.create(mapName, minimapPlayersFor(mapName), { radarImage:minimapController.radarImage });
      selector.innerHTML = '<option value="1">Раунд 1</option>';
      selector.value = '1';
      document.getElementById('map-live-state').textContent = 'ДЕМО · MOCK';
      document.getElementById('round-console-hint').textContent = 'Mock-сценарий для интерфейса; позиции привязаны к проходимой области радара.';
    }
    replayTime = 0;
    selectedPlayerId = null;
    applyCamera();
    renderReplayAt(0);
    if (replayPlaying) playReplay();
  }

  function playReplay() {
    if (!roundReplay || replayPlaying) return;
    replayPlaying = true;
    const button = document.getElementById('round-play');
    button.textContent = 'Ⅱ'; button.setAttribute('aria-label', 'Пауза');
    replayTimer = setInterval(() => {
      const next = replayTime + .1 * replaySpeed;
      if (next >= roundReplay.length) {
        stopReplay();
        renderReplayAt(roundReplay.length);
      } else renderReplayAt(next);
    }, 100);
  }

  function bindReplayControls() {
    document.getElementById('round-play').addEventListener('click', () => replayPlaying ? stopReplay() : playReplay());
    document.getElementById('round-reset').addEventListener('click', () => { stopReplay(); renderReplayAt(0); });
    document.getElementById('round-seek').addEventListener('input', (event) => renderReplayAt(event.target.value));
    document.getElementById('round-speed').addEventListener('change', (event) => { replaySpeed = Number(event.target.value) || 1; });
    document.getElementById('round-select').addEventListener('change', () => { stopReplay(); startReplay(selectedMap); });
    document.getElementById('map-follow').addEventListener('click', () => {
      if (selectedPlayerId) { selectedPlayerId = null; minimapController.selectPlayer(null); applyCamera(); }
      else document.querySelector('.map-player-dot')?.focus();
    });
    document.getElementById('player-layer').addEventListener('click', (event) => {
      const button = event.target.closest('.map-player-dot');
      if (!button) return;
      const marker = button.closest('.map-player');
      selectedPlayerId = selectedPlayerId === marker?.dataset.playerId ? null : marker?.dataset.playerId;
      minimapController.selectPlayer(selectedPlayerId);
      const player = roundReplay.getSnapshot(replayTime).players.find((item) => item.id === selectedPlayerId);
      applyCamera(player?.position);
    });
  }

  function setRadarAsset(mapName, layer) {
    const image = minimapController?.radarImage;
    if (!image || !root.CSRadarConfig.MAP_OVERVIEWS[mapName]) return;
    const url = root.CSRadarConfig.getRadarAsset(mapName, layer);
    if (image.dataset.radarKey === url && image.complete && image.naturalWidth) return;
    image.dataset.radarKey = url;
    image.dataset.radarLoading = 'true';
    image.hidden = true;
    const finish = () => {
      if (image.dataset.radarKey !== url) return;
      image.dataset.radarLoading = 'false';
      image.hidden = false;
    };
    image.addEventListener('load', finish, { once:true });
    image.addEventListener('error', () => {
      if (image.dataset.radarKey !== url) return;
      image.dataset.radarLoading = 'false';
      document.getElementById('map-live-state').textContent = 'Ошибка радара';
    }, { once:true });
    if (url.toLowerCase().endsWith('.dds')) {
      root.CSDdsRadar.loadIntoImage(image, url).catch((error) => {
        if (image.dataset.radarKey === url) {
          image.dataset.radarLoading = 'false';
          console.error(error);
        }
      });
    } else {
      image.src = url;
      if (image.complete && image.naturalWidth) finish();
    }
  }

  // Match view orchestration
  function renderMap() {
    const current = data.stats[selectedMap];
    const meta = data.mapMeta[selectedMap] || { nuclearSide:'T', k27Side:'CT', halfScore:[], status:root.ActiveMatch?.statusLabel || 'Завершен', winner:null };
    const tacticalMap = document.getElementById('tactical-map');
    const radarImage = document.getElementById('radar-image');

    document.getElementById('selected-map-name').textContent = selectedMap;
    document.getElementById('map-title').textContent = selectedMap;
    document.getElementById('map-layout-name').textContent = selectedMap;
    document.getElementById('map-copy-title').textContent = selectedMap;
    document.getElementById('map-score').textContent = current?.score || '— : —';
    document.getElementById('map-half-score').innerHTML = renderHalfScore(meta.halfScore || []);
    document.getElementById('map-status').textContent = `${meta.status || 'Завершен'} · ${currentTeams[0].name} vs ${currentTeams[1].name}`;

    tacticalMap.className = `tactical-map map-${selectedMap.toLowerCase()} has-radar`;
    radarImage.alt = `${selectedMap} radar overview`;
    setRadarAsset(selectedMap, 'upper');
    document.getElementById('map-shapes').innerHTML = '';
    document.getElementById('map-log').innerHTML = `<div class="log-stack">${(data.mapLogs[selectedMap] || []).map(renderLogItem).join('')}</div>`;

    setSideBadge('nuclear-map-side', meta.nuclearSide);
    setSideBadge('k27-map-side', meta.k27Side);
    document.getElementById('nuclear-panel-head').classList.toggle('map-winner', meta.winner === currentTeams[0].name);
    document.getElementById('k27-panel-head').classList.toggle('map-winner', meta.winner === currentTeams[1].name);

    renderPlayerList('t-players', currentTeams[0].name);
    renderPlayerList('ct-players', currentTeams[1].name);
    startReplay(selectedMap);
    renderScoreboard();
  }

  function bindControls() {
    document.querySelector('.maps').addEventListener('click', (event) => {
      const button = event.target.closest('.map-btn');
      if (!button) return;
      document.querySelectorAll('.map-btn').forEach((item) => item.setAttribute('aria-pressed', 'false'));
      button.setAttribute('aria-pressed', 'true');
      selectedMap = button.dataset.map;
      renderMap();
    });

    document.querySelectorAll('.stat-mode button').forEach((button) => button.addEventListener('click', () => {
      document.querySelectorAll('.stat-mode button').forEach((item) => item.setAttribute('aria-pressed', 'false'));
      button.setAttribute('aria-pressed', 'true');
      scoreboardMode = button.dataset.mode;
      renderScoreboard();
    }));
  }

  function exposeMinimapAdapter() {
    root.matchMinimap = {
      connect(source, label = 'Live') {
        stopReplay();
        minimapController.connect(source);
        document.getElementById('map-live-state').textContent = label;
      },
      update(snapshot) {
        stopReplay();
        minimapController.disconnect();
        minimapController.update(snapshot);
        document.getElementById('map-live-state').textContent = 'Live';
      },
      useMock() {
        startReplay(selectedMap);
      }
    };
  }

  function init() {
    if (initialized) return;
    initialized = true;
    minimapController = new root.CSMinimap.MinimapController({
      root:document.getElementById('map-world'),
      layer:document.getElementById('player-layer'),
      radarImage:document.getElementById('radar-image')
    });
    bindControls();
    bindReplayControls();
    exposeMinimapAdapter();
    renderMap();
  }

  function setActive(active) {
    if (!initialized) return;
    if (active) startReplay(selectedMap);
    else { stopReplay(); minimapController.disconnect(); }
  }

  function winnerForScore(score, teamA, teamB) {
    const [a, b] = String(score).split(':').map((part) => Number(part.trim()));
    if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return null;
    return a > b ? teamA : teamB;
  }

  function mockStatRow(playerIndex, mapIndex, teamIndex, total = false) {
    const factor = total ? 3 : 1;
    const kills = (10 + ((playerIndex * 3 + mapIndex * 2 + teamIndex) % 9)) * factor;
    const deaths = (9 + ((playerIndex * 2 + mapIndex + teamIndex * 2) % 8)) * factor;
    const adr = 62 + ((playerIndex * 7 + mapIndex * 5 + teamIndex * 3) % 39);
    const rating = .82 + ((playerIndex * 9 + mapIndex * 4 + teamIndex * 5) % 54) / 100;
    return [String(kills), String(deaths), '-', adr.toFixed(1), rating.toFixed(2)];
  }

  function mockRoundState(playerIndex, teamIndex) {
    const grenades = [[],['smokegrenade.svg'],['flashbang.svg'],['hegrenade.svg'],['molotov.svg','flashbang.svg']];
    return {
      kills:(playerIndex + teamIndex) % 3,
      assists:(playerIndex * 2 + teamIndex) % 2,
      deaths:(playerIndex + teamIndex + 1) % 2,
      money:[150,350,0,500,800][playerIndex % 5],
      hp:[100,82,64,100,46][(playerIndex + teamIndex) % 5],
      armor:[100,100,57,85,0][playerIndex % 5],
      grenades:grenades[(playerIndex + teamIndex) % grenades.length]
    };
  }

  function mockHalfScore(score) {
    const [a, b] = String(score).split(':').map((part) => Number(part.trim()));
    if (!Number.isFinite(a) || !Number.isFinite(b)) return [];
    const firstA = Math.ceil(a * .55);
    const firstB = Math.ceil(b * .55);
    return [[firstA, firstB], [a - firstA, b - firstB]];
  }

  function loadMatch(match) {
    currentTeams = [match.teamA, match.teamB];
    const maps = match.maps.length ? match.maps : [['TBA','— : —']];
    const legacyMatch = match.id === '2379601';
    isExternalMatch = !legacyMatch;
    importedDemo = null;
    activeRound = null;

    if (legacyMatch) {
      restoreLegacyState();
    } else {
      const players = [match.teamA, match.teamB].flatMap((team, teamIndex) => team.players.map(([name, full, photo], playerIndex) => {
        const identity = root.PlayerIdentity?.findProfile(name);
        return { id:name, name, full, photo, team:team.name, rank:'HLTV profile', teamIndex, playerIndex, identityId:identity?.id || null, steamId:identity?.steamId || null, aliases:identity?.aliases || [] };
      }));
      const totalRows = Object.fromEntries(players.map((player) => {
        const row = match.stats?.[player.id];
        return [player.id, row ? [String(row[0]),String(row[1]),'-',row[2],row[3]] : mockStatRow(player.playerIndex, 0, player.teamIndex, true)];
      }));
      const weapons = ['ak47.svg','m4a1.svg','awp.svg','m4a1_silencer.svg','galilar.svg'];

      data.players = players;
      data.stats = { total:{ rows:totalRows } };
      data.mapMeta = {};
      data.mapLogs = {};
      data.radarImages = {};
      data.firstRoundState = Object.fromEntries(players.map((player) => [player.id, mockRoundState(player.playerIndex, player.teamIndex)]));
      data.bombCarrierByMap = {};
      data.primaryWeaponsByMap = {};

      maps.forEach(([name, score], mapIndex) => {
        const winner = winnerForScore(score, match.teamA.name, match.teamB.name);
        const teamASide = mapIndex % 2 === 0 ? 'T' : 'CT';
        const teamBSide = teamASide === 'T' ? 'CT' : 'T';
        data.stats[name] = { score, rows:Object.fromEntries(players.map((player) => [player.id, mockStatRow(player.playerIndex, mapIndex, player.teamIndex)])) };
        data.mapMeta[name] = { winner, nuclearSide:teamASide, k27Side:teamBSide, halfScore:mockHalfScore(score), status:match.statusLabel };
        data.mapLogs[name] = [{ type:'system', text:'Демонстрационный раунд · mock live' }];
        data.radarImages[name] = name === 'TBA' ? 'assets/radar/default_png.png' : `assets/radar/de_${name.toLowerCase()}_radar.png`;
        data.primaryWeaponsByMap[name] = Object.fromEntries(players.map((player) => [player.id, weapons[(player.playerIndex + mapIndex + player.teamIndex) % weapons.length]]));
        const tTeam = teamASide === 'T' ? match.teamA : match.teamB;
        data.bombCarrierByMap[name] = tTeam.players[0]?.[0];
      });
    }

    selectedMap = maps[0][0];
    scoreboardMode = legacyMatch ? 'map' : 'total';
    document.querySelectorAll('.stat-mode button').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.mode === scoreboardMode)));
    document.querySelector('.maps').innerHTML = maps.map(([name, score], index) => `<button class="map-btn" type="button" data-map="${name}" aria-pressed="${index === 0}">${name}<small>${match.teamA.name} ${score} ${match.teamB.name}</small></button>`).join('');

    document.querySelector('.hero-score .event').textContent = `${match.tournament} · ${match.stage}`;
    document.getElementById('series-score').textContent = match.score;
    document.getElementById('detail-match-context').innerHTML = `${match.statusLabel} · ${match.bestOf} · <a href="${match.source}" target="_blank" rel="noopener">Источник HLTV</a>`;
    document.getElementById('series-status').innerHTML = `${match.statusLabel} · ${match.bestOf} · выбранная карта: <b id="selected-map-name">${selectedMap}</b>`;
    [['a',match.teamA],['b',match.teamB]].forEach(([side, team]) => {
      document.getElementById(`team-${side}-name`).textContent = team.name;
      document.getElementById(`team-${side}-logo`).src = team.logo;
      document.getElementById(`team-${side}-logo`).alt = `${team.name} logo`;
      document.getElementById(`team-${side}-card`).setAttribute('aria-label', team.name);
      document.getElementById(`team-${side}-ranks`).innerHTML = `<span class="rank-chip">${team.rank}</span><span class="rank-chip">${team.vrs}</span>`;
    });
    document.getElementById('t-title').textContent = match.teamA.name;
    document.getElementById('ct-title').textContent = match.teamB.name;
    const analyticsDescription = document.querySelector('#match-analytics-panel .analytics-hero p');
    if (analyticsDescription) {
      analyticsDescription.textContent = `${match.teamA.name} — ${match.teamB.name}: форма команд и очные встречи по данным Liquipedia.`;
    }
    root.ActiveMatch = match;
    renderMap();
    const loadToken = ++demoLoadToken;
    if (root.DemoApi) {
      root.DemoApi.get(match.id).then(async (parsed) => {
        await root.Players?.ready?.();
        if (!parsed || loadToken !== demoLoadToken || root.ActiveMatch?.id !== match.id) return;
        importedDemo = parsed;
        const importedNames = Object.keys(parsed.maps || {});
        const matchNames = maps.filter(([name]) => name !== 'TBA').map(([name]) => name);
        const mapNames = [...new Set([...matchNames, ...importedNames])];
        const scoreByMap = new Map(maps.map(([name, score]) => [name, score]));
        document.querySelector('.maps').innerHTML = mapNames.map((name, index) => `<button class="map-btn" type="button" data-map="${name}" aria-pressed="${name === selectedMap}">${name}<small>Map ${index + 1} · ${match.teamA.name} ${scoreByMap.get(name) || '— : —'} ${match.teamB.name}</small></button>`).join('');
        Object.entries(parsed.maps).forEach(([name, map]) => {
          const rows = Object.create(null);
          const mappedStats = root.PlayerIdentity?.matchMapStats(data.players, map) || Object.create(null);
          data.players.forEach((player) => {
            const stat = mappedStats[player.id];
            if (stat) rows[player.id] = [String(stat.kills), String(stat.deaths), '—', String(stat.adr), null];
            data.firstRoundState[player.id] = null;
          });
          data.stats[name] = { score:scoreByMap.get(name) || '— : —', rows };
          data.mapMeta[name] ||= { winner:null, nuclearSide:'T', k27Side:'CT', halfScore:[], status:match.statusLabel };
          // У импортированной карты не оставляем строки старого mock kill log и снаряжение-заглушку.
          data.mapLogs[name] = [];
          data.bombCarrierByMap[name] = null;
          data.primaryWeaponsByMap[name] = {};
          data.radarImages[name] = `assets/radar/${root.CSRadarConfig.MAP_OVERVIEWS[name]?.id || `de_${name.toLowerCase()}`}_radar.png`;
        });
        const totals = Object.create(null);
        Object.values(parsed.maps).forEach((map) => {
          const mappedStats = root.PlayerIdentity?.matchMapStats(data.players, map) || Object.create(null);
          Object.entries(mappedStats).forEach(([playerId, stat]) => {
            totals[playerId] ||= { kills:0, deaths:0, assists:0, damage:0, rounds:0 };
            totals[playerId].kills += stat.kills || 0; totals[playerId].deaths += stat.deaths || 0;
            totals[playerId].assists += stat.assists || 0; totals[playerId].damage += stat.damage || 0;
            totals[playerId].rounds += map.rounds?.length || 0;
          });
        });
        const totalRows = Object.create(null);
        data.players.forEach((player) => {
          const stat = totals[player.id];
          if (stat) totalRows[player.id] = [String(stat.kills), String(stat.deaths), '—', String(Number((stat.damage / Math.max(1, stat.rounds)).toFixed(1))), null];
        });
        data.stats.total = { rows:totalRows };
        if (!importedNames.includes(selectedMap)) selectedMap = importedNames[0];
        scoreboardMode = 'map';
        document.querySelectorAll('.stat-mode button').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.mode === scoreboardMode)));
        document.querySelectorAll('.map-btn').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.map === selectedMap)));
        renderMap();
      }).catch((error) => console.warn('Не удалось загрузить импортированное демо:', error));
    }
  }

  root.MatchView = { init, setActive, loadMatch };
})(window);
