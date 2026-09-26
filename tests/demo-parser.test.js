'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { normalizeParsedRows } = require('../js/demo-parser.js');
const { decodeDxt1 } = require('../js/components/dds-radar.js');

const parsed = normalizeParsedRows({
  mapName:'Dust2', tickRate:64,
  eventRows:[
    { event_name:'round_start', tick:64 },
    { event_name:'player_death', tick:128, attacker_name:'alpha', user_name:'bravo', attacker_steamid:'76561198034202222', user_steamid:'76561198034202223', weapon:'ak47', attacker_X:120, attacker_Y:240, user_X:180, user_Y:260 },
    { event_name:'player_hurt', tick:144, attacker_name:'alpha', user_name:'bravo', dmg_health:42 },
    { event_name:'bomb_planted', tick:160, user_name:'alpha', user_steamid:'76561198034202222', user_X:140, user_Y:250 },
    { event_name:'bomb_begindefuse', tick:176, user_name:'bravo', user_steamid:'76561198034202223', user_X:180, user_Y:260, haskit:true },
    { event_name:'bomb_defused', tick:192, user_name:'bravo' },
    { event_name:'smokegrenade_detonate', tick:120, user_name:'alpha' },
    { event_name:'inferno_startburn', tick:150, user_name:'alpha', user_steamid:'1', user_X:145, user_Y:251 },
    { event_name:'round_end', tick:256 }
  ],
  tickRows:[
    { tick:64, name:'alpha', steamid:'1', team_num:2, X:100, Y:220, Z:32, yaw:0, is_alive:true, health:87, armor_value:64, balance:3450, inventory:['AK-47','Smoke Grenade'] },
    { tick:64, name:'bravo', steamid:'2', team_num:3, X:190, Y:270, Z:32, yaw:180, is_alive:true, health:100, armor_value:100, balance:16000, inventory:['M4A1-S'] },
    { tick:128, name:'alpha', steamid:'1', team_num:2, X:120, Y:240, Z:32, yaw:20, is_alive:true },
    { tick:128, name:'bravo', steamid:'2', team_num:3, X:180, Y:260, Z:32, yaw:160, is_alive:false },
    { tick:256, name:'alpha', steamid:'1', team_num:2, X:130, Y:250, Z:32, yaw:30, is_alive:true }
  ],
  grenadeRows:[
    { tick:96, grenade_entity_id:7, grenade_type:'SmokeGrenade', name:'alpha', thrower_steamid:'1', x:110, y:230, z:40 },
    { tick:104, grenade_entity_id:7, grenade_type:'SmokeGrenade', name:'alpha', x:null, y:null, z:null },
    { tick:112, grenade_entity_id:7, grenade_type:'SmokeGrenade', name:'alpha', thrower_steamid:'1', x:140, y:250, z:35 },
    { tick:150, grenade_entity_id:8, grenade_type:'Inferno', name:'alpha', thrower_steamid:'1', x:145, y:251, z:35 }
  ]
});

assert.equal(parsed.mapName, 'Dust2');
assert.equal(parsed.rounds.length, 1);
const killEvent = parsed.rounds[0].events.find((event) => event.type === 'kill');
assert.equal(killEvent.actor.name, 'alpha');
assert.equal(parsed.rounds[0].events.some((event) => event.type === 'bomb_plant'), true);
assert.equal(parsed.rounds[0].events.some((event) => event.type === 'bomb_defuse'), true);
assert.deepEqual(killEvent.position, { x:120, y:240, z:32 });
assert.deepEqual(killEvent.targetPosition, { x:180, y:260, z:32 });
assert.equal(parsed.rounds[0].samples[0].players.length, 2);
assert.equal(parsed.rounds[0].samples[0].players[0].health, 87);
assert.equal(parsed.rounds[0].samples[0].players[0].armor, 64);
assert.equal(parsed.rounds[0].samples[0].players[0].money, 3450);
assert.deepEqual(parsed.rounds[0].samples[0].players[0].inventory, ['AK-47','Smoke Grenade']);
assert.equal(parsed.rounds[0].events.find((event) => event.type === 'bomb_defuse_start').hasKit, true);
assert.equal(parsed.rounds[0].events.find((event) => event.type === 'smoke').grenadeType, 'SmokeGrenade');
assert.equal(parsed.rounds[0].events.find((event) => event.type === 'molotov').grenadeType, 'Inferno');
assert.equal(parsed.rounds[0].grenades[0].samples.length, 2);
assert.equal(parsed.rounds[0].grenades[0].throwerId, '1');
assert.equal(parsed.stats.alpha.kills, 1);
assert.equal(parsed.stats.alpha.damage, 42);
assert.equal(parsed.stats.bravo.deaths, 1);
assert.equal(parsed.playerSteamIds.alpha, '76561198034202222');
assert.equal(parsed.playerSteamIds.bravo, '76561198034202223');

const ddsFile = path.join(__dirname, '..', 'assets', 'radar', 'de_nuke_lower_radar.dds');
const pixels = decodeDxt1(fs.readFileSync(ddsFile));
assert.equal(pixels.width, 1024);
assert.equal(pixels.height, 1024);
assert.equal(pixels.data.length, 1024 * 1024 * 4);
assert.ok(pixels.data.some((channel) => channel > 0), 'DDS radar decodes visible map colors');

