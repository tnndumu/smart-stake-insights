import type { Game, LeagueAdapter } from './index';

// Live scores feed (official nfl.com). Returns a map keyed by game id.
const LIVE = 'https://static.nfl.com/liveupdate/scores/scores.json';

export const NFLAdapter: LeagueAdapter = {
  id: 'NFL',
  async fetchByDate(_date) {
    try {
      const r = await fetch(LIVE);
      if (!r.ok) return [];
      const j = await r.json();
      const out: Game[] = [];
      for (const k of Object.keys(j)) {
        const g = j[k];
        // Convert EST time text to ISO if present; fallback to Date now if missing
        const iso = g?.start_time ? new Date(g.start_time).toISOString() : new Date().toISOString();
        out.push({
          id: String(k),
          league: 'NFL',
          startUtc: iso,
          home: g.home?.abbr || g.home?.team || g.home || 'Unknown',
          away: g.away?.abbr || g.away?.team || g.away || 'Unknown',
          venue: g?.stadium,
          extra: g
        });
      }
      return out;
    } catch (error) {
      console.warn('NFL adapter failed:', error);
      return [];
    }
  }
};

export default NFLAdapter;