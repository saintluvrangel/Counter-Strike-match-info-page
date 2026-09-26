(function initAuthModule(root) {
  'use strict';

  const api = root.AuthApi;
  const sessionStorage = root.sessionStorage;
  const userStorage = root.localStorage;
  const permissions = Object.freeze({
    root:['matches', 'match', 'news', 'players', 'players_bind', 'players_edit', 'hltv_refresh', 'news_manage', 'users_manage', 'gsi', 'edit'],
    admin:['matches', 'match', 'news', 'players', 'players_bind', 'players_edit', 'hltv_refresh', 'news_manage', 'users_manage', 'gsi', 'edit'],
    media_editor:['matches', 'match', 'news', 'players', 'players_bind', 'hltv_refresh', 'news_manage'],
    user:['matches', 'match', 'news', 'players']
  });
  const roleLabels = Object.freeze({ root:'Root', admin:'Administrator', media_editor:'Media editor', user:'Пользователь' });
  let currentUser = api.readSession(sessionStorage, userStorage);
  let preview = false;

  function can(permission, user = currentUser) {
    return Boolean(user && permissions[user.role]?.includes(permission));
  }

  function notify() {
    root.dispatchEvent(new CustomEvent('auth:change', { detail:{ user:currentUser } }));
  }

  async function signIn(email, password) {
    const user = await api.login(email, password, userStorage);
    api.writeSession(sessionStorage, user);
    currentUser = user;
    notify();
    return user;
  }

  async function registerUser(email, password) {
    const user = await api.registerUser(email, password, userStorage);
    api.writeSession(sessionStorage, user);
    currentUser = user;
    notify();
    return user;
  }

  function isPreviewMode() { return preview; }
  function togglePreviewMode(force) {
    preview = typeof force === 'boolean' ? force : !preview;
    root.document.body.classList.toggle('preview-mode', preview);
    root.dispatchEvent(new CustomEvent('preview:change', { detail:{ active:preview } }));
    return preview;
  }

  function signOut() {
    api.clearSession(sessionStorage);
    currentUser = null;
    togglePreviewMode(false);
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

  async function listUsers() {
    if (!can('users_manage')) throw new Error('Недостаточно прав');
    return api.listUsers(userStorage);
  }

  async function assignRole(email, role) {
    if (!can('users_manage')) throw new Error('Недостаточно прав');
    return api.assignRole(email, role, currentUser, userStorage);
  }

  root.Auth = { signIn, registerUser, signOut, getUser, can, requireRoute, roleLabel, listUsers, assignRole, isPreviewMode, togglePreviewMode };
})(window);
