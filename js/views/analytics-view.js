(function initAnalyticsViewModule(root) {
  'use strict';

  const data = root.AnalyticsData;
  function safeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function mapsWon(match, teamIndex) {
    return match.maps.reduce((total, map) => {
      const scores = String(map[1]).split(':').map((part) => Number(part.trim()));
      if (scores.length !== 2 || scores.some((score) => !Number.isFinite(score)) || scores[0] === scores[1]) return total;
      return total + (teamIndex === (scores[0] > scores[1] ? 0 : 1) ? 1 : 0);
    }, 0);
  }

  function realTeamSummary(match, team, teamIndex) {
    const ratings = team.players
      .map(([nick]) => safeNumber(match.stats?.[nick]?.[3]))
      .filter((value) => value !== null);
    const averageRating = ratings.length ? (ratings.reduce((sum, value) => sum + value, 0) / ratings.length).toFixed(2) : '—';
    return `<article class="analytics-card team-summary-card">
      <header class="analytics-team-head">
        <img src="${team.logo}" alt="${team.name} logo">
        <div><h3>${team.name}</h3><span>${team.rank} · ${team.vrs}</span></div>
      </header>
      <dl class="summary-metrics">
        <div><dt>Карты</dt><dd>${mapsWon(match, teamIndex)}</dd></div>
        <div><dt>Игроки</dt><dd>${team.players.length}</dd></div>
        <div><dt>Серия</dt><dd>${match.score}</dd></div>
        <div><dt>Ср. Rating</dt><dd>${averageRating}</dd></div>
      </dl>
    </article>`;
  }

  function realTopPlayers(match, team) {
    const rankedPlayers = team.players
      .map(([name, full, photo]) => ({ name, full, photo, row:match.stats?.[name] }))
      .filter((player) => player.row)
      .sort((a, b) => Number(b.row[3]) - Number(a.row[3]))
      .slice(0, 3);

    return `<article class="analytics-card top-player-card">
      <header class="section-card-head"><div><span class="eyebrow">Лучшие игроки матча</span><h3>${team.name}</h3></div><img src="${team.logo}" alt=""></header>
      ${rankedPlayers.length ? `<div class="top-player-list">${rankedPlayers.map((player, index) => `<div class="top-player-row">
        <span class="top-position">${index + 1}</span>
        <strong title="${player.full}">${player.name}</strong>
        <span><small>K/D</small>${player.row[0]}/${player.row[1]}</span>
        <span><small>ADR</small>${Number(player.row[2]).toFixed(1)}</span>
        <span><small>Rating</small>${Number(player.row[3]).toFixed(2)}</span>
      </div>`).join('')}</div>` : '<p class="analytics-empty">Статистика появится после завершения матча.</p>'}
    </article>`;
  }

  function realMapHistory(match) {
    return `<article class="analytics-card h2h-card">
      <header class="section-card-head"><div><span class="eyebrow">Серия ${match.bestOf}</span><h3>Карты матча</h3></div><span>${match.statusLabel}</span></header>
      <div class="analytics-table-wrap"><table class="analytics-table">
        <thead><tr><th>Карта</th><th>${match.teamA.name}</th><th>${match.teamB.name}</th><th>Победитель</th></tr></thead>
        <tbody>${(match.maps.length ? match.maps : [['TBA','— : —']]).map(([name, score]) => {
          const scores = String(score).split(':').map((part) => Number(part.trim()));
          const winner = scores.length === 2 && scores.every(Number.isFinite) && scores[0] !== scores[1]
            ? (scores[0] > scores[1] ? match.teamA.name : match.teamB.name)
            : '—';
          return `<tr><td>${name}</td><td>${Number.isFinite(scores[0]) ? scores[0] : '—'}</td><td>${Number.isFinite(scores[1]) ? scores[1] : '—'}</td><td>${winner}</td></tr>`;
        }).join('')}</tbody>
      </table></div>
    </article>`;
  }

  function renderRealMatch(match) {
    document.getElementById('analytics-content').innerHTML = `
      <section class="analytics-grid team-summary-grid" aria-label="Статистика команд">
        ${realTeamSummary(match, match.teamA, 0)}
        ${realTeamSummary(match, match.teamB, 1)}
      </section>
      ${realMapHistory(match)}
      <section class="analytics-grid top-grid" aria-label="Лучшие игроки команд">
        ${realTopPlayers(match, match.teamA)}
        ${realTopPlayers(match, match.teamB)}
      </section>
      <p class="analytics-source-note">Данные матча и игроков получены со страницы матча на HLTV. Для матчей без опубликованной статистики отображаются нейтральные значения. <a href="${match.source}" target="_blank" rel="noopener">Открыть источник</a></p>`;
  }

  function teamSummary(team) {
    return `<article class="analytics-card team-summary-card">
      <header class="analytics-team-head">
        <img src="${team.logo}" alt="${team.name} logo">
        <div><h3>${team.name}</h3><span>Последние 3 месяца · mock</span></div>
      </header>
      <dl class="summary-metrics">
        <div><dt>Победы</dt><dd>${team.summary.wins}</dd></div>
        <div><dt>Поражения</dt><dd>${team.summary.losses}</dd></div>
        <div><dt>Винрейт</dt><dd>${team.summary.winRate}%</dd></div>
        <div><dt>Ср. Rating</dt><dd>${team.summary.averageRating.toFixed(2)}</dd></div>
      </dl>
    </article>`;
  }

  function recentMatches(team) {
    return `<article class="analytics-card recent-card">
      <header class="section-card-head"><div><span class="eyebrow">Последние игры</span><h3>${team.name}</h3></div><img src="${team.logo}" alt=""></header>
      <ul class="recent-list">
        ${team.recent.map((match) => `<li>
          <span class="result-badge ${match.result === 'W' ? 'win' : 'loss'}">${match.result}</span>
          <span class="recent-opponent">${match.opponent}</span>
          <strong>${match.score}</strong>
        </li>`).join('')}
      </ul>
    </article>`;
  }

  function h2hHistory() {
    return `<article class="analytics-card h2h-card">
      <header class="section-card-head"><div><span class="eyebrow">Head-to-head</span><h3>Последние встречи</h3></div><span>${data.h2h.length} матча</span></header>
      <div class="analytics-table-wrap">
        <table class="analytics-table">
          <thead><tr><th>Дата</th><th>Турнир</th><th>Счёт</th><th>Победитель</th></tr></thead>
          <tbody>${data.h2h.map((match) => `<tr><td>${match.date}</td><td>${match.event}</td><td><strong>${match.score}</strong></td><td>${match.winner}</td></tr>`).join('')}</tbody>
        </table>
      </div>
    </article>`;
  }

  function topPlayers(team) {
    return `<article class="analytics-card top-player-card">
      <header class="section-card-head"><div><span class="eyebrow">Лучшие игроки</span><h3>${team.name}</h3></div><img src="${team.logo}" alt=""></header>
      <div class="top-player-list">
        ${team.topPlayers.map((player, index) => `<div class="top-player-row">
          <span class="top-position">${index + 1}</span>
          <strong>${player.name}</strong>
          <span><small>K/D</small>${player.kd.toFixed(2)}</span>
          <span><small>ADR</small>${player.adr.toFixed(1)}</span>
          <span><small>Rating</small>${player.rating.toFixed(2)}</span>
        </div>`).join('')}
      </div>
    </article>`;
  }

  function winChance() {
    const nuclear = data.teams.find((team) => team.id === 'nuclear');
    const k27 = data.teams.find((team) => team.id === 'k27');

    return `<article class="analytics-card chance-card">
      <header class="section-card-head"><div><span class="eyebrow">Модель прогноза · mock</span><h3>Шансы на победу</h3></div><span>BO3</span></header>
      <div class="chance-teams">
        <div><img src="${nuclear.logo}" alt=""><strong>${nuclear.name}</strong><b>${data.winChance.nuclear}%</b></div>
        <div class="right"><b>${data.winChance.k27}%</b><strong>${k27.name}</strong><img src="${k27.logo}" alt=""></div>
      </div>
      <div class="chance-bar" role="img" aria-label="Вероятность победы: ${nuclear.name} ${data.winChance.nuclear}%, ${k27.name} ${data.winChance.k27}%">
        <span class="chance-nuclear" style="width:${data.winChance.nuclear}%"></span>
        <span class="chance-k27" style="width:${data.winChance.k27}%"></span>
      </div>
      <p>Демонстрационный прогноз. Подключите API модели или букмекера через объект <code>AnalyticsData</code>.</p>
    </article>`;
  }

  function render() {
    if (root.ActiveMatch) {
      renderRealMatch(root.ActiveMatch);
      return;
    }
    document.getElementById('analytics-content').innerHTML = `
      <section class="analytics-grid team-summary-grid" aria-label="Статистика команд">
        ${data.teams.map(teamSummary).join('')}
      </section>
      <section class="analytics-grid recent-grid" aria-label="Последние игры">
        ${data.teams.map(recentMatches).join('')}
      </section>
      ${h2hHistory()}
      <section class="analytics-grid top-grid" aria-label="Лучшие игроки команд">
        ${data.teams.map(topPlayers).join('')}
      </section>
      ${winChance()}`;
  }

  root.AnalyticsView = { render };
})(window);
