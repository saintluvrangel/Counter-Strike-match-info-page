(function initRouter(root) {
  'use strict';
  const aliases = { home:'home', matches:'matches', news:'news', players:'players', match:'match', users:'users', gsi:'gsi' };
  function switchTab(tabName) {
    const tab = aliases[tabName] || 'home';
    const target = document.getElementById(tab === 'players' ? 'tab-players' : `${tab}-view`);
    if (!target) return false;
    const routeHash = tab === 'match' && /^#match\//.test(root.location.hash) ? root.location.hash : `#${tab}`;
    if (root.location.hash !== routeHash) root.history.replaceState(null, '', routeHash);
    document.querySelectorAll('.app-view').forEach((section) => { section.hidden = section !== target; });
    const navRoute = tab === 'match' ? 'matches' : tab;
    document.querySelectorAll('[data-route]').forEach((link) => { const active = link.dataset.route === navRoute; link.classList.toggle('active', active); active ? link.setAttribute('aria-current', 'page') : link.removeAttribute('aria-current'); });
    root.scrollTo({ top:0, behavior:'smooth' });
    root.dispatchEvent(new CustomEvent('route:change', { detail:{ tab } }));
    return true;
  }
  root.Router = { switchTab };
})(window);