// Два дыма одновременно: старая неподвижная граната не должна забирать координаты новой.
const overlap = normalizeParsedRows({ mapName:'Dust2', tickRate:64, tickRows:[],
  eventRows:[{ event_name:'round_start', tick:0 },
    { event_name:'smokegrenade_detonate', tick:64, entityid:1, user_name:'a', user_steamid:'1', x:100, y:200, z:0 },
    { event_name:'smokegrenade_detonate', tick:128, entityid:2, user_name:'b', user_steamid:'2', user_X:999, user_Y:999, x:500, y:600, z:0 },
    { event_name:'round_end', tick:1400 }],
  grenadeRows:[{ tick:60, grenade_entity_id:1, grenade_type:'SmokeGrenade', steamid:'1', x:100, y:200, z:0 },
    { tick:128, grenade_entity_id:1, grenade_type:'SmokeGrenade', steamid:'1', x:100, y:200, z:0 },
    { tick:120, grenade_entity_id:2, grenade_type:'SmokeGrenade', steamid:'2', x:495, y:598, z:0 }]
});
const secondSmoke = overlap.rounds[0].events.filter(e => e.type === 'smoke')[1];
assert.deepEqual(secondSmoke.position, { x:500, y:600, z:0 });
assert.equal(secondSmoke.grenadeId, '2-120');
assert.equal(secondSmoke.actor.id, '2');
const replay = require('../js/components/round-replay.js').createFromDemo('Dust2', overlap.rounds[0]);
assert.equal(replay.getSnapshot(2.1).activeEffects.length, 2);
assert.equal(replay.getSnapshot(2.1).grenadeTracks.length, 0);
assert.equal(replay.getSnapshot(21).activeEffects.length, 0);

const boundaries = normalizeParsedRows({ mapName:'Dust2', tickRate:64, tickRows:[], grenadeRows:[], eventRows:[
  { event_name:'round_start', tick:1, round:1, is_warmup_period:false },
  { event_name:'round_end', tick:3, round:1, is_warmup_period:false },
  { event_name:'round_start', tick:4, is_warmup_period:true },
  { event_name:'player_death', tick:10, attacker_name:'warmup', user_name:'other' },
  { event_name:'round_start', tick:40, round:1, is_warmup_period:false },
  { event_name:'round_start', tick:50, round:1, is_warmup_period:false },
  { event_name:'round_end', tick:100, round:1 },
  { event_name:'round_start', tick:100, round:2 },
  { event_name:'round_freeze_end', tick:120 },
  { event_name:'round_end', tick:200, round:2 }
] });
assert.deepEqual(boundaries.rounds.map(r => [r.number, r.startTick, r.endTick]), [[1,50,100],[2,120,200]]);
assert.equal(boundaries.stats.warmup, undefined);
assert.equal(boundaries.rounds[1].events[0].type, 'round_start');

const equipment = require('../js/components/equipment.js');
for (const file of fs.readdirSync(path.join(__dirname, '../assets/equipment')).filter(f => f.endsWith('.svg'))) {
  assert.ok(fs.existsSync(path.join(__dirname, '../assets/equipment', equipment.asset(file.slice(0,-4)))));
}
assert.equal(equipment.asset('M4A4'), 'm4a1.svg');
assert.equal(equipment.asset('Butterfly Knife'), 'knife_butterfly.svg');
assert.equal(equipment.asset('M9 Bayonet'), 'knife_m9_bayonet.svg');
assert.equal(equipment.asset('USP-S'), 'usp_silencer.svg');
// Техническое завершение в середине матча пропускается, обычный world-kill — нет.
const restarted = normalizeParsedRows({ mapName:'Dust2', tickRows:[], grenadeRows:[], eventRows:[
  { event_name:'round_start', tick:1, round:1 },
  { event_name:'player_death', tick:60, weapon:'world', user_name:'a', user_steamid:'1', attacker_steamid:'1' },
  { event_name:'round_end', tick:64, winner:'T', reason:'ct_killed' },
  { event_name:'round_start', tick:80, round:2 },
  ...['1','2','3','4'].map(id => ({ event_name:'player_death', tick:100, weapon:'world', user_name:id, attacker_name:id, user_steamid:id, attacker_steamid:id })),
  { event_name:'round_end', tick:100, winner:null, reason:null },
  { event_name:'round_start', tick:110, round:2 },
  { event_name:'player_death', tick:130, weapon:'ak47', attacker_name:'b', user_name:'a', headshot:true },
  { event_name:'round_end', tick:150, winner:'CT', reason:'t_killed' },
] });
assert.deepEqual(restarted.rounds.map(r => r.startTick), [1,110]);
assert.equal(restarted.rounds[0].events.some(e => e.weapon === 'world'), true);
assert.equal(restarted.skippedRounds.length, 1);
assert.equal(restarted.stats['2'], undefined);
assert.equal(restarted.rounds[1].events.find(e => e.type === 'kill').headshot, true);
console.log('demo parser tests passed');
