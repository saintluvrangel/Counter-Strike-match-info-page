(function initMatchesApi(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MatchesApi = api;
})(typeof window !== 'undefined' ? window : globalThis, function createMatchesApi(root) {
  'use strict';

  const data = root.HltvMatchData;

  function expand(match) {
    return {
      ...match,
      teamA:{ ...data.teams[match.teamA], players:data.teams[match.teamA].players.map((player) => [...player]) },
      teamB:{ ...data.teams[match.teamB], players:data.teams[match.teamB].players.map((player) => [...player]) },
      maps:match.maps.map((map) => [...map]),
      stats:match.stats ? Object.fromEntries(Object.entries(match.stats).map(([id, row]) => [id, [...row]])) : null
    };
  }

  async function list() {
    return data.matches.map(expand);
  }

  async function get(id) {
    const match = data.matches.find((item) => item.id === String(id));
    return match ? expand(match) : null;
  }

  return { list, get };
});
