(function initMatchesModule(root) {
  'use strict';

  const api = root.MatchesApi;
  let initialized = false;
  let onSelect = () => {};

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
  }

  function card(match) {
    return `<article class="match-card match-${match.status}">
      <header><div><span class="eyebrow">${escapeHtml(match.stage)}</span><h3>${escapeHtml(match.tournament)}</h3></div><span class="match-status ${match.status}">${escapeHtml(match.statusLabel)}</span></header>
      <div class="match-card-teams">
        <div><img class="match-team-logo" src="${escapeHtml(match.teamA.logo)}" alt=""><strong>${escapeHtml(match.teamA.name)}</strong></div>
        <span class="match-list-score">${escapeHtml(match.score)}</span>
        <div class="right"><strong>${escapeHtml(match.teamB.name)}</strong><img class="match-team-logo" src="${escapeHtml(match.teamB.logo)}" alt=""></div>
      </div>
      <div class="match-card-extra">
        <div class="match-map-chips">${match.maps.length ? match.maps.map(([name, score]) => `<span>${escapeHtml(name)} <b>${escapeHtml(score)}</b></span>`).join('') : '<span>Карты ещё не выбраны</span>'}</div>
        <div class="match-lineup-preview" aria-label="Игроки матча">${[...match.teamA.players.slice(0,3), ...match.teamB.players.slice(0,3)].map(([nick,,photo]) => `<img src="${escapeHtml(photo)}" alt="${escapeHtml(nick)}" title="${escapeHtml(nick)}">`).join('')}</div>
      </div>
      <footer><span>${escapeHtml(match.date)}</span><span>${escapeHtml(match.bestOf)}</span></footer>
      <button class="match-card-link" type="button" data-match-id="${match.id}" aria-label="Открыть матч ${escapeHtml(match.teamA.name)} против ${escapeHtml(match.teamB.name)}"></button>
    </article>`;
  }

  async function renderList() {
    const grid = document.getElementById('matches-grid');
    grid.innerHTML = '<div class="view-loading">Загрузка матчей…</div>';
    const matches = await api.list();
    grid.innerHTML = matches.map(card).join('');
  }

  async function showDetail(matchId) {
    const match = await api.get(matchId) || await api.get('2398105');
    root.MatchView.loadMatch(match);
    collapseAnalytics();
  }

  function collapseAnalytics() {
    const panel = document.getElementById('match-analytics-panel');
    const button = document.getElementById('analytics-toggle');
    panel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    button.classList.remove('active');
  }

  function toggleAnalytics() {
    const panel = document.getElementById('match-analytics-panel');
    const button = document.getElementById('analytics-toggle');
    const willOpen = panel.hidden;
    panel.hidden = !willOpen;
    button.setAttribute('aria-expanded', String(willOpen));
    button.classList.toggle('active', willOpen);
    if (willOpen) root.AnalyticsView.render();
  }

  function init(options = {}) {
    if (initialized) return;
    initialized = true;
    onSelect = options.onSelect || onSelect;
    document.getElementById('matches-grid').addEventListener('click', (event) => {
      const trigger = event.target.closest('[data-match-id]');
      if (trigger) onSelect(trigger.dataset.matchId);
    });
    document.getElementById('analytics-toggle').addEventListener('click', toggleAnalytics);
  }

  root.Matches = { init, renderList, showDetail, collapseAnalytics };
})(window);
