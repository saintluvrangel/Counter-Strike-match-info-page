(function initAnalyticsData(root) {
  'use strict';

  // Mock contract prepared for replacement by an API response.
  root.AnalyticsData = {
    generatedAt:'Mock dataset',
    teams:[
      {
        id:'nuclear',
        name:'Nuclear TigeRES',
        logo:'https://img-cdn.hltv.org/teamlogo/GcO3SLh1j8cgiNGoEXNUVS.png?ixlib=java-2.1.0&s=856dc9f0ffdbeedbe76d9874fbcdb546&w=50',
        summary:{ wins:14, losses:8, winRate:64, averageRating:1.08 },
        recent:[
          { opponent:'K27', score:'1 : 2', result:'L' },
          { opponent:'Aurora Young Blud', score:'2 : 0', result:'W' },
          { opponent:'RUSTEC', score:'2 : 1', result:'W' },
          { opponent:'HOTU', score:'0 : 2', result:'L' },
          { opponent:'Nemiga Academy', score:'2 : 0', result:'W' }
        ],
        topPlayers:[
          { name:'flouzer', kd:1.23, adr:84.3, rating:1.21 },
          { name:'senka', kd:.83, adr:90.1, rating:1.23 },
          { name:'k0s', kd:1.12, adr:77.4, rating:1.07 }
        ]
      },
      {
        id:'k27',
        name:'K27',
        logo:'https://img-cdn.hltv.org/teamlogo/7LmOZHYhlq-fIAm23aM2q1.png?ixlib=java-2.1.0&s=e194cf9c20b306723ae899eac0e8a356&w=50',
        summary:{ wins:18, losses:6, winRate:75, averageRating:1.14 },
        recent:[
          { opponent:'Nuclear TigeRES', score:'2 : 1', result:'W' },
          { opponent:'CYBERSHOKE Academy', score:'2 : 0', result:'W' },
          { opponent:'FORZE Reload', score:'1 : 2', result:'L' },
          { opponent:'RUSTEC', score:'2 : 1', result:'W' },
          { opponent:'Insilio Academy', score:'2 : 0', result:'W' }
        ],
        topPlayers:[
          { name:'kashl1d', kd:1.30, adr:90.8, rating:1.40 },
          { name:'relaxxie', kd:1.29, adr:85.5, rating:1.33 },
          { name:'xeedo', kd:1.12, adr:81.2, rating:1.24 }
        ]
      }
    ],
    h2h:[
      { date:'2025-05-18', event:'CyberX Celebration', score:'1 : 2', winner:'K27' },
      { date:'2025-03-02', event:'Regional Series', score:'2 : 0', winner:'Nuclear TigeRES' },
      { date:'2024-12-14', event:'Winter Cup', score:'0 : 2', winner:'K27' }
    ],
    winChance:{ nuclear:40, k27:60 }
  };
})(window);
