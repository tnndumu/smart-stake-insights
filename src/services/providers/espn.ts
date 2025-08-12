import type { NormalizedOddsRow } from './types';

function leagueToPath(league: string): string | null {
  switch (league.toUpperCase()) {
    case 'MLB': return 'baseball/mlb';
    case 'NBA': return 'basketball/nba';
    case 'NHL': return 'hockey/nhl';
    case 'NFL': return 'football/nfl';
    case 'EPL': return 'soccer/eng.1';
    case 'MLS': return 'soccer/usa.1';
    default: return null;
  }
}

export async function fetchESPNOdds(league: string, dateYYYYMMDD: string): Promise<NormalizedOddsRow[]> {
  const path = leagueToPath(league);
  if (!path) return [];
  
  const d = String(dateYYYYMMDD || '').replace(/-/g,'');
  const url = `https://site.api.espn.com/apis/v2/sports/${path}/scoreboard?dates=${d}`;
  
  try {
    const res = await fetch(url, { headers: { 'accept': 'application/json' }});
    if (!res.ok) return [];
    
    const data = await res.json();
    const events = data?.events || [];
    const out: NormalizedOddsRow[] = [];
    
    for (const ev of events) {
      const comp = ev?.competitions?.[0];
      if (!comp) continue;
      
      const comps = comp.competitors || [];
      const home = comps.find((c:any)=>c?.homeAway==='home')?.team?.displayName || comps[0]?.team?.displayName;
      const away = comps.find((c:any)=>c?.homeAway==='away')?.team?.displayName || comps[1]?.team?.displayName;
      const start = comp?.date || ev?.date;

      const books:any[] = [];
      const oddsArr = comp?.odds || ev?.odds || [];
      
      for (const o of oddsArr) {
        const book = o?.provider?.name || o?.provider?.displayName || 'ESPN';
        const markets:any[] = [];
        
        if (o?.moneylineAway != null && o?.moneylineHome != null) {
          markets.push({ 
            key:'h2h', 
            outcomes:[
              { name: away, price: Number(o.moneylineAway) },
              { name: home, price: Number(o.moneylineHome) },
            ]
          });
        }
        
        if (o?.spread != null) {
          const s = Number(o.spread);
          markets.push({ 
            key:'spreads', 
            outcomes:[
              { name: away, point: -s, price: Number(o?.awayTeamOdds?.moneyLine ?? NaN) },
              { name: home, point:  s, price: Number(o?.homeTeamOdds?.moneyLine ?? NaN) },
            ]
          });
        }
        
        if (o?.overUnder != null) {
          const ou = Number(o.overUnder);
          markets.push({ 
            key:'totals', 
            outcomes:[
              { name:'Over',  point: ou, price: Number(o?.overOdds ?? NaN) },
              { name:'Under', point: ou, price: Number(o?.underOdds ?? NaN) },
            ]
          });
        }
        
        if (markets.length) books.push({ bookmaker: book, markets });
      }
      
      out.push({ start, home, away, books });
    }
    
    return out;
  } catch { 
    return []; 
  }
}