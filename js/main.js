(function initApplication(root) {
  'use strict';
  const routes = { home:'home-view', matches:'matches-view', match:'match-view', news:'news-view', players:'tab-players', users:'users-view', gsi:'gsi-view' };
  const routeLabels = { home:'Главная', matches:'Матчи', news:'Новости', players:'Игроки', users:'Пользователи', gsi:'Настройки API' };
  let initialized = false;
  function requestedRoute() { const [name, id, view] = root.location.hash.replace(/^#/, '').split('/'); return { name:name || 'home', id:id || null, view:view || null }; }
  function renderNavigation(user) {
    const available = ['home', 'matches', 'news', 'players'];
    if (user && !root.Auth.isPreviewMode() && root.Auth.can('users_manage', user)) available.push('users');
    if (user && !root.Auth.isPreviewMode() && root.Auth.can('gsi', user)) available.push('gsi');
    document.getElementById('site-nav').innerHTML = available.map((route) => `<a href="#${route}" data-route="${route}">${routeLabels[route]}</a>`).join('');
  }
  function renderUser(user) {
    document.getElementById('guest-auth-actions').hidden = Boolean(user);
    document.getElementById('signed-auth-actions').hidden = !user || root.Auth.isPreviewMode();
    if (user) { document.getElementById('user-email').textContent = user.email; document.getElementById('user-role').textContent = root.Auth.roleLabel(user.role); document.getElementById('user-avatar').textContent = user.email.slice(0, 2).toUpperCase(); document.getElementById('edit-data-button').hidden = !root.Auth.can('edit', user); }
    document.getElementById('preview-button').hidden = !user || root.Auth.isPreviewMode();
    document.getElementById('preview-banner').hidden = !root.Auth.isPreviewMode();
    document.body.classList.toggle('preview-mode', root.Auth.isPreviewMode());
    document.getElementById('add-news-button').hidden = !user || !root.Auth.can('news_manage', user) || root.Auth.isPreviewMode();
  }
  async function showRoute(request = requestedRoute()) {
    const routeName = routes[request.name] ? request.name : 'home';
    if (routeName === 'users' && (!root.Auth.getUser() || !root.Auth.can('users_manage'))) { root.Router.switchTab('home'); return; }
    if (routeName === 'gsi' && (!root.Auth.getUser() || !root.Auth.can('gsi'))) { root.Router.switchTab('home'); return; }
    if (!initialized) initializeApp();
    root.Router.switchTab(routeName);
  }
  function initializeApp() {
    if (initialized) return; initialized = true;
    root.MatchView.init(); root.Matches.init({ onSelect:(id) => { root.location.hash = `#match/${id}`; } }); root.News.init(); root.Home.init(); root.Users.init(); root.Players.init();
  }
  function renderAuthState() { const user = root.Auth.getUser(); renderNavigation(user); renderUser(user); if (!initialized) initializeApp(); showRoute(requestedRoute()); }
  function selectAuthTab(tabName) {
    const isLogin = tabName === 'login';
    document.getElementById('login-form').hidden = !isLogin;
    document.getElementById('register-form').hidden = isLogin;
    document.getElementById('login-title').textContent = isLogin ? 'Авторизация' : 'Регистрация';
    document.querySelectorAll('[data-auth-tab]').forEach((button) => {
      const selected = button.dataset.authTab === tabName;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    document.getElementById(isLogin ? 'login-error' : 'register-error').hidden = true;
  }
  function openAuth(tabName) {
    selectAuthTab(tabName);
    document.getElementById('login-screen').hidden = false;
    document.body.classList.add('modal-open');
    document.getElementById(tabName === 'login' ? 'login-email' : 'register-email').focus();
  }
  function closeAuth() {
    document.getElementById('login-screen').hidden = true;
    document.body.classList.remove('modal-open');
  }
  document.getElementById('login-form').addEventListener('submit', async (event) => { event.preventDefault(); const error = document.getElementById('login-error'); const data = new FormData(event.currentTarget); try { await root.Auth.signIn(data.get('email'), data.get('password')); closeAuth(); } catch (e) { error.textContent = e.message; error.hidden = false; } });
  document.getElementById('register-form').addEventListener('submit', async (event) => { event.preventDefault(); const data = new FormData(event.currentTarget); const error = document.getElementById('register-error'); error.hidden = true; if (data.get('password') !== data.get('confirm')) { error.textContent = 'Пароли не совпадают'; error.hidden = false; return; } try { await root.Auth.registerUser(data.get('email'), data.get('password')); closeAuth(); } catch (e) { error.textContent = e.message; error.hidden = false; } });
  document.getElementById('show-auth').addEventListener('click', () => openAuth('login'));
  document.querySelectorAll('[data-auth-tab]').forEach((button) => button.addEventListener('click', () => selectAuthTab(button.dataset.authTab)));
  document.getElementById('close-auth').addEventListener('click', closeAuth);
  document.getElementById('login-screen').addEventListener('click', (event) => { if (event.target.id === 'login-screen') closeAuth(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !document.getElementById('login-screen').hidden) closeAuth(); });
  document.getElementById('logout-button').addEventListener('click', () => { root.Auth.signOut(); });
  document.getElementById('preview-button').addEventListener('click', () => { root.Auth.togglePreviewMode(true); renderNavigation(root.Auth.getUser()); renderUser(root.Auth.getUser()); if (['gsi', 'users'].includes(requestedRoute().name)) root.Router.switchTab('home'); });
  document.getElementById('exit-preview').addEventListener('click', () => { root.Auth.togglePreviewMode(false); renderNavigation(root.Auth.getUser()); renderUser(root.Auth.getUser()); });
  document.getElementById('edit-data-button').addEventListener('click', () => root.alert('Редактор данных подготовлен как RBAC-заглушка. Подключите API сохранения в AuthApi.'));
  root.addEventListener('auth:change', renderAuthState);
  root.addEventListener('hashchange', () => showRoute(requestedRoute()));
  root.addEventListener('route:change', (event) => {
    const tab = event.detail.tab;
    root.MatchView.setActive(tab === 'match');
    if (tab === 'home') root.Home.render();
    if (tab === 'news') root.News.render();
    if (tab === 'players') root.Players.render();
    if (tab === 'users') root.Users.render();
    if (tab === 'matches') root.Matches.renderList();
    if (tab === 'match') { const req = requestedRoute(); root.Matches.showDetail(req.id || '2379601', req.view); }
    if (tab === 'gsi') { root.GsiGenerator.init(); root.DemoImporter.init(); }
  });
  renderAuthState();
})(window);
