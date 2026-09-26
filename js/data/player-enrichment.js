/*
 * Справочные данные публичных профилей HLTV и Steam для текущего mock-roster.
 * HLTV Rating 3.0 — снимок значений «Past 3 months» на 25.09.2026.
 * Steam-профили взяты из публичного community-списка; неоднозначные записи
 * намеренно оставлены пустыми. Эти значения можно заменить данными API/backend.
 */
(function initPlayerEnrichment(root) {
  'use strict';
  const ratings = {
    molodoy:[24144,1.10], yuurih:[12553,.94], fallen:[2023,.90], kscerato:[15631,1.21], yekindar:[13915,1.06],
    tomaszin:[22570,1.16], insani:[21037,1.20], nqz:[19694,1.07], venomzera:[21288,1.08], lnz:[19310,.94],
    senka:[22878,.95], flouzer:[24568,1.08], k0s:[22430,1.02], h1kan:[23303,null], fluffy:[24569,.97],
    kashl1d:[23686,1.10], relaxxie:[23684,1.07], xeedo:[22886,1.12], qw1nk1:[24725,1.07], x5g7v:[19575,.99],
    xelex:[24457,1.05], spinx:[18221,1.12], xertion:[20312,1.09], torzsi:[18072,1.11], pr:[22279,.97],
    im:[14759,.98], makazze:[22673,1.03], b1t:[18987,1.03], w0nderful:[20127,1.09], aleksib:[9816,.85],
    woxic:[8574,1.03], xantares:[7938,1.06], wicadia:[21243,1.07], jimpphat:[18850,1.14], kyxsan:[19677,.99],
    mezii:[18462,1.02], apex:[7322,null], ropz:[11816,1.06], zywoo:[11893,1.32], flamez:[16693,null]
  };
  const steamIds = {
    fallen:'76561197960690195', yuurih:'76561198164970560', kscerato:'76561198058500492', yekindar:'76561198134401925',
    insani:'76561198061423730', woxic:'76561198083485506', xantares:'76561198044118796', wicadia:'76561198812513923',
    jimpphat:'76561198855375325', xertion:'76561198193174134', torzsi:'76561198355739212', aleksib:'76561198013243326',
    im:'76561198050250233', b1t:'https://steamcommunity.com/id/b1t333/', w0nderful:'76561199063068840',
    apex:'76561197989744167', zywoo:'76561198113666193', flamez:'https://steamcommunity.com/id/flameZzZz/',
    mezii:'https://steamcommunity.com/id/kingmezii/', ropz:'76561197991272318'
  };
  const snapshot = '2026-09-25T00:00:00.000Z';
  const profiles = {};
  Object.entries(ratings).forEach(([nickname, [hltvId, rating]]) => {
    profiles[nickname] = {
      hltvId:String(hltvId),
      hltvStats:{ rating, kd:null, lastUpdated:snapshot, source:'HLTV Rating 3.0 · past 3 months', hltvProfileUrl:`https://www.hltv.org/player/${hltvId}/${nickname}` },
      steamId:steamIds[nickname] || null
    };
  });
  Object.entries(steamIds).forEach(([nickname, steamId]) => { if (profiles[nickname]) profiles[nickname].steamId = steamId; });
  root.PlayerEnrichment = profiles;
})(window);
