'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { getMatchAnalytics, calculateWinProbability, normalizeMatch, sameTournament } = require('../lib/analytics');
const { parseTeamMatchesHtml } = require('../lib/mediawiki-matches');
const { endpointUrl, request } = require('../lib/liquipedia');

function row(date, tournament, result, score, opponent) {
  const timestamp = Date.parse(date) / 1000;
  return `<tr class="table2__row--body"><td data-sort-value="${timestamp}"><span data-timestamp="${timestamp}"></span></td><td></td><td></td><td></td><td></td><td>${tournament}</td><td><div data-label-type="result-${result}"></div></td><td>${score}</td><td><span class="name"><a href="/counterstrike/${opponent}">${opponent}</a></span></td><td></td></tr>`;
}
const page = (...rows) => `<div class="match-table-wrapper"><table>${rows.join('')}</table></div>`;

async function run() {
  const sharedDate = '2026-01-02T12:00:00Z';
  const alpha = page(row(sharedDate, 'Cup - Playoffs', 'win', '2 : 1', 'Beta'), row('2026-01-01T12:00:00Z', 'Cup', 'loss', '8 - 13', 'Gamma'));
  const beta = page(row(sharedDate, 'Cup - Playoffs', 'loss', '1 : 2', 'Alpha'), row('2026-01-03T12:00:00Z', 'Cup', 'win', 'W : FF', 'Delta'));
  assert.equal(parseTeamMatchesHtml(alpha, 'Alpha').length, 2);
  assert.equal(parseTeamMatchesHtml(beta, 'Beta')[1].opponent1score, undefined);
  const result = await getMatchAnalytics({ id:'alpha', name:'Alpha' }, { id:'beta', name:'Beta' }, '2026-01-15T00:00:00Z', 'Cup', {
    resolveMatchPages:async () => ['Team Alpha/Matches', 'Beta Gaming/Matches'],
    parsePage:async (title) => title === 'Team Alpha/Matches' ? alpha : beta
  });
  assert.equal(result.headToHead.matches.length, 1, 'H2H duplicate from both team pages is removed');
  assert.equal(result.headToHead.wins.alpha, 1);
  assert.equal(result.headToHead.wins.beta, 0);
  assert.equal(result.teams[0].recentMatches.length, 2);
  assert.equal(result.teams[1].recentMatches.length, 2);
  assert.equal(result.winProbability.team1 + result.winProbability.team2, 100);
  assert.equal(normalizeMatch({ id:'x', date:'2026-01-01', opponent1:'A', opponent2:'B' }).winnerId, undefined);
  assert.equal(calculateWinProbability({ recentMatches:[] }, { recentMatches:[] }, { matches:[] }, ''), null);
  assert.equal(sameTournament('SL StarSeries Fall 2026', 'StarLadder StarSeries Fall 2026'), true);
  assert.equal(sameTournament('IEM Katowice 2026', 'IEM Krakow 2026'), false);
  assert.equal(endpointUrl({ action:'query', titles:'Alpha' }).origin, 'https://liquipedia.net');

  let calls = 0;
  const fetchStub = async (_url, options) => {
    calls++;
    assert.match(options.headers['User-Agent'], /cs2-info-dashboard\/1\.0\.0 \(https:\/\/github\.com\//);
    assert.equal(options.headers.Authorization, undefined);
    return { ok:true, json:async () => ({ query:{ pages:{} } }) };
  };
  const query = { action:'query', titles:`Test-${crypto.randomUUID()}` };
  await request(query, { fetch:fetchStub });
  await request(query, { fetch:fetchStub });
  assert.equal(calls, 1, 'MediaWiki responses are cached');
  console.log('analytics tests passed');
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
