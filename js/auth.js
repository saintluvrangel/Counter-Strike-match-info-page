(function initAuthModule(root) {
  'use strict';

  const api = root.AuthApi;
  const storage = root.sessionStorage;
  const permissions = Object.freeze({
    root:['matches', 'match', 'news', 'news_manage', 'gsi', 'edit'],
    admin:['matches', 'match', 'news', 'news_manage', 'gsi', 'edit'],
    media_editor:['matches', 'match', 'news', 'news_manage']
  });
  const roleLabels = Object.freeze({ root:'Root', admin:'Administrator', media_editor:'Media editor' });
  let currentUser = api.readSession(storage);

  function can(permission, user = currentUser) {
    return Boolean(user && permissions[user.role]?.includes(permission));
  }

  function notify() {
    root.dispatchEvent(new CustomEvent('auth:change', { detail:{ user:currentUser } }));
  }

  async function signIn(email, password) {
    const user = await api.login(email, password);
    api.writeSession(storage, user);
    currentUser = user;
    notify();
    return user;
  }

  function signOut() {
    api.clearSession(storage);
    currentUser = null;
    notify();
  }

  function getUser() {
    return currentUser ? { ...currentUser } : null;
  }

  function requireRoute(route) {
    return can(route) ? route : 'matches';
  }

  function roleLabel(role) {
    return roleLabels[role] || role;
  }

  root.Auth = { signIn, signOut, getUser, can, requireRoute, roleLabel };
})(window);
