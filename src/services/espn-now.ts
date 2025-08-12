// Lightweight ESPN scoreboard client used when "force ESPN" is on.
export type ESPNBookOutcome = { name: string; price: number; point?: number };
export type ESPNBookMarket = { key: 'h2h'|'spreads'|'totals'; outcomes: ESPNBookOutcome[] };
export type ESPNRow = { start: string; home: string; away: string; books: { bookmaker: string; markets: ESPNBookMarket[] }[] };

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

function norm(s:string){return String(s||'').toUpperCase().replace(/[^A-Z0-9 ]+/g,'').replace(/\s+/g,' ').trim();}
function canonMLB(s:string){
  const n=norm(s);
  const map:Record<string,string>={
    'D BACKS':'ARIZONA DIAMONDBACKS','DBACKS':'ARIZONA DIAMONDBACKS','D-BACKS':'ARIZONA DIAMONDBACKS',
    'RED SOX':'BOSTON RED SOX','BOSOX':'BOSTON RED SOX','WHITE SOX':'CHICAGO WHITE SOX','WHITESOX':'CHICAGO WHITE SOX','CHISOX':'CHICAGO WHITE SOX',
    'BLUE JAYS':'TORONTO BLUE JAYS','JAYS':'TORONTO BLUE JAYS','YANKEES':'NEW YORK YANKEES','YANKS':'NEW YORK YANKEES',
    'METS':'NEW YORK METS','HALOS':'LOS ANGELES ANGELS','ANGELS':'LOS ANGELES ANGELS','DODGERS':'LOS ANGELES DODGERS',
    'GUARDS':'CLEVELAND GUARDIANS','CARDS':'ST. LOUIS CARDINALS','ROX':'COLORADO ROCKIES','NATS':'WASHINGTON NATIONALS',
    "O'S":'BALTIMORE ORIOLES','OS':'BALTIMORE ORIOLES'
  };
  if (map[n]) return map[n];
  if (n.includes('SOX')) return n.includes('WHITE')?'CHICAGO WHITE SOX':'BOSTON RED SOX';
  return n;
}
function canonSoccer(s:string){
  const n=norm(s);
  const map:Record<string,string>={
    'MAN CITY':'MANCHESTER CITY','MAN U':'MANCHESTER UNITED','MAN UNITED':'MANCHESTER UNITED','SPURS':'TOTTENHAM HOTSPUR',
    'GUNNERS':'ARSENAL','HAMMERS':'WEST HAM UNITED','TOON':'NEWCASTLE UNITED','WOLVES':'WOLVERHAMPTON WANDERERS',
    'BRIGHTON':'BRIGHTON AND HOVE ALBION','LAFC':'LOS ANGELES FC','LA GALAXY':'LA GALAXY','RED BULLS':'NEW YORK RED BULLS',
    'NYCFC':'NEW YORK CITY FC','INTER MIAMI':'INTER MIAMI CF','SOUNDERS':'SEATTLE SOUNDERS FC','AUSTIN':'AUSTIN FC','CHARLOTTE':'CHARLOTTE FC'
  };
  return map[n] || n;
}

export function canonical(league:string, name:string){
  const L=league.toUpperCase(); return (L==='EPL'||L==='MLS')?canonSoccer(name):canonMLB(name);
}

export async function fetchESPNRows(league: string, dateYYYYMMDD: string): Promise<ESPNRow[]> {
  const path = leagueToPath(league); if (!path) return [];
  const d = String(dateYYYYMMDD||'').replace(/-/g,'');
  const url = `https://site.api.espn.com/apis/v2/sports/${path}/scoreboard?dates=${d}`;
  const res = await fetch(url, { headers: { 'accept': 'application/json' } });
  if (!res.ok) return [];
  const data = await res.json();
  const events = data?.events || [];
  const out: ESPNRow[] = [];
  for (const ev of events) {
    const comp = ev?.competitions?.[0]; if (!comp) continue;
    const cs = comp.competitors || [];
    const home = cs.find((c:any)=>c?.homeAway==='home')?.team?.displayName || cs[0]?.team?.displayName;
    const away = cs.find((c:any)=>c?.homeAway==='away')?.team?.displayName || cs[1]?.team?.displayName;
    const start = comp?.date || ev?.date;

    const books:any[] = [];
    for (const o of (comp?.odds || ev?.odds || [])) {
      const bookmaker = o?.provider?.name || o?.provider?.displayName || 'ESPN';
      const markets:any[] = [];
      if (o?.moneylineAway != null && o?.moneylineHome != null) {
        markets.push({ key:'h2h', outcomes:[
          { name: away, price: Number(o.moneylineAway) },
          { name: home, price: Number(o.moneylineHome) },
        ]});
      }
      if (o?.spread != null) {
        const s = Number(o.spread);
        markets.push({ key:'spreads', outcomes:[
          { name: away, point: -s, price: Number(o?.awayTeamOdds?.moneyLine ?? NaN) },
          { name: home, point:  s, price: Number(o?.homeTeamOdds?.moneyLine ?? NaN) },
        ]});
      }
      if (o?.overUnder != null) {
        const ou = Number(o.overUnder);
        markets.push({ key:'totals', outcomes:[
          { name:'Over',  point: ou, price: Number(o?.overOdds ?? NaN) },
          { name:'Under', point: ou, price: Number(o?.underOdds ?? NaN) },
        ]});
      }
      if (markets.length) books.push({ bookmaker, markets });
    }
    out.push({ start, home, away, books });
  }
  return out;
}

export function extractESPNFor(league:string, rows:ESPNRow[], away:string, home:string){
  const A = canonical(league, away), H = canonical(league, home);
  const row = rows.find(r => canonical(league, r.away)===A && canonical(league, r.home)===H);
  if (!row) return null;
  const books = row.books||[];
  const find = (key:'h2h'|'spreads'|'totals') => (books.find(b=>b.markets?.some((m:any)=>m.key===key))?.markets||[]).find((m:any)=>m.key===key);
  const h2h = find('h2h');
  const sp  = find('spreads');
  const tot = find('totals');

  const fmt = (p?:number)=> (typeof p==='number' ? (p>0?`+${p}`:`${p}`) : 'not yet');
  const fpt = (x?:number)=> (typeof x==='number' ? (x>0?`+${x}`:`${x}`) : '—');

  const hAway = h2h?.outcomes?.find((o:any)=>canonical(league,o.name)===A);
  const hHome = h2h?.outcomes?.find((o:any)=>canonical(league,o.name)===H);

  const sAway = sp?.outcomes?.find((o:any)=>canonical(league,o.name)===A);
  const sHome = sp?.outcomes?.find((o:any)=>canonical(league,o.name)===H);

  const over  = tot?.outcomes?.find((o:any)=>/^over$/i.test(o.name));
  const under = tot?.outcomes?.find((o:any)=>/^under$/i.test(o.name));

  return {
    ml: (hAway && hHome) ? `${fmt(hAway.price)} / ${fmt(hHome.price)}` : 'not yet',
    spread: (sAway && sHome) ? `${fpt(sAway.point)} (${fmt(sAway.price)}) / ${fpt(sHome.point)} (${fmt(sHome.price)})` : 'not yet',
    total: (over && under) ? `O ${fpt(over.point)} (${fmt(over.price)}) / U ${fpt(under.point)} (${fmt(under.price)})` : 'not yet'
  };
}