(function initHome(root) {
  'use strict';
  async function render() {
    if (!root.Matches || !root.News) return;
    const [matchCards, items] = await Promise.all([root.Matches.getCards(3), root.NewsApi.list()]);
    document.getElementById('home-matches-grid').innerHTML = matchCards || '<div class="empty-state">Матчей пока нет</div>';
    document.getElementById('home-news-grid').innerHTML = items.length ? items.slice(0, 5).map(root.News.card).join('') : '<div class="empty-state">Новостей пока нет</div>';
  }
  function init() { document.querySelectorAll('[data-switch-tab]').forEach((link) => link.addEventListener('click', (event) => { event.preventDefault(); root.Router.switchTab(link.dataset.switchTab); })); }
  root.Home = { render, init };
})(window);
