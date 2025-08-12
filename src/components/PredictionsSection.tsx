import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, TrendingUp, Target, Calendar, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchLiveGames, fetchUpcomingGames } from "@/services/leagues/all";
import { predict } from "@/services/predict";
import { DateTime } from "luxon";

// === Odds helpers for PredictionsSection ===
type OddsRow = {
  sportKey: string;
  start: string;
  home: string;
  away: string;
  books: Array<{
    key?: string;
    bookmaker?: string;
    title?: string;
    markets?: Array<{ key: string; outcomes: Array<{ name: string; price: number; point?: number }> }>;
  }>;
};

function getEnvPS(key: string): string | undefined {
  const map: Record<string,string> = {
    ODDS_API_KEY: 'VITE_ODDS_API_KEY',
    SUPABASE_URL: 'VITE_SUPABASE_URL',
    ODDS_REGION: 'VITE_ODDS_REGION',
    ODDS_BOOKMAKERS: 'VITE_ODDS_BOOKMAKERS',
  };
  const viteKey = map[key] || key;
  const fromWindow = (window as any)?.env?.[key];
  // @ts-ignore
  let fromVite: string | undefined;
  try {
    fromVite = (import.meta as any)?.env?.[viteKey];
  } catch {
    fromVite = undefined;
  }
  return fromWindow ?? fromVite;
}

const SPORT_KEYS_PS: Record<string,string> = {
  MLB: 'baseball_mlb',
  NBA: 'basketball_nba',
  NHL: 'icehockey_nhl',
  NFL: 'americanfootball_nfl',
  MLS: 'soccer_usa_mls',
};

function normNamePS(s: string) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9 ]+/g, '').replace(/\s+/g, ' ').trim();
}

