import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, TrendingUp, Target, Calendar, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchLiveGames, fetchUpcomingGames } from "@/services/leagues/all";
import { predict } from "@/services/predict";
import { DateTime } from "luxon";
import { formatAmerican, formatPoint, isBetterPrice } from "@/utils/odds";
import { useParlay } from "@/state/parlay";

// --- Live odds helpers (proxy + fallback) ---
function envVar(key: string): string | undefined {
  const map: Record<string,string> = {
    SUPABASE_URL: "VITE_SUPABASE_URL",
    ODDS_REGION: "VITE_ODDS_REGION",
    ODDS_BOOKMAKERS: "VITE_ODDS_BOOKMAKERS",
    ODDS_API_KEY: "VITE_ODDS_API_KEY",
  };
  const w = (window as any)?.env?.[key];
  let v: any; try { v = (import.meta as any)?.env?.[map[key] || key]; } catch {}
  return w ?? v;
}
function sportKeyForLeague(league: string) {
  switch (league.toUpperCase()) {
    case "MLB": return "baseball_mlb";
    case "NBA": return "basketball_nba";
    case "NHL": return "icehockey_nhl";
    case "NFL": return "americanfootball_nfl";
    case "EPL": return "soccer_epl";
    case "MLS": return "soccer_usa_mls";
    default: return "";
  }
}
function normNamePS(s: string) {
  return String(s||"").toUpperCase().replace(/[^A-Z0-9 ]+/g,"").replace(/\s+/g," ").trim();
}
// MLB nicknames so rows match
function nicknameTokenPS(s: string) {
  const n = normNamePS(s);
  const map: Record<string,string> = {
    "D BACKS":"ARIZONA DIAMONDBACKS","DBACKS":"ARIZONA DIAMONDBACKS","D-BACKS":"ARIZONA DIAMONDBACKS",
    "BOSOX":"BOSTON RED SOX","RED SOX":"BOSTON RED SOX",
    "WHITESOX":"CHICAGO WHITE SOX","WHITE SOX":"CHICAGO WHITE SOX","CHISOX":"CHICAGO WHITE SOX",
    "JAYS":"TORONTO BLUE JAYS","BLUE JAYS":"TORONTO BLUE JAYS",
    "YANKS":"NEW YORK YANKEES","YANKEES":"NEW YORK YANKEES","METS":"NEW YORK METS",
    "HALOS":"LOS ANGELES ANGELS","ANGELS":"LOS ANGELES ANGELS","DODGERS":"LOS ANGELES DODGERS",
    "GUARDS":"CLEVELAND GUARDIANS","CARDS":"ST. LOUIS CARDINALS","ROX":"COLORADO ROCKIES",
    "NATS":"WASHINGTON NATIONALS","OS":"BALTIMORE ORIOLES","O S":"BALTIMORE ORIOLES","O'S":"BALTIMORE ORIOLES"
  };
  if (map[n]) return map[n];
  if (n.includes("SOX")) return n.includes("WHITE") ? "CHICAGO WHITE SOX" : "BOSTON RED SOX";
  return n.split(" ").slice(-1)[0]; // fallback: nickname word (Yankees, Mets, etc.)
}
type OddsOutcome = { name: string; price: number; point?: number };
type OddsMarket = { key: string; outcomes: OddsOutcome[] };
type OddsBook = { key?: string; bookmaker?: string; title?: string; markets: OddsMarket[] };
type OddsRow = { sportKey?: string; start: string; home: string; away: string; books: OddsBook[] };

function matchOddsPS(list: OddsRow[], away: string, home: string): OddsRow | null {
  const a = normNamePS(away), h = normNamePS(home);
  const an = nicknameTokenPS(away), hn = nicknameTokenPS(home);
  for (const row of list) {
    const ra = normNamePS(row.away), rh = normNamePS(row.home);
    const ran = nicknameTokenPS(row.away), rhn = nicknameTokenPS(row.home);
    const strong = (ra.includes(a) && rh.includes(h)) || (a.includes(ra) && h.includes(rh));
    const nick = ran === an && rhn === hn;
    if (strong || nick) return row;
  }
  return null;
}
function impliedProb(price: number) {
  // american odds → implied %
  return price > 0 ? 100 / (price + 100) : (-price) / ((-price) + 100);
}

