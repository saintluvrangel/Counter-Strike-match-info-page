'use strict';

const assert = require('node:assert/strict');
const AuthApi = require('../js/services/auth-api.js');
const GsiGenerator = require('../js/gsi-generator.js');

function createStorage() {
  const values = new Map();
  return {
    getItem:key => values.get(key) ?? null,
    setItem:(key, value) => values.set(key, value),
    removeItem:key => values.delete(key)
  };
}

(async function run() {
  const storage = createStorage();
  const root = await AuthApi.login('ROOT@CS2.COM', 'root');
  assert.deepEqual(root, { id:'user-root', email:'root@cs2.com', role:'root' });
  assert.equal(Object.hasOwn(root, 'password'), false);

  const registered = await AuthApi.registerUser(' New.User@example.com ', 'secure-pass-8', storage);
  assert.deepEqual(registered, { id:registered.id, email:'new.user@example.com', role:'user' });
  assert.equal((await AuthApi.login('new.user@example.com', 'secure-pass-8', storage)).id, registered.id);
  await assert.rejects(() => AuthApi.registerUser('new.user@example.com', 'secure-pass-8', storage), /уже зарегистрирован/);
  await assert.rejects(() => AuthApi.registerUser('bad-email', 'secure-pass-8', storage), /корректный email/);
  await assert.rejects(() => AuthApi.registerUser('valid@example.com', 'short', storage), /8 символов/);

  AuthApi.writeSession(storage, root);
  assert.deepEqual(AuthApi.readSession(storage), root);
  AuthApi.clearSession(storage);
  assert.equal(AuthApi.readSession(storage), null);
  await assert.rejects(() => AuthApi.login('root@cs2.com', 'wrong'), /Неверный/);

  const config = GsiGenerator.generateConfig({
    name:'CS2_Dashboard_Integration',
    token:'test-token',
    port:3000,
    selectedData:['provider', 'map', 'player_state', 'bomb']
  });
  assert.match(config, /^"CS2_Dashboard_Integration"/);
  assert.match(config, /"uri" "http:\/\/127\.0\.0\.1:3000"/);
  assert.match(config, /"token" "test-token"/);
  assert.match(config, /"player_state"\s+"1"/);
  assert.doesNotMatch(config, /"round"\s+"1"/);
  assert.equal(GsiGenerator.safeFileName('My GSI Config'), 'my_gsi_config.cfg');
  assert.throws(() => GsiGenerator.generateConfig({ name:'x', token:'x', port:70000, selectedData:[] }), /Порт/);

  console.log('auth and GSI tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
