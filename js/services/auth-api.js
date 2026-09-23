(function initAuthApiModule(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AuthApi = api;
})(typeof window !== 'undefined' ? window : globalThis, function createAuthApi() {
  'use strict';

  const SESSION_KEY = 'cs2-dashboard-session';
  const users = Object.freeze([
    { id:'user-root', email:'root@cs2.com', password:'root', role:'root' },
    { id:'user-admin', email:'admin@cs2.com', password:'admin', role:'admin' },
    { id:'user-media', email:'media@cs2.com', password:'media', role:'media_editor' }
  ]);

  function publicUser(user) {
    return user ? { id:user.id, email:user.email, role:user.role } : null;
  }

  // Mock API boundary. Replace these methods with fetch() calls when a backend is available.
  async function login(email, password) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const user = users.find((candidate) => candidate.email === normalizedEmail && candidate.password === password);
    if (!user) throw new Error('Неверный email или пароль');
    return publicUser(user);
  }

  function readSession(storage) {
    try {
      const session = JSON.parse(storage.getItem(SESSION_KEY));
      return users.some((user) => user.id === session?.id && user.role === session?.role) ? publicUser(session) : null;
    } catch {
      return null;
    }
  }

  function writeSession(storage, user) {
    storage.setItem(SESSION_KEY, JSON.stringify(publicUser(user)));
  }

  function clearSession(storage) {
    storage.removeItem(SESSION_KEY);
  }

  return { login, readSession, writeSession, clearSession, SESSION_KEY };
});