async function fetchLeagueOddsPS(league: string, dateYYYYMMDD: string): Promise<OddsRow[]> {
  const sportKey = sportKeyForLeague(league);
  const region = envVar("ODDS_REGION") || "us";
  const bookmakers = envVar("ODDS_BOOKMAKERS") || "draftkings,betmgm,fanduel,caesars";
  const supabaseUrl = envVar("SUPABASE_URL");

  let url: URL;
  if (supabaseUrl) {
    // secure proxy path
    url = new URL(supabaseUrl.replace(/\/$/,"") + "/functions/v1/odds-proxy");
    url.searchParams.set("sport", sportKey);
  } else {
    // direct vendor only for dev
    url = new URL(`https://api.the-odds-api.com/v4/sports/${sportKey}/odds`);
    const key = envVar("ODDS_API_KEY"); if (key) url.searchParams.set("apiKey", key);
  }
  url.searchParams.set("regions", region);
  url.searchParams.set("bookmakers", bookmakers);
  url.searchParams.set("markets", "h2h,spreads,totals");
  url.searchParams.set("oddsFormat", "american");
  url.searchParams.set("dateFormat", "iso");

  const res = await fetch(url.toString());
  return res.ok ? await res.json() : [];
}

// ESPN fallback (lightweight; same returns shape)
async function fetchESPNFallbackPS(league: string, dateYYYYMMDD: string): Promise<OddsRow[]> {
  const lgMap: Record<string,string> = { MLB:"baseball/mlb", NBA:"basketball/nba", NHL:"hockey/nhl", NFL:"football/nfl", EPL:"soccer/eng.1", MLS:"soccer/usa.1" };
  const path = lgMap[league.toUpperCase()]; if (!path) return [];
  const d = (dateYYYYMMDD || "").replace(/-/g,"");
  const url = `https://site.api.espn.com/apis/v2/sports/${path}/scoreboard?dates=${d}`;
  try {
    const r = await fetch(url); if (!r.ok) return [];
    const data = await r.json();
    const evs = data?.events || [];
    const out: OddsRow[] = [];
    for (const ev of evs) {
      const comp = ev?.competitions?.[0]; if (!comp) continue;
      const cs = comp?.competitors || [];
      const home = cs.find((c:any)=>c?.homeAway==='home')?.team?.displayName || cs[0]?.team?.displayName;
      const away = cs.find((c:any)=>c?.homeAway==='away')?.team?.displayName || cs[1]?.team?.displayName;
      const start = comp?.date || ev?.date;
      const books: OddsBook[] = [];
      for (const o of (comp?.odds || ev?.odds || [])) {
        const book = o?.provider?.name || o?.provider?.displayName || "ESPN";
        const mkts: OddsMarket[] = [];
        if (o?.moneylineAway != null && o?.moneylineHome != null) {
          mkts.push({ key:"h2h", outcomes:[
            { name: away, price: Number(o.moneylineAway) },
            { name: home, price: Number(o.moneylineHome) },
          ]});
        }
        if (o?.spread != null) {
          const s = Number(o.spread);
          mkts.push({ key:"spreads", outcomes:[
            { name: away, point: -s, price: Number(o?.awayTeamOdds?.moneyLine ?? NaN) },
            { name: home, point:  s, price: Number(o?.homeTeamOdds?.moneyLine ?? NaN) },
          ]});
        }
        if (o?.overUnder != null) {
          const ou = Number(o.overUnder);
          mkts.push({ key:"totals", outcomes:[
            { name:"Over",  point: ou, price: Number(o?.overOdds ?? NaN) },
            { name:"Under", point: ou, price: Number(o?.underOdds ?? NaN) },
          ]});
        }
        if (mkts.length) books.push({ bookmaker: book, markets: mkts });
      }
      out.push({ start, home, away, books });
    }
    return out;
  } catch { return []; }
}

