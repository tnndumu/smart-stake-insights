import type { Game, LeagueAdapter } from './index';

const BASE = 'https://statsapi.mlb.com/api/v1';

export const MLBAdapter: LeagueAdapter = {
  id: 'MLB',
  async fetchByDate(date) {
    const url = `${BASE}/schedule?sportId=1&date=${date}`; // YYYY-MM-DD
    const r = await fetch(url);
    if (!r.ok) return [];
    const json = await r.json();
    const dates = json?.dates ?? [];
    const games: Game[] = [];
    for (const d of dates) {
      for (const g of (d.games ?? [])) {
        games.push({
          id: String(g.gamePk),
          league: 'MLB',
          startUtc: g.gameDate, // ISO UTC
          home: g.teams?.home?.team?.name || 'Unknown',
          away: g.teams?.away?.team?.name || 'Unknown',
          venue: g.venue?.name,
          extra: g
        });
      }
    }
    return games;
  },
  async fetchLive() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const url = `${BASE}/schedule?sportId=1&date=${today}`;
      const r = await fetch(url);
      if (!r.ok) return [];
      const j = await r.json();
      const dates = j?.dates ?? [];
      const live: Game[] = [];
      for (const d of dates) {
        for (const g of (d.games ?? [])) {
          const state = g?.status?.detailedState || '';
          if (/In Progress|Live/i.test(state)) {
            live.push({
              id: String(g.gamePk),
              league: 'MLB',
              startUtc: g.gameDate,
              home: g.teams?.home?.team?.name || 'Unknown',
              away: g.teams?.away?.team?.name || 'Unknown',
              venue: g.venue?.name,
              extra: g
            });
          }
        }
      }
      return live;
    } catch (e) {
      console.warn('MLB live failed:', e);
      return [];
    }
  }
};

export default MLBAdapter;