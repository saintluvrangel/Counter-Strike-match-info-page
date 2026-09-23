'use strict';

const assert = require('node:assert/strict');
const coordinates = require('../js/data/mock-map-coordinates.js');
const { MockMinimapSource, normalizePlayers, radarToWorld, worldToRadar } = require('../js/components/minimap.js');

function assertClose(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not close to ${expected}`);
}

['Dust2', 'Inferno', 'Anubis', 'Mirage', 'Nuke', 'Cache'].forEach((mapName) => {
  const expected = { x: .37, y: .64 };
  const worldPosition = radarToWorld(mapName, expected);
  const radarPosition = worldToRadar(mapName, worldPosition);

  assertClose(radarPosition.x, expected.x);
  assertClose(radarPosition.y, expected.y);
  assert.equal(radarPosition.visible, true);
  assert.equal(coordinates.getRoutes(mapName, 'T').length, 5);
  assert.equal(coordinates.getRoutes(mapName, 'CT').length, 5);
});

let mockSnapshot;
const stopMock = new MockMinimapSource({
  mapName:'Mirage',
  players:[{ id:'player-1', nick:'Player', side:'T', number:1, weapon:'AK-47' }],
  intervalMs:60_000
}).subscribe((snapshot) => { mockSnapshot = snapshot; });
stopMock();
assert.equal(mockSnapshot.mapName, 'Mirage');
assert.equal(mockSnapshot.players.length, 1);
assert.equal(worldToRadar('Mirage', mockSnapshot.players[0].position).visible, true);

const normalized = normalizePlayers([
  { id:'one', nick:'old', side:'T', position:{ x:10, y:20 } },
  { id:'one', nick:'new', side:'CT', position:{ x:30, y:40 } },
  { id:'invalid', side:'T', position:{ x:'not-a-number', y:0 } }
]);

assert.equal(normalized.length, 1);
assert.equal(normalized[0].nick, 'new');
assert.equal(normalized[0].side, 'CT');
assert.deepEqual(normalized[0].position, { x:30, y:40 });

console.log('minimap tests passed');
