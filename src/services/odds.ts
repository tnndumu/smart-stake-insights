import { DateTime } from 'luxon';
import { isWithinUTC } from '@/utils/time';

const API_KEY = import.meta.env.VITE_ODDS_API_KEY; // set this in Lovable env vars
const BASE = 'https://api.the-odds-api.com/v4';

export type Market = 'h2h' | 'spreads' | 'totals';
export type SportKey = string;

async function getActiveSports(): Promise<Array<{ key: SportKey; active: boolean; group: string; title: string }>> {
  if (!API_KEY) {
    console.warn('VITE_ODDS_API_KEY not set, using mock data');
    return [];
  }
  
  const res = await fetch(`${BASE}/sports/?apiKey=${API_KEY}`);
  if (!res.ok) throw new Error('Failed to load sports');
  return res.json();
}

async function getOddsForSport(key: SportKey) {
  if (!API_KEY) return [];
  
  const url = `${BASE}/sports/${key}/odds?regions=us&markets=h2h,spreads,totals&oddsFormat=decimal&dateFormat=iso&apiKey=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  return res.json();
}

export async function getOddsForDay(rangeUTC: { startUTC: DateTime; endUTC: DateTime }) {
  if (!API_KEY) {
    // Return mock data when no API key
    return [];
  }

  // 1) list active sports to avoid dead seasons
  const sports = (await getActiveSports()).filter(s => s.active);

  // 2) fetch all, filter by commence_time within [startUTC, endUTC]
  const results = await Promise.all(
    sports.map(async (s) => {
      try {
        const games = await getOddsForSport(s.key);
        const filtered = (games || []).filter((g: any) =>
          g?.commence_time && isWithinUTC(g.commence_time, rangeUTC.startUTC, rangeUTC.endUTC)
        );
        // tag sport info for UI
        return filtered.map((g: any) => ({ ...g, __sport: { key: s.key, title: s.title, group: s.group } }));
      } catch {
        return [];
      }
    })
  );

  // 3) flatten and sort by kickoff time
  const flat = results.flat();
  flat.sort((a: any, b: any) => (a.commence_time > b.commence_time ? 1 : -1));
  return flat;
}