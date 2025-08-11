import React, { useEffect, useMemo, useRef, useState } from 'react';

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

// Read site variables from window.env (Lovable Site Variables)
function getEnv(key: string): string | undefined {
  try {
    return (window as any)?.env?.[key];
  } catch {
    return undefined;
  }
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

function matchOdds(oddsList: OddsData[], away: string, home: string): OddsData | null {
  const awayNorm = normalizeName(away);
  const homeNorm = normalizeName(home);
  
  for (const odds of oddsList) {
    const oddsAwayNorm = normalizeName(odds.away);
    const oddsHomeNorm = normalizeName(odds.home);
    
    // Exact match or contains match
    if ((oddsAwayNorm === awayNorm && oddsHomeNorm === homeNorm) || 
        (oddsAwayNorm.includes(awayNorm) && oddsHomeNorm.includes(homeNorm)) ||
        (awayNorm.includes(oddsAwayNorm) && homeNorm.includes(oddsHomeNorm))) {
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

async function fetchOddsForLeague(league: string, oddsProvider: string, oddsKey: string, oddsRegion: string, oddsBookmakers: string, soccerKeys: string[]): Promise<OddsData[]> {
  if (oddsProvider !== 'theoddsapi' || !oddsKey) return [];
  
  const keys = league === 'soccer' ? soccerKeys : [SPORT_KEYS[league]].filter(Boolean);
  if (!keys.length) return [];
  
  const results = await Promise.all(keys.map(async (sportKey) => {
    try {
      const url = new URL(`https://api.the-odds-api.com/v4/sports/${sportKey}/odds`);
      url.searchParams.set('regions', oddsRegion);
      url.searchParams.set('markets', 'h2h,spreads,totals');
      url.searchParams.set('oddsFormat', 'american');
      url.searchParams.set('dateFormat', 'iso');
      url.searchParams.set('bookmakers', oddsBookmakers);
      url.searchParams.set('apiKey', oddsKey);
      
      const response = await fetch(url);
      if (!response.ok) return [];
      
      const data = await response.json();
      return (data || []).map((item: any) => ({
        sportKey,
        start: item.commence_time,
        home: item.home_team,
        away: item.away_team,
        books: item.bookmakers || [],
      }));
    } catch {
      return [];
    }
  }));
  
  return results.flat();
}

function formatBestMoneyline(odds: OddsData | null): string {
  if (!odds) return '—';
  
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
  
  if (!bestAway || !bestHome) return '—';
  
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
  if (!odds) return '—';
  
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
  if (!bestSpread) return '—';
  
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
  if (!odds) return '—';
  
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
  
  if (!bestOver && !bestUnder) return '—';
  
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
  const timerRef = useRef<number | null>(null);

  const backend = useMemo(() => getEnv('BACKEND_URL') || '', []);
  const oddsProvider = useMemo(() => getEnv('ODDS_API_PROVIDER') || 'theoddsapi', []);
  const oddsKey = useMemo(() => getEnv('ODDS_API_KEY') || '', []);
  const oddsRegion = useMemo(() => getEnv('ODDS_REGION') || 'us', []);
  const oddsBookmakers = useMemo(() => getEnv('ODDS_BOOKMAKERS') || 'draftkings,betmgm,fanduel,caesars', []);
  const soccerKeys = useMemo(() => (getEnv('ODDS_SOCCER_KEYS') || 'soccer_usa_mls').split(',').map(s => s.trim()).filter(Boolean), []);

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
        Promise.all(selected.map(league => fetchOddsForLeague(league, oddsProvider, oddsKey, oddsRegion, oddsBookmakers, soccerKeys)))
      ]);

      const schedules = scheduleResults.flat();
      const oddsByLeague: Record<string, OddsData[]> = {};
      selected.forEach((league, index) => {
        oddsByLeague[league] = oddsResults[index];
      });

      // Merge schedules with odds
      const mergedRows = schedules.map(schedule => {
        const leagueOdds = oddsByLeague[schedule.league] || [];
        const matchedOdds = matchOdds(leagueOdds, schedule.away || '', schedule.home || '');
        return { ...schedule, odds: matchedOdds };
      });

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
                      <td className="py-2" dangerouslySetInnerHTML={{ __html: formatBestMoneyline(row.odds) }} />
                      <td className="py-2">{formatBestSpread(row.odds)}</td>
                      <td className="py-2">{formatBestTotal(row.odds)}</td>
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
