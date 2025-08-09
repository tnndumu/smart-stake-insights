import type { Game, LeagueAdapter } from './index';

const BASE = 'https://api-web.nhle.com/v1';

export const NHLAdapter: LeagueAdapter = {
  id: 'NHL',
  async fetchByDate(date) { // YYYY-MM-DD
    try {
      const r = await fetch(`${BASE}/schedule/${date}`);
      if (!r.ok) return [];
      const j = await r.json();
      const gms = (j?.gameWeek ?? []).flatMap((w:any)=> w.games ?? []);
      return gms.map((g:any): Game => ({
        id: String(g.id),
        league: 'NHL',
        startUtc: g.startTimeUTC,  // ISO UTC
        home: g.homeTeam?.abbrev ?? g.homeTeam?.name ?? 'Unknown',
        away: g.awayTeam?.abbrev ?? g.awayTeam?.name ?? 'Unknown',
        venue: g.venue?.default?.name,
        extra: g
      }));
    } catch (error) {
      console.warn('NHL adapter failed:', error);
      return [];
    }
  }
};

export default NHLAdapter;