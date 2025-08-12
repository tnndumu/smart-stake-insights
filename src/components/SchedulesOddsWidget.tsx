import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fetchESPNOdds, consensusRow, canonicalMLB, canonicalSoccer, type NormalizedOddsRow } from '@/services/providers';
import { fetchESPNRows, extractESPNFor } from '@/services/espn-now';
import { DateTime } from 'luxon';

// --- ESPN quick client (inline) ---
type ESPNOutcome = { name: string; price: number; point?: number };
type ESPNMarket = { key: 'h2h'|'spreads'|'totals'; outcomes: ESPNOutcome[] };
type ESPNRow = { start: string; home: string; away: string; books: { bookmaker: string; markets: ESPNMarket[] }[] };

function _norm(s:string){return String(s||'').toUpperCase().replace(/[^A-Z0-9 ]+/g,'').replace(/\s+/g,' ').trim();}
function _canonMLB(s:string){
  const n=_norm(s); const M:Record<string,string>={
    'D BACKS':'ARIZONA DIAMONDBACKS','DBACKS':'ARIZONA DIAMONDBACKS','D-BACKS':'ARIZONA DIAMONDBACKS',
    'BOSOX':'BOSTON RED SOX','RED SOX':'BOSTON RED SOX','WHITE SOX':'CHICAGO WHITE SOX','WHITESOX':'CHICAGO WHITE SOX','CHISOX':'CHICAGO WHITE SOX',
    'JAYS':'TORONTO BLUE JAYS','BLUE JAYS':'TORONTO BLUE JAYS','YANKEES':'NEW YORK YANKEES','YANKS':'NEW YORK YANKEES',
    'METS':'NEW YORK METS','HALOS':'LOS ANGELES ANGELS','ANGELS':'LOS ANGELES ANGELS','DODGERS':'LOS ANGELES DODGERS',
    'GUARDS':'CLEVELAND GUARDIANS','CARDS':'ST. LOUIS CARDINALS','ROX':'COLORADO ROCKIES','NATS':'WASHINGTON NATIONALS',
    "O'S":'BALTIMORE ORIOLES','OS':'BALTIMORE ORIOLES'
  };
  if (M[n]) return M[n];
  if (n.includes('SOX')) return n.includes('WHITE')?'CHICAGO WHITE SOX':'BOSTON RED SOX';
  return n;
}
function _canonSoccer(s:string){
  const n=_norm(s); const M:Record<string,string>={
    'MAN CITY':'MANCHESTER CITY','MAN U':'MANCHESTER UNITED','MAN UNITED':'MANCHESTER UNITED','SPURS':'TOTTENHAM HOTSPUR',
    'GUNNERS':'ARSENAL','HAMMERS':'WEST HAM UNITED','TOON':'NEWCASTLE UNITED','WOLVES':'WOLVERHAMPTON WANDERERS',
    'BRIGHTON':'BRIGHTON AND HOVE ALBION','LAFC':'LOS ANGELES FC','LA GALAXY':'LA GALAXY','RED BULLS':'NEW YORK RED BULLS',
    'NYCFC':'NEW YORK CITY FC','INTER MIAMI':'INTER MIAMI CF','SOUNDERS':'SEATTLE SOUNDERS FC','AUSTIN':'AUSTIN FC','CHARLOTTE':'CHARLOTTE FC'
  };
  return M[n] || n;
}
function _canon(league:string,name:string){
  const L=String(league||'').toUpperCase();
  return (L==='EPL'||L==='MLS') ? _canonSoccer(name) : _canonMLB(name);
}
function _leaguePath(league:string){
  switch(String(league).toUpperCase()){
    case 'MLB': return 'baseball/mlb';
    case 'NBA': return 'basketball/nba';
    case 'NHL': return 'hockey/nhl';
    case 'NFL': return 'football/nfl';
    case 'EPL': return 'soccer/eng.1';
    case 'MLS': return 'soccer/usa.1';
    default: return null;
  }
}
async function _fetchESPNRows(league:string, isoDate:string):Promise<ESPNRow[]>{
  const path=_leaguePath(league); if(!path) return [];
  const d = (isoDate||'').replace(/-/g,'');
  const url=`https://site.api.espn.com/apis/v2/sports/${path}/scoreboard?dates=${d}`;
  const res=await fetch(url,{headers:{accept:'application/json'}});
  if(!res.ok) return [];
  const data=await res.json();
  const events=data?.events||[];
  const out:ESPNRow[]=[];
  for(const ev of events){
    const comp=ev?.competitions?.[0]; if(!comp) continue;
    const cs=comp.competitors||[];
    const home=cs.find((c:any)=>c?.homeAway==='home')?.team?.displayName || cs[0]?.team?.displayName;
    const away=cs.find((c:any)=>c?.homeAway==='away')?.team?.displayName || cs[1]?.team?.displayName;
    const start=comp?.date||ev?.date;
    const books:any[]=[];
    for(const o of (comp?.odds||ev?.odds||[])){
      const bookmaker=o?.provider?.name||o?.provider?.displayName||'ESPN';
      const markets:any[]=[];
      if(o?.moneylineAway!=null && o?.moneylineHome!=null){
        markets.push({key:'h2h',outcomes:[
          {name:away,price:Number(o.moneylineAway)},
          {name:home,price:Number(o.moneylineHome)}
        ]});
      }
      if(o?.spread!=null){
        const s=Number(o.spread);
        markets.push({key:'spreads',outcomes:[
          {name:away,point:-s,price:Number(o?.awayTeamOdds?.moneyLine ?? NaN)},
          {name:home,point: s,price:Number(o?.homeTeamOdds?.moneyLine ?? NaN)}
        ]});
      }
      if(o?.overUnder!=null){
        const ou=Number(o.overUnder);
        markets.push({key:'totals',outcomes:[
          {name:'Over', point:ou, price:Number(o?.overOdds ?? NaN)},
          {name:'Under',point:ou, price:Number(o?.underOdds ?? NaN)}
        ]});
      }
      if(markets.length) books.push({bookmaker,markets});
    }
    out.push({start,home,away,books});
  }
  return out;
}
function _fmtPrice(p?:number){return typeof p==='number' && isFinite(p) ? (p>0?`+${p}`:`${p}`) : 'not yet'}
function _fmtPoint(x?:number){return typeof x==='number' && isFinite(x) ? (x>0?`+${x}`:`${x}`) : '—'}
// --- end ESPN quick client ---

