import type { Game, LeagueAdapter } from './index';

const BASE = 'https://footballapi.pulselive.com/football';

async function getFixtures(date: string) {
  const url = `${BASE}/fixtures?comps=1&compSeasons=0&page=0&pageSize=200&sort=asc&statuses=C,S,U`;
  return fetch(url, {
    headers: {
      'Origin': 'https://www.premierleague.com',
      'Referer': 'https://www.premierleague.com/',
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'application/json'
    }
  }).then(r => r.ok ? r.json() : Promise.reject('EPL fetch failed'));
}

export const EPLAdapter: LeagueAdapter = {
  id: 'EPL',
  async fetchByDate(date) {
    try {
      const j = await getFixtures(date);
      const items = j?.content ?? [];
      const out: Game[] = [];
      for (const f of items) {
        const kick = f.kickoff?.label || f.kickoff?.millis;
        const iso = typeof kick === 'number' ? new Date(kick).toISOString() : new Date(kick).toISOString();
        const d = new Date(iso).toISOString().slice(0,10);
        if (d !== date) continue;
        out.push({
          id: String(f.id),
          league: 'EPL',
          startUtc: iso,
          home: f.teams?.[0]?.team?.name || f.homeTeam?.name || 'Unknown',
          away: f.teams?.[1]?.team?.name || f.awayTeam?.name || 'Unknown',
          venue: f.ground?.name,
          extra: f,
        });
      }
      return out;
    } catch (error) {
      console.warn('EPL adapter failed:', error);
      return [];
    }
  }
};

export default EPLAdapter;