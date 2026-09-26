(function initRoundReplay(root, factory) {
  const minimap = typeof module === 'object' && module.exports
    ? require('./minimap.js')
    : root.CSMinimap;
  const coordinates = typeof module === 'object' && module.exports
    ? require('../data/mock-map-coordinates.js')
    : root.CSMockCoordinates;
  const navigation = typeof module === 'object' && module.exports
    ? require('./map-navigation.js')
    : root.CSMapNavigation;
  const api = factory(minimap, coordinates, navigation);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CSRoundReplay = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createRoundReplay(minimap, coordinates, navigation) {
  'use strict';

  const ROUND_LENGTH = 60;
  // События сценария нужны только для демонстрации интерфейса до подключения demo/GSI API.
  // TODO: заменить на данные повтора из GET /api/matches/:id/rounds/:round/events.
  const DEMO_EVENTS = Object.freeze([
    { at:0, type:'round_start', side:null, player:null, label:'Начало раунда' },
    { at:7, type:'smoke', side:'CT', player:1, point:[.59,.47], duration:18, label:'Дымовая граната' },
    { at:13, type:'molotov', side:'T', player:2, point:[.47,.55], duration:7, label:'Зажигательная граната' },
    { at:20, type:'shot', side:'CT', player:0, targetSide:'T', target:0, label:'Выстрел' },
    { at:21, type:'kill', side:'CT', player:0, targetSide:'T', target:0, label:'Игрок выбыл' },
    { at:24, type:'bomb_plant', side:'T', player:0, point:[.68,.57], label:'Бомба заложена' },
    { at:31, type:'shot', side:'T', player:1, targetSide:'CT', target:2, label:'Выстрел' },
    { at:32, type:'kill', side:'T', player:1, targetSide:'CT', target:2, label:'Игрок выбыл' },
    { at:38, type:'smoke', side:'T', player:3, point:[.65,.52], duration:18, label:'Дымовая граната' },
    { at:46, type:'shot', side:'CT', player:4, targetSide:'T', target:4, label:'Выстрел' },
    { at:47, type:'kill', side:'CT', player:4, targetSide:'T', target:4, label:'Игрок выбыл' },
    { at:60, type:'round_end', side:null, player:null, label:'Раунд завершён' }
  ]);

  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

  function create(mapName, players, options = {}) {
    const roster = Array.isArray(players) ? players : [];
    const indexes = { T:0, CT:0 };
    const safeRoutesBySide = Object.fromEntries(['T','CT'].map((side) => {
      const routes = coordinates?.getRoutes(mapName, side) || [];
      return [side, navigation?.constrainRoutes(options.radarImage, routes) || routes];
    }));
    const walkGrid = navigation?.walkableGrid(options.radarImage);
    const scenarioEvents = DEMO_EVENTS.map((event) => {
      if (!event.point || !navigation) return event;
      return walkGrid ? { ...event, point:navigation.nearestWalkable(walkGrid, event.point) } : event;
    });
    const rosterWithRoutes = roster.map((player) => {
      const side = player.side === 'CT' ? 'CT' : 'T';
      const sideIndex = indexes[side]++;
      const safeRoutes = safeRoutesBySide[side];
      return { ...player, side, sideIndex, route:safeRoutes[sideIndex % Math.max(1, safeRoutes.length)] || [[.5,.5]] };
    });

    function getSnapshot(seconds) {
      const time = clamp(Number(seconds) || 0, 0, ROUND_LENGTH);
      const playersAtTime = rosterWithRoutes.map((player) => {
        const route = player.route;
        // Стартовый сдвиг фазы разводит маркеры по первым участкам командных маршрутов.
        const phase = clamp(time / 48 + player.sideIndex * .095, 0, 1);
        const next = minimap.interpolateRoute(route, phase);
        const radarPosition = minimap.interpolateRoute(route, Math.min(1, phase + .012));
        const angle = Math.atan2(radarPosition.y - next.y, radarPosition.x - next.x) * 180 / Math.PI + 90;
        return {
          ...player,
          position:minimap.radarToWorld(mapName, next),
          heading:Number.isFinite(angle) ? angle : 0,
          alive:!scenarioEvents.some((event) => event.type === 'kill' && event.at <= time && event.targetSide === player.side && event.target === player.sideIndex)
        };
      });

      const happened = scenarioEvents.filter((event) => event.at <= time).map((event, index) => {
        const actor = playersAtTime.find((player) => player.side === event.side && player.sideIndex === event.player);
        const target = event.targetSide ? playersAtTime.find((player) => player.side === event.targetSide && player.sideIndex === event.target) : null;
        return { ...event, id:`${event.type}-${index}`, actor, target, sourcePoint:actor ? minimap.worldToRadar(mapName, actor.position) : null, targetPoint:target ? minimap.worldToRadar(mapName, target.position) : null };
      });
      const aliveT = playersAtTime.filter((player) => player.side === 'T' && player.alive).length;
      const aliveCt = playersAtTime.filter((player) => player.side === 'CT' && player.alive).length;
      const latest = happened[happened.length - 1];
      const bombPlanted = happened.some((event) => event.type === 'bomb_plant');

      return {
        mapName, time, duration:ROUND_LENGTH, players:playersAtTime, events:happened,
        activeEffects:happened.filter((event) => ['smoke','molotov'].includes(event.type) && time < event.at + event.duration),
        activeShot:latest && ['shot','damage','kill'].includes(latest.type) && time - latest.at < 1.2 ? latest : null,
        bomb:{ planted:bombPlanted, secondsRemaining:bombPlanted ? Math.max(0, 40 - (time - 24)) : null },
        chanceT:Math.round(100 * aliveT / Math.max(1, aliveT + aliveCt)), aliveT, aliveCt,
        source:'demo'
      };
    }

    return { getSnapshot, length:ROUND_LENGTH, events:scenarioEvents };
  }

  function createFromDemo(mapName, round, options = {}) {
    const tickRate = Number(options.tickRate) || 64;
    const samples = Array.isArray(round.samples) ? round.samples : [];
    const sourceEvents = Array.from(new Map((round.events || []).filter((event) => event?.id).map((event) => [String(event.id), event])).values())
      .sort((a, b) => a.timestampMs - b.timestampMs || String(a.id).localeCompare(String(b.id)))
      .map((event) => ({ ...event, label:({ round_start:'Начало раунда', round_end:'Раунд завершён', kill:'Убийство', damage:'Попадание', bomb_plant:'Бомба заложена', bomb_defuse_start:'Начало дефуза', bomb_defuse_abort:'Дефуз прерван', bomb_defuse:'Бомба обезврежена', bomb_explode:'Бомба взорвалась', shot:'Выстрел', grenade_throw:'Бросок гранаты', smoke:'Дымовая граната', molotov:'Зажигательная граната', he:'Осколочная граната', flash:'Световая граната', decoy:'Ложная цель' })[event.type] || event.type }));
    const events = sourceEvents.map((event) => {
      if (event.type !== 'shot') return event;
      const hit = sourceEvents.filter((candidate) => ['damage','kill'].includes(candidate.type)
        && String(candidate.actor?.id || '') === String(event.actor?.id || '')
        && candidate.at >= event.at && candidate.at - event.at <= .35)
        .sort((a, b) => a.at - b.at)[0];
      return hit ? { ...event, target:hit.target, targetPosition:hit.targetPosition, confirmedHit:true } : event;
    });
    const duration = Math.max(Number(round.duration) || 0, samples[samples.length - 1]?.seconds || 0, events[events.length - 1]?.at || 0, 1);

    function frameAt(seconds) {
      let previous = samples[0] || { seconds:0, players:[] };
      let next = samples[samples.length - 1] || previous;
      for (const sample of samples) {
        if (sample.seconds <= seconds) previous = sample;
        if (sample.seconds >= seconds) { next = sample; break; }
      }
      const span = Math.max(.001, next.seconds - previous.seconds);
      const ratio = clamp((seconds - previous.seconds) / span, 0, 1);
      const following = new Map(next.players.map((player) => [String(player.id), player]));
      return previous.players.map((player) => {
        const later = following.get(String(player.id)) || player;
        const position = {
          x:player.position.x + (later.position.x - player.position.x) * ratio,
          y:player.position.y + (later.position.y - player.position.y) * ratio,
          z:player.position.z === null || later.position.z === null ? (later.position.z ?? player.position.z) : player.position.z + (later.position.z - player.position.z) * ratio
        };
        const playerNames = [player.nick, options.playerNicknames?.[String(player.id)]].filter(Boolean).map((name) => name.toLowerCase());
        const isVictim = (event) => String(event.target?.id || '') === String(player.id) || playerNames.includes(String(event.target?.name || '').toLowerCase());
        const dead = events.some((event) => event.type === 'kill' && event.at <= seconds && isVictim(event));
        // Между двумя demo-сэмплами применяем player_hurt точно в момент события.
        // Следующий сэмпл уже содержит новый HP, поэтому урон не вычитается повторно.
        const healthFromEvents = player.health != null && Number.isFinite(Number(player.health))
          ? Math.max(0, Number(player.health) - events.filter((event) => event.type === 'damage' && isVictim(event) && event.at > previous.seconds && event.at <= seconds).reduce((sum, event) => sum + Math.max(0, Number(event.damage) || 0), 0))
          : null;
        return { id:String(player.id), nick:options.playerNicknames?.[String(player.id)] || player.nick || String(player.id), demoNick:player.nick || String(player.id), side:player.side, number:Number(options.playerNumbers?.[String(player.id)]) || 0, weapon:player.weapon || '', health:healthFromEvents ?? (ratio < .5 ? player.health : (later.health ?? player.health)) ?? null, armor:ratio < .5 ? player.armor : (later.armor ?? player.armor), money:ratio < .5 ? player.money : (later.money ?? player.money), inventory:ratio < .5 ? player.inventory || [] : later.inventory || player.inventory || [], heading:player.heading === null ? 0 : (90 - player.heading + 360) % 360, alive:!dead && player.alive !== false, position };
      });
    }

    function getSnapshot(value) {
      const time = clamp(Number(value) || 0, 0, duration);
      const playersAtTime = frameAt(time);
      const happened = events.filter((event) => event.at <= time).map((event) => {
        const actor = playersAtTime.find((player) => String(player.id) === String(event.actor?.id) || player.demoNick?.toLowerCase() === event.actor?.name?.toLowerCase());
        const target = playersAtTime.find((player) => String(player.id) === String(event.target?.id) || player.demoNick?.toLowerCase() === event.target?.name?.toLowerCase());
        const position = event.position || actor?.position || null;
        const targetPosition = event.targetPosition || target?.position || null;
        const radarPoint = position ? minimap.worldToRadar(mapName, position) : null;
        return { ...event, actor:actor ? { ...event.actor, nick:actor.nick } : event.actor, target:target ? { ...event.target, nick:target.nick } : event.target, side:event.side || actor?.side || null, sourcePoint:radarPoint, targetPoint:targetPosition ? minimap.worldToRadar(mapName, targetPosition) : null, point:radarPoint ? [radarPoint.x, radarPoint.y] : null };
      });
      const effectLifetime = (event) => event.type === 'smoke' ? 18 : event.type === 'molotov' ? 7 : event.type === 'he' ? 1.1 : event.type === 'flash' ? .8 : event.type === 'decoy' ? 2.5 : 0;
      // В CS дым тушит активное пламя при физическом пересечении. Без координат
      // пересечение не предполагаем: сохраняем только то, что подтверждено демо.
      const extinguishedFireIds = new Set(happened.filter((event) => event.type === 'smoke' && event.position).flatMap((smoke) => happened
        .filter((fire) => fire.type === 'molotov' && fire.position && smoke.at >= fire.at && smoke.at < fire.at + effectLifetime(fire))
        .filter((fire) => Math.hypot(Number(smoke.position.x) - Number(fire.position.x), Number(smoke.position.y) - Number(fire.position.y)) <= 200)
        .map((fire) => fire.id)));
      const activeEffects = happened.filter((event) => ['smoke','molotov','he','flash','decoy'].includes(event.type) && event.point && time < event.at + effectLifetime(event) && !(event.type === 'molotov' && extinguishedFireIds.has(event.id)))
        .map((event) => ({ ...event, duration:effectLifetime(event), effectKind:event.type === 'molotov' && /incendiary/i.test(event.grenadeType || '') ? 'incendiary' : event.type }));
      const grenadeTracks = (round.grenades || []).map((grenade) => {
        const arrived = grenade.samples.filter((sample) => sample.seconds <= time && sample.seconds >= time - 3);
        if (!arrived.length) return null;
        const kind = grenadeKind(grenade.type);
        const throwerId = String(grenade.throwerId || '');
        const throwerName = String(grenade.thrower || '').trim().toLowerCase();
        const thrower = playersAtTime.find((player) => throwerId && String(player.id) === throwerId)
          || playersAtTime.find((player) => throwerName && [player.nick, player.demoNick].some((name) => String(name || '').trim().toLowerCase() === throwerName));
        const expectedGrenadeType = String(grenade.type || '').toLowerCase();
        const detonation = happened.find((event) => event.type === kind.event && (() => {
          if (event.at < grenade.samples[0].seconds) return false;
          if (grenade.detonationId) return event.id === grenade.detonationId;
          if (event.grenadeId) return event.grenadeId === grenade.id;
          if (event.entityId && grenade.entityId) return event.entityId === grenade.entityId;
          const eventOwnerId = String(event.actor?.id || '');
          if (throwerId && eventOwnerId && throwerId !== eventOwnerId) return false;
          const eventGrenadeType = String(event.grenadeType || '').toLowerCase();
          const sameGrenade = eventGrenadeType && expectedGrenadeType && (eventGrenadeType.includes(expectedGrenadeType) || expectedGrenadeType.includes(eventGrenadeType));
          if (eventGrenadeType && expectedGrenadeType && !sameGrenade) return false;
          if (!throwerId && !eventOwnerId && throwerName && event.actor?.name && throwerName !== event.actor.name.trim().toLowerCase()) return false;
          const nearest = grenade.samples.reduce((best, sample) => !best || Math.abs(sample.seconds - event.at) < Math.abs(best.seconds - event.at) ? sample : best, null);
          if (!nearest || Math.abs(nearest.seconds - event.at) > 5) return false;
          if (event.position && nearest.position) {
            const dx = Number(event.position.x) - Number(nearest.position.x);
            const dy = Number(event.position.y) - Number(nearest.position.y);
            if (Number.isFinite(dx) && Number.isFinite(dy) && Math.hypot(dx, dy) > 300) return false;
          }
          return Boolean(throwerId && eventOwnerId && throwerId === eventOwnerId) || Boolean(throwerName && event.actor?.name && throwerName === event.actor.name.trim().toLowerCase()) || Boolean(sameGrenade);
        })());
        // После детонации убираем траекторию и сам снаряд сразу: дальше остаётся только эффект.
        if (detonation) return null;
        const point = minimap.worldToRadar(mapName, arrived[arrived.length - 1].position);
        return { id:grenade.id, type:grenade.type, kind:kind.name, icon:kind.icon, thrower:grenade.thrower, side:thrower?.side || null, path:arrived.map((sample) => minimap.worldToRadar(mapName, sample.position)), point, flying:time - arrived[arrived.length - 1].seconds <= .35 };
      }).filter(Boolean);
      const aliveT = playersAtTime.filter((player) => player.side === 'T' && player.alive).length;
      const aliveCt = playersAtTime.filter((player) => player.side === 'CT' && player.alive).length;
      const plant = happened.find((event) => event.type === 'bomb_plant');
      const bombResolution = plant && happened.find((event) => ['bomb_defuse','bomb_explode'].includes(event.type) && event.at >= plant.at);
      const defuseStart = plant && happened.filter((event) => event.at >= plant.at && ['bomb_defuse_start','bomb_defuse_abort'].includes(event.type)).reduce((latestEvent, event) => event.type === 'bomb_defuse_abort' ? null : event, null);
      const defuseDuration = defuseStart ? (defuseStart.hasKit ? 5 : 10) : null;
      const latest = happened[happened.length - 1];
      const recentDamage = happened.filter((event) => event.type === 'damage' && event.targetPoint && time - event.at <= 1.1).map((event) => ({ id:event.id, targetId:String(event.target?.id || ''), damage:Math.max(0, Number(event.damage) || 0), at:event.at }));
      return {
        mapName, time, duration, players:playersAtTime, events:happened, recentDamage,
        activeEffects, grenadeTracks,
        activeShot:[...happened].reverse().find((event) => event.type === 'shot' && event.confirmedHit && time - event.at < .45) || null,
        bomb:{ planted:Boolean(plant), active:Boolean(plant && !bombResolution), point:plant?.point || null, secondsRemaining:plant && !bombResolution ? Math.max(0, 40 - (time - plant.at)) : null, defuseSecondsRemaining:defuseStart ? Math.max(0, defuseDuration - (time - defuseStart.at)) : null, defuseActive:Boolean(defuseStart && !bombResolution), defuseHasKit:defuseStart?.hasKit ?? null, result:bombResolution?.type === 'bomb_defuse' ? 'defused' : bombResolution?.type === 'bomb_explode' ? 'exploded' : null },
        chanceT:Math.round(100 * aliveT / Math.max(1, aliveT + aliveCt)), aliveT, aliveCt, source:'imported'
      };
    }
    return { getSnapshot, length:duration, events, roundNumber:round.number };
  }

  function grenadeKind(name) {
    const value = String(name || '').toLowerCase();
    if (value.includes('smoke')) return { name:'smoke', icon:'smokegrenade.svg', event:'smoke' };
    if (value.includes('flash')) return { name:'flash', icon:'flashbang.svg', event:'flash' };
    if (value.includes('decoy')) return { name:'decoy', icon:'decoy.svg', event:'decoy' };
    if (value.includes('molotov')) return { name:'molotov', icon:'molotov.svg', event:'molotov' };
    if (value.includes('incendiary') || value.includes('incgrenade')) return { name:'incendiary', icon:'incgrenade.svg', event:'molotov' };
    return { name:'he', icon:'hegrenade.svg', event:'he' };
  }

  return { create, createFromDemo, DEMO_EVENTS, ROUND_LENGTH };
});