// runtime flags from Site Variables or Vite env
function _readEnv(key:string){
  const map:Record<string,string>={FORCE_ESPN:'VITE_FORCE_ESPN',FORCE_ESPN_UNTIL:'VITE_FORCE_ESPN_UNTIL'};
  const w=(window as any)?.env?.[key]; let v:any; try{v=(import.meta as any)?.env?.[map[key]||key];}catch{}
  return w ?? v;
}
function _forceESPNFor(dateISO:string){
  if(_readEnv('FORCE_ESPN')==='1') return true;
  const until=_readEnv('FORCE_ESPN_UNTIL');
  if(!until) return false;
  try{
    const sel=DateTime.fromISO(dateISO).toISODate(); 
    return !!sel && sel <= until;
  }catch{return false;}
}

// Helper types
interface Row {
  time: string; // ISO UTC
  status: string; // lowercase
  home?: string;
  away?: string;
  venue?: string;
  league: string; // mlb|nhl|nba|nfl|mls|soccer
  gamePk?: string; // for MLB linking
  odds?: OddsData | null;
}

interface OddsData {
  sportKey: string;
  start: string;
  home: string;
  away: string;
  books: BookmakerData[];
}

interface BookmakerData {
  title?: string;
  key?: string;
  markets?: MarketData[];
}

interface MarketData {
  key?: string;
  market?: string;
  outcomes?: OutcomeData[];
}

interface OutcomeData {
  name: string;
  price: number;
  point?: number;
}

type Tab = 'live' | 'upcoming';

// Get environment variables (prefer proxy over direct API)
function getEnv(key: string): string | undefined {
  // Prefer Lovable Site Variables (window.env) but also read Vite env at build time
  const map: Record<string, string> = {
    ODDS_API_KEY: 'VITE_ODDS_API_KEY',
    SUPABASE_URL: 'VITE_SUPABASE_URL',
    ODDS_REGION: 'VITE_ODDS_REGION',
    ODDS_BOOKMAKERS: 'VITE_ODDS_BOOKMAKERS',
    FORCE_ESPN: 'VITE_FORCE_ESPN',
    FORCE_ESPN_UNTIL: 'VITE_FORCE_ESPN_UNTIL',
  };
  const viteKey = map[key] || key;
  const fromWindow = (window as any)?.env?.[key];
  let fromVite: string | undefined;
  try { fromVite = (import.meta as any)?.env?.[viteKey]; } catch { /* noop */ }
  return fromWindow ?? fromVite;
}

/* ESPN-only if FORCE_ESPN === '1' OR selected date <= FORCE_ESPN_UNTIL (YYYY-MM-DD) */
function shouldForceESPN(selectedISO: string): boolean {
  if (getEnv('FORCE_ESPN') === '1') return true;
  const until = getEnv('FORCE_ESPN_UNTIL');
  if (!until) return false;
  try {
    const sel = DateTime.fromISO(selectedISO).toISODate();
    return sel! <= until;
  } catch { return false; }
}

function todayYYYYMMDD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Status filters
function isLive(g: Row) {
  const s = (g.status || '').toLowerCase();
  return /live|in[- ]progress|period|quarter|top|bottom|half|ot|so/.test(s);
}
function isUpcoming(g: Row) {
  const s = (g.status || '').toLowerCase();
  return /scheduled|pre|preview|time tbd|warmup/.test(s);
}

