'use strict';

const assert = require('node:assert/strict');
const store = new Map();
global.window = {
  localStorage:{ getItem:(key) => store.get(key) || null, setItem:(key, value) => store.set(key, value) },
  Steam:require('../js/steam.js')
};
require('../js/player-identity.js');

const steamId = '76561198034202222';
const profile = { id:'mibr:insani', nickname:'insani', steamId, aliases:['FelipeYuji','old-tag'] };
window.localStorage.setItem('cs2_players', JSON.stringify([profile]));
const roster = [{ id:'insani', name:'insani', full:'Felipe Yuji', identityId:profile.id, steamId, aliases:profile.aliases }];

assert.equal(window.PlayerIdentity.resolveRosterPlayer(roster, 'old tag').id, 'insani');
assert.equal(window.PlayerIdentity.resolveRosterPlayer(roster, 'new-match-tag', steamId).id, 'insani');
const mapped = window.PlayerIdentity.matchMapStats(roster, {
  rounds:Array.from({ length:10 }, (_, index) => ({ number:index + 1 })),
  stats:{ 'new-match-tag':{ kills:12, deaths:8, assists:4, damage:1750 } },
  playerSteamIds:{ newmatchtag:steamId }
});
assert.deepEqual(mapped.insani, { kills:12, deaths:8, assists:4, damage:1750, adr:175 });

global.DOMParser = class {
  parseFromString(xml) { return { querySelector:(tag) => tag === 'steamID64' ? { textContent:xml.match(/<steamID64>(\d+)<\/steamID64>/)?.[1] || '' } : null }; }
};
window.Steam.resolve('https://steamcommunity.com/id/example-player/', async (url) => {
  assert.equal(url, 'https://steamcommunity.com/id/example-player?xml=1');
  return { text:async () => `<profile><steamID64>${steamId}</steamID64></profile>` };
}).then((resolved) => {
  assert.equal(resolved.value, steamId);
  assert.equal(typeof resolved.value, 'string');
  console.log('steam vanity resolution tests passed');
}).catch((error) => { console.error(error); process.exitCode = 1; });

console.log('player identity tests passed');
