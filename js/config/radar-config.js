(function initRadarConfig(root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.CSRadarConfig = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createRadarConfig() {
  'use strict';

  const RADAR_SIZE = 1024;

  // Extracted from the installed CS2 resource/overviews files.
  const MAP_OVERVIEWS = Object.freeze({
    Dust2: Object.freeze({
      id: 'de_dust2',
      posX: -2476,
      posY: 3239,
      scale: 4.4,
      rotate: true,
      width: RADAR_SIZE,
      height: RADAR_SIZE
    }),
    Inferno: Object.freeze({
      id: 'de_inferno',
      posX: -2087,
      posY: 3870,
      scale: 4.9,
      rotate: false,
      width: RADAR_SIZE,
      height: RADAR_SIZE
    }),
    Anubis: Object.freeze({
      id: 'de_anubis',
      posX: -2796,
      posY: 3328,
      scale: 5.22,
      rotate: false,
      width: RADAR_SIZE,
      height: RADAR_SIZE
    }),
    Mirage: Object.freeze({
      id: 'de_mirage', posX: -3230, posY: 1713, scale: 5, rotate: false, width: RADAR_SIZE, height: RADAR_SIZE
    }),
    Nuke: Object.freeze({
      id: 'de_nuke', posX: -3453, posY: 2887, scale: 7, rotate: false, width: RADAR_SIZE, height: RADAR_SIZE
    }),
    Cache: Object.freeze({
      id: 'de_cache', posX: -2000, posY: 3250, scale: 5.5, rotate: false, width: RADAR_SIZE, height: RADAR_SIZE
    })
  });

  function getOverview(mapName) {
    const overview = MAP_OVERVIEWS[mapName];

    if (!overview) {
      throw new Error(`Radar overview is not configured for map: ${mapName}`);
    }

    return overview;
  }

  return { RADAR_SIZE, MAP_OVERVIEWS, getOverview };
});
