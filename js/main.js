(function initApplication(root) {
  'use strict';

  const routes = {
    matches:document.getElementById('matches-view'),
    match:document.getElementById('match-view'),
    news:document.getElementById('news-view'),
    gsi:document.getElementById('gsi-view')
  };
  const routeLabels = { matches:'Матчи', news:'Новости', gsi:'Настройки API' };
  let appInitialized = false;

  function requestedRoute() {
    const [name, id] = root.location.hash.replace(/^#/, '').split('/');
    return { name:name || 'matches', id:id || null };
  }

  function hideAllRoutes() {
    Object.values(routes).forEach((view) => { view.hidden = true; });
    root.MatchView?.setActive(false);
  }

  function renderNavigation(user) {
    const availableRoutes = ['matches', 'news'];
    if (root.Auth.can('gsi', user)) availableRoutes.push('gsi');
    document.getElementById('site-nav').innerHTML = availableRoutes
      .map((route) => `<a href="#${route}" data-route="${route}">${routeLabels[route]}</a>`)
      .join('');
  }

  function renderUser(user) {
    document.getElementById('user-email').textContent = user.email;
    document.getElementById('user-role').textContent = root.Auth.roleLabel(user.role);
    document.getElementById('user-avatar').textContent = user.email.slice(0, 2).toUpperCase();
    document.getElementById('edit-data-button').hidden = !root.Auth.can('edit', user);
  }

  async function showRoute(routeRequest) {
    if (!root.Auth.getUser()) {
      hideAllRoutes();
      return;
    }

    const routeName = routeRequest.name;
    const route = routes[routeName] && root.Auth.can(routeName)
      ? routeName
      : root.Auth.requireRoute(routeName);
    if (route !== routeName || !routes[route]) {
      root.location.hash = '#matches';
      return;
    }

    Object.entries(routes).forEach(([name, view]) => { view.hidden = name !== route; });
    document.querySelectorAll('[data-route]').forEach((link) => {
      const activeRoute = route === 'match' ? 'matches' : route;
      const active = link.dataset.route === activeRoute;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    root.MatchView.setActive(route === 'match');
    if (route === 'matches') await root.Matches.renderList();
    if (route === 'match') await root.Matches.showDetail(routeRequest.id || '2379601');
    if (route === 'news') await root.News.render();
    if (route === 'gsi') root.GsiGenerator.init();
  }

  function initializeProtectedApp() {
    if (appInitialized) return;
    root.MatchView.init();
    root.Matches.init({ onSelect:(id) => { root.location.hash = `#match/${id}`; } });
    root.News.init();
    appInitialized = true;
  }

  function renderAuthState() {
    const user = root.Auth.getUser();
    const loginScreen = document.getElementById('login-screen');
    const appShell = document.getElementById('app-shell');
    loginScreen.hidden = Boolean(user);
    appShell.hidden = !user;

    if (!user) {
      hideAllRoutes();
      document.getElementById('login-form').reset();
      document.getElementById('login-error').hidden = true;
      document.getElementById('login-email').focus();
      return;
    }

    initializeProtectedApp();
    renderNavigation(user);
    renderUser(user);
    showRoute(requestedRoute());
  }

  document.getElementById('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const error = document.getElementById('login-error');
    const submitButton = event.currentTarget.querySelector('[type="submit"]');
    const formData = new FormData(event.currentTarget);
    error.hidden = true;
    submitButton.disabled = true;
    submitButton.textContent = 'Вход…';
    try {
      await root.Auth.signIn(formData.get('email'), formData.get('password'));
    } catch (loginError) {
      error.textContent = loginError.message;
      error.hidden = false;
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Войти';
    }
  });

  document.getElementById('logout-button').addEventListener('click', () => {
    root.Auth.signOut();
    root.location.hash = '#matches';
  });
  document.getElementById('edit-data-button').addEventListener('click', () => {
    root.alert('Редактор данных подготовлен как RBAC-заглушка. Подключите API сохранения в AuthApi.');
  });
  root.addEventListener('auth:change', renderAuthState);
  root.addEventListener('hashchange', () => showRoute(requestedRoute()));
  renderAuthState();
})(window);