function bestH2H(row: OddsRow, team: string) {
  const t = nicknameTokenPS(team);
  let best: { price: number; book: string } | null = null;
  for (const b of (row.books || [])) {
    const m = (b.markets || []).find(m => m.key === "h2h");
    const o = m?.outcomes?.find(o => nicknameTokenPS(o.name) === t);
    if (o && Number.isFinite(o.price)) {
      if (!best || o.price > best.price) best = { price: o.price, book: b.bookmaker || b.key || "book" };
    }
  }
  return best;
}

function pickBestSpread(row: OddsRow | null) {
  if (!row) return null;
  let bestHome: any = null, bestAway: any = null;
  for (const b of row.books) {
    for (const m of (b.markets || []).filter(m => m.key === 'spreads')) {
      for (const o of m.outcomes || []) {
        const isHome = normNamePS(o.name) === normNamePS(row.home);
        const entry = { price: o.price, point: o.point, book: (b.bookmaker || b.key || '').toString() };
        const prev = isHome ? bestHome : bestAway;
        const prevProb = prev ? (impliedProb(prev.price) ?? 1) : 1;
        const nowProb = impliedProb(o.price) ?? 1;
        if (!prev || nowProb < prevProb) {
          if (isHome) bestHome = entry; else bestAway = entry;
        }
      }
    }
  }
  return { home: bestHome, away: bestAway };
}

function pickBestTotal(row: OddsRow | null) {
  if (!row) return null;
  let bestOver: any = null, bestUnder: any = null;
  for (const b of row.books) {
    for (const m of (b.markets || []).filter(m => m.key === 'totals')) {
      for (const o of m.outcomes || []) {
        const isOver = /OVER/i.test(o.name);
        const entry = { price: o.price, point: o.point, book: (b.bookmaker || b.key || '').toString() };
        const prev = isOver ? bestOver : bestUnder;
        const prevProb = prev ? (impliedProb(prev.price) ?? 1) : 1;
        const nowProb = impliedProb(o.price) ?? 1;
        if (!prev || nowProb < prevProb) {
          if (isOver) bestOver = entry; else bestUnder = entry;
        }
      }
    }
  }
  return { over: bestOver, under: bestUnder };
}

function buildBookTable(row: OddsRow | null) {
  if (!row) return [];
  const table: Array<any> = [];
  for (const b of row.books) {
    const rec: any = { book: (b.bookmaker || b.key || '').toString() };
    const byKey: Record<string, any> = {};
    for (const m of (b.markets || [])) {
      byKey[m.key] = m;
    }
    const ml = byKey['h2h'];
    if (ml) {
      for (const o of (ml.outcomes || [])) {
        if (normNamePS(o.name) === normNamePS(row.home)) rec.mlHome = o.price;
        if (normNamePS(o.name) === normNamePS(row.away)) rec.mlAway = o.price;
      }
    }
    const sp = byKey['spreads'];
    if (sp) {
      for (const o of (sp.outcomes || [])) {
        if (normNamePS(o.name) === normNamePS(row.home)) { rec.spHome = o.price; rec.spHomePt = o.point; }
        if (normNamePS(o.name) === normNamePS(row.away)) { rec.spAway = o.price; rec.spAwayPt = o.point; }
      }
    }
    const tot = byKey['totals'];
    if (tot) {
      for (const o of (tot.outcomes || [])) {
        if (/OVER/i.test(o.name)) { rec.over = o.price; rec.overPt = o.point; }
        if (/UNDER/i.test(o.name)) { rec.under = o.price; rec.underPt = o.point; }
      }
    }
    table.push(rec);
  }
  table.sort((a,b) => {
    const ap = impliedProb(a.mlHome ?? 0) ?? 1;
    const bp = impliedProb(b.mlHome ?? 0) ?? 1;
    return ap - bp;
  });
  return table;
}

// Helper functions for modal table rendering
function fmtPrice(p?: number) { return typeof p === "number" ? (p>0?`+${p}`:`${p}`) : "not yet"; }
function fmtPoint(x?: number) { return typeof x === "number" ? (x>0?`+${x}`:`${x}`) : "—"; }
function findMarket(b:any, key:string){ return (b.markets||[]).find((m:any)=>m.key===key); }
function findTeam(m:any, name:string){ return (m?.outcomes||[]).find((o:any)=>nicknameTokenPS(o.name)===nicknameTokenPS(name)); }

