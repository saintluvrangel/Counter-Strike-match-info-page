'use strict';

const assert = require('node:assert/strict');

const memory = new Map();
global.localStorage = {
  getItem:key => memory.get(key) ?? null,
  setItem:(key, value) => memory.set(key, value),
  removeItem:key => memory.delete(key)
};

global.HltvMatchData = require('../js/data/hltv-match-data.js');
global.location = { protocol:'http:' };
global.Auth = {
  can:permission => permission === 'news_manage',
  getUser:() => ({ id:'user-media', role:'media_editor' })
};
global.fetch = async () => ({
  ok:true,
  async json() {
    return { title:'Telegram title', content:'Telegram text', imageUrl:null, publishedAt:'2026-09-20T12:00:00.000Z', source:'https://t.me/cs2_channel/123', channel:'cs2_channel', messageId:'123' };
  }
});
const MatchesApi = require('../js/services/matches-api.js');
const NewsApi = require('../js/services/news-api.js');

(async function run() {
  const matches = await MatchesApi.list();
  assert.equal(matches.length, 7);
  assert.equal((await MatchesApi.get('2379601')).teamA.name, 'Nuclear TigeRES');
  const auroraVitality = await MatchesApi.get('2398105');
  assert.equal(auroraVitality.status, 'finished');
  assert.deepEqual(auroraVitality.maps.map(([name]) => name), ['Anubis', 'Inferno', 'Nuke']);
  assert.equal(auroraVitality.teamA.players.length, 5);
  assert.equal(auroraVitality.teamB.players.length, 5);
  assert.match(auroraVitality.teamB.players.find(([nick]) => nick === 'ZywOo')[2], /^https:\/\/img-cdn\.hltv\.org\/playerbodyshot\//);
  assert.notStrictEqual(auroraVitality.teamA.players, (await MatchesApi.get('2398105')).teamA.players);
  assert.equal(await MatchesApi.get('missing'), null);

  const parsed = await NewsApi.parseTelegram('https://t.me/cs2_channel/123');
  assert.equal(parsed.title, 'Telegram title');
  assert.equal(parsed.text, 'Telegram text');
  assert.equal(parsed.sourceType, 'telegram');
  await assert.rejects(() => NewsApi.parseTelegram('https://example.com/post'), /t\.me/);

  await NewsApi.create({ title:'Test title', text:'Test text', imageUrl:'', source:'manual' });
  const news = await NewsApi.list();
  assert.equal(news[0].title, 'Test title');
  assert.equal(news[0].imageUrl, '');
  await NewsApi.remove(news[0].id);
  assert.equal((await NewsApi.list()).some((item) => item.id === news[0].id), false);

  console.log('matches and news tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
