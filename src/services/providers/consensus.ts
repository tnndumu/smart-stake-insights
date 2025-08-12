import type { NormalizedBook, NormalizedOddsRow } from './types';

const MLB_SYNONYMS: Record<string,string> = {
  "D-BACKS":"ARIZONA DIAMONDBACKS","DBACKS":"ARIZONA DIAMONDBACKS","D BACKS":"ARIZONA DIAMONDBACKS",
  "DODGERS":"LOS ANGELES DODGERS","GIANTS":"SAN FRANCISCO GIANTS","PADRES":"SAN DIEGO PADRES",
  "CARDS":"ST. LOUIS CARDINALS","ROX":"COLORADO ROCKIES","REDSOX":"BOSTON RED SOX","RED SOX":"BOSTON RED SOX",
  "WHITESOX":"CHICAGO WHITE SOX","WHITE SOX":"CHICAGO WHITE SOX","BOSOX":"BOSTON RED SOX","CHISOX":"CHICAGO WHITE SOX",
  "JAYS":"TORONTO BLUE JAYS","BLUE JAYS":"TORONTO BLUE JAYS","NATS":"WASHINGTON NATIONALS",
  "O'S":"BALTIMORE ORIOLES","OS":"BALTIMORE ORIOLES","ORIOLES":"BALTIMORE ORIOLES",
  "YANKS":"NEW YORK YANKEES","YANKEES":"NEW YORK YANKEES","M'S":"SEATTLE MARINERS","MS":"SEATTLE MARINERS",
  "HALOS":"LOS ANGELES ANGELS","ANGELS":"LOS ANGELES ANGELS","GUARDS":"CLEVELAND GUARDIANS","RAYS":"TAMPA BAY RAYS",
  "BREWERS":"MILWAUKEE BREWERS","BUCS":"PITTSBURGH PIRATES","PHILS":"PHILADELPHIA PHILLIES"
};

export function norm(s: string) {
  return String(s||'').toUpperCase().replace(/[^A-Z0-9 ]+/g,'').replace(/\s+/g,' ').trim();
}

export function canonicalMLB(s: string) {
  const n = norm(s); 
  return MLB_SYNONYMS[n] || (n.includes('SOX') && !MLB_SYNONYMS[n] ? (n.includes('WHITE')?'CHICAGO WHITE SOX':'BOSTON RED SOX') : n);
}

type Price = { price: number; point?: number; source: string };
const BOOK_KEYS = ['fanduel','draftkings','betmgm','caesars'];

function collectPrices(books: NormalizedBook[], teamName: string, market: 'h2h'|'spreads'|'totals'): Price[] {
  const out: Price[] = [];
  for (const b of books) {
    const source = (b.bookmaker || b.key || '').toString().toLowerCase();
    const markets = b.markets || [];
    const m = markets.find(m => m.key === market);
    if (!m) continue;
    if (market === 'totals') {
      for (const o of m.outcomes||[]) {
        if (/^over$/i.test(o.name) || /^under$/i.test(o.name)) out.push({ price: Number(o.price), point: o.point, source });
      }
    } else {
      const t = (m.outcomes||[]).find(o => canonicalMLB(o.name) === canonicalMLB(teamName));
      if (t && isFinite(Number(t.price))) out.push({ price: Number(t.price), point: t.point, source });
    }
  }
  return out;
}

function cluster<T extends Price>(arr: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const p of arr) {
    const key = (p.point!=null ? `${p.point}` : '') + `@${p.price}`;
    const list = map.get(key) || []; list.push(p); map.set(key, list);
  }
  return map;
}

export function consensusForTeam(teamName: string, primary: NormalizedBook[], espn: NormalizedBook[], market: 'h2h'|'spreads'|'totals') {
  const primaryFiltered = primary.filter(b => BOOK_KEYS.includes((b.bookmaker||b.key||'').toString().toLowerCase()));
  const all = [
    ...collectPrices(primaryFiltered, teamName, market),
    ...collectPrices(espn, teamName, market).map(x => ({...x, source:'espn'}))
  ];
  if (!all.length) return null;
  const buckets = [...cluster(all).values()].sort((a,b)=>b.length-a.length);
  const top = buckets[0];
  // need 2 or more sources to agree
  if (top.length >= 2) return top[0];
  return null;
}

export function consensusRow(rowPrimary: NormalizedOddsRow|null, rowESPN: NormalizedOddsRow|null) {
  if (!rowPrimary && !rowESPN) return null;
  const home = (rowPrimary||rowESPN)!.home;
  const away = (rowPrimary||rowESPN)!.away;
  const pb = rowPrimary?.books || [];
  const eb = rowESPN?.books || [];
  const h2hHome = consensusForTeam(home, pb, eb, 'h2h');
  const h2hAway = consensusForTeam(away, pb, eb, 'h2h');
  const spHome = consensusForTeam(home, pb, eb, 'spreads');
  const spAway = consensusForTeam(away, pb, eb, 'spreads');
  const totOver = consensusForTeam('Over', pb, eb, 'totals');
  const totUnder = consensusForTeam('Under', pb, eb, 'totals');
  return { home, away, h2hHome, h2hAway, spHome, spAway, totOver, totUnder };
}