// Extract the best prices across books:
function bestMLFor(row: any, team: "away"|"home") {
  let best: number | undefined;
  for (const b of (row?.books||[])) {
    const m = (b.markets||[]).find((x:any)=>x.key==="h2h");
    const o = m?.outcomes?.find((o:any)=>o.name && o.name.toUpperCase().includes(team==="away" ? row.away.toUpperCase().split(" ").slice(-1)[0] : row.home.toUpperCase().split(" ").slice(-1)[0]));
    if (!o || !Number.isFinite(o.price)) continue;
    if (best === undefined || isBetterPrice(o.price, best)) best = o.price;
  }
  return best;
}
function bestSpreadFor(row:any, team:"away"|"home") {
  let best: { price:number, point?:number } | undefined;
  for (const b of (row?.books||[])) {
    const m = (b.markets||[]).find((x:any)=>x.key==="spreads");
    const o = m?.outcomes?.find((o:any)=>o.name && o.name.toUpperCase().includes(team==="away" ? row.away.toUpperCase().split(" ").slice(-1)[0] : row.home.toUpperCase().split(" ").slice(-1)[0]));
    if (!o || !Number.isFinite(o.price)) continue;
    if (!best || isBetterPrice(o.price, best.price)) best = { price:o.price, point:o.point };
  }
  return best;
}
function bestTotals(row:any) {
  let over: { price:number, point?:number } | undefined;
  let under: { price:number, point?:number } | undefined;
  for (const b of (row?.books||[])) {
    const m = (b.markets||[]).find((x:any)=>x.key==="totals");
    const o = m?.outcomes || [];
    const O = o.find((x:any)=>/^over$/i.test(x.name));
    const U = o.find((x:any)=>/^under$/i.test(x.name));
    if (O && Number.isFinite(O.price) && (!over || isBetterPrice(O.price, over.price))) over = { price:O.price, point:O.point };
    if (U && Number.isFinite(U.price) && (!under || isBetterPrice(U.price, under.price))) under = { price:U.price, point:U.point };
  }
  return { over, under };
}

// --- end helpers ---

