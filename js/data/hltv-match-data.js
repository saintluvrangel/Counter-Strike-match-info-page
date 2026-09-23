(function initHltvMatchData(root, factory) {
  const data = factory();
  if (typeof module === 'object' && module.exports) module.exports = data;
  if (root) root.HltvMatchData = data;
})(typeof window !== 'undefined' ? window : globalThis, function createHltvMatchData() {
  'use strict';

  const teams = {
    furia:{ name:'FURIA', rank:'HLTV #4', vrs:'VRS #8', logo:'https://img-cdn.hltv.org/teamlogo/mvNQc4csFGtxXk5guAh8m1.svg?ixlib=java-2.1.0&s=11e5056829ad5d6c06c5961bbe76d20c', players:[
      ['molodoy','Danil Golubenko','https://img-cdn.hltv.org/playerbodyshot/oPoWLYFq87cIs2cYDo8id7.png?ixlib=java-2.1.0&s=26d135bacbf9f98ff775421c3ca2bf4c&w=400'],
      ['yuurih','Yuri Santos','https://img-cdn.hltv.org/playerbodyshot/ZapU9KMKIlH1bDpSlV6MO1.png?ixlib=java-2.1.0&s=09cb203041b92340db49939164bc6f99&w=400'],
      ['FalleN','Gabriel Toledo','https://img-cdn.hltv.org/playerbodyshot/gQbb4I0TeHmxx7bYBOtd7T.png?ixlib=java-2.1.0&s=744dd676bd5ad23e4adfc8dc8fcbaa80&w=400'],
      ['KSCERATO','Kaike Cerato','https://img-cdn.hltv.org/playerbodyshot/z0vT0V815B0MdeeKhcf44Y.png?ixlib=java-2.1.0&s=32afd770ba5023b0eefc0712e029065a&w=400'],
      ['YEKINDAR','Mareks Gaļinskis','https://img-cdn.hltv.org/playerbodyshot/IO3vEa2fT2qFPRlrPid7hf.png?ixlib=java-2.1.0&s=2826592c7787a70711b1ca5651ab25a7&w=400'] ] },
    mibr:{ name:'MIBR', rank:'HLTV #18', vrs:'VRS #14', logo:'https://img-cdn.hltv.org/teamlogo/sVnH-oAf1J5TnMwoY4cxUC.png?ixlib=java-2.1.0&s=b0ef463fa0f1638bce72a89590fbaddf&w=50', players:[
      ['tomaszin','Tomas Corna','https://img-cdn.hltv.org/playerbodyshot/MRftvdAsS7UJhqQXpRhITI.png?ixlib=java-2.1.0&s=735a4794931270f22b5bb1406f8e633c&w=400'],
      ['insani','Felipe Yuji','https://img-cdn.hltv.org/playerbodyshot/rMLFuDdAsdhOFc2DoQ9n7k.png?ixlib=java-2.1.0&s=1159d0701afb1514001444387c22ef56&w=400'],
      ['nqz','Lucas Soares','https://img-cdn.hltv.org/playerbodyshot/it97AaPjOGBlBiAJb3ra60.png?ixlib=java-2.1.0&s=55a5cecbb83b87371be9ea28658c4201&w=400'],
      ['venomzera','Carlos Eduardo','https://img-cdn.hltv.org/playerbodyshot/BTNEAhe45nPFjEifq-R-sV.png?ixlib=java-2.1.0&s=dd800e15cd61b560db63025a94b1e4e6&w=400'],
      ['LNZ','Linus Holtäng','https://img-cdn.hltv.org/playerbodyshot/c7tcRMt0bkk12_yaIBZTLC.png?ixlib=java-2.1.0&s=b702fd627509f340516faea6b65e815f&w=400'] ] },
    mouz:{ name:'MOUZ', rank:'HLTV #3', vrs:'VRS #3', logo:'https://img-cdn.hltv.org/teamlogo/IejtXpquZnE8KqYPB1LNKw.svg?ixlib=java-2.1.0&s=7fd33b8def053fbfd8fdbb58e3bdcd3c', players:[
      ['xelex','Adrian Vincze','https://img-cdn.hltv.org/playerbodyshot/EA2EJPIjte0zKwqxN2IZk2.png?ixlib=java-2.1.0&s=780792677ecbfe5b2fecb6808e8d70fe&w=400'],
      ['Spinx','Lotan Giladi','https://img-cdn.hltv.org/playerbodyshot/hm9ckLb3eD78VZSpRT8sH-.png?ixlib=java-2.1.0&s=8e01a31490335fe56f469e2ea186c31a&w=400'],
      ['xertioN','Dorian Berman','https://img-cdn.hltv.org/playerbodyshot/d27M8GVSaQYgRfmBJnBpkE.png?ixlib=java-2.1.0&s=aff5b6409249a3c87412e15c4e7ea4e2&w=400'],
      ['torzsi','Ádám Torzsás','https://img-cdn.hltv.org/playerbodyshot/g9uOgg5eleoDQBL3oISgCU.png?ixlib=java-2.1.0&s=c2e49b3335e46e1f0ad6ee145563b566&w=400'],
      ['PR','Oldřich Nový','https://img-cdn.hltv.org/playerbodyshot/DO6ik7s3E-z96wKhFQXD1A.png?ixlib=java-2.1.0&s=762c3d2f1310e70648a70d240b347bf4&w=400'] ] },
    navi:{ name:'Natus Vincere', rank:'HLTV #10', vrs:'VRS #17', logo:'https://img-cdn.hltv.org/teamlogo/9iMirAi7ArBLNU8p3kqUTZ.svg?ixlib=java-2.1.0&s=4dd8635be16122656093ae9884675d0c', players:[
      ['iM','Mihai Ivan','https://img-cdn.hltv.org/playerbodyshot/lWNcoOFOcHF3uIERANZRXh.png?ixlib=java-2.1.0&s=cd5df4d5e89df8cab0e4a7edd6db0d8b&w=400'],
      ['makazze','Drin Shaqiri','https://img-cdn.hltv.org/playerbodyshot/U6KmIKHcqg2OpMrNn-Aqk6.png?ixlib=java-2.1.0&s=420f1bcb0e6943b68fafb5e2d933197c&w=400'],
      ['b1t','Valeriy Vakhovskiy','https://img-cdn.hltv.org/playerbodyshot/CgO3veixSYH5OMIePtwp1u.png?ixlib=java-2.1.0&s=1b5f0f326bf822540d59ae246c1b7e65&w=400'],
      ['w0nderful','Ihor Zhdanov','https://img-cdn.hltv.org/playerbodyshot/OepRRBoc68iVojIfgK3JIA.png?ixlib=java-2.1.0&s=99dcc1115ffec1ed275a5cf4eacca825&w=400'],
      ['Aleksib','Aleksi Virolainen','https://img-cdn.hltv.org/playerbodyshot/7-TvianW79yWk13gdw-Jc5.png?ixlib=java-2.1.0&s=f94eda5a77f332bc02821e6b845ca207&w=400'] ] },
    aurora:{ name:'Aurora', rank:'HLTV #9', vrs:'VRS #9', logo:'https://img-cdn.hltv.org/teamlogo/yJzPNOeXlyiniNxanYJCrv.png?ixlib=java-2.1.0&s=2c08f70c2f2f8c2024a438ddcf19bbf1&w=50', players:[
      ['woxic','Özgür Eker','https://img-cdn.hltv.org/playerbodyshot/HwdtHmtO-pl5oKVeVJqhP1.png?ixlib=java-2.1.0&s=1565383f86356916f098e1969e0495d2&w=400'],
      ['XANTARES','Ismailcan Dörtkardeş','https://img-cdn.hltv.org/playerbodyshot/9zPNSNo_4XxREmOgFhVWY8.png?ixlib=java-2.1.0&s=921783f5c5bd3d054acef1f62eb92dd5&w=400'],
      ['Wicadia','Ali Haydar Yalçın','https://img-cdn.hltv.org/playerbodyshot/Ewe2uyIIaNKBDTs_Zkv-PC.png?ixlib=java-2.1.0&s=0b4cbf6f3252f3233b39257551870f26&w=400'],
      ['Jimpphat','Jimi Salo','https://img-cdn.hltv.org/playerbodyshot/YV17JXjtrMTI4G0LULROlE.png?ixlib=java-2.1.0&s=429021ee8e8ce7cfced630caa82ea4a2&w=400'],
      ['kyxsan','Damjan Stoilkovski','https://img-cdn.hltv.org/playerbodyshot/J0y8JcMMhuMg9oZ5VhrrIp.png?ixlib=java-2.1.0&s=73d96af92e3e63ee59559bdcca2d7ffe&w=400'] ] },
    vitality:{ name:'Vitality', rank:'HLTV #5', vrs:'VRS #3', logo:'https://img-cdn.hltv.org/teamlogo/ogcHrcCdzRvxbYvAz04KAN.png?ixlib=java-2.1.0&s=e1f6019aa9f274ffe45a5e99c88dbc02&w=50', players:[
      ['mezii','William Merriman','https://img-cdn.hltv.org/playerbodyshot/7GVUrVLAQkgnuovRkk5Bxw.png?ixlib=java-2.1.0&s=00b346853396c35e5889b00be2766c99&w=400'],
      ['apEX','Dan Madesclaire','https://img-cdn.hltv.org/playerbodyshot/3M9h08qvl3YOsaRcAvKhs4.png?ixlib=java-2.1.0&s=c1acc9777d9e3165140548582e9bf1f5&w=400'],
      ['ropz','Robin Kool','https://img-cdn.hltv.org/playerbodyshot/YQ9kQQ3aop1JZQE9xJ140r.png?ixlib=java-2.1.0&s=d4c7a00036511e25b4854ba3d3af80ca&w=400'],
      ['ZywOo','Mathieu Herbaut','https://img-cdn.hltv.org/playerbodyshot/blnoWFtH8GUJZjhr8H0P4u.png?ixlib=java-2.1.0&s=dc0fe6bd817ef852f59185ccf6b6c868&w=400'],
      ['flameZ','Shahar Shushan','https://img-cdn.hltv.org/playerbodyshot/LUQi5dX9boyO0uDadUGht5.png?ixlib=java-2.1.0&s=1c5c46fe41e79b19a69b479d8abbbb41&w=400'] ] },
    nuclear:{ name:'Nuclear TigeRES', rank:'HLTV #123', vrs:'VRS: Unranked', logo:'https://img-cdn.hltv.org/teamlogo/GcO3SLh1j8cgiNGoEXNUVS.png?ixlib=java-2.1.0&s=856dc9f0ffdbeedbe76d9874fbcdb546&w=50', players:[
      ['senka','Arseniy Kozlovsky','https://img-cdn.hltv.org/playerbodyshot/eDZ47qVhKR6T_d1xiC6vFO.png?ixlib=java-2.1.0&s=8018a1ab20f53358d4df78a9607ca14c&w=400'],
      ['flouzer','Ilya Selifonov','https://img-cdn.hltv.org/playerbodyshot/raSGvazp2eJUaBEQ3VAfnQ.png?ixlib=java-2.1.0&s=614db791b09d3b1ad0613fe16dc3b777&w=400'],
      ['k0s','Matvey Abramov','https://img-cdn.hltv.org/playerbodyshot/VYl2SXeVj3feQFMrVIbVbN.png?ixlib=java-2.1.0&s=0db0bf1e7d29bf4629f6893ec13ea8c9&w=400'],
      ['h1kaN','Yuriy Rotar','https://img-cdn.hltv.org/playerbodyshot/aepjG-2DfBqVRi_PvPu55v.png?ixlib=java-2.1.0&s=e75e94680b5ef84ea3cd74217fc54fb2&w=400'],
      ['fluffy','Vladislav Galimov','https://img-cdn.hltv.org/playerbodyshot/zavLCBfyGSmHFgxufhxTlf.png?ixlib=java-2.1.0&s=2d19f037b651ab8da7ec76af9e7ea6fb&w=400'] ] },
    k27:{ name:'K27', rank:'HLTV #87', vrs:'VRS #206', logo:'https://img-cdn.hltv.org/teamlogo/7LmOZHYhlq-fIAm23aM2q1.png?ixlib=java-2.1.0&s=e194cf9c20b306723ae899eac0e8a356&w=50', players:[
      ['kashl1d','Danila Dronov','https://img-cdn.hltv.org/playerbodyshot/wNGdRx4DbLG4EZHXhOqxQI.png?ixlib=java-2.1.0&s=6f62e0ba8ea11f8948b0ff198ca2af99&w=400'],
      ['relaxxie','Karim Miftakhov','https://img-cdn.hltv.org/playerbodyshot/xl5WSZlHhqSKBZBCeFosr0.png?ixlib=java-2.1.0&s=7dbbb865c6ab31578a31a809a0221bd4&w=400'],
      ['xeedo','Aleksey Mikulich','https://img-cdn.hltv.org/playerbodyshot/peZ4CDwvPiNL_pKOksbZFS.png?ixlib=java-2.1.0&s=f068148cf7b40460adebcbc928f34710&w=400'],
      ['qw1nk1','Daniil Kabilov','https://img-cdn.hltv.org/playerbodyshot/gIiMgI6yAJJq0yQZM92y7k.png?ixlib=java-2.1.0&s=399e85575901c4726b34c86b263bde4a&w=400'],
      ['X5G7V','Daniil Maryshev','https://img-cdn.hltv.org/playerbodyshot/XMyAjreb7JMtwc_AZd9H0-.png?ixlib=java-2.1.0&s=bd4e7746cdfec70ccb4736ea856bd8b7&w=400'] ] }
  };

  const statRows = {
    furiaMibr:{ KSCERATO:[51,36,84,1.30], molodoy:[48,33,78,1.24], yuurih:[39,35,77.5,1.14], YEKINDAR:[51,39,82.1,1.13], FalleN:[30,41,51.7,.92], insani:[54,46,89.5,1.21], tomaszin:[39,43,69.4,1.01], nqz:[36,39,57.5,.81], LNZ:[25,45,53.7,.77], venomzera:[29,46,57,.76] },
    mouzNavi:{ xertioN:[49,49,79.9,1.13], PR:[47,42,76.1,1.09], Spinx:[45,43,77,1.08], xelex:[46,44,71.4,1.05], torzsi:[39,40,63.4,.82], w0nderful:[58,44,86.4,1.41], b1t:[48,40,76,1.09], makazze:[41,50,68.9,.94], iM:[39,48,71.4,.89], Aleksib:[30,45,53.1,.79] },
    auroraVitality:{ Jimpphat:[53,34,91.5,1.36], Wicadia:[46,39,72.9,1.21], woxic:[50,31,69.6,1.11], XANTARES:[40,44,72.3,.99], kyxsan:[34,43,59.4,.92], ZywOo:[48,43,77.5,1.28], flameZ:[39,47,68.2,.94], apEX:[35,48,68.6,.87], mezii:[34,41,52.5,.82], ropz:[35,44,60.8,.77] },
    mouzFuria:{ xertioN:[48,54,68.4,1], xelex:[49,54,69.9,.99], torzsi:[46,43,58.9,.92], Spinx:[43,50,73.5,.88], PR:[34,52,55.7,.86], KSCERATO:[66,45,97.5,1.44], molodoy:[51,39,69.9,1.18], YEKINDAR:[49,49,67.9,.95], yuurih:[40,42,59.9,.94], FalleN:[47,48,65.8,.94] },
    nuclearK27:{ senka:[38,46,90.1,1.23], flouzer:[49,40,84.3,1.21], k0s:[46,41,77.4,1.07], h1kaN:[43,49,76.8,.93], fluffy:[36,42,56.4,.73], kashl1d:[52,40,90.8,1.40], relaxxie:[54,42,85.5,1.33], xeedo:[47,42,81.2,1.24], qw1nk1:[34,44,61.3,.87], X5G7V:[29,45,56.8,.68] }
  };

  const matches = [
    { id:'2379601', teamA:'nuclear', teamB:'k27', tournament:'CyberX Celebration Championship 2025', score:'1 : 2', status:'finished', statusLabel:'Завершен', date:'27 апреля 2025', stage:'Grand final', maps:[['Dust2','10 : 13'],['Inferno','13 : 5'],['Anubis','8 : 13']], stats:statRows.nuclearK27, source:'https://www.hltv.org/matches/2379601/nuclear-tigeres-vs-k27-cyberx-celebration-championship-2025' },
    { id:'2398105', teamA:'aurora', teamB:'vitality', score:'2 : 1', status:'finished', statusLabel:'Завершен', date:'19 сентября 2026 · 17:25', stage:'Upper bracket final', maps:[['Anubis','13 : 7'],['Inferno','11 : 13'],['Nuke','13 : 8']], stats:statRows.auroraVitality, source:'https://www.hltv.org/matches/2398105/aurora-vs-vitality-starladder-starseries-fall-2026' },
    { id:'2398103', teamA:'mouz', teamB:'furia', score:'1 : 2', status:'finished', statusLabel:'Завершен', date:'19 сентября 2026 · 14:00', stage:'Lower bracket semi-final', maps:[['Cache','8 : 13'],['Mirage','19 : 16'],['Nuke','6 : 13']], stats:statRows.mouzFuria, source:'https://www.hltv.org/matches/2398103/mouz-vs-furia-starladder-starseries-fall-2026' },
    { id:'2398099', teamA:'mouz', teamB:'navi', score:'2 : 1', status:'finished', statusLabel:'Завершен', date:'18 сентября 2026 · 12:00', stage:'Lower bracket round 1', maps:[['Cache','10 : 13'],['Inferno','13 : 10'],['Mirage','13 : 8']], stats:statRows.mouzNavi, source:'https://www.hltv.org/matches/2398099/mouz-vs-natus-vincere-starladder-starseries-fall-2026' },
    { id:'2398091', teamA:'furia', teamB:'mibr', score:'2 : 1', status:'finished', statusLabel:'Завершен', date:'17 сентября 2026 · 19:10', stage:'Upper bracket quarter-final', maps:[['Inferno','11 : 13'],['Nuke','13 : 6'],['Cache','13 : 6']], stats:statRows.furiaMibr, source:'https://www.hltv.org/matches/2398091/furia-vs-mibr-starladder-starseries-fall-2026' },
    { id:'2398106', teamA:'mibr', teamB:'furia', score:'0 : 2', status:'finished', statusLabel:'Завершен', date:'19 сентября 2026 · 19:30', stage:'Lower bracket final', maps:[['Nuke','6 : 13'],['Cache','6 : 13']], stats:null, source:'https://www.hltv.org/matches/2398106/mibr-vs-furia-starladder-starseries-fall-2026' },
    { id:'2398108', teamA:'aurora', teamB:'vitality', score:'— : —', status:'upcoming', statusLabel:'Предстоящий', date:'20 сентября 2026 · 17:00', stage:'Grand final', maps:[], stats:null, bestOf:'BO5', source:'https://www.hltv.org/matches/2398108/aurora-vs-vitality-starladder-starseries-fall-2026' }
  ].map((match) => ({ tournament:'StarLadder StarSeries Fall 2026', bestOf:match.bestOf || 'BO3', ...match }));

  return { teams, matches };
});
