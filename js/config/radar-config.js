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
    Ancient: Object.freeze({ id:'de_ancient', posX:-2953, posY:2164, scale:5, rotate:false, width:RADAR_SIZE, height:RADAR_SIZE }),
    Mirage: Object.freeze({
      id: 'de_mirage', posX: -3230, posY: 1713, scale: 5, rotate: false, width: RADAR_SIZE, height: RADAR_SIZE
    }),
    Nuke: Object.freeze({
      id: 'de_nuke', posX: -3453, posY: 2887, scale: 7, rotate: false, width: RADAR_SIZE, height: RADAR_SIZE,
      verticalSections:Object.freeze({ upper:Object.freeze({ min:-495, max:10000 }), lower:Object.freeze({ min:-10000, max:-495 }) })
    }),
    Cache: Object.freeze({
      id: 'de_cache', posX: -2000, posY: 3250, scale: 5.5, rotate: false, width: RADAR_SIZE, height: RADAR_SIZE
    }),
    Overpass: Object.freeze({ id:'de_overpass', posX:-4831, posY:1781, scale:5.2, rotate:false, width:RADAR_SIZE, height:RADAR_SIZE }),
    Train: Object.freeze({ id:'de_train', posX:-2308, posY:2078, scale:4.082077, rotate:false, width:RADAR_SIZE, height:RADAR_SIZE }),
    Vertigo: Object.freeze({ id:'de_vertigo', posX:-3168, posY:1762, scale:4, rotate:false, width:RADAR_SIZE, height:RADAR_SIZE,
      verticalSections:Object.freeze({ upper:Object.freeze({ min:11700, max:20000 }), lower:Object.freeze({ min:-10000, max:11700 }) }) })
  });

  const RADAR_ASSETS = Object.freeze({
    Nuke:Object.freeze({ upper:'assets/radar/de_nuke_radar.png', lower:'assets/radar/de_nuke_lower_radar.dds' }),
    Vertigo:Object.freeze({ upper:'assets/radar/de_vertigo_radar.dds', lower:'assets/radar/de_vertigo_lower_radar.png' })
  });

  function getOverview(mapName) {
    const overview = MAP_OVERVIEWS[mapName];

    if (!overview) {
      throw new Error(`Radar overview is not configured for map: ${mapName}`);
    }

    return overview;
  }

  function getRadarAsset(mapName, layer = 'upper') {
    return RADAR_ASSETS[mapName]?.[layer] || `assets/radar/${getOverview(mapName).id}_radar.png`;
  }

  return { RADAR_SIZE, MAP_OVERVIEWS, RADAR_ASSETS, getOverview, getRadarAsset };
});
