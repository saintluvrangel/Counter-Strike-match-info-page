const fallbackAvatar = 'https://www.hltv.org/img/static/player/player_silhouette.png';
    const teamLogo = {
      nuclear: 'https://img-cdn.hltv.org/teamlogo/GcO3SLh1j8cgiNGoEXNUVS.png?ixlib=java-2.1.0&s=856dc9f0ffdbeedbe76d9874fbcdb546&w=50',
      k27: 'https://img-cdn.hltv.org/teamlogo/7LmOZHYhlq-fIAm23aM2q1.png?ixlib=java-2.1.0&s=e194cf9c20b306723ae899eac0e8a356&w=50'
    };
    const players = [
      { id:'senka', name:'senka', full:'Arseniy Kozlovsky', team:'Nuclear TigeRES', side:'T', rank:'#47 current / #38 peak', photo:'https://img-cdn.hltv.org/playerbodyshot/eDZ47qVhKR6T_d1xiC6vFO.png?ixlib=java-2.1.0&s=8018a1ab20f53358d4df78a9607ca14c&w=400' },
      { id:'flouzer', name:'flouzer', full:'Ilya Selifonov', team:'Nuclear TigeRES', side:'T', rank:'HLTV profile', photo:'https://img-cdn.hltv.org/playerbodyshot/raSGvazp2eJUaBEQ3VAfnQ.png?ixlib=java-2.1.0&s=614db791b09d3b1ad0613fe16dc3b777&w=400' },
      { id:'k0s', name:'k0s', full:'Matvey Abramov', team:'Nuclear TigeRES', side:'T', rank:'HLTV profile', photo:'https://img-cdn.hltv.org/playerbodyshot/VYl2SXeVj3feQFMrVIbVbN.png?ixlib=java-2.1.0&s=0db0bf1e7d29bf4629f6893ec13ea8c9&w=400' },
      { id:'h1kaN', name:'h1kaN', full:'Yuriy Rotar', team:'Nuclear TigeRES', side:'T', rank:'HLTV profile', photo:'https://img-cdn.hltv.org/playerbodyshot/aepjG-2DfBqVRi_PvPu55v.png?ixlib=java-2.1.0&s=e75e94680b5ef84ea3cd74217fc54fb2&w=400' },
      { id:'fluffy', name:'fluffy', full:'Vladislav Galimov', team:'Nuclear TigeRES', side:'T', rank:'HLTV profile', photo:'https://img-cdn.hltv.org/playerbodyshot/zavLCBfyGSmHFgxufhxTlf.png?ixlib=java-2.1.0&s=2d19f037b651ab8da7ec76af9e7ea6fb&w=400' },
      { id:'kashl1d', name:'kashl1d', full:'Danila Dronov', team:'K27', side:'CT', rank:'Top player in match', photo:'https://img-cdn.hltv.org/playerbodyshot/wNGdRx4DbLG4EZHXhOqxQI.png?ixlib=java-2.1.0&s=6f62e0ba8ea11f8948b0ff198ca2af99&w=400' },
      { id:'relaxxie', name:'relaxxie', full:'Karim Miftakhov', team:'K27', side:'CT', rank:'HLTV profile', photo:'https://img-cdn.hltv.org/playerbodyshot/xl5WSZlHhqSKBZBCeFosr0.png?ixlib=java-2.1.0&s=7dbbb865c6ab31578a31a809a0221bd4&w=400' },
      { id:'xeedo', name:'xeedo', full:'Aleksey Mikulich', team:'K27', side:'CT', rank:'HLTV profile', photo:'https://img-cdn.hltv.org/playerbodyshot/peZ4CDwvPiNL_pKOksbZFS.png?ixlib=java-2.1.0&s=f068148cf7b40460adebcbc928f34710&w=400' },
      { id:'qw1nk1', name:'qw1nk1', full:'Daniil Kabilov', team:'K27', side:'CT', rank:'HLTV profile', photo:'https://img-cdn.hltv.org/playerbodyshot/gIiMgI6yAJJq0yQZM92y7k.png?ixlib=java-2.1.0&s=399e85575901c4726b34c86b263bde4a&w=400' },
      { id:'X5G7V', name:'X5G7V', full:'Daniil Maryshev', team:'K27', side:'CT', rank:'HLTV profile', photo:'https://img-cdn.hltv.org/playerbodyshot/XMyAjreb7JMtwc_AZd9H0-.png?ixlib=java-2.1.0&s=bd4e7746cdfec70ccb4736ea856bd8b7&w=400' }
    ];
    const stats = {
      total: {
        rows:{ senka:['38','46','-',90.1,1.23], flouzer:['49','40','-',84.3,1.21], k0s:['46','41','-',77.4,1.07], h1kaN:['43','49','-',76.8,0.93], fluffy:['36','42','-',56.4,0.73], kashl1d:['52','40','-',90.8,1.40], relaxxie:['54','42','-',85.5,1.33], xeedo:['47','42','-',81.2,1.24], qw1nk1:['34','44','-',61.3,0.87], X5G7V:['29','45','-',56.8,0.68] }
      },
      Dust2: {
        score:'10 : 13',
        rows:{ senka:['13','19','-',72.9,0.98], flouzer:['17','16','-',83.7,1.03], k0s:['19','15','-',84.7,1.00], h1kaN:['17','20','-',86.4,0.87], fluffy:['11','17','-',56.4,0.75], kashl1d:['21','15','-',109.3,1.82], relaxxie:['22','15','-',87.1,1.50], xeedo:['22','14','-',78.7,1.42], qw1nk1:['13','18','-',69.8,0.87], X5G7V:['8','16','-',49.1,0.68] }
      },
      Inferno: {
        score:'13 : 5',
        rows:{ senka:['14','10','-',116.3,1.91], flouzer:['12','9','-',58.4,1.21], k0s:['14','11','-',84.7,1.33], h1kaN:['15','11','-',82.6,1.27], fluffy:['13','11','-',61.2,0.72], kashl1d:['16','12','-',86.8,1.20], relaxxie:['11','14','-',66.1,0.82], xeedo:['7','14','-',65.6,0.87], qw1nk1:['8','13','-',43.5,0.58], X5G7V:['9','15','-',57.7,0.63] }
      },
      Anubis: {
        score:'8 : 13',
        rows:{ senka:['11','17','-',86.5,1.01], flouzer:['20','15','-',107.3,1.44], k0s:['13','15','-',63.0,0.98], h1kaN:['11','18','-',61.3,0.80], fluffy:['12','14','-',52.3,0.74], kashl1d:['15','13','-',73.9,1.14], relaxxie:['21','13','-',100.3,1.71], xeedo:['18','14','-',97.3,1.38], qw1nk1:['13','13','-',67.2,1.15], X5G7V:['12','14','-',64.6,0.78] }
      }
    };
    const mapMeta = {
      Dust2: { winner:'K27', nuclearSide:'T', k27Side:'CT', score:'10 : 13', halfScore:[[5, 7], [5, 6]] },
      Inferno: { winner:'Nuclear TigeRES', nuclearSide:'CT', k27Side:'T', score:'13 : 5', halfScore:[[9, 3], [4, 2]] },
      Anubis: { winner:'K27', nuclearSide:'T', k27Side:'CT', score:'8 : 13', halfScore:[[6, 6], [2, 7]] }
    };
    const mapBlueprints = {
      Dust2: [
        ['map-room','left:6%;top:10%;width:28%;height:33%'], ['map-room','left:38%;top:8%;width:22%;height:28%'], ['map-room','right:7%;top:16%;width:28%;height:24%'],
        ['map-room','left:13%;bottom:12%;width:25%;height:30%'], ['map-room','left:43%;bottom:8%;width:22%;height:34%'], ['map-room','right:10%;bottom:15%;width:26%;height:34%'],
        ['map-line','left:29%;top:45%;width:45%;transform:rotate(-9deg)'], ['map-line','left:32%;top:55%;width:38%;transform:rotate(19deg)'],
        ['map-hatch','left:8%;top:47%;width:18%;height:10%'], ['map-hatch','right:8%;bottom:9%;width:17%;height:12%']
      ],
      Inferno: [
        ['map-room','left:8%;top:8%;width:28%;height:28%'], ['map-room','left:43%;top:10%;width:20%;height:36%'], ['map-room','right:8%;top:8%;width:24%;height:24%'],
        ['map-room','left:10%;bottom:12%;width:24%;height:34%'], ['map-room','left:38%;bottom:14%;width:24%;height:28%'], ['map-room','right:11%;bottom:12%;width:28%;height:34%'],
        ['map-line','left:29%;top:38%;width:48%;transform:rotate(24deg)'], ['map-line','left:27%;top:62%;width:46%;transform:rotate(-19deg)'],
        ['map-hatch','left:13%;bottom:10%;width:18%;height:12%'], ['map-hatch','right:15%;top:34%;width:15%;height:11%']
      ],
      Anubis: [
        ['map-room','left:6%;top:12%;width:22%;height:40%'], ['map-room','left:34%;top:8%;width:28%;height:26%'], ['map-room','right:6%;top:11%;width:25%;height:42%'],
        ['map-room','left:15%;bottom:9%;width:28%;height:30%'], ['map-room','left:48%;bottom:10%;width:20%;height:37%'], ['map-room','right:8%;bottom:12%;width:22%;height:26%'],
        ['map-line','left:27%;top:45%;width:47%;transform:rotate(-18deg)'], ['map-line','left:31%;top:60%;width:38%;transform:rotate(21deg)'],
        ['map-hatch','left:7%;top:55%;width:17%;height:13%'], ['map-hatch','right:9%;top:50%;width:16%;height:12%']
      ]
    };
    const radarImages = {
      Anubis: 'assets/radar/de_anubis_radar.png',
      Dust2: 'assets/radar/de_dust2_radar.png',
      Inferno: 'assets/radar/de_inferno_radar.png'
    };
    const equipmentIcons = {
      ak: 'assets/equipment/ak47.svg',
      awp: 'assets/equipment/awp.svg',
      galil: 'assets/equipment/galilar.svg',
      m4: 'assets/equipment/m4a1_silencer.svg'
    };
    const mapLogs = {
      Dust2: [
        { type:'system', text:'Round started' },
        { type:'kill', actor:'kashl1d', actorSide:'ct', weapon:'ak', victim:'h1kaN', victimSide:'t' },
        { type:'kill', actor:'flouzer', actorSide:'t', weapon:'m4', victim:'relaxxie', victimSide:'ct' },
        { type:'round', winner:'K27', winnerSide:'ct', reason:'Enemy eliminated' }
      ],
      Inferno: [
        { type:'system', text:'Round started' },
        { type:'kill', actor:'k0s', actorSide:'t', weapon:'ak', victim:'xeedo', victimSide:'ct' },
        { type:'kill', actor:'kashl1d', actorSide:'ct', weapon:'awp', victim:'senka', victimSide:'t' },
        { type:'round', winner:'Nuclear TigeRES', winnerSide:'t', reason:'Time expired' }
      ],
      Anubis: [
        { type:'system', text:'Round started' },
        { type:'kill', actor:'relaxxie', actorSide:'ct', weapon:'ak', victim:'h1kaN', victimSide:'t' },
        { type:'kill', actor:'flouzer', actorSide:'t', weapon:'m4', victim:'X5G7V', victimSide:'ct' },
        { type:'kill', actor:'xeedo', actorSide:'ct', weapon:'galil', victim:'k0s', victimSide:'t' },
        { type:'round', winner:'K27', winnerSide:'ct', reason:'Enemy eliminated' }
      ]
    };
    let selectedMap = 'Anubis';
    let mode = 'map';

    function kdClass(kills, deaths) {
      const diff = Number(kills) - Number(deaths);
      if (diff > 0) return 'kd-good';
      if (diff < 0) return 'kd-bad';
      return 'kd-even';
    }
    function kdValue(row) {
      return Number(row[0]) / Math.max(1, Number(row[1]));
    }
    function setSideBadge(elementId, side) {
      const element = document.getElementById(elementId);
      element.textContent = side;
      element.className = `side ${side.toLowerCase()}`;
    }
    function avatarFor(player) {
      return player.photo || fallbackAvatar;
    }
    function sideNameClass(side) {
      return side === 't' ? 't-name' : 'ct-name';
    }
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
        <span class="weapon-icon" aria-label="${item.weapon}">
          <img src="${equipmentIcons[item.weapon]}" alt="">
        </span>
        <span class="log-player ${sideNameClass(item.victimSide)}">${item.victim}</span>
      </div>`;
    }
    function renderHalfScore(halfScore) {
      return halfScore
        .map(([tRounds, ctRounds]) => `<span class="half-pair">(<span class="t-rounds">${tRounds}</span>:<span class="ct-rounds">${ctRounds}</span>)</span>`)
        .join(' ');
    }
    function renderPlayerList(target, teamName) {
      document.getElementById(target).innerHTML = players.filter((player) => player.team === teamName).map((player) => {
        const total = stats.total.rows[player.id];
        return `<li class="player" tabindex="0">
          <span class="avatar"><img src="${avatarFor(player)}" alt="${player.name} avatar" onerror="this.remove(); this.parentElement.textContent='${player.name.slice(0,2).toUpperCase()}'"></span>
          <span class="player-main"><b>${player.name}</b><small>${player.full}</small></span>
          <span class="player-team">${player.team}</span>
          <span class="player-popover"><strong>${player.name} · HLTV summary</strong><span class="mini-grid"><span>K-D<br><b>${total[0]}-${total[1]}</b></span><span>ADR<br><b>${total[3]}</b></span><span>Rating<br><b>${Number(total[4]).toFixed(2)}</b></span><span>Profile<br><b>${player.rank}</b></span></span></span>
        </li>`;
      }).join('');
    }
    function renderScoreboard() {
      const source = mode === 'total' ? stats.total : stats[selectedMap];
      document.getElementById('scoreboard-subtitle').textContent = mode === 'total' ? 'Статистика по всему матчу' : `Статистика карты ${selectedMap}`;
      const teams = [
        { name:'Nuclear TigeRES', logo:teamLogo.nuclear, rank:'HLTV #123' },
        { name:'K27', logo:teamLogo.k27, rank:'HLTV #87' }
      ];
      document.getElementById('scoreboard-body').innerHTML = `<div class="scoreboard-grid">${teams.map((team) => {
        const teamPlayers = players.filter((player) => player.team === team.name).sort((a, b) => kdValue(source.rows[b.id]) - kdValue(source.rows[a.id]));
        return `<section class="score-team" aria-label="${team.name} scoreboard">
          <div class="score-team-head">
            <div class="score-team-title"><img src="${team.logo}" alt="${team.name} logo"><span><b>${team.name}</b><small>${team.rank}</small></span></div>
          </div>
          <div class="stat-row stat-labels" aria-hidden="true"><div>Игрок</div><div class="stat-kd">K/D</div><div class="stat-adr">ADR</div><div class="stat-rating">RTG</div></div>
          ${teamPlayers.map((player) => {
            const row = source.rows[player.id];
            return `<div class="stat-row">
              <div class="stat-player"><span class="avatar"><img src="${avatarFor(player)}" alt="${player.name} avatar" onerror="this.remove(); this.parentElement.textContent='${player.name.slice(0,2).toUpperCase()}'"></span><span><b>${player.name}</b><small>${player.team}</small></span></div>
              <div class="stat-kd ${kdClass(row[0], row[1])}">${row[0]}/${row[1]}</div>
              <div class="stat-adr">${row[3]}</div>
              <div class="stat-rating">${Number(row[4]).toFixed(2)}</div>
            </div>`;
          }).join('')}
        </section>`;
      }).join('')}</div>`;
    }
    function renderMap() {
      const current = stats[selectedMap];
      const meta = mapMeta[selectedMap];
      document.getElementById('selected-map-name').textContent = selectedMap;
      document.getElementById('map-title').textContent = selectedMap;
      document.getElementById('map-layout-name').textContent = selectedMap;
      document.getElementById('map-copy-title').textContent = selectedMap;
      document.getElementById('map-score').textContent = current.score;
      document.getElementById('map-half-score').innerHTML = renderHalfScore(meta.halfScore);
      const tacticalMap = document.getElementById('tactical-map');
      const radarImage = document.getElementById('radar-image');
      tacticalMap.className = `tactical-map map-${selectedMap.toLowerCase()}`;
      if (radarImages[selectedMap]) {
        tacticalMap.classList.add('has-radar');
        radarImage.src = radarImages[selectedMap];
        radarImage.alt = `${selectedMap} radar from Steam Simple Radar guide`;
        radarImage.hidden = false;
      } else {
        radarImage.hidden = true;
        radarImage.removeAttribute('src');
        radarImage.alt = '';
      }
      document.getElementById('map-shapes').innerHTML = mapBlueprints[selectedMap].map(([className, style]) => `<span class="${className}" style="${style}"></span>`).join('');
      document.getElementById('map-log').innerHTML = `<div class="log-stack">${mapLogs[selectedMap].map(renderLogItem).join('')}</div>`;
      setSideBadge('nuclear-map-side', meta.nuclearSide);
      setSideBadge('k27-map-side', meta.k27Side);
      document.getElementById('nuclear-panel-head').classList.toggle('map-winner', meta.winner === 'Nuclear TigeRES');
      document.getElementById('k27-panel-head').classList.toggle('map-winner', meta.winner === 'K27');
      renderScoreboard();
    }
    document.querySelectorAll('.map-btn').forEach((button) => button.addEventListener('click', () => {
      document.querySelectorAll('.map-btn').forEach((item) => item.setAttribute('aria-pressed', 'false'));
      button.setAttribute('aria-pressed', 'true');
      selectedMap = button.dataset.map;
      renderMap();
    }));
    document.querySelectorAll('.stat-mode button').forEach((button) => button.addEventListener('click', () => {
      document.querySelectorAll('.stat-mode button').forEach((item) => item.setAttribute('aria-pressed', 'false'));
      button.setAttribute('aria-pressed', 'true');
      mode = button.dataset.mode;
      renderScoreboard();
    }));
    renderPlayerList('t-players', 'Nuclear TigeRES');
    renderPlayerList('ct-players', 'K27');
    renderMap();
