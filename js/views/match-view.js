(function initMatchViewModule(root) {
  'use strict';

  const data = root.MatchData;
  let selectedMap = 'Anubis';
  let scoreboardMode = 'map';
  let minimapController = null;
  let initialized = false;
  let isExternalMatch = false;
  let currentTeams = [
    { name:'Nuclear TigeRES', logo:data.teamLogo.nuclear, rank:'HLTV #123' },
    { name:'K27', logo:data.teamLogo.k27, rank:'HLTV #87' }
  ];
  const mutableDataKeys = ['players','stats','mapMeta','mapLogs','radarImages','firstRoundState','bombCarrierByMap','primaryWeaponsByMap'];
  const legacyState = Object.fromEntries(mutableDataKeys.map((key) => [key, JSON.parse(JSON.stringify(data[key]))]));

  function restoreLegacyState() {
    mutableDataKeys.forEach((key) => { data[key] = JSON.parse(JSON.stringify(legacyState[key])); });
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
    const source = isExternalMatch ? data.stats.total : (data.stats[selectedMap] || data.stats.total);
    const currentSide = teamName === currentTeams[0].name
      ? data.mapMeta[selectedMap].nuclearSide
      : data.mapMeta[selectedMap].k27Side;

    document.getElementById(target).innerHTML = data.players
      .filter((player) => player.team === teamName)
      .map((player, index) => {
        const row = source?.rows[player.id] || data.stats.total.rows[player.id] || ['—','—','—','—','—'];
        const roundState = data.firstRoundState[player.id];
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
        return `<li class="player ${sideClass}" tabindex="0">
          <div class="player-head">
            <span class="player-index">${index + 1}</span>
            <b class="player-nick">${player.name}</b>
            <span class="player-mini-stat" aria-label="Убийства"><b class="stat-letter">K</b><b>${combat.kills}</b></span>
            <span class="player-mini-stat" aria-label="Смерти"><b class="stat-letter">D</b><b>${combat.deaths}</b></span>
            <span class="player-mini-stat" aria-label="Помощь"><b class="stat-letter">A</b><b>${combat.assists}</b></span>
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

  function useMockMinimap(mapName) {
    if (!root.CSRadarConfig.MAP_OVERVIEWS[mapName] || !root.CSMockCoordinates.hasMap(mapName)) {
      minimapController.disconnect();
      document.getElementById('player-layer').innerHTML = '';
      document.getElementById('map-live-state').textContent = 'Нет координат';
      return;
    }
    minimapController.setMap(mapName);
    minimapController.connect(new root.CSMinimap.MockMinimapSource({
      mapName,
      players:minimapPlayersFor(mapName)
    }));
    document.getElementById('map-live-state').textContent = 'Mock live';
  }

  // Match view orchestration
  function renderMap() {
    const current = data.stats[selectedMap];
    const meta = data.mapMeta[selectedMap];
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
    radarImage.src = data.radarImages[selectedMap] || 'assets/radar/default_png.png';
    radarImage.alt = `${selectedMap} radar overview`;
    radarImage.hidden = false;
    document.getElementById('map-shapes').innerHTML = '';
    document.getElementById('map-log').innerHTML = `<div class="log-stack">${(data.mapLogs[selectedMap] || []).map(renderLogItem).join('')}</div>`;

    setSideBadge('nuclear-map-side', meta.nuclearSide);
    setSideBadge('k27-map-side', meta.k27Side);
    document.getElementById('nuclear-panel-head').classList.toggle('map-winner', meta.winner === currentTeams[0].name);
    document.getElementById('k27-panel-head').classList.toggle('map-winner', meta.winner === currentTeams[1].name);

    useMockMinimap(selectedMap);
    renderPlayerList('t-players', currentTeams[0].name);
    renderPlayerList('ct-players', currentTeams[1].name);
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
        minimapController.connect(source);
        document.getElementById('map-live-state').textContent = label;
      },
      update(snapshot) {
        minimapController.disconnect();
        minimapController.update(snapshot);
        document.getElementById('map-live-state').textContent = 'Live';
      },
      useMock() {
        useMockMinimap(selectedMap);
      }
    };
  }

  function init() {
    if (initialized) return;
    initialized = true;
    minimapController = new root.CSMinimap.MinimapController({
      root:document.getElementById('tactical-map'),
      layer:document.getElementById('player-layer'),
      radarImage:document.getElementById('radar-image')
    });
    bindControls();
    exposeMinimapAdapter();
    renderMap();
  }

  function setActive(active) {
    if (!initialized) return;
    if (active) useMockMinimap(selectedMap);
    else minimapController.disconnect();
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

    if (legacyMatch) {
      restoreLegacyState();
    } else {
      const players = [match.teamA, match.teamB].flatMap((team, teamIndex) => team.players.map(([name, full, photo], playerIndex) => ({ id:name, name, full, photo, team:team.name, rank:'HLTV profile', teamIndex, playerIndex })));
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
      analyticsDescription.textContent = `Подтверждённые карты и общая статистика игроков: ${match.teamA.name} — ${match.teamB.name}.`;
    }
    root.ActiveMatch = match;
    renderMap();
  }

  root.MatchView = { init, setActive, loadMatch };
})(window);
