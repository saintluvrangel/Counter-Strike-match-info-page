'use strict';

const assert = require('node:assert/strict');
const Replay = require('../js/components/round-replay.js');
const Radar = require('../js/components/minimap.js');

const players = Array.from({ length:10 }, (_, index) => ({
  id:`player-${index}`,
  nick:`Player ${index}`,
  number:(index % 5) + 1,
  side:index < 5 ? 'T' : 'CT',
  position:{ x:0, y:0 }
}));
const replay = Replay.create('Anubis', players);
const opening = replay.getSnapshot(0);
const middle = replay.getSnapshot(24);
const late = replay.getSnapshot(49);

assert.equal(opening.source, 'demo');
assert.equal(opening.players.length, 10);
assert.equal(new Set(opening.players.map((player) => JSON.stringify(Radar.worldToRadar('Anubis', player.position)))).size, 10, 'стартовые маркеры не накладываются друг на друга');
assert.notDeepEqual(opening.players[0].position, middle.players[0].position, 'игрок проходит маршрут карты');
assert.equal(opening.players.every((player) => Radar.worldToRadar('Anubis', player.position).visible), true);
assert.equal(opening.players.every((player) => Number.isFinite(player.heading)), true);
assert.equal(middle.bomb.planted, true);
assert.equal(middle.bomb.secondsRemaining, 40);
assert.equal(middle.activeEffects.some((effect) => effect.type === 'smoke'), true);
assert.equal(replay.getSnapshot(42).activeEffects.some((effect) => effect.type === 'molotov'), false);
assert.equal(late.players.filter((player) => player.alive && player.side === 'T').length, 3);
assert.equal(late.chanceT < opening.chanceT, true);

const imported = Replay.createFromDemo('Dust2', {
  number:1, duration:40,
  events:[
    { id:'shot', type:'shot', at:2, timestampMs:2000, actor:{ id:'76561198000000001', name:'demo-nick' }, position:{ x:-1500, y:-700, z:0 } },
    { id:'hit', type:'damage', at:2.1, timestampMs:2100, actor:{ id:'76561198000000001', name:'demo-nick' }, target:{ id:'76561198000000002', name:'opponent' }, targetPosition:{ x:-1400, y:-600, z:0 } },
    { id:'plant', type:'bomb_plant', at:5, timestampMs:5000, actor:{ name:'Player 0' }, position:{ x:-1200, y:-500, z:0 } },
    { id:'smoke', type:'smoke', at:1.75, timestampMs:1750, duration:18, grenadeType:'CSmokeGrenadeProjectile', position:{ x:-1300, y:-550, z:0 } },
    { id:'begin-defuse', type:'bomb_defuse_start', at:20, timestampMs:20000, hasKit:true, actor:{ name:'Player 5' } },
    { id:'defuse', type:'bomb_defuse', at:25, timestampMs:25000, actor:{ name:'Player 5' } }
  ],
  samples:[{ seconds:0, players:[
    { id:'76561198000000001', nick:'demo-nick', side:'T', position:{ x:-1500, y:-700, z:0 }, heading:0, health:80, armor:50, inventory:['AK-47'], alive:true },
    { id:'76561198000000002', nick:'opponent', side:'CT', position:{ x:-1400, y:-600, z:0 }, heading:0, alive:true }
  ] }],
  grenades:[{ id:'smoke-1', type:'CSmokeGrenadeProjectile', thrower:'demo-nick', throwerId:'76561198000000001', samples:[
    { seconds:1, position:{ x:-1400, y:-600, z:0 } },
    { seconds:1.5, position:{ x:-1350, y:-575, z:0 } }
  ] }]
}, { playerNicknames:{ '76561198000000001':'roster-nick' }, playerNumbers:{ '76561198000000001':3 } });
assert.equal(imported.getSnapshot(1.6).grenadeTracks[0].icon, 'smokegrenade.svg');
assert.equal(imported.getSnapshot(1.6).grenadeTracks[0].flying, true);
assert.equal(imported.getSnapshot(1.6).grenadeTracks[0].side, 'T');
assert.equal(imported.getSnapshot(2).activeEffects[0].effectKind, 'smoke');
assert.equal(imported.getSnapshot(2).grenadeTracks.length, 0, 'после раскрытия смока убираем снаряд и его трейсер');
assert.equal(imported.getSnapshot(10).bomb.secondsRemaining, 35);
assert.equal(imported.getSnapshot(10).bomb.active, true);
assert.equal(imported.getSnapshot(10).bomb.point.length, 2);
assert.deepEqual(imported.getSnapshot(10).bomb.point, [Radar.worldToRadar('Dust2', { x:-1200, y:-500 }).x, Radar.worldToRadar('Dust2', { x:-1200, y:-500 }).y], 'координата C4 берётся из позиции установки');
assert.equal(imported.getSnapshot(22).bomb.defuseActive, true);
assert.equal(imported.getSnapshot(22).bomb.defuseSecondsRemaining, 3);
assert.equal(imported.getSnapshot(26).bomb.result, 'defused');
assert.equal(imported.getSnapshot(2.2).activeShot.confirmedHit, true);
assert.equal(imported.getSnapshot(2.2).activeShot.side, 'T');
assert.equal(imported.getSnapshot(2.2).players[0].nick, 'roster-nick');
assert.equal(imported.getSnapshot(2.2).players[0].number, 3);
assert.equal(imported.getSnapshot(2.2).players[0].health, 80);
assert.equal(imported.getSnapshot(2.2).players[1].health, null, 'неизвестное здоровье остаётся неизвестным');
assert.equal(imported.getSnapshot(2.2).players[0].armor, 50);

const smokeExtinguishesFire = Replay.createFromDemo('Dust2', {
  number:2, duration:22,
  events:[
    { id:'fire-start', type:'molotov', at:1, timestampMs:1000, position:{ x:-1300, y:-550, z:0 }, duration:7 },
    { id:'smoke-pop', type:'smoke', at:3.2, timestampMs:3200, position:{ x:-1280, y:-560, z:0 }, duration:18 }
  ], samples:[], grenades:[]
});
assert.equal(smokeExtinguishesFire.getSnapshot(2).activeEffects.some((effect) => effect.type === 'molotov'), true, 'огонь горит до попадания смока');
assert.deepEqual(smokeExtinguishesFire.getSnapshot(4).activeEffects.map((effect) => effect.type), ['smoke'], 'смок тушит близкий молотов и сам остаётся на карте');

const healthReplay = Replay.createFromDemo('Dust2', {
  number:3, duration:4,
  events:[{ id:'hurt', type:'damage', at:2.1, timestampMs:2100, damage:38, actor:{ id:'victim', name:'victim' }, target:{ id:'victim', name:'victim' }, targetPosition:{ x:-1400, y:-600, z:0 } }],
  samples:[
    { seconds:0, players:[{ id:'victim', nick:'victim', side:'CT', position:{ x:-1400, y:-600, z:0 }, health:100, alive:true }] },
    { seconds:2.5, players:[{ id:'victim', nick:'victim', side:'CT', position:{ x:-1400, y:-600, z:0 }, health:62, alive:true }] }
  ], grenades:[]
});
assert.equal(healthReplay.getSnapshot(2.2).players[0].health, 62, 'урон обновляет HP до следующего demo-сэмпла');
assert.deepEqual(healthReplay.getSnapshot(2.2).recentDamage.map((event) => event.damage), [38], 'для HUD доступно краткое событие урона по цели');
assert.equal(healthReplay.getSnapshot(2.7).players[0].health, 62, 'новый demo-сэмпл не списывает урон повторно');

console.log('round replay tests passed');
