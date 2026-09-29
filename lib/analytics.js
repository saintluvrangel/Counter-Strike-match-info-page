'use strict';

const liquipedia = require('./liquipedia');
const { parseTeamMatchesHtml } = require('./mediawiki-matches');

const str = (value) => typeof value === 'string' ? value.trim() : typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
const numeric = (value) => value === '' || value == null ? null : Number.isFinite(Number(value)) ? Number(value) : null;
const safeUrl = (value) => { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : undefined; } catch { return undefined; } };
const sourceUrl = (row) => safeUrl(row.url || row.pageurl || row.wikiurl) || (str(row.pagename) ? `https://liquipedia.net/counterstrike/${str(row.pagename).split('/').map(encodeURIComponent).join('/')}` : undefined);
const canonical = (value) => str(value).normalize('NFKC').toLocaleLowerCase('en').replace(/\s+/g, ' ');
const nameOf = (value) => str(typeof value === 'object' && value ? value.name || value.id || value.pagename : value);

function normalizeMatch(row) {
  const opponents = Array.isArray(row.opponents) ? row.opponents : [];
  const a = row.opponent1 || opponents[0] || row.team1;
  const b = row.opponent2 || opponents[1] || row.team2;
  const aName = nameOf(a), bName = nameOf(b);
  const date = str(row.date || row.startdate || row.datetime);
  const id = str(row.id || row.matchid || row.pageid || row.pagename);
  if (!id || !date || !aName || !bName) return null;
  const aId = str(a?.id || a?.pagename) || aName;
  const bId = str(b?.id || b?.pagename) || bName;
  const aScore = numeric(row.opponent1score ?? a?.score ?? row.team1score);
  const bScore = numeric(row.opponent2score ?? b?.score ?? row.team2score);
  const winnerName = nameOf(row.winner);
  const explicitWinner = canonical(winnerName) === canonical(aName) ? aId : canonical(winnerName) === canonical(bName) ? bId : undefined;
  const winnerId = explicitWinner || (aScore !== null && bScore !== null && aScore !== bScore ? (aScore > bScore ? aId : bId) : undefined);
  return {
    id, date, tournament:nameOf(row.tournament || row.event),
    team1Id:aId, team1Name:aName, team2Id:bId, team2Name:bName,
    team1Score:aScore ?? undefined, team2Score:bScore ?? undefined, winnerId,
    url:sourceUrl(row)
  };
}

function teamNameMatches(name, team) { return [team.name, team.sourceName].filter(Boolean).some((alias) => canonical(name) === canonical(alias)); }
function involved(match, team) { return teamNameMatches(match.team1Name, team) || teamNameMatches(match.team2Name, team); }
function teamIdIn(match, team) { return teamNameMatches(match.team1Name, team) ? match.team1Id : teamNameMatches(match.team2Name, team) ? match.team2Id : null; }
function byDate(a, b) { return Date.parse(b.date) - Date.parse(a.date) || a.id.localeCompare(b.id); }
function winShare(matches, team) {
  const known = matches.filter((m) => m.winnerId && teamIdIn(m, team));
  if (!known.length) return null;
  let weight = 0, wins = 0;
  known.forEach((match, index) => { const w = 1 / (1 + index * 0.2); weight += w; if (match.winnerId === teamIdIn(match, team)) wins += w; });
  return { share:wins / weight, sampleSize:known.length };
}

function sameTournament(actual, expected) {
  const a = canonical(actual), b = canonical(expected);
  if (!a || !b) return false;
  if (a.startsWith(b) || b.startsWith(a)) return true;
  const left = new Set(a.split(/[^\p{L}\p{N}]+/u).filter(Boolean));
  const right = new Set(b.split(/[^\p{L}\p{N}]+/u).filter(Boolean));
  const shared = [...left].filter((token) => right.has(token));
  const meaningful = shared.filter((token) => !/^\d{4}$/.test(token));
  return meaningful.length >= 2 && shared.length / new Set([...left, ...right]).size >= 0.6;
}

