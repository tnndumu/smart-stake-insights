import type { Game, LeagueAdapter } from './index';

const BASE = 'https://api.mlssoccer.com/api/v1';

export const MLSAdapter: LeagueAdapter = {
  id: 'MLS',
  async fetchByDate(date) { // YYYY-MM-DD
    try {
      const r = await fetch(`${BASE}/schedule?date=${date}`);
      if (!r.ok) return [];
      const j = await r.json();
      const list = j?.matches ?? j ?? [];
      return list
        .filter((m:any)=> (m?.date || m?.matchDate)?.slice(0,10) === date)
        .map((m:any): Game => ({
          id: String(m.matchId || m.id),
          league: 'MLS',
          startUtc: new Date(m.date || m.matchDate).toISOString(),
          home: m.homeTeam?.name || m.home?.name || 'Unknown',
          away: m.awayTeam?.name || m.away?.name || 'Unknown',
          venue: m.venue?.name,
          extra: m
        }));
    } catch (error) {
      console.warn('MLS adapter failed:', error);
      return [];
    }
  },
  async fetchLive() {
    try {
      const today = new Date().toISOString().slice(0,10);
      const r = await fetch(`${BASE}/schedule?date=${today}`);
      if (!r.ok) return [];
      const j = await r.json();
      const list = j?.matches ?? j ?? [];
      return list
        .filter((m:any)=> /live|in[- ]?progress/i.test(String(m?.status || m?.matchStatus || '')))
        .map((m:any): Game => ({
          id: String(m.matchId || m.id),
          league: 'MLS',
          startUtc: new Date(m.date || m.matchDate || Date.now()).toISOString(),
          home: m.homeTeam?.name || m.home?.name || 'Unknown',
          away: m.awayTeam?.name || m.away?.name || 'Unknown',
          venue: m.venue?.name,
          extra: m
        }));
    } catch (error) {
      console.warn('MLS live failed:', error);
      return [];
    }
  }
};

export default MLSAdapter;