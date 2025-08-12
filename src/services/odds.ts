import { DateTime } from 'luxon';
import { isWithinUTC } from '@/utils/time';

const DIRECT_API_KEY = import.meta.env.VITE_ODDS_API_KEY; // may be unset in production
const SUPABASE_URL = "https://hgcbxwttbwwschlgiigj.supabase.co";
const FUNC_BASE = `${SUPABASE_URL}/functions/v1/odds-proxy`;

// Helper to build either proxy or direct URL
function oddsUrl(sportKey: string, markets = 'h2h,spreads,totals', regions = 'us') {
  if (FUNC_BASE) {
    const u = new URL(FUNC_BASE);
    u.searchParams.set('sport', sportKey);
    u.searchParams.set('markets', markets);
    u.searchParams.set('regions', regions);
    return { url: u.toString(), useProxy: true };
  }
  // Fallback to direct vendor (only if DIRECT_API_KEY is set)
  if (!DIRECT_API_KEY) {
    console.warn('No proxy or direct API key available');
    return { url: '', useProxy: false };
  }
  const u = new URL(`https://api.the-odds-api.com/v4/sports/${sportKey}/odds/`);
  u.searchParams.set('apiKey', DIRECT_API_KEY);
  u.searchParams.set('markets', markets);
  u.searchParams.set('regions', regions);
  u.searchParams.set('oddsFormat', 'american');
  u.searchParams.set('dateFormat', 'iso');
  return { url: u.toString(), useProxy: false };
}

export type Market = 'h2h' | 'spreads' | 'totals';
export type SportKey = string;

async function getActiveSports(): Promise<Array<{ key: SportKey; active: boolean; group: string; title: string }>> {
  // For now, keep using direct API for sports list or return mock data
  if (!DIRECT_API_KEY) {
    console.warn('ODDS_API_KEY not set, using mock data');
    return [];
  }
  
  const res = await fetch(`https://api.the-odds-api.com/v4/sports/?apiKey=${DIRECT_API_KEY}`);
  if (!res.ok) throw new Error('Failed to load sports');
  return res.json();
}

async function getOddsForSport(
  sportKey: SportKey,
  markets: string = 'h2h,spreads,totals',
  regions: string = 'us'
): Promise<any[]> {
  const { url, useProxy } = oddsUrl(sportKey, markets, regions);
  
  if (!url) {
    console.warn('No valid odds URL available');
    return [];
  }

  try {
    console.log(`Fetching odds from ${useProxy ? 'proxy' : 'direct'}:`, url.replace(/apiKey=[^&]+/, 'apiKey=[REDACTED]'));
    const res = await fetch(url, { 
      headers: { 
        accept: 'application/json'
      } 
    });
    
    if (!res.ok) {
      console.error(`Odds fetch failed (${res.status}): ${res.statusText}`);
      return [];
    }
    
    const data = await res.json();
    console.log(`Received ${data.length} odds entries for ${sportKey}`);
    return data;
  } catch (error) {
    console.error('Error fetching odds:', error);
    return [];
  }
}

export async function getOddsForDay(rangeUTC: { startUTC: DateTime; endUTC: DateTime }) {
  // Check if we have either proxy or direct access
  if (!FUNC_BASE && !DIRECT_API_KEY) {
    console.warn('No odds API access available (neither proxy nor direct key)');
    return [];
  }

  try {
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
  } catch (error) {
    console.error('Error in getOddsForDay:', error);
    return [];
  }
}
