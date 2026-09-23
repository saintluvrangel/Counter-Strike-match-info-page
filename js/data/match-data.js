(function initMatchData(root) {
  'use strict';

  const fallbackAvatar = 'https://www.hltv.org/img/static/player/player_silhouette.png';
  const teamLogo = {
    nuclear: 'https://img-cdn.hltv.org/teamlogo/GcO3SLh1j8cgiNGoEXNUVS.png?ixlib=java-2.1.0&s=856dc9f0ffdbeedbe76d9874fbcdb546&w=50',
    k27: 'https://img-cdn.hltv.org/teamlogo/7LmOZHYhlq-fIAm23aM2q1.png?ixlib=java-2.1.0&s=e194cf9c20b306723ae899eac0e8a356&w=50'
  };

  const players = [
    { id:'senka', name:'senka', full:'Arseniy Kozlovsky', team:'Nuclear TigeRES', rank:'#47 current / #38 peak', photo:'https://img-cdn.hltv.org/playerbodyshot/eDZ47qVhKR6T_d1xiC6vFO.png?ixlib=java-2.1.0&s=8018a1ab20f53358d4df78a9607ca14c&w=400' },
    { id:'flouzer', name:'flouzer', full:'Ilya Selifonov', team:'Nuclear TigeRES', rank:'HLTV profile', photo:'https://img-cdn.hltv.org/playerbodyshot/raSGvazp2eJUaBEQ3VAfnQ.png?ixlib=java-2.1.0&s=614db791b09d3b1ad0613fe16dc3b777&w=400' },
    { id:'k0s', name:'k0s', full:'Matvey Abramov', team:'Nuclear TigeRES', rank:'HLTV profile', photo:'https://img-cdn.hltv.org/playerbodyshot/VYl2SXeVj3feQFMrVIbVbN.png?ixlib=java-2.1.0&s=0db0bf1e7d29bf4629f6893ec13ea8c9&w=400' },
    { id:'h1kaN', name:'h1kaN', full:'Yuriy Rotar', team:'Nuclear TigeRES', rank:'HLTV profile', photo:'https://img-cdn.hltv.org/playerbodyshot/aepjG-2DfBqVRi_PvPu55v.png?ixlib=java-2.1.0&s=e75e94680b5ef84ea3cd74217fc54fb2&w=400' },
    { id:'fluffy', name:'fluffy', full:'Vladislav Galimov', team:'Nuclear TigeRES', rank:'HLTV profile', photo:'https://img-cdn.hltv.org/playerbodyshot/zavLCBfyGSmHFgxufhxTlf.png?ixlib=java-2.1.0&s=2d19f037b651ab8da7ec76af9e7ea6fb&w=400' },
    { id:'kashl1d', name:'kashl1d', full:'Danila Dronov', team:'K27', rank:'Top player in match', photo:'https://img-cdn.hltv.org/playerbodyshot/wNGdRx4DbLG4EZHXhOqxQI.png?ixlib=java-2.1.0&s=6f62e0ba8ea11f8948b0ff198ca2af99&w=400' },
    { id:'relaxxie', name:'relaxxie', full:'Karim Miftakhov', team:'K27', rank:'HLTV profile', photo:'https://img-cdn.hltv.org/playerbodyshot/xl5WSZlHhqSKBZBCeFosr0.png?ixlib=java-2.1.0&s=7dbbb865c6ab31578a31a809a0221bd4&w=400' },
    { id:'xeedo', name:'xeedo', full:'Aleksey Mikulich', team:'K27', rank:'HLTV profile', photo:'https://img-cdn.hltv.org/playerbodyshot/peZ4CDwvPiNL_pKOksbZFS.png?ixlib=java-2.1.0&s=f068148cf7b40460adebcbc928f34710&w=400' },
    { id:'qw1nk1', name:'qw1nk1', full:'Daniil Kabilov', team:'K27', rank:'HLTV profile', photo:'https://img-cdn.hltv.org/playerbodyshot/gIiMgI6yAJJq0yQZM92y7k.png?ixlib=java-2.1.0&s=399e85575901c4726b34c86b263bde4a&w=400' },
    { id:'X5G7V', name:'X5G7V', full:'Daniil Maryshev', team:'K27', rank:'HLTV profile', photo:'https://img-cdn.hltv.org/playerbodyshot/XMyAjreb7JMtwc_AZd9H0-.png?ixlib=java-2.1.0&s=bd4e7746cdfec70ccb4736ea856bd8b7&w=400' }
  ];

  const stats = {
    total: { rows:{ senka:['38','46','-',90.1,1.23], flouzer:['49','40','-',84.3,1.21], k0s:['46','41','-',77.4,1.07], h1kaN:['43','49','-',76.8,0.93], fluffy:['36','42','-',56.4,0.73], kashl1d:['52','40','-',90.8,1.40], relaxxie:['54','42','-',85.5,1.33], xeedo:['47','42','-',81.2,1.24], qw1nk1:['34','44','-',61.3,0.87], X5G7V:['29','45','-',56.8,0.68] } },
    Dust2: { score:'10 : 13', rows:{ senka:['13','19','-',72.9,0.98], flouzer:['17','16','-',83.7,1.03], k0s:['19','15','-',84.7,1.00], h1kaN:['17','20','-',86.4,0.87], fluffy:['11','17','-',56.4,0.75], kashl1d:['21','15','-',109.3,1.82], relaxxie:['22','15','-',87.1,1.50], xeedo:['22','14','-',78.7,1.42], qw1nk1:['13','18','-',69.8,0.87], X5G7V:['8','16','-',49.1,0.68] } },
    Inferno: { score:'13 : 5', rows:{ senka:['14','10','-',116.3,1.91], flouzer:['12','9','-',58.4,1.21], k0s:['14','11','-',84.7,1.33], h1kaN:['15','11','-',82.6,1.27], fluffy:['13','11','-',61.2,0.72], kashl1d:['16','12','-',86.8,1.20], relaxxie:['11','14','-',66.1,0.82], xeedo:['7','14','-',65.6,0.87], qw1nk1:['8','13','-',43.5,0.58], X5G7V:['9','15','-',57.7,0.63] } },
    Anubis: { score:'8 : 13', rows:{ senka:['11','17','-',86.5,1.01], flouzer:['20','15','-',107.3,1.44], k0s:['13','15','-',63.0,0.98], h1kaN:['11','18','-',61.3,0.80], fluffy:['12','14','-',52.3,0.74], kashl1d:['15','13','-',73.9,1.14], relaxxie:['21','13','-',100.3,1.71], xeedo:['18','14','-',97.3,1.38], qw1nk1:['13','13','-',67.2,1.15], X5G7V:['12','14','-',64.6,0.78] } }
  };

  const mapMeta = {
    Dust2: { winner:'K27', nuclearSide:'T', k27Side:'CT', score:'10 : 13', halfScore:[[5,7],[5,6]] },
    Inferno: { winner:'Nuclear TigeRES', nuclearSide:'CT', k27Side:'T', score:'13 : 5', halfScore:[[9,3],[4,2]] },
    Anubis: { winner:'K27', nuclearSide:'T', k27Side:'CT', score:'8 : 13', halfScore:[[6,6],[2,7]] }
  };

  const radarImages = {
    Anubis:'assets/radar/de_anubis_radar.png',
    Dust2:'assets/radar/de_dust2_radar.png',
    Inferno:'assets/radar/de_inferno_radar.png'
  };

  const equipmentIcons = {
    ak:'assets/equipment/ak47.svg',
    ak47:'assets/equipment/ak47.svg',
    awp:'assets/equipment/awp.svg',
    galil:'assets/equipment/galilar.svg',
    m4:'assets/equipment/m4a1_silencer.svg',
    m4a1s:'assets/equipment/m4a1_silencer.svg'
  };

  const firstRoundState = {
    senka:{ kills:1, assists:0, deaths:0, money:150, hp:100, armor:100, grenades:['smokegrenade.svg','flashbang.svg'] },
    flouzer:{ kills:0, assists:1, deaths:0, money:350, hp:100, armor:100, grenades:['hegrenade.svg'] },
    k0s:{ kills:0, assists:0, deaths:1, money:0, hp:100, armor:57, grenades:['molotov.svg','flashbang.svg'] },
    h1kaN:{ kills:0, assists:0, deaths:0, money:500, hp:100, armor:100, grenades:['smokegrenade.svg'] },
    fluffy:{ kills:0, assists:0, deaths:0, money:800, hp:100, armor:0, grenades:[] },
    kashl1d:{ kills:1, assists:0, deaths:0, money:100, hp:100, armor:100, grenades:['hegrenade.svg','flashbang.svg'] },
    relaxxie:{ kills:0, assists:1, deaths:0, money:300, hp:100, armor:100, grenades:['smokegrenade.svg'] },
    xeedo:{ kills:0, assists:0, deaths:1, money:0, hp:100, armor:67, grenades:['incgrenade.svg','flashbang.svg'] },
    qw1nk1:{ kills:0, assists:0, deaths:0, money:650, hp:100, armor:100, grenades:['decoy.svg'] },
    X5G7V:{ kills:0, assists:0, deaths:0, money:800, hp:100, armor:0, grenades:[] }
  };

  const bombCarrierByMap = { Dust2:'senka', Inferno:'kashl1d', Anubis:'senka' };
  const primaryWeaponsByMap = {
    Dust2:{ senka:'ak47.svg', flouzer:'m4a1.svg', k0s:'awp.svg', h1kaN:'m4a1_silencer.svg', fluffy:'ak47.svg', kashl1d:'awp.svg', relaxxie:'m4a1.svg', xeedo:'m4a1_silencer.svg', qw1nk1:'ak47.svg', X5G7V:'awp.svg' },
    Inferno:{ senka:'awp.svg', flouzer:'m4a1_silencer.svg', k0s:'ak47.svg', h1kaN:'m4a1.svg', fluffy:'m4a1_silencer.svg', kashl1d:'ak47.svg', relaxxie:'awp.svg', xeedo:'m4a1.svg', qw1nk1:'m4a1_silencer.svg', X5G7V:'ak47.svg' },
    Anubis:{ senka:'m4a1_silencer.svg', flouzer:'ak47.svg', k0s:'m4a1.svg', h1kaN:'awp.svg', fluffy:'m4a1_silencer.svg', kashl1d:'ak47.svg', relaxxie:'awp.svg', xeedo:'m4a1.svg', qw1nk1:'m4a1_silencer.svg', X5G7V:'ak47.svg' }
  };

  const mapLogs = {
    Dust2:[
      { type:'system', text:'Round 1 · started' },
      { type:'kill', actor:'kashl1d', actorSide:'ct', weapon:'ak47', victim:'h1kaN', victimSide:'t', headshot:true },
      { type:'kill', actor:'flouzer', actorSide:'t', weapon:'m4a1s', victim:'relaxxie', victimSide:'ct' },
      { type:'round', winner:'K27', winnerSide:'ct', reason:'Enemy eliminated' },
      { type:'system', text:'Round 2 · started' },
      { type:'kill', actor:'kashl1d', actorSide:'ct', weapon:'awp', victim:'senka', victimSide:'t', headshot:true },
      { type:'kill', actor:'k0s', actorSide:'t', weapon:'ak47', victim:'xeedo', victimSide:'ct' },
      { type:'round', winner:'Nuclear TigeRES', winnerSide:'t', reason:'Bomb exploded' },
      { type:'system', text:'Round 3 · started' },
      { type:'kill', actor:'relaxxie', actorSide:'ct', weapon:'m4a1s', victim:'fluffy', victimSide:'t' },
      { type:'round', winner:'K27', winnerSide:'ct', reason:'Time expired' }
    ],
    Inferno:[
      { type:'system', text:'Round 1 · started' },
      { type:'kill', actor:'k0s', actorSide:'t', weapon:'ak47', victim:'xeedo', victimSide:'ct', headshot:true },
      { type:'kill', actor:'kashl1d', actorSide:'ct', weapon:'awp', victim:'senka', victimSide:'t' },
      { type:'round', winner:'Nuclear TigeRES', winnerSide:'t', reason:'Time expired' },
      { type:'system', text:'Round 2 · started' },
      { type:'kill', actor:'flouzer', actorSide:'t', weapon:'m4a1s', victim:'qw1nk1', victimSide:'ct' },
      { type:'kill', actor:'relaxxie', actorSide:'ct', weapon:'awp', victim:'h1kaN', victimSide:'t', headshot:true },
      { type:'round', winner:'Nuclear TigeRES', winnerSide:'t', reason:'Enemy eliminated' },
      { type:'system', text:'Round 3 · started' },
      { type:'kill', actor:'kashl1d', actorSide:'ct', weapon:'ak47', victim:'k0s', victimSide:'t', headshot:true },
      { type:'round', winner:'K27', winnerSide:'ct', reason:'Bomb defused' }
    ],
    Anubis:[
      { type:'system', text:'Round 1 · started' },
      { type:'kill', actor:'relaxxie', actorSide:'ct', weapon:'ak47', victim:'h1kaN', victimSide:'t' },
      { type:'kill', actor:'flouzer', actorSide:'t', weapon:'m4a1s', victim:'X5G7V', victimSide:'ct', headshot:true },
      { type:'kill', actor:'xeedo', actorSide:'ct', weapon:'m4a1s', victim:'k0s', victimSide:'t' },
      { type:'round', winner:'K27', winnerSide:'ct', reason:'Enemy eliminated' },
      { type:'system', text:'Round 2 · started' },
      { type:'kill', actor:'senka', actorSide:'t', weapon:'awp', victim:'xeedo', victimSide:'ct', headshot:true },
      { type:'kill', actor:'kashl1d', actorSide:'ct', weapon:'m4a1s', victim:'flouzer', victimSide:'t' },
      { type:'round', winner:'K27', winnerSide:'ct', reason:'Bomb exploded' },
      { type:'system', text:'Round 3 · started' },
      { type:'kill', actor:'relaxxie', actorSide:'ct', weapon:'awp', victim:'senka', victimSide:'t', headshot:true },
      { type:'round', winner:'K27', winnerSide:'ct', reason:'Enemy eliminated' }
    ]
  };

  root.MatchData = {
    fallbackAvatar,
    teamLogo,
    players,
    stats,
    mapMeta,
    radarImages,
    equipmentIcons,
    firstRoundState,
    bombCarrierByMap,
    primaryWeaponsByMap,
    mapLogs,
    headshotIcon:'assets/icons/headshot.png'
  };
})(window);
