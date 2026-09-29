'use strict';

const cheerio = require('cheerio');
const crypto = require('node:crypto');

function canonical(value) { return String(value || '').normalize('NFKC').trim().toLocaleLowerCase('en').replace(/\s+/g, ' '); }

function parseTeamMatchesHtml(html, teamTitle) {
  const $ = cheerio.load(html || '');
  const matches = [];
  $('.match-table-wrapper tr.table2__row--body').each((_, row) => {
    const cells = $(row).children('td');
    if (cells.length < 9) return;
    const timestamp = Number(cells.eq(0).find('[data-timestamp]').attr('data-timestamp') || cells.eq(0).attr('data-sort-value'));
    const scoreText = cells.eq(7).text().replace(/\s+/g, ' ').trim();
    const score = scoreText.match(/^(\d+)\s*[:\-]\s*(\d+)$/);
    const opponentCell = cells.eq(8);
    const opponentName = opponentCell.find('.name a').first().text().trim() || opponentCell.attr('data-sort-value') || '';
    if (!Number.isSafeInteger(timestamp) || timestamp <= 0 || !opponentName) return;
    const result = cells.eq(6).find('[data-label-type]').attr('data-label-type');
    if (result !== 'result-win' && result !== 'result-loss') return;
    const tournament = cells.eq(5).text().replace(/\s+/g, ' ').trim();
    const participantKey = [canonical(teamTitle), canonical(opponentName)].sort().join('|');
    const id = crypto.createHash('sha256').update(`${timestamp}|${participantKey}|${canonical(tournament)}`).digest('hex').slice(0, 24);
    matches.push({
      id,
      date:new Date(timestamp * 1000).toISOString(),
      tournament,
      opponent1:teamTitle,
      opponent2:opponentName,
      opponent1score:score ? Number(score[1]) : undefined,
      opponent2score:score ? Number(score[2]) : undefined,
      winner:result === 'result-win' ? teamTitle : opponentName
    });
  });
  return matches;
}

module.exports = { parseTeamMatchesHtml };