function nicknameTokenPS(name: string): string {
  const n = normNamePS(name);
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

function impliedProb(american: number) {
  if (!isFinite(american) || american === 0) return null;
  return american > 0 ? 100 / (american + 100) : (-american) / ((-american) + 100);
}

function bestH2H(odds: OddsRow | null) {
  if (!odds) return null;
  const markets = odds.books.flatMap(b => (b.markets || []).filter(m => m.key === 'h2h'));
  const outcomes = markets.flatMap(m => m.outcomes || []);
  const byTeam: Record<string, { price: number; book: string }> = {};
  for (const b of odds.books) {
    for (const m of (b.markets || []).filter(m => m.key === 'h2h')) {
      for (const o of m.outcomes || []) {
        const team = normNamePS(o.name);
        const price = o.price;
        const book = (b.bookmaker || b.key || '').toString();
        const prev = byTeam[team];
        const prevProb = prev ? impliedProb(prev.price) ?? 1 : 1;
        const thisProb = impliedProb(price) ?? 1;
        // Choose the offer with the LOWEST implied probability (best for bettor)
        if (!prev || thisProb < prevProb) byTeam[team] = { price, book };
      }
    }
  }
  return byTeam;
}

async function fetchLeagueOddsPS(league: string): Promise<OddsRow[]> {
  const sportKey = SPORT_KEYS_PS[league];
  if (!sportKey) return [];
  const region = getEnvPS('ODDS_REGION') || 'us';
  const bookmakers = getEnvPS('ODDS_BOOKMAKERS') || 'draftkings,betmgm,fanduel,caesars';
  let url = new URL(`https://api.the-odds-api.com/v4/sports/${sportKey}/odds`);
  url.searchParams.set('regions', region);
  url.searchParams.set('markets', 'h2h,spreads,totals');
  url.searchParams.set('oddsFormat', 'american');
  url.searchParams.set('dateFormat', 'iso');
  url.searchParams.set('bookmakers', bookmakers);

  const supabaseUrl = getEnvPS('SUPABASE_URL') || '';
  if (supabaseUrl) {
    const p = new URL(supabaseUrl.replace(/\/$/, '') + '/functions/v1/odds-proxy');
    p.searchParams.set('sport', sportKey);
    p.searchParams.set('regions', region);
    p.searchParams.set('markets', 'h2h,spreads,totals');
    p.searchParams.set('bookmakers', bookmakers);
    url = p;
  } else {
    const key = getEnvPS('ODDS_API_KEY') || '';
    if (!key) return [];
    url.searchParams.set('apiKey', key);
  }

  const res = await fetch(url.toString());
  if (!res.ok) return [];
  return await res.json();
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

function matchOddsPS(list: OddsRow[], away: string, home: string): OddsRow | null {
  const a = normNamePS(away), h = normNamePS(home);
  const aNick = nicknameTokenPS(away), hNick = nicknameTokenPS(home);
  for (const row of list) {
    const rowA = normNamePS(row.away), rowH = normNamePS(row.home);
    const rowANick = nicknameTokenPS(row.away), rowHNick = nicknameTokenPS(row.home);
    if ((rowA.includes(a) && rowH.includes(h)) ||
        (a.includes(rowA) && h.includes(rowH)) ||
        (rowANick === aNick && rowHNick === hNick)) {
      return row;
    }
  }
  return null;
}

const PredictionsSection = () => {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<any | null>(null);
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasAnyResults, setHasAnyResults] = useState(false);

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
      
      // attach market odds (best moneyline) per league
      const leagues = Array.from(new Set(accumulatedGames.map(g => g.league)));
      const oddsByLeague: Record<string, OddsRow[]> = {};
      for (const lg of leagues) {
        const odds = await fetchLeagueOddsPS(lg);
        console.log(`Odds rows ${lg}: ${odds.length}`);
        oddsByLeague[lg] = odds;
      }
      const withOdds = [...accumulatedGames].map(g => {
        const matched = matchOddsPS(oddsByLeague[g.league] || [], g.away, g.home);
        let best: any = null;
        if (matched) {
          const byTeam = bestH2H(matched);
          const homeBest = byTeam ? byTeam[normNamePS(g.home)] : undefined;
          const awayBest = byTeam ? byTeam[normNamePS(g.away)] : undefined;
          best = {
            homePrice: homeBest?.price,
            homeProb: homeBest ? impliedProb(homeBest.price) : null,
            homeBook: homeBest?.book,
            awayPrice: awayBest?.price,
            awayProb: awayBest ? impliedProb(awayBest.price) : null,
            awayBook: awayBest?.book,
          };
        }
        return { ...g, market: best, marketMatched: matched };
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
                  ? `Market ML: ${prediction.away} ${prediction.market.awayPrice>0?'+':''}${prediction.market.awayPrice ?? 'not yet'} / ${prediction.home} ${prediction.market.homePrice>0?'+':''}${prediction.market.homePrice ?? 'not yet'}`
                  : 'not yet'}
              </p>

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
                              {table.length ? table.map((r: any, i: number) => (
                                <tr key={i} className="border-t">
                                  <td className="px-2 py-1">{r.book || 'not yet'}</td>
                                  <td className="px-2 py-1">{r.mlAway>0?'+':''}{r.mlAway ?? 'not yet'}</td>
                                  <td className="px-2 py-1">{r.mlHome>0?'+':''}{r.mlHome ?? 'not yet'}</td>
                                  <td className="px-2 py-1">{r.spAwayPt ? `${r.spAwayPt>0?'+':''}${r.spAwayPt}` : 'not yet'} {r.spAway!=null ? `(${r.spAway>0?'+':''}${r.spAway})` : ''}</td>
                                  <td className="px-2 py-1">{r.spHomePt ? `${r.spHomePt>0?'+':''}${r.spHomePt}` : 'not yet'} {r.spHome!=null ? `(${r.spHome>0?'+':''}${r.spHome})` : ''}</td>
                                  <td className="px-2 py-1">{r.overPt ?? 'not yet'} {r.over!=null ? `(${r.over>0?'+':''}${r.over})` : ''}</td>
                                  <td className="px-2 py-1">{r.underPt ?? 'not yet'} {r.under!=null ? `(${r.under>0?'+':''}${r.under})` : ''}</td>
                                </tr>
                              )) : <tr><td className="px-2 py-2 text-muted-foreground" colSpan={7}>not yet</td></tr>}
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