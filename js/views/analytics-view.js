(function initAnalyticsView(root) {
  'use strict';
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const a = (url, label) => url && /^https:\/\//.test(url) ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${label}</a>` : label;
  const logo = (team) => team.logoUrl ? `<img src="${esc(team.logoUrl)}" alt="">` : '';
  const dt = (value) => { const date = new Date(value); return Number.isNaN(date.valueOf()) ? 'N/A' : date.toLocaleDateString('ru-RU'); };
  const same = (left, right) => String(left).trim().toLocaleLowerCase() === String(right).trim().toLocaleLowerCase();
  const belongs = (name, team) => same(name, team.name) || (team.sourceName && same(name, team.sourceName));
  const result = (match, team) => {
    const own = belongs(match.team1Name, team) ? match.team1Id : match.team2Id;
    return !match.winnerId ? 'N/A' : match.winnerId === own ? 'Победа' : 'Поражение';
  };
  const score = (m, team) => m.team1Score == null || m.team2Score == null ? 'N/A'
    : belongs(m.team1Name, team) ? `${m.team1Score} : ${m.team2Score}` : `${m.team2Score} : ${m.team1Score}`;
  const empty = '<p class="analytics-empty">Нет данных</p>';
  function winProbBar(data) {
    const p = data.winProbability, [x, y] = data.teams;
    return `<article class="analytics-card chance-card"><header class="section-card-head"><div><span class="eyebrow">Прогноз</span><h3>Шансы на победу</h3></div></header>
      ${p ? `<div class="chance-teams"><div>${logo(x)}<strong>${esc(x.name)}</strong><b>${p.team1}%</b></div><div class="right"><b>${p.team2}%</b><strong>${esc(y.name)}</strong>${logo(y)}</div></div>
      <div class="chance-bar" role="img" aria-label="${esc(x.name)} ${p.team1}%, ${esc(y.name)} ${p.team2}%"><span class="chance-team-a" style="width:${p.team1}%"></span><span class="chance-team-b" style="width:${p.team2}%"></span></div>
      <p>${esc(p.label)}. ${p.components.map((c) => `${esc(c.name)} (${Math.round(c.weight * 100)}%)`).join('; ')}. Веса нормализованы по доступным данным.</p>` : `${empty}<p>Для оценки нужны результаты обеих команд или рейтинги Liquipedia.</p>`}</article>`;
  }
  function recentGames(team) {
    return `<article class="analytics-card recent-card"><header class="section-card-head"><div><span class="eyebrow">Последние 5 игр</span><h3>${esc(team.name)}</h3></div>${logo(team)}</header>
      ${team.recentMatches.length ? `<ul class="analytics-game-list">${team.recentMatches.slice(0, 5).map((m) => `<li><span class="result-badge ${result(m, team) === 'Победа' ? 'win' : result(m, team) === 'Поражение' ? 'loss' : ''}">${result(m, team)}</span><div><time datetime="${esc(m.date)}">${dt(m.date)}</time><strong>${a(m.url, esc(belongs(m.team1Name, team) ? m.team2Name : m.team1Name))}</strong><small>${esc(m.tournament || 'Турнир: N/A')}</small></div><b>${score(m, team)}</b></li>`).join('')}</ul>` : empty}</article>`;
  }
  function h2h(data) {
    const [x, y] = data.teams, h = data.headToHead;
    return `<article class="analytics-card h2h-card"><header class="section-card-head"><div><span class="eyebrow">Head to head</span><h3>Личные встречи</h3></div><strong>${h.matches.length ? `${h.wins[x.id]} : ${h.wins[y.id]}` : 'N/A'}</strong></header>
      ${h.matches.length ? `<ul class="analytics-game-list">${h.matches.map((m) => `<li><time datetime="${esc(m.date)}">${dt(m.date)}</time><div><strong>${a(m.url, `${esc(m.team1Name)} — ${esc(m.team2Name)}`)}</strong><small>${esc(m.tournament || 'Турнир: N/A')}</small></div><b>${score(m, x)}</b><span>${esc(result(m, x))}</span></li>`).join('')}</ul>` : empty}</article>`;
  }
  let token = 0;
  async function render(matchId) {
    const current = ++token, target = document.getElementById('analytics-content');
    target.innerHTML = '<div class="analytics-card" role="status">Загрузка аналитики Liquipedia… Первый запрос может занять более 30 секунд.</div>';
    try {
      const response = await fetch(`/api/matches/${encodeURIComponent(matchId)}/analytics`);
      if (!response.ok) throw new Error('Unavailable');
      const data = await response.json();
      if (current !== token) return;
      target.innerHTML = `${data.warnings.length ? `<p class="analytics-source-note" role="status">Часть данных Liquipedia недоступна.</p>` : ''}${winProbBar(data)}<section class="analytics-grid">${data.teams.map(recentGames).join('')}</section>${h2h(data)}<p class="analytics-source-note">Источник: <a href="https://liquipedia.net/counterstrike/" target="_blank" rel="noopener noreferrer">Liquipedia Counter-Strike</a>, открытый MediaWiki API. Для отдельных матчей в таблице нет прямых ссылок; отсутствующие поля показаны как N/A.</p>`;
    } catch {
      if (current !== token) return;
      target.innerHTML = '<div class="analytics-card" role="alert"><p>Не удалось загрузить аналитику.</p><button type="button" id="analytics-retry">Повторить</button></div>';
      document.getElementById('analytics-retry').addEventListener('click', () => render(matchId));
    }
  }
  root.AnalyticsView = { render };
})(window);
