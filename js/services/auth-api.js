(function initAuthApiModule(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AuthApi = api;
})(typeof window !== 'undefined' ? window : globalThis, function createAuthApi() {
  'use strict';

  const SESSION_KEY = 'cs2-dashboard-session';
  const USERS_KEY = 'cs2-dashboard-users';
  const seededUsers = [
    { id:'user-root', email:'root@cs2.com', password:'root', role:'root' },
    { id:'user-admin', email:'admin@cs2.com', password:'admin', role:'admin' },
    { id:'user-media', email:'media@cs2.com', password:'media', role:'media_editor' }
  ];

  function readStoredUsers(storage) {
    try {
      const saved = JSON.parse(storage?.getItem(USERS_KEY));
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  }

  function readUsers(storage) {
    return [...seededUsers, ...readStoredUsers(storage).filter((u) => !seededUsers.some((s) => s.email === u.email))];
  }

  function getStorage(storage) { return storage || (typeof root !== 'undefined' ? root.localStorage : null); }

  function publicUser(user) {
    return user ? { id:user.id, email:user.email, role:user.role } : null;
  }

  // Mock API boundary. Replace these methods with fetch() calls when a backend is available.
  async function login(email, password, storage) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const user = readUsers(getStorage(storage)).find((candidate) => candidate.email === normalizedEmail && candidate.password === password);
    if (!user) throw new Error('Неверный email или пароль');
    return publicUser(user);
  }

  async function registerUser(email, password, storage) {
    // TODO: заменить на POST /api/auth/register
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error('Введите корректный email');
    if (String(password || '').length < 8) throw new Error('Пароль должен содержать не менее 8 символов');
    storage = getStorage(storage);
    const users = readUsers(storage);
    if (users.some((user) => user.email === normalizedEmail)) throw new Error('Пользователь с таким email уже зарегистрирован');
    const user = { id:`user-${Date.now()}`, email:normalizedEmail, password:String(password), role:'user' };
    try { storage?.setItem(USERS_KEY, JSON.stringify([...users.filter((u) => !seededUsers.some((s) => s.id === u.id)), user])); }
    catch { throw new Error('Не удалось сохранить пользователя в этом браузере'); }
    return publicUser(user);
  }

  function readSession(sessionStorage, userStorage = sessionStorage) {
    try {
      sessionStorage = getStorage(sessionStorage);
      userStorage = getStorage(userStorage);
      const session = JSON.parse(sessionStorage.getItem(SESSION_KEY));
      return readUsers(userStorage).some((user) => user.id === session?.id && user.role === session?.role) ? publicUser(session) : null;
    } catch {
      return null;
    }
  }

  function writeSession(storage, user) {
    storage = getStorage(storage);
    storage.setItem(SESSION_KEY, JSON.stringify(publicUser(user)));
  }

  function clearSession(storage) {
    storage = getStorage(storage);
    storage.removeItem(SESSION_KEY);
  }

  async function listUsers(storage) {
    return readUsers(getStorage(storage)).map((user) => ({ ...publicUser(user), isSystem:seededUsers.some((seed) => seed.id === user.id) }));
  }

  async function assignRole(email, role, actor, storage) {
    // TODO: заменить на PATCH /api/users/:id/role
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const allowedRoles = actor?.role === 'root' ? ['root', 'admin', 'media_editor', 'user'] : ['admin', 'media_editor', 'user'];
    if (!['root', 'admin'].includes(actor?.role)) throw new Error('Недостаточно прав для изменения ролей');
    if (!allowedRoles.includes(role)) throw new Error('Эту роль может назначить только root');
    storage = getStorage(storage);
    const users = readUsers(storage);
    const target = users.find((user) => user.email === normalizedEmail);
    if (!target) throw new Error('Пользователь с таким email не найден');
    if (seededUsers.some((user) => user.id === target.id)) throw new Error('Роль системного аккаунта изменить нельзя');
    if (target.id === actor.id) throw new Error('Нельзя изменить собственную роль');
    if (actor.role === 'admin' && target.role === 'root') throw new Error('Admin не может изменять root-аккаунты');
    const stored = readStoredUsers(storage);
    const updated = stored.map((user) => user.id === target.id ? { ...user, role } : user);
    storage.setItem(USERS_KEY, JSON.stringify(updated));
    return publicUser({ ...target, role });
  }

  return { login, registerUser, listUsers, assignRole, readSession, writeSession, clearSession, SESSION_KEY, USERS_KEY };
});