const PredictionsSection = () => {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<any | null>(null);
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasAnyResults, setHasAnyResults] = useState(false);
  const { add } = useParlay();

  useEffect(() => {
    let alive = true;
    let loadingTimeout: NodeJS.Timeout;
    const accumulatedGames: any[] = [];

    // Stop loading after 2 seconds or when first results arrive
    loadingTimeout = setTimeout(() => {
      if (alive && !hasAnyResults) {
        setLoading(false);
      }
    }, 2000);

    const handleLeagueComplete = async (leagueName: string, games: any[]) => {
      if (!alive) return;
      
      const nowISO = DateTime.now().toUTC().toISO();
      const gamesWithPredictions = games
        .filter((g: any) => !g.startUtc || g.startUtc >= nowISO)
        .map((g: any) => ({ ...g, prediction: predict(g) }));
      
      accumulatedGames.push(...gamesWithPredictions);
      
      // date used for odds
      const dateISO = DateTime.now().toISODate()!;
      const league = leagueName;
      let rows = await fetchLeagueOddsPS(league, dateISO);
      if (!rows || !rows.length) rows = await fetchESPNFallbackPS(league, dateISO);
      console.debug("predictions modal odds rows", league, rows?.length || 0);

      // ...for each game g = { away, home, ... } attach market info:
      const withOdds = [...accumulatedGames].map(g => {
        const matched = matchOddsPS(rows, g.away, g.home);

        let market: any = null;
        if (matched) {
          const homeBest = bestH2H(matched, g.home);
          const awayBest = bestH2H(matched, g.away);
          market = {
            homePrice: homeBest?.price,
            awayPrice: awayBest?.price,
            homeProb: homeBest ? impliedProb(homeBest.price) : null,
            awayProb: awayBest ? impliedProb(awayBest.price) : null,
            homeBook: homeBest?.book,
            awayBook: awayBest?.book,
            raw: matched, // <- keep full row for book-by-book table
          };
        }
        
        return { ...g, market, marketMatched: matched };
      });
      
      const sortedWithOdds = withOdds
        .sort((a, b) => new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime())
        .slice(0, 6);
      
      setCards(sortedWithOdds);
      
      if (!hasAnyResults && gamesWithPredictions.length > 0) {
        setHasAnyResults(true);
        setLoading(false);
        clearTimeout(loadingTimeout);
      }
    };

    (async () => {
      try {
        // Load live games first
        const live = await fetchLiveGames();
        if (alive && live.all.length > 0) {
          const liveWithPredictions = live.all.map((g: any) => ({ ...g, prediction: predict(g) }));
          accumulatedGames.push(...liveWithPredictions);
          setCards([...accumulatedGames].slice(0, 6));
          setHasAnyResults(true);
          setLoading(false);
          clearTimeout(loadingTimeout);
        }

        // Then load upcoming games with incremental updates (changed from 30 to 7 days)
        await fetchUpcomingGames({ 
          days: 7, 
          onLeagueComplete: handleLeagueComplete 
        });
        
        if (alive && !hasAnyResults) {
          setLoading(false);
        }
      } catch (e: any) {
        if (alive) {
          setError(e?.message || 'Failed to load games');
          setLoading(false);
        }
      }
    })();

    return () => { 
      alive = false; 
      clearTimeout(loadingTimeout);
    };
  }, [hasAnyResults]);

  if (loading) {
    return (
      <section className="py-16 px-4" id="predictions">
        <div className="container mx-auto">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading official games...</p>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="py-16 px-4" id="predictions">
        <div className="container mx-auto">
          <div className="text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 px-4" id="predictions">
      <div className="container mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">
            <span className="bg-gradient-to-r from-primary to-warning bg-clip-text text-transparent">
              Latest Predictions
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Expert analysis and data-driven predictions for today's biggest games
          </p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
          {cards.map((prediction) => (
            <Card key={`${prediction.league}-${prediction.id}`} className="p-6 bg-gradient-to-br from-card to-secondary/30 border-border/50 hover:border-primary/50 transition-all duration-300 group">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <Badge variant="secondary" className="text-xs">
                    {prediction.league}
                  </Badge>
                  <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>{DateTime.fromISO(prediction.startUtc).toFormat('LLL d')}</span>
                  </div>
                  <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{DateTime.fromISO(prediction.startUtc).toFormat('h:mm a')}</span>
                  </div>
                </div>

                <Badge variant="outline" className="border-warning text-warning">
                  Official Source
                </Badge>
              </div>

              <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                {prediction.away} @ {prediction.home}
              </h3>

              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <div>
                    <p className="text-lg font-bold text-primary">
                      {prediction.prediction.probHome >= prediction.prediction.probAway ? prediction.home : prediction.away}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {prediction.prediction.probHome >= prediction.prediction.probAway
                        ? `${(prediction.prediction.probHome*100).toFixed(1)}%`
                        : `${(prediction.prediction.probAway*100).toFixed(1)}%`}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-4 w-4 text-success" />
                    <span className="text-sm font-medium">Confidence</span>
                  </div>
                </div>
              </div>

              <p className="text-sm text-muted-foreground mb-4">
                {prediction.market && (prediction.market.homePrice || prediction.market.awayPrice)
                  ? `Live ML: ${prediction.away} ${prediction.market.awayPrice>0?'+':''}${prediction.market.awayPrice ?? 'not yet'} / ${prediction.home} ${prediction.market.homePrice>0?'+':''}${prediction.market.homePrice ?? 'not yet'}`
                   : 'not yet'}
              </p>

              {prediction.market && (prediction.market.homePrice || prediction.market.awayPrice) && (
                <div className="flex gap-2 mb-4">
                  {prediction.market.awayPrice && (
                    <button
                      onClick={() => add({
                        id: `${prediction.away}@${prediction.home}:${prediction.startUtc}:ML:away`,
                        league: prediction.league,
                        start: prediction.startUtc,
                        away: prediction.away,
                        home: prediction.home,
                        market: "ML",
                        side: "away",
                        price: prediction.market.awayPrice,
                        book: prediction.market.awayBook
                      })}
                      className="text-xs px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600"
                    >
                      Add Away ML {formatAmerican(prediction.market.awayPrice)}
                    </button>
                  )}
                  {prediction.market.homePrice && (
                    <button
                      onClick={() => add({
                        id: `${prediction.away}@${prediction.home}:${prediction.startUtc}:ML:home`,
                        league: prediction.league,
                        start: prediction.startUtc,
                        away: prediction.away,
                        home: prediction.home,
                        market: "ML",
                        side: "home",
                        price: prediction.market.homePrice,
                        book: prediction.market.homeBook
                      })}
                      className="text-xs px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600"
                    >
                      Add Home ML {formatAmerican(prediction.market.homePrice)}
                    </button>
                  )}
                </div>
              )}

              <Button variant="outline" size="sm" className="w-full group-hover:border-primary/50" onClick={() => { setActive(prediction); setOpen(true); }}>
                <Target className="h-4 w-4 mr-2" />
                View Full Analysis
              </Button>
            </Card>
          ))}
        </div>
        
        <div className="text-center mt-12">
          <Button 
            size="lg" 
            className="bg-gradient-to-r from-primary to-warning hover:opacity-90"
            onClick={() => (window.location.href = '/daily-betting-insights')}
          >
            View All Predictions
          </Button>
        </div>
      </div>
      
      {open && active && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-2xl rounded-xl border border-border bg-background p-4">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-xl font-semibold">{active.away} @ {active.home}</h3>
              <button onClick={() => setOpen(false)} className="px-2 py-1 border rounded hover:bg-muted">Close</button>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <h4 className="font-semibold">Model</h4>
                <p>Home: {(active.prediction.probHome*100).toFixed(1)}% &nbsp; Away: {(active.prediction.probAway*100).toFixed(1)}%</p>
                <ul className="list-disc pl-5 text-sm text-muted-foreground">
                  {active.prediction.analysis.map((b: string, i: number) => <li key={i}>{b}</li>)}
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold">Market</h4>
                {(() => {
                  const row = active.marketMatched || active.marketSource || active.oddsRow || null;
                  const spread = pickBestSpread(row);
                  const total = pickBestTotal(row);
                  const table = buildBookTable(row);
                  
                  return (
                    <div className="text-sm space-y-2">
                      {active.market ? (
                        <div>
                          <div>Home ML: {active.market.homePrice>0?'+':''}{active.market.homePrice ?? 'not yet'} {active.market.homeBook ? `(${active.market.homeBook})` : ''}</div>
                          <div>Away ML: {active.market.awayPrice>0?'+':''}{active.market.awayPrice ?? 'not yet'} {active.market.awayBook ? `(${active.market.awayBook})` : ''}</div>
                          <div className="mt-1">Implied: Home {active.market.homeProb ? (active.market.homeProb*100).toFixed(1)+'%' : 'not yet'} / Away {active.market.awayProb ? (active.market.awayProb*100).toFixed(1)+'%' : 'not yet'}</div>
                        </div>
                      ) : <div className="text-muted-foreground">not yet</div>}
                      
                      <div className="mt-2">
                        <div><strong>Best Spread</strong>: {spread?.away ? `${active.away} ${spread.away.point>0?'+':''}${spread.away.point} (${spread.away.price>0?'+':''}${spread.away.price})` : 'not yet'} / {spread?.home ? `${active.home} ${spread.home.point>0?'+':''}${spread.home.point} (${spread.home.price>0?'+':''}${spread.home.price})` : 'not yet'}</div>
                        <div><strong>Best Total</strong>: {total?.over ? `Over ${total.over.point} (${total.over.price>0?'+':''}${total.over.price})` : 'not yet'} / {total?.under ? `Under ${total.under.point} (${total.under.price>0?'+':''}${total.under.price})` : 'not yet'}</div>
                      </div>
                      
                      <div className="mt-3">
                        <h5 className="font-medium mb-1">Book-by-book</h5>
                        <div className="overflow-x-auto border rounded">
                          <table className="min-w-full text-xs">
                            <thead className="bg-muted/30">
                              <tr>
                                <th className="px-2 py-1 text-left">Book</th>
                                <th className="px-2 py-1 text-left">ML Away</th>
                                <th className="px-2 py-1 text-left">ML Home</th>
                                <th className="px-2 py-1 text-left">Away Spread</th>
                                <th className="px-2 py-1 text-left">Home Spread</th>
                                <th className="px-2 py-1 text-left">Over</th>
                                <th className="px-2 py-1 text-left">Under</th>
                              </tr>
                            </thead>
                             <tbody>
                               {(active.market?.raw?.books || []).length ? (
                                 (() => {
                                   // compute best prices once per game row:
                                   const BEST_AWAY = bestMLFor(active.market?.raw, "away");
                                   const BEST_HOME = bestMLFor(active.market?.raw, "home");
                                   const BEST_AWAY_SP = bestSpreadFor(active.market?.raw, "away");
                                   const BEST_HOME_SP = bestSpreadFor(active.market?.raw, "home");
                                   const BT = bestTotals(active.market?.raw);

                                   return (active.market.raw.books).map((b:any, i:number) => {
                                     const h2h = findMarket(b,"h2h");
                                     const sp  = findMarket(b,"spreads");
                                     const tot = findMarket(b,"totals");
                                     const aH2H = findTeam(h2h, active.away);
                                     const hH2H = findTeam(h2h, active.home);
                                     const aSp  = findTeam(sp, active.away);
                                     const hSp  = findTeam(sp, active.home);
                                     const over = (tot?.outcomes||[]).find((o:any)=>/^over$/i.test(o.name));
                                     const under= (tot?.outcomes||[]).find((o:any)=>/^under$/i.test(o.name));
                                     
                                     return (
                                       <tr key={i}>
                                         <td className="p-2">{b.bookmaker || b.key || `Book ${i+1}`}</td>
                                         <td className="p-2">
                                           {aH2H ? <span className={aH2H.price === BEST_AWAY ? "text-emerald-400 font-semibold" : ""}>
                                             {aH2H.price === BEST_AWAY ? "⭐ " : ""}{formatAmerican(aH2H.price)}
                                           </span> : "—"}
                                         </td>
                                         <td className="p-2">
                                           {hH2H ? <span className={hH2H.price === BEST_HOME ? "text-emerald-400 font-semibold" : ""}>
                                             {hH2H.price === BEST_HOME ? "⭐ " : ""}{formatAmerican(hH2H.price)}
                                           </span> : "—"}
                                         </td>
                                         <td className="p-2">
                                           {aSp ? <span className={aSp.price === BEST_AWAY_SP?.price && aSp.point === BEST_AWAY_SP?.point ? "text-emerald-400 font-semibold" : ""}>
                                             {aSp.price === BEST_AWAY_SP?.price && aSp.point === BEST_AWAY_SP?.point ? "⭐ " : ""}{formatPoint(aSp.point)} ({formatAmerican(aSp.price)})
                                           </span> : "—"}
                                         </td>
                                         <td className="p-2">
                                           {hSp ? <span className={hSp.price === BEST_HOME_SP?.price && hSp.point === BEST_HOME_SP?.point ? "text-emerald-400 font-semibold" : ""}>
                                             {hSp.price === BEST_HOME_SP?.price && hSp.point === BEST_HOME_SP?.point ? "⭐ " : ""}{formatPoint(hSp.point)} ({formatAmerican(hSp.price)})
                                           </span> : "—"}
                                         </td>
                                         <td className="p-2">
                                           {over ? <span className={over.price === BT.over?.price && over.point === BT.over?.point ? "text-emerald-400 font-semibold" : ""}>
                                             {over.price === BT.over?.price && over.point === BT.over?.point ? "⭐ " : ""}{`O ${formatPoint(over.point)} (${formatAmerican(over.price)})`}
                                           </span> : "—"}
                                         </td>
                                         <td className="p-2">
                                           {under ? <span className={under.price === BT.under?.price && under.point === BT.under?.point ? "text-emerald-400 font-semibold" : ""}>
                                             {under.price === BT.under?.price && under.point === BT.under?.point ? "⭐ " : ""}{`U ${formatPoint(under.point)} (${formatAmerican(under.price)})`}
                                           </span> : "—"}
                                         </td>
                                       </tr>
                                     );
                                   });
                                 })()
                               ) : (
                                 <tr><td className="p-2" colSpan={7}>not yet</td></tr>
                               )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default PredictionsSection;