function fmtLocal(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString([], {
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function normalizeName(name: string): string {
  return String(name || '').toUpperCase().replace(/[^A-Z0-9 ]+/g, '').replace(/\s+/g, ' ').trim();
}

function nicknameToken(name: string): string {
  const n = normalizeName(name);
  // Handle MLB nicknames like Yankees, Red Sox, Blue Jays, White Sox
  if (n.includes('YANKEES')) return 'YANKEES';
  if (n.includes('RED SOX')) return 'RED SOX';
  if (n.includes('BLUE JAYS')) return 'BLUE JAYS';
  if (n.includes('WHITE SOX')) return 'WHITE SOX';
  if (n.includes('DODGERS')) return 'DODGERS';
  if (n.includes('GIANTS')) return 'GIANTS';
  if (n.includes('METS')) return 'METS';
  if (n.includes('CUBS')) return 'CUBS';
  if (n.includes('PADRES')) return 'PADRES';
  if (n.includes('PHILLIES')) return 'PHILLIES';
  if (n.includes('BRAVES')) return 'BRAVES';
  if (n.includes('MARLINS')) return 'MARLINS';
  if (n.includes('NATIONALS')) return 'NATIONALS';
  if (n.includes('CARDINALS')) return 'CARDINALS';
  if (n.includes('BREWERS')) return 'BREWERS';
  if (n.includes('REDS')) return 'REDS';
  if (n.includes('PIRATES')) return 'PIRATES';
  if (n.includes('ASTROS')) return 'ASTROS';
  if (n.includes('RANGERS')) return 'RANGERS';
  if (n.includes('MARINERS')) return 'MARINERS';
  if (n.includes('ATHLETICS')) return 'ATHLETICS';
  if (n.includes('ANGELS')) return 'ANGELS';
  if (n.includes('TWINS')) return 'TWINS';
  if (n.includes('GUARDIANS')) return 'GUARDIANS';
  if (n.includes('TIGERS')) return 'TIGERS';
  if (n.includes('ROYALS')) return 'ROYALS';
  if (n.includes('ORIOLES')) return 'ORIOLES';
  if (n.includes('RAYS')) return 'RAYS';
  if (n.includes('BLUE JAYS')) return 'BLUE JAYS';
  if (n.includes('ROCKIES')) return 'ROCKIES';
  if (n.includes('DIAMONDBACKS')) return 'DIAMONDBACKS';
  // Return the last word as fallback
  const words = n.split(' ');
  return words[words.length - 1] || n;
}

function matchOdds(oddsList: OddsData[], away: string, home: string, league: string): OddsData | null {
  // Choose canonicalizer based on league
  const canon = (league === 'soccer' || league === 'mls') ? canonicalSoccer : canonicalMLB;
  for (const odds of oddsList) {
    if (canon(odds.away) === canon(away) && canon(odds.home) === canon(home)) {
      return odds;
    }
  }
  return null;
}

function matchESPNOdds(oddsList: NormalizedOddsRow[], away: string, home: string, league: string): NormalizedOddsRow | null {
  // Choose canonicalizer based on league  
  const canon = (league === 'soccer' || league === 'mls') ? canonicalSoccer : canonicalMLB;
  for (const odds of oddsList) {
    if (canon(odds.away) === canon(away) && canon(odds.home) === canon(home)) {
      return odds;
    }
  }
  return null;
}

function impliedProbability(american: number): number | null {
  if (!isFinite(american) || american === 0) return null;
  return american > 0 ? 100 / (american + 100) : (-american) / ((-american) + 100);
}

function formatPercent(prob: number | null): string {
  return prob ? `${(prob * 100).toFixed(1)}%` : '—';
}

const SPORT_KEYS: Record<string, string> = {
  nba: 'basketball_nba',
  nhl: 'icehockey_nhl',
  mlb: 'baseball_mlb',
  nfl: 'americanfootball_nfl',
  mls: 'soccer_usa_mls'
};

const ALL_LEAGUES = [
  { value: 'mlb', label: 'MLB' },
  { value: 'nhl', label: 'NHL' },
  { value: 'nba', label: 'NBA' },
  { value: 'nfl', label: 'NFL' },
  { value: 'mls', label: 'MLS' },
  { value: 'soccer', label: 'Soccer' },
] as const;

async function fetchScheduleForLeague(league: string, date: string, backend: string): Promise<Row[]> {
  if (backend) {
    const url = `${backend.replace(/\/$/, '')}/api/schedule?league=${encodeURIComponent(league)}&date=${encodeURIComponent(date)}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (Array.isArray(data)) {
      return data.map((item: any) => ({
        league,
        time: item.date_utc,
        status: String(item.status || '').toLowerCase(),
        home: item.home?.name,
        away: item.away?.name,
        venue: item.venue,
        gamePk: item.extras?.gamePk || item.game_id,
      }));
    }
    return [];
  }

  // Client fallback for MLB/NHL
  if (league === 'mlb') {
    const response = await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}`);
    if (!response.ok) return [];
    const data = await response.json();
    
    const results: Row[] = [];
    for (const dateEntry of data.dates || []) {
      for (const game of dateEntry.games || []) {
        results.push({
          league: 'mlb',
          time: game.gameDate,
          status: String(game.status?.detailedState || '').toLowerCase(),
          home: game.teams?.home?.team?.name,
          away: game.teams?.away?.team?.name,
          venue: game.venue?.name || '',
          gamePk: game.gamePk,
        });
      }
    }
    return results;
  }

  if (league === 'nhl') {
    const response = await fetch(`https://statsapi.web.nhl.com/api/v1/schedule?date=${date}`);
    if (!response.ok) return [];
    const data = await response.json();
    
    const results: Row[] = [];
    for (const dateEntry of data.dates || []) {
      for (const game of dateEntry.games || []) {
        results.push({
          league: 'nhl',
          time: game.gameDate,
          status: String(game.status?.detailedState || '').toLowerCase(),
          home: game.teams?.home?.team?.name,
          away: game.teams?.away?.team?.name,
          venue: game.venue?.name || '',
          gamePk: game.gamePk,
        });
      }
    }
    return results;
  }

  // Other leagues require backend
  return [];
}

async function fetchOddsForLeague(league: string, oddsProvider: string, oddsKey: string, oddsRegion: string, oddsBookmakers: string, soccerKeys: string[], date?: string): Promise<OddsData[]> {
  const keys = league === 'soccer' ? soccerKeys : [SPORT_KEYS[league]].filter(Boolean);
  if (!keys.length) return [];
  
  const results = await Promise.all(keys.map(async (sportKey) => {
    try {
      let url = new URL(`https://api.the-odds-api.com/v4/sports/${sportKey}/odds`);
      url.searchParams.set('regions', oddsRegion);
      url.searchParams.set('markets', 'h2h,spreads,totals');
      url.searchParams.set('oddsFormat', 'american');
      url.searchParams.set('dateFormat', 'iso');
      url.searchParams.set('bookmakers', oddsBookmakers);

      const supabaseUrl = getEnv('SUPABASE_URL') || '';
      if (supabaseUrl) {
        const p = new URL(supabaseUrl.replace(/\/$/, '') + '/functions/v1/odds-proxy');
        p.searchParams.set('sport', sportKey);
        p.searchParams.set('regions', oddsRegion);
        p.searchParams.set('markets', 'h2h,spreads,totals');
        p.searchParams.set('bookmakers', oddsBookmakers);
        url = p;
      } else {
        url.searchParams.set('apiKey', oddsKey);
      }
      
      console.log(`Fetching odds for ${sportKey}`);
      const response = await fetch(url.toString());
      
      if (response.ok) {
        const data = await response.json();
        console.log(`Odds rows ${league.toUpperCase()}: ${data.length}`);
        return (data || []).map((item: any) => ({
          sportKey,
          start: item.commence_time,
          home: item.home_team,
          away: item.away_team,
          books: item.bookmakers || [],
        }));
      }
      
      return [];
    } catch (error) {
      console.error(`Error fetching odds for ${sportKey}:`, error);
      return [];
    }
  }));
  
  const merged = results.flat();
  const lgMap: Record<string,string> = { mlb:'MLB', nba:'NBA', nhl:'NHL', nfl:'NFL', mls:'MLS', soccer:'EPL' };
  const sportLabel = lgMap[league] || league.toUpperCase();

  // ESPN for the requested date
  const dateFormatted = date || todayYYYYMMDD();
  const espnRows = await fetchESPNOdds(sportLabel, dateFormatted);

  // (A) Force ESPN for today (or until a given date)
  if (shouldForceESPN(dateFormatted) && espnRows.length) {
    console.log(`Force ESPN mode for ${league}: ${espnRows.length} rows`);
    return espnRows.map(r => ({ sportKey: keys[0] || '', start: r.start, home: r.home, away: r.away, books: r.books }));
  }

  // (B) Otherwise prefer primary; fallback to ESPN if primary empty
  if (merged.length) return merged;
  if (espnRows.length) {
    console.log(`ESPN fallback for ${league}: ${espnRows.length} rows`);
    return espnRows.map(r => ({ sportKey: keys[0] || '', start: r.start, home: r.home, away: r.away, books: r.books }));
  }
  return [];
}

// Updated formatter functions that use consensus
function formatConsensusML(primaryOdds: OddsData | null, espnOdds: NormalizedOddsRow | null, away: string, home: string): string {
  const lgMap: Record<string,string> = { mlb:"MLB", nba:"NBA", nhl:"NHL", nfl:"NFL", mls:"MLS", soccer:"EPL" };
  const sportLabel = 'MLB' as any; // Default to MLB for now
  
  const consensus = consensusRow(
    sportLabel,
    primaryOdds ? { start: primaryOdds.start, home: primaryOdds.home, away: primaryOdds.away, books: primaryOdds.books as any } : null,
    espnOdds
  );

  if (consensus?.hAway && consensus?.hHome) {
    const awayProb = impliedProbability(consensus.hAway.price);
    const homeProb = impliedProbability(consensus.hHome.price);
    const favPct = Math.max(awayProb || 0, homeProb || 0);

    return `
      <div class="relative p-2 border border-border rounded-lg" role="group" aria-label="Consensus moneyline">
        <div class="absolute inset-0 pointer-events-none rounded-lg bg-gradient-to-r from-yellow-400/20 to-transparent" style="width: ${(favPct * 100).toFixed(0)}%"></div>
        <div class="relative font-semibold">${consensus.hAway.price > 0 ? '+' : ''}${consensus.hAway.price} / ${consensus.hHome.price > 0 ? '+' : ''}${consensus.hHome.price}</div>
        <div class="relative text-xs opacity-90 flex gap-2 flex-wrap mt-1">
          <span>${formatPercent(awayProb)} / ${formatPercent(homeProb)}</span>
          <span class="px-2 py-0.5 border border-border rounded-full">${consensus.hAway.source}</span>
        </div>
      </div>`;
  }
  return 'not yet';
}

function formatConsensusSpread(primaryOdds: OddsData | null, espnOdds: NormalizedOddsRow | null): string {
  const lgMap: Record<string,string> = { mlb:"MLB", nba:"NBA", nhl:"NHL", nfl:"NFL", mls:"MLS", soccer:"EPL" };
  const sportLabel = 'MLB' as any; // Default to MLB for now
  
  const consensus = consensusRow(
    sportLabel,
    primaryOdds ? { start: primaryOdds.start, home: primaryOdds.home, away: primaryOdds.away, books: primaryOdds.books as any } : null,
    espnOdds
  );

  if (consensus?.spAway && consensus?.spHome) {
    return `
      <div class="relative p-2 border border-border rounded-lg" role="group" aria-label="Consensus spread">
        <div class="relative font-semibold">${consensus.spAway.point! > 0 ? '+' : ''}${consensus.spAway.point} (${consensus.spAway.price > 0 ? '+' : ''}${consensus.spAway.price}) / ${consensus.spHome.point! > 0 ? '+' : ''}${consensus.spHome.point} (${consensus.spHome.price > 0 ? '+' : ''}${consensus.spHome.price})</div>
        <div class="relative text-xs opacity-90 mt-1">
          <span class="px-2 py-0.5 border border-border rounded-full">${consensus.spAway.source}</span>
        </div>
      </div>`;
  }
  return 'not yet';
}

function formatConsensusTotal(primaryOdds: OddsData | null, espnOdds: NormalizedOddsRow | null): string {
  const lgMap: Record<string,string> = { mlb:"MLB", nba:"NBA", nhl:"NHL", nfl:"NFL", mls:"MLS", soccer:"EPL" };
  const sportLabel = 'MLB' as any; // Default to MLB for now
  
  const consensus = consensusRow(
    sportLabel,
    primaryOdds ? { start: primaryOdds.start, home: primaryOdds.home, away: primaryOdds.away, books: primaryOdds.books as any } : null,
    espnOdds
  );

  if (consensus?.tOver && consensus?.tUnder) {
    return `
      <div class="relative p-2 border border-border rounded-lg" role="group" aria-label="Consensus totals">
        <div class="relative font-semibold">O ${consensus.tOver.point} (${consensus.tOver.price > 0 ? '+' : ''}${consensus.tOver.price}) / U ${consensus.tUnder.point} (${consensus.tUnder.price > 0 ? '+' : ''}${consensus.tUnder.price})</div>
        <div class="relative text-xs opacity-90 flex gap-2 flex-wrap mt-1">
          <span class="px-2 py-0.5 border border-border rounded-full">${consensus.tOver.source}</span>
        </div>
      </div>`;
  }
  return 'not yet';
}

function formatBestMoneyline(odds: OddsData | null): string {
  if (!odds) return 'not yet';
  
  const h2hMarkets = odds.books.flatMap(book => 
    (book.markets || [])
      .filter(market => market.key === 'h2h' || market.market === 'h2h')
      .map(market => ({
        bookmaker: book.title || book.key || 'book',
        outcomes: market.outcomes || []
      }))
  );
  
  const awayOutcomes = h2hMarkets.flatMap(market => 
    market.outcomes
      .filter(outcome => /away|visitor/i.test(outcome.name) || market.outcomes.indexOf(outcome) === 0)
      .map(outcome => ({ ...outcome, bookmaker: market.bookmaker }))
  );
  
  const homeOutcomes = h2hMarkets.flatMap(market => 
    market.outcomes
      .filter(outcome => /home/i.test(outcome.name) || market.outcomes.indexOf(outcome) === 1)
      .map(outcome => ({ ...outcome, bookmaker: market.bookmaker }))
  );
  
  const bestAway = awayOutcomes.sort((a, b) => b.price - a.price)[0];
  const bestHome = homeOutcomes.sort((a, b) => b.price - a.price)[0];
  
  if (!bestAway || !bestHome) return 'not yet';
  
  const awayProb = impliedProbability(bestAway.price);
  const homeProb = impliedProbability(bestHome.price);
  const favPct = Math.max(awayProb || 0, homeProb || 0);
  
  function escapeHtml(text: string) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  return `
    <div class="relative p-2 border border-border rounded-lg" role="group" aria-label="Best moneyline across books">
      <div class="absolute inset-0 pointer-events-none rounded-lg bg-gradient-to-r from-yellow-400/20 to-transparent" style="width: ${(favPct * 100).toFixed(0)}%"></div>
      <div class="relative font-semibold">${bestAway.price > 0 ? '+' : ''}${bestAway.price} / ${bestHome.price > 0 ? '+' : ''}${bestHome.price}</div>
      <div class="relative text-xs opacity-90 flex gap-2 flex-wrap mt-1">
        <span>${formatPercent(awayProb)} / ${formatPercent(homeProb)}</span>
        <span class="px-2 py-0.5 border border-border rounded-full">${escapeHtml(bestAway.bookmaker)}</span>
        <span class="px-2 py-0.5 border border-border rounded-full">${escapeHtml(bestHome.bookmaker)}</span>
      </div>
    </div>`;
}

function formatBestSpread(odds: OddsData | null): string {
  if (!odds) return 'not yet';
  
  const spreadMarkets = odds.books.flatMap(book => 
    (book.markets || [])
      .filter(market => market.key === 'spreads' || market.market === 'spreads')
      .flatMap(market => 
        (market.outcomes || []).map(outcome => ({
          ...outcome,
          bookmaker: book.title || book.key || 'book'
        }))
      )
  );
  
  const bestSpread = spreadMarkets.sort((a, b) => b.price - a.price)[0];
  if (!bestSpread) return 'not yet';
  
  function escapeHtml(text: string) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  return `
    <div class="relative p-2 border border-border rounded-lg" role="group" aria-label="Best spread">
      <div class="absolute inset-0 pointer-events-none rounded-lg bg-gradient-to-r from-yellow-400/20 to-transparent" style="width: 100%"></div>
      <div class="relative font-semibold">${escapeHtml(bestSpread.name)} ${bestSpread.point != null ? escapeHtml(bestSpread.point.toString()) : ''} @ ${bestSpread.price > 0 ? '+' : ''}${bestSpread.price}</div>
      <div class="relative text-xs opacity-90 mt-1">
        <span class="px-2 py-0.5 border border-border rounded-full">${escapeHtml(bestSpread.bookmaker)}</span>
      </div>
    </div>`;
}

function formatBestTotal(odds: OddsData | null): string {
  if (!odds) return 'not yet';
  
  const totalMarkets = odds.books.flatMap(book => 
    (book.markets || [])
      .filter(market => market.key === 'totals' || market.market === 'totals')
      .flatMap(market => 
        (market.outcomes || []).map(outcome => ({
          ...outcome,
          bookmaker: book.title || book.key || 'book'
        }))
      )
  );
  
  const overOutcomes = totalMarkets.filter(outcome => /over/i.test(outcome.name));
  const underOutcomes = totalMarkets.filter(outcome => /under/i.test(outcome.name));
  
  const bestOver = overOutcomes.sort((a, b) => b.price - a.price)[0];
  const bestUnder = underOutcomes.sort((a, b) => b.price - a.price)[0];
  
  if (!bestOver && !bestUnder) return 'not yet';
  
  function escapeHtml(text: string) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  return `
    <div class="relative p-2 border border-border rounded-lg" role="group" aria-label="Best totals">
      <div class="absolute inset-0 pointer-events-none rounded-lg bg-gradient-to-r from-yellow-400/20 to-transparent" style="width: 100%"></div>
      <div class="relative font-semibold">
        ${bestOver ? `O ${bestOver.point} @ ${bestOver.price > 0 ? '+' : ''}${bestOver.price}` : ''} ${bestOver && bestUnder ? ' / ' : ''} ${bestUnder ? `U ${bestUnder.point} @ ${bestUnder.price > 0 ? '+' : ''}${bestUnder.price}` : ''}
      </div>
      <div class="relative text-xs opacity-90 flex gap-2 flex-wrap mt-1">
        ${bestOver ? `<span class="px-2 py-0.5 border border-border rounded-full">${escapeHtml(bestOver.bookmaker)}</span>` : ''}
        ${bestUnder ? `<span class="px-2 py-0.5 border border-border rounded-full">${escapeHtml(bestUnder.bookmaker)}</span>` : ''}
      </div>
    </div>`;
}

export default function SchedulesOddsWidget() {
  const [tab, setTab] = useState<Tab>('live');
  const [date, setDate] = useState<string>(todayYYYYMMDD());
  const [selected, setSelected] = useState<string[]>(['mlb', 'nhl']);
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [drawerData, setDrawerData] = useState<Row | null>(null);
  const [espnOdds, setEspnOdds] = useState<NormalizedOddsRow[]>([]);
  const timerRef = useRef<number | null>(null);

  const backend = useMemo(() => getEnv('BACKEND_URL') || '', []);
  const oddsProvider = useMemo(() => getEnv('ODDS_API_PROVIDER') || 'theoddsapi', []);
  const oddsKey = useMemo(() => getEnv('ODDS_API_KEY') || '', []);
  const oddsRegion = useMemo(() => getEnv('ODDS_REGION') || 'us', []);
  const oddsBookmakers = useMemo(() => getEnv('ODDS_BOOKMAKERS') || 'draftkings,betmgm,fanduel,caesars', []);
  const soccerKeys = useMemo(() => (getEnv('ODDS_SOCCER_KEYS') || 'soccer_usa_mls').split(',').map(s => s.trim()).filter(Boolean), []);
  
  const supabaseUrl = getEnv('SUPABASE_URL') || '';
  const hasProxy = !!supabaseUrl;
  const hasDirectKey = !!oddsKey;
  const showOddsWarning = !hasProxy && !hasDirectKey;

  useEffect(() => {
    reloadData();
    
    if (timerRef.current) clearInterval(timerRef.current);
    
    const interval = tab === 'live' ? 30000 : 120000; // 30s for live, 2min for upcoming
    timerRef.current = window.setInterval(reloadData, interval);
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, date, selected.join('|')]);

  async function reloadData() {
    setRows([]);
    setStatus('Loading…');
    setLoading(true);

    try {
      // Fetch schedules and odds in parallel
      const [scheduleResults, oddsResults] = await Promise.all([
        Promise.all(selected.map(league => fetchScheduleForLeague(league, date, backend))),
        Promise.all(selected.map(league => fetchOddsForLeague(league, oddsProvider, oddsKey, oddsRegion, oddsBookmakers, soccerKeys, date)))
      ]);

      const schedules = scheduleResults.flat();
      const oddsByLeague: Record<string, OddsData[]> = {};
      selected.forEach((league, index) => {
        oddsByLeague[league] = oddsResults[index];
      });

      // Fetch ESPN odds for consensus
      const lgMap: Record<string,string> = { mlb:'MLB', nba:'NBA', nhl:'NHL', nfl:'NFL', mls:'MLS', soccer:'EPL' };
      const espnOddsPromises = selected.map(league => 
        fetchESPNOdds(lgMap[league] || league.toUpperCase(), date)
      );
      const espnResults = await Promise.all(espnOddsPromises);
      const espnByLeague: Record<string, NormalizedOddsRow[]> = {};
      selected.forEach((league, index) => {
        espnByLeague[league] = espnResults[index];
      });
      setEspnOdds(espnResults.flat());

      // Merge schedules with odds
      let mergedRows = schedules.map(schedule => {
        const leagueOdds = oddsByLeague[schedule.league] || [];
        const matchedOdds = matchOdds(leagueOdds, schedule.away || '', schedule.home || '', schedule.league);
        return { ...schedule, odds: matchedOdds };
      });

      // If ESPN is forced for this date, fill the three columns from ESPN now.
      if (_forceESPNFor(date)) {
        const lgMap:Record<string,string>={ mlb:'MLB', nba:'NBA', nhl:'NHL', nfl:'NFL', mls:'MLS', soccer:'EPL' };
        
        // Process each league separately
        for (const league of selected) {
          const L = lgMap[league] || String(league).toUpperCase();
          const espnRows = await _fetchESPNRows(L, date);

          mergedRows = mergedRows.map((row:any) => {
            if (row.league !== league) return row;
            
            const A=_canon(L,row.away||''), H=_canon(L,row.home||'');
            const r = espnRows.find(x => _canon(L,x.away)===A && _canon(L,x.home)===H);
            if (!r) return { ...row, bestML:'not yet', bestSpread:'not yet', bestTotal:'not yet' };

            const get = (key:'h2h'|'spreads'|'totals') => (r.books||[])
              .flatMap(b => (b.markets||[]))
              .find(m => m.key===key);

            const h2h = get('h2h');
            const sp  = get('spreads');
            const tot = get('totals');

            const hAway = h2h?.outcomes?.find(o => _canon(L,o.name)===A);
            const hHome = h2h?.outcomes?.find(o => _canon(L,o.name)===H);
            const sAway = sp?.outcomes?.find(o => _canon(L,o.name)===A);
            const sHome = sp?.outcomes?.find(o => _canon(L,o.name)===H);
            const over  = tot?.outcomes?.find(o => /^over$/i.test(o.name));
            const under = tot?.outcomes?.find(o => /^under$/i.test(o.name));

            return {
              ...row,
              bestML: (hAway&&hHome) ? `${_fmtPrice(hAway.price)} / ${_fmtPrice(hHome.price)}` : 'not yet',
              bestSpread: (sAway&&sHome) ? `${_fmtPoint(sAway.point)} (${_fmtPrice(sAway.price)}) / ${_fmtPoint(sHome.point)} (${_fmtPrice(sHome.price)})` : 'not yet',
              bestTotal: (over&&under) ? `O ${_fmtPoint(over.point)} (${_fmtPrice(over.price)}) / U ${_fmtPoint(under.point)} (${_fmtPrice(under.price)})` : 'not yet',
            };
          });
        }

        // Optional tiny debug note in preview
        if (process.env.NODE_ENV !== 'production') {
          console.info('ESPN forced for', date);
        }
      }

      // Filter by tab
      const filtered = tab === 'live' 
        ? mergedRows.filter(isLive)
        : mergedRows.filter(isUpcoming);

      // Sort by time
      filtered.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

      setRows(filtered);
      setStatus(filtered.length ? `Loaded ${filtered.length} games.` : 'No games found.');
    } catch (error) {
      console.error('Error loading data:', error);
      setStatus('Error loading data.');
    } finally {
      setLoading(false);
    }
  }

  function toggleLeague(league: string) {
    setSelected(prev => 
      prev.includes(league) 
        ? prev.filter(l => l !== league)
        : [...prev, league]
    );
  }

  function openDrawer(row: Row) {
    setDrawerData(row);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setDrawerData(null);
  }

  return (
    <section className="py-16 px-4" aria-labelledby="schedules-odds-heading">
      <div className="container mx-auto">
        <header className="mb-6">
          <h2 id="schedules-odds-heading" className="text-3xl font-bold mb-2">
            <span className="bg-gradient-to-r from-primary to-warning bg-clip-text text-transparent">
              Schedules & Odds
            </span>
          </h2>
          <p className="text-muted-foreground">Live and upcoming games with real-time odds from top sportsbooks</p>
        </header>

        <article className="rounded-xl border border-border bg-card p-4 shadow-sm">
          {/* API Configuration Warning Banner */}
        {oddsProvider === 'theoddsapi' && !oddsKey && !getEnv('SUPABASE_URL') && (
          <div className="mb-4 rounded-md border border-yellow-600/30 bg-yellow-900/20 px-3 py-2 text-sm">
            <strong>Odds API key not configured.</strong> Schedules will load but odds will be disabled.
            Set <code>ODDS_API_KEY</code> (or <code>VITE_ODDS_API_KEY</code>) in <em>Project → Settings → Environment variables</em>,
            or set <code>SUPABASE_URL</code> and deploy the <code>odds-proxy</code> function to keep the key server-side.
          </div>
        )}
          
          {/* Development Debug Info */}
          {process.env.NODE_ENV !== 'production' && (
            <div className="mb-2 text-xs text-muted-foreground">
              Dev Info: Proxy={<b>{getEnv('SUPABASE_URL') ? '✓' : '✗'}</b>}, Direct Key={<b>{getEnv('ODDS_API_KEY') || getEnv('VITE_ODDS_API_KEY') ? '✓' : '✗'}</b>}
              <button
                className="ml-2 px-2 py-0.5 border rounded hover:bg-muted"
                onClick={async () => {
                  const u = (getEnv('SUPABASE_URL') || '').replace(/\/$/, '') + '/functions/v1/odds-proxy?sport=baseball_mlb&markets=h2h&regions=us';
                  try {
                    const res = await fetch(u);
                    alert('Proxy test: ' + res.status + ' - ' + (res.ok ? 'OK' : await res.text()));
                  } catch (err) {
                    alert('Proxy test failed: ' + err);
                  }
                }}
              >
                Test Proxy
              </button>
            </div>
          )}
          
          {/* Controls */}
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <label className="text-sm text-muted-foreground flex flex-col">
              Date
              <input
                type="date"
                className="mt-1 rounded-md border border-input bg-background px-3 py-2 text-foreground"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>

            <fieldset className="flex flex-col text-sm text-muted-foreground">
              <legend className="mb-1">Leagues</legend>
              <div className="flex flex-wrap gap-2">
                {ALL_LEAGUES.map((league) => (
                  <button
                    key={league.value}
                    type="button"
                    onClick={() => toggleLeague(league.value)}
                    className={`px-3 py-1 rounded-md border ${
                      selected.includes(league.value) 
                        ? 'bg-secondary text-foreground' 
                        : 'bg-background text-muted-foreground'
                    } hover:border-primary transition-colors`}
                    aria-pressed={selected.includes(league.value)}
                  >
                    {league.label}
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Tabs */}
            <nav className="flex gap-2" role="tablist" aria-label="Schedules tabs">
              <button
                role="tab"
                aria-selected={tab === 'live'}
                className={`px-3 py-2 rounded-md border ${
                  tab === 'live' 
                    ? 'outline outline-2 outline-primary' 
                    : 'hover:border-primary'
                }`}
                onClick={() => setTab('live')}
              >
                Live
              </button>
              <button
                role="tab"
                aria-selected={tab === 'upcoming'}
                className={`px-3 py-2 rounded-md border ${
                  tab === 'upcoming' 
                    ? 'outline outline-2 outline-primary' 
                    : 'hover:border-primary'
                }`}
                onClick={() => setTab('upcoming')}
              >
                Upcoming
              </button>
            </nav>

            <div className="ml-auto flex items-center gap-2">
              <div role="status" aria-live="polite" className="text-sm text-muted-foreground">
                {status}
              </div>
              <button
                type="button"
                onClick={reloadData}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm hover:border-primary"
              >
                Reload
              </button>
            </div>
          </div>

          <div className="relative overflow-x-auto">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/40">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" aria-label="Loading" />
              </div>
            )}
            
            <table className="w-full" aria-live="polite">
              <thead>
                <tr className="text-left text-sm text-muted-foreground">
                  <th className="py-2">Time (local)</th>
                  <th className="py-2">Away</th>
                  <th className="py-2">Home</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Best ML<br /><span className="text-xs">(Away / Home)</span></th>
                  <th className="py-2">Best Spread</th>
                  <th className="py-2">Best Total (O/U)</th>
                  <th className="py-2">Venue</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && !loading ? (
                  <tr>
                    <td className="py-6 text-sm text-muted-foreground" colSpan={8}>No games found.</td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr 
                      key={`${row.league}-${row.time}-${index}`} 
                      className="border-t border-border/60 cursor-pointer hover:bg-muted/30"
                      onClick={() => openDrawer(row)}
                    >
                      <td className="py-2">{fmtLocal(row.time)}</td>
                      <td className="py-2">{row.away || ''}</td>
                      <td className="py-2">{row.home || ''}</td>
                      <td className="py-2 capitalize">{row.status || ''}</td>
                      <td className="py-2">
                        {(row as any).bestML || formatConsensusML(
                          row.odds, 
                          matchESPNOdds(espnOdds.filter(e => e.sportKey === SPORT_KEYS[row.league]), row.away || '', row.home || '', row.league), 
                          row.away || '', 
                          row.home || ''
                        )}
                      </td>
                      <td className="py-2">
                        {(row as any).bestSpread || formatConsensusSpread(
                          row.odds, 
                          matchESPNOdds(espnOdds.filter(e => e.sportKey === SPORT_KEYS[row.league]), row.away || '', row.home || '', row.league)
                        )}
                      </td>
                      <td className="py-2">
                        {(row as any).bestTotal || formatConsensusTotal(
                          row.odds, 
                          matchESPNOdds(espnOdds.filter(e => e.sportKey === SPORT_KEYS[row.league]), row.away || '', row.home || '', row.league)
                        )}
                      </td>
                      <td className="py-2">{row.venue || ''}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>

        {/* Drawer for game details */}
        {drawerOpen && drawerData && (
          <div className="fixed inset-0 bg-black/50 z-50" onClick={closeDrawer}>
            <div 
              className="fixed bottom-0 left-0 right-0 bg-card border-t border-border rounded-t-lg p-6 max-h-[70vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold">{drawerData.away} @ {drawerData.home}</h3>
                  <p className="text-muted-foreground">
                    {fmtLocal(drawerData.time)} • {drawerData.venue} • {drawerData.league.toUpperCase()}
                  </p>
                </div>
                <button
                  onClick={closeDrawer}
                  className="text-muted-foreground hover:text-foreground px-3 py-1 border rounded"
                >
                  Close
                </button>
              </div>

              {drawerData.odds ? (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Moneyline</h4>
                    <div dangerouslySetInnerHTML={{ __html: formatBestMoneyline(drawerData.odds) }} />
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Spread</h4>
                    <div>{formatBestSpread(drawerData.odds)}</div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Total</h4>
                    <div>{formatBestTotal(drawerData.odds)}</div>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">No odds available for this game.</p>
              )}

              <div className="mt-4 pt-4 border-t border-border">
                {drawerData.league === 'mlb' && drawerData.gamePk && (
                  <a
                    href={`https://www.mlb.com/gameday/${drawerData.gamePk}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-3 py-1 border rounded text-sm hover:bg-muted"
                  >
                    MLB Gameday
                  </a>
                )}
                {drawerData.league === 'nhl' && (
                  <a
                    href={`https://www.nhl.com/scores/${formatDate(drawerData.time)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-3 py-1 border rounded text-sm hover:bg-muted"
                  >
                    NHL Scoreboard
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
