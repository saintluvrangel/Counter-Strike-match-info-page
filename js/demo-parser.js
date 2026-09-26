'use strict';

const { parseEvents, parseTicks, parseGrenades, parseHeader, listGameEvents } = require('@laihoe/demoparser2');

const REQUESTED_EVENTS = [
  'round_start', 'round_end', 'round_freeze_end', 'player_death', 'player_hurt', 'bomb_planted', 'bomb_defused',
  'weapon_fire', 'grenade_thrown', 'smokegrenade_detonate', 'inferno_startburn', 'bomb_exploded', 'bomb_begindefuse', 'bomb_abortdefuse',
  'hegrenade_detonate', 'flashbang_detonate', 'decoy_detonate'
];

function rows(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  const columns = Object.entries(value).filter(([, column]) => Array.isArray(column));
  if (!columns.length) return [];
  return Array.from({ length:columns[0][1].length }, (_, index) => Object.fromEntries(columns.map(([key, column]) => [key, column[index]])));
}

function finite(value) {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
function nameOf(row, ...keys) { for (const key of keys) if (row?.[key] && String(row[key]).trim()) return String(row[key]).trim(); return null; }
function tickOf(row) { return finite(row?.tick ?? row?.game_time); }
function sideFromTeamNumber(value) { return Number(value) === 2 ? 'T' : Number(value) === 3 ? 'CT' : null; }

// Нормализует формат ответа парсера в контракт, который используют карта и Game log.
function normalizeParsedRows({ mapName, eventRows, tickRows, grenadeRows, tickRate = 64 }) {
  const sourceEvents = rows(eventRows).filter((row) => tickOf(row) !== null).sort((a, b) => tickOf(a) - tickOf(b));
  const worldDeathsByTick = new Map();
  sourceEvents.filter(row => row.event_name === 'player_death' && /^(world|worldspawn|trigger_hurt)$/.test(row.weapon || '')
    && (!row.attacker_steamid || row.attacker_steamid === row.user_steamid)).forEach(row => {
      const tick = tickOf(row); worldDeathsByTick.set(tick, (worldDeathsByTick.get(tick) || 0) + 1);
    });
  const worldResetTicks = new Set([...worldDeathsByTick].filter(([, count]) => count >= 3).map(([tick]) => tick));
  const rawTicks = rows(tickRows).filter((row) => tickOf(row) !== null).sort((a, b) => tickOf(a) - tickOf(b));
  const tickEvents = sourceEvents.filter((row) => ['round_start','round_end'].includes(row.event_name || row.name || row.type));
  // В начале записи может остаться завершение пробного раунда до включения разминки.
  const warmupEnd = sourceEvents.reduce((latest, row) => row.is_warmup_period === true ? Math.max(latest, tickOf(row)) : latest, -1);
  const starts = tickEvents.filter((row) => (row.event_name || row.name || row.type) === 'round_start' && tickOf(row) > warmupEnd);
  const ends = tickEvents.filter((row) => (row.event_name || row.name || row.type) === 'round_end' && tickOf(row) > warmupEnd);
  const skippedRounds = [];
  // Перезапуски не являются отдельными раундами. Конец ищем внутри интервала
  // конкретного старта, а не по индексу в независимом массиве round_end.
  const boundaries = starts.map((start, index) => {
    const startTick = tickOf(start);
    const nextStart = tickOf(starts[index + 1]);
    const end = ends.find((row) => tickOf(row) > startTick && (nextStart === null || tickOf(row) <= nextStart));
    if (!end && nextStart !== null) return null;
    const endTick = tickOf(end);
    const terminalDeaths = sourceEvents.filter(row => row.event_name === 'player_death' && tickOf(row) >= (endTick ?? Infinity) - tickRate / 4 && tickOf(row) <= endTick);
    const worldVictims = new Set(terminalDeaths.filter(row => /^(world|worldspawn|trigger_hurt)$/.test(row.weapon || '') && (!row.attacker_steamid || row.attacker_steamid === row.user_steamid)).map(row => row.user_steamid || row.user_name).filter(Boolean));
    // Отрезок, закончившийся массовыми world-смертями без результата, является
    // техническим перезапуском сервера и не показывается как игровой раунд.
    const serverRestart = Boolean(end && (/restart|cancel|game_commencing|game_start/i.test(String(end.reason || ''))
      || (!end.winner && !end.reason && worldVictims.size >= 3)));
    if (serverRestart) {
      skippedRounds.push({ number:finite(start.round) ?? index + 1, startTick, endTick, reason:'server_restart' });
      return null;
    }
    const freezeEnd = sourceEvents.find((row) => row.event_name === 'round_freeze_end' && tickOf(row) >= startTick && tickOf(row) < (endTick ?? Infinity));
    return {
      number:finite(start.round) ?? (finite(start.total_rounds_played) === null ? index + 1 : finite(start.total_rounds_played) + 1),
      startTick:tickOf(freezeEnd) ?? startTick,
      preFreezeStartTick:startTick,
      endTick:Math.max(startTick, endTick ?? (nextStart === null ? Math.max(startTick, ...sourceEvents.map(tickOf).filter((tick) => tick !== null)) : nextStart - 1)),
      start,
      end:end || null,
      serverRestart
    };
  }).filter(Boolean);
  // При восстановлении бэкапа сервер может повторно сыграть уже начатые раунды.
  for (let index = boundaries.length - 1; index >= 0; index--) {
    if (boundaries.slice(index + 1).some(round => round.number <= boundaries[index].number)) boundaries.splice(index, 1);
  }

  // Демки с неполным event-списком остаются пригодны для просмотра известных событий.
  if (!boundaries.length && sourceEvents.length && !tickEvents.length) {
    let round = 1;
    for (const event of sourceEvents) {
      const parsedRound = finite(event.total_rounds_played ?? event.round);
      if (parsedRound !== null) round = Math.max(1, Math.floor(parsedRound) + 1);
      const existing = boundaries.find((item) => item.number === round);
      if (existing) existing.endTick = tickOf(event);
      else boundaries.push({ number:round, startTick:tickOf(event), endTick:tickOf(event), start:null, end:null });
    }
  }

  const frameMap = new Map();
  rawTicks.forEach((row) => {
    const tick = tickOf(row);
    if (!frameMap.has(tick)) frameMap.set(tick, { tick, players:[] });
    const player = {
      id:String(row.steamid ?? row.player_steamid ?? row.name ?? row.player_name ?? ''),
      nick:nameOf(row, 'name', 'player_name') || null,
      side:sideFromTeamNumber(row.team_num ?? row.team_number),
      position:{ x:finite(row.X ?? row.x), y:finite(row.Y ?? row.y), z:finite(row.Z ?? row.z) },
      heading:finite(row.yaw),
      weapon:nameOf(row, 'active_weapon_name') || null,
      health:finite(row.health),
      armor:finite(row.armor_value),
      money:finite(row.balance),
      inventory:Array.isArray(row.inventory) ? row.inventory.map(String) : [],
      alive:row.is_alive === undefined || row.is_alive === null ? null : row.is_alive === true || row.is_alive === 1 || row.is_alive === 'true'
    };
    if (player.id && player.position.x !== null && player.position.y !== null) frameMap.get(tick).players.push(player);
  });
  const frames = [...frameMap.values()];

  const nearestFrame = (tick) => {
    let best = null;
    for (const frame of frames) {
      if (!best || Math.abs(frame.tick - tick) < Math.abs(best.tick - tick)) best = frame;
      if (frame.tick >= tick) break;
    }
    return best;
  };
  const roundForTick = (tick) => {
    let low = 0; let high = boundaries.length - 1;
    while (low <= high) {
      const middle = (low + high) >> 1; const round = boundaries[middle];
      if (tick < round.startTick) high = middle - 1;
      else if (tick > round.endTick) low = middle + 1;
      else return round;
    }
    return null;
  };
  const normalizedEvents = sourceEvents.filter(row => !(row.event_name === 'player_death' && worldResetTicks.has(tickOf(row)))).map((row, index) => {
    const tick = tickOf(row);
    const rawType = row.event_name || row.name || row.type || '';
    const type = ({ player_death:'kill', player_hurt:'damage', bomb_planted:'bomb_plant', bomb_defused:'bomb_defuse', bomb_begindefuse:'bomb_defuse_start', bomb_abortdefuse:'bomb_defuse_abort', bomb_exploded:'bomb_explode', round_start:'round_start', round_end:'round_end', weapon_fire:'shot', grenade_thrown:'grenade_throw', smokegrenade_detonate:'smoke', inferno_startburn:'molotov', hegrenade_detonate:'he', flashbang_detonate:'flash', decoy_detonate:'decoy' })[rawType];
    if (!type) return null;
    const frame = nearestFrame(tick);
    const actorName = ['kill','damage'].includes(type) ? nameOf(row, 'attacker_name', 'attacker') : nameOf(row, 'user_name', 'player_name', 'thrower_name');
    const targetName = type === 'kill' || type === 'damage' ? nameOf(row, 'user_name', 'victim_name', 'player_name') : null;
    const actorState = frame?.players.find((player) => player.nick?.toLowerCase() === actorName?.toLowerCase());
    const targetState = frame?.players.find((player) => player.nick?.toLowerCase() === targetName?.toLowerCase());
    // У гранаты x/y/z — место детонации, user_X/Y/Z — позиция бросившего игрока.
    const effect = ['smoke','molotov','he','flash','decoy'].includes(type);
    const actorX = finite(effect ? row.x ?? row.X : row.attacker_X ?? row.user_X ?? row.X ?? row.x);
    const actorY = finite(effect ? row.y ?? row.Y : row.attacker_Y ?? row.user_Y ?? row.Y ?? row.y);
    const targetX = finite(row.user_X ?? row.victim_X);
    const targetY = finite(row.user_Y ?? row.victim_Y);
    const position = actorX === null || actorY === null ? (effect ? null : actorState?.position || null) : { x:actorX, y:actorY, z:finite(effect ? row.z ?? row.Z : row.attacker_Z ?? row.user_Z ?? row.Z) ?? actorState?.position?.z ?? null };
    const targetPosition = targetX === null || targetY === null ? targetState?.position || null : { x:targetX, y:targetY, z:finite(row.user_Z ?? row.victim_Z) ?? targetState?.position?.z ?? null };
    return {
      id:`${Math.round(tick)}-${rawType}-${index}`,
      type, rawType, tick, timestampMs:Math.max(0, Math.round(tick / tickRate * 1000)),
      roundNumber:roundForTick(tick)?.number ?? null,
      entityId:row.entityid == null ? null : String(row.entityid),
      actor:actorName ? { id:String((['kill','damage'].includes(type) ? row.attacker_steamid : row.user_steamid) ?? actorState?.id ?? actorName), name:actorName } : null,
      target:targetName ? { id:String(row.user_steamid ?? targetState?.id ?? targetName), name:targetName } : null,
      assister:nameOf(row, 'assister_name') || null,
      assisterId:String(row.assister_steamid ?? ''),
      side:actorState?.side || sideFromTeamNumber(row.attacker_team_num ?? row.team_num),
      targetSide:targetState?.side || null,
      weapon:nameOf(row, 'weapon', 'weapon_name') || null,
      headshot:row.headshot === true,
      hasKit:type === 'bomb_defuse_start' ? Boolean(row.haskit ?? row.user_has_defuser) : null,
      damage:finite(row.dmg_health) || 0,
      position:position ? { x:position.x, y:position.y, z:position.z ?? null } : null,
      targetPosition,
      site:nameOf(row, 'site') || null,
      duration:type === 'smoke' ? 18 : type === 'molotov' ? 7 : null
    };
  }).filter(Boolean);

  const parsedGrenades = rows(grenadeRows);
  const grenadeGroups = new Map();
  const activeGrenadeGroups = new Map();
  for (const grenade of parsedGrenades) {
    const tick = tickOf(grenade);
    const x = finite(grenade.X ?? grenade.x); const y = finite(grenade.Y ?? grenade.y); const z = finite(grenade.Z ?? grenade.z);
    if (tick === null || x === null || y === null) continue;
    const round = roundForTick(tick);
    if (!round) continue;
    const entity = String(grenade.entity_id ?? grenade.grenade_entity_id ?? grenade.entityid ?? `${grenade.thrower_steamid || grenade.steamid || grenade.name}-${tick}`);
    const owner = String(grenade.thrower_steamid || grenade.steamid || grenade.name || 'unknown');
    const baseKey = `${round.number}:${entity}:${owner}`;
    let key = activeGrenadeGroups.get(baseKey);
    let track = key ? grenadeGroups.get(key) : null;
    if (track && tick - track.lastTick > tickRate * 5) {
      track = null;
    }
    if (!track) {
      key = `${baseKey}:${tick}`;
      activeGrenadeGroups.set(baseKey, key);
      track = grenadeGroups.get(key);
    }
    if (!track) {
      track = { id:`${entity}-${tick}`, entityId:entity, roundNumber:round.number, type:String(grenade.grenade_type || 'grenade'), thrower:nameOf(grenade, 'name', 'thrower_name'), throwerId:String(grenade.thrower_steamid || grenade.steamid || ''), samples:[], lastTick:tick };
      grenadeGroups.set(key, track);
    }
    track.lastTick = tick;
    const last = track.samples[track.samples.length - 1];
    // Сохраняем точки примерно 8 раз в секунду, чтобы архив оставался компактным.
    if (!last || tick - last.tick >= Math.max(1, Math.round(tickRate / 8))) {
      track.samples.push({ tick, position:{ x, y, z } });
    }
  }

  const rounds = boundaries.map((round) => {
    const roundFrames = frames.filter((frame) => frame.tick >= round.startTick && frame.tick <= round.endTick).map((frame) => ({ tick:frame.tick, seconds:Number(((frame.tick - round.startTick) / tickRate).toFixed(3)), players:frame.players }));
    const grenades = [...grenadeGroups.values()].filter((grenade) => grenade.roundNumber === round.number).map((grenade) => ({ ...grenade, samples:grenade.samples.map((sample) => ({ ...sample, seconds:Number(((sample.tick - round.startTick) / tickRate).toFixed(3)) })) }));
    const events = normalizedEvents.filter((event) => event.roundNumber === round.number).map((event) => ({ ...event, at:Number(((event.tick - round.startTick) / tickRate).toFixed(3)) }));
    if (!events.some((event) => event.type === 'round_start')) {
      events.unshift({ id:`${round.startTick}-round_start`, type:'round_start', tick:round.startTick, timestampMs:Math.round(round.startTick / tickRate * 1000), roundNumber:round.number, at:0 });
    }
    events.filter((event) => ['smoke','molotov','he','flash','decoy'].includes(event.type)).forEach((event) => {
      const expectedByEvent = { smoke:['smoke'], molotov:['molotov','incendiary','inferno','fire'], he:['hegrenade','he_grenade','explosive'], flash:['flashbang','flash'], decoy:['decoy'] };
      const expected = expectedByEvent[event.type] || [];
      const matching = grenades.map((grenade) => ({ grenade, last:grenade.samples[grenade.samples.length - 1] }))
        .filter(({ grenade, last }) => last && expected.some((name) => String(grenade.type).toLowerCase().includes(name)))
        .filter(({ grenade }) => grenade.samples[0].tick <= event.tick && !grenade.detonationId
          && (event.entityId ? event.entityId === grenade.entityId : !event.actor?.id || !grenade.throwerId || event.actor.id === grenade.throwerId))
        .map(({ grenade }) => ({ grenade, sample:grenade.samples.reduce((best, sample) => !best || Math.abs(sample.tick - event.tick) < Math.abs(best.tick - event.tick) ? sample : best, null) }))
        .sort((a, b) => Math.abs(a.sample.tick - event.tick) - Math.abs(b.sample.tick - event.tick))[0];
      if (matching && Math.abs(matching.sample.tick - event.tick) <= tickRate * 5) {
        // Достоверные координаты события никогда не заменяем координатами другого снаряда.
        event.position ||= matching.sample.position;
        event.grenadeType = matching.grenade.type;
        event.grenadeId = matching.grenade.id;
        matching.grenade.detonationId = event.id;
      }
    });
    const duration = Math.max(0, (round.endTick - round.startTick) / tickRate);
    return { number:round.number, startTick:round.startTick, endTick:round.endTick, duration:Number(duration.toFixed(2)), phase:'ended', events, samples:roundFrames, grenades };
  });

  const stats = Object.create(null);
  const playerSteamIds = Object.create(null);
  const count = (name) => { if (!name) return null; stats[name] ||= { kills:0, deaths:0, assists:0, damage:0 }; return stats[name]; };
  const rememberSteamId = (name, id) => {
    if (!name || !/^\d{17}$/.test(String(id || ''))) return;
    const key = String(name).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    if (key) playerSteamIds[key] = String(id);
  };
  normalizedEvents.filter((event) => event.roundNumber !== null).forEach((event) => {
    rememberSteamId(event.actor?.name, event.actor?.id);
    rememberSteamId(event.target?.name, event.target?.id);
    rememberSteamId(event.assister, event.assisterId);
    if (event.type === 'kill') { const killer = count(event.actor?.name); const victim = count(event.target?.name); if (killer) killer.kills += 1; if (victim) victim.deaths += 1; }
    if (event.type === 'damage' && event.actor?.name) count(event.actor.name).damage += Math.max(0, event.damage);
    if (event.type === 'kill' && event.assister) count(event.assister).assists += 1;
  });
  const roundCount = Math.max(1, rounds.length);
  Object.values(stats).forEach((value) => { value.adr = Number((value.damage / roundCount).toFixed(1)); value.rating = null; });

  return { mapName, tickRate, rounds, skippedRounds, stats, playerSteamIds, frameCount:frames.length, grenadeCount:grenadeGroups.size, importedAt:new Date().toISOString() };
}

function parseDemoFile(filePath) {
  const header = parseHeader(filePath);
  const eventNames = rows(listGameEvents(filePath)).map((item) => typeof item === 'string' ? item : item.name).filter(Boolean);
  // round_start/end генерируются парсером из состояния игры и отсутствуют
  // в listGameEvents некоторых CS2-демок. Их нельзя отфильтровывать этим списком.
  const available = REQUESTED_EVENTS.filter((eventName) => ['round_start','round_end'].includes(eventName) || eventNames.includes(eventName));
  const parsedEvents = available.length ? parseEvents(filePath, available, ['X','Y','Z','yaw','haskit','user_has_defuser'], ['total_rounds_played','is_warmup_period']) : [];
  const eventRows = rows(parsedEvents).map((row) => ({ ...row, event_name:row.event_name || row.name }));
  const endTick = Math.max(0, ...eventRows.map((row) => tickOf(row) || 0));
  const roundStarts = eventRows.filter((row) => row.event_name === 'round_start').map(tickOf);
  const roundEnds = eventRows.filter((row) => row.event_name === 'round_end').map(tickOf);
  const maxTick = Math.max(endTick, ...roundStarts, ...roundEnds, 0);
  const tickRate = 64;
  const interval = Math.max(8, Math.round(tickRate / 4));
  const wantedTicks = [];
  for (let tick = 0; tick <= maxTick; tick += interval) wantedTicks.push(tick);
  [...roundStarts, ...roundEnds, ...eventRows.filter(row => row.event_name === 'round_freeze_end').map(tickOf)].forEach((tick) => wantedTicks.push(tick));
  const tickRows = maxTick ? parseTicks(filePath, ['X','Y','Z','yaw','team_num','active_weapon_name','is_alive','health','armor_value','balance','inventory','current_equip_value'], [...new Set(wantedTicks)].sort((a, b) => a - b)) : [];
    const grenadeRows = parseGrenades(filePath, [], true);
  const mapName = String(header?.map_name || '').replace(/^de_/, '').replace(/(^|_)([a-z])/g, (_, sep, letter) => letter.toUpperCase());
  if (!mapName) throw new Error('В демо не найдено название карты');
  const normalized = normalizeParsedRows({ mapName, eventRows, tickRows, grenadeRows, tickRate });
  if (!normalized.rounds.length) throw new Error('Парсер не нашёл границы раундов в демо');
  return normalized;
}

module.exports = { REQUESTED_EVENTS, rows, normalizeParsedRows, parseDemoFile };
