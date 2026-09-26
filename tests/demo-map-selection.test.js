'use strict';

const assert = require('node:assert/strict');
const { applyMatchMapSelection } = require('../server.js');

const source = {
  matchId:'2379601', importedAt:'2026-09-24T00:00:00.000Z',
  maps:{
    Dust2:{ mapName:'Dust2', rounds:[{ number:1 }] },
    Inferno:{ mapName:'Inferno', rounds:[{ number:1 }] },
    Anubis:{ mapName:'Anubis', rounds:[{ number:1 }] }
  }
};

const allMaps = applyMatchMapSelection(structuredClone(source), '2379601', 'all');
assert.deepEqual(Object.keys(allMaps.maps).sort(), ['Anubis','Dust2','Inferno']);

const singleMap = applyMatchMapSelection({ ...structuredClone(source), maps:{ Inferno:source.maps.Inferno } }, '2379601', 'Inferno');
assert.deepEqual(Object.keys(singleMap.maps), ['Inferno']);
assert.throws(() => applyMatchMapSelection({ ...structuredClone(source), maps:{ Inferno:source.maps.Inferno } }, '2379601', 'Dust2'), /обнаружена карта Inferno/);
assert.throws(() => applyMatchMapSelection({ ...structuredClone(source), maps:{ Dust2:source.maps.Dust2 } }, '2379601', 'all'), /не найдены демо/i);

console.log('demo map selection tests passed');