function calculateWinProbability(team1, team2, h2h, tournament) {
  const components = [];
  const add = (name, weight, a, b, sampleSize) => {
    if (a == null || b == null || a + b === 0) return;
    components.push({ name, weight, team1Share:a / (a + b), sampleSize });
  };
  const formA = winShare(team1.recentMatches.slice(0, 10), team1);
  const formB = winShare(team2.recentMatches.slice(0, 10), team2);
  add('Последние 10 матчей · вес свежести 1/(1+0.2×позиция)', .5, formA?.share, formB?.share, Math.min(formA?.sampleSize || 0, formB?.sampleSize || 0));
  const hA = winShare(h2h.matches, team1), hB = winShare(h2h.matches, team2);
  add('Личные встречи', .25, hA?.share, hB?.share, h2h.matches.length);
  add('Рейтинг команды', .15, team1.rating, team2.rating, 2);
  if (tournament) {
    const tA = winShare(team1.recentMatches.filter((m) => sameTournament(m.tournament, tournament)), team1);
    const tB = winShare(team2.recentMatches.filter((m) => sameTournament(m.tournament, tournament)), team2);
    add('Форма на турнире', .1, tA?.share, tB?.share, Math.min(tA?.sampleSize || 0, tB?.sampleSize || 0));
  }
  if (!components.length) return null;
  const total = components.reduce((sum, part) => sum + part.weight, 0);
  const first = Math.round(100 * components.reduce((sum, part) => sum + part.team1Share * part.weight, 0) / total);
  return { team1:first, team2:100 - first, components, label:'Оценочная вероятность, не букмекерский коэффициент' };
}

async function getMatchAnalytics(team1, team2, matchDate, tournament = '', options = {}) {
  const resolveMatchPages = options.resolveMatchPages || liquipedia.resolveMatchPages;
  const parsePage = options.parsePage || liquipedia.parsePage;
  const warnings = [];
  const teams = [team1, team2].map((input) => {
    const team = typeof input === 'string' ? { name:input } : input;
    if (!team || !str(team.name)) throw new Error('Team name is required');
    return { id:String(team.id || team.name), name:team.name, logoUrl:safeUrl(team.logoUrl || team.logo), rating:undefined, players:[], recentMatches:[] };
  });
  const allRows = [];
  const titles = await resolveMatchPages(teams.map((team) => team.name));
  for (const [index, team] of teams.entries()) {
    const pageTitle = titles[index];
    if (!pageTitle) { warnings.push(`История ${team.name} не найдена на Liquipedia`); continue; }
    const sourceName = pageTitle.replace(/\/Matches$/, '');
    team.sourceName = sourceName;
    try {
      allRows.push(...parseTeamMatchesHtml(await parsePage(pageTitle), sourceName));
    } catch (error) {
      if (/returned (401|403|429)/.test(error.message)) throw error;
      warnings.push(`История ${team.name}: ${error.message}`);
    }
  }
  const parsedCutoff = matchDate ? Date.parse(matchDate) : NaN;
  const cutoff = Number.isFinite(parsedCutoff) ? parsedCutoff : Infinity;
  const unique = new Map();
  allRows.map(normalizeMatch).filter(Boolean).forEach((match) => {
    if (Number.isNaN(Date.parse(match.date)) || Date.parse(match.date) >= cutoff) return;
    // The site catalog and Liquipedia use different match IDs. Exclude the selected
    // fixture by its teams and day, so its result never leaks into the forecast.
    if (matchDate && match.date.slice(0, 10) === String(matchDate).slice(0, 10) && teams.every((team) => involved(match, team))) return;
    const key = teams.every((team) => involved(match, team))
      ? `h2h:${match.date}:${teams.map((team) => team.id).sort().join('|')}`
      : match.id;
    if (!unique.has(key)) unique.set(key, match);
  });
  const matches = [...unique.values()].sort(byDate);
  for (const team of teams) team.recentMatches = matches.filter((match) => involved(match, team)).slice(0, 10);
  const h2hMatches = matches.filter((match) => teams.every((team) => involved(match, team))).slice(0, 5);
  const wins = Object.fromEntries(teams.map((team) => [team.id, h2hMatches.filter((match) => match.winnerId === teamIdIn(match, team)).length]));
  const headToHead = { matches:h2hMatches, wins };
  return { teams, headToHead, winProbability:calculateWinProbability(teams[0], teams[1], headToHead, tournament), warnings, source:'Liquipedia MediaWiki' };
}

module.exports = { getMatchAnalytics, calculateWinProbability, normalizeMatch, sameTournament };
