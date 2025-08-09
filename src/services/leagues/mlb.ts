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
  }
};

export default MLBAdapter;