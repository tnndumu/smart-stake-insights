import React, { useEffect, useMemo, useRef, useState } from 'react';

// Helper types
interface Row {
  time: string; // ISO UTC
  status: string; // lowercase
  home?: string;
  away?: string;
  venue?: string;
  league: string; // mlb|nhl|nba|nfl|mls|soccer
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

// Filters
function isLive(g: Row) {
  const s = (g.status || '').toLowerCase();
  return /live|in[- ]progress|period|quarter|top|bottom|half/.test(s);
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

async function fetchBackend(league: string, date: string, backend: string): Promise<Row[]> {
  const u = `${backend.replace(/\/$/, '')}/api/schedule?league=${encodeURIComponent(league)}&date=${encodeURIComponent(date)}`;
  const r = await fetch(u);
  const j = await r.json();
  if (Array.isArray(j)) {
    return j.map((n: any) => ({
      time: n.date_utc,
      status: String(n.status || '').toLowerCase(),
      home: n.home?.name,
      away: n.away?.name,
      venue: n.venue,
      league,
    }));
  }
  if (j?.info?.error) throw new Error(j.info.error);
  return [];
}

async function fetchMLB(date: string): Promise<Row[]> {
  const r = await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}`);
  if (!r.ok) return [];
  const j = await r.json();
  const out: Row[] = [];
  for (const d of j.dates || []) {
    for (const g of d.games || []) {
      out.push({
        time: g.gameDate,
        status: String(g.status?.detailedState || '').toLowerCase(),
        home: g.teams?.home?.team?.name,
        away: g.teams?.away?.team?.name,
        venue: g.venue?.name || '',
        league: 'mlb',
      });
    }
  }
  return out;
}

async function fetchNHL(date: string): Promise<Row[]> {
  const r = await fetch(`https://statsapi.web.nhl.com/api/v1/schedule?date=${date}`);
  if (!r.ok) return [];
  const j = await r.json();
  const out: Row[] = [];
  for (const d of j.dates || []) {
    for (const g of d.games || []) {
      out.push({
        time: g.gameDate,
        status: String(g.status?.detailedState || '').toLowerCase(),
        home: g.teams?.home?.team?.name,
        away: g.teams?.away?.team?.name,
        venue: g.venue?.name || '',
        league: 'nhl',
      });
    }
  }
  return out;
}

async function fetchSoccer(date: string, provider?: string, token?: string): Promise<Row[]> {
  if (!token) return [];
  try {
    if (provider === 'apisports') {
      const r = await fetch(`https://v3.football.api-sports.io/fixtures?date=${date}`, {
        headers: { 'x-apisports-key': token },
      });
      if (!r.ok) return [];
      const j = await r.json();
      return (j.response || []).map((x: any) => ({
        time: x.fixture?.date,
        status: String(x.fixture?.status?.long || x.fixture?.status?.short || '').toLowerCase(),
        home: x.teams?.home?.name,
        away: x.teams?.away?.name,
        venue: x.fixture?.venue?.name || '',
        league: 'soccer',
      }));
    }
    // default fd
    const r = await fetch(`https://api.football-data.org/v4/matches?dateFrom=${date}&dateTo=${date}`, {
      headers: { 'X-Auth-Token': token },
    });
    if (!r.ok) return [];
    const j = await r.json();
    return (j.matches || []).map((m: any) => ({
      time: m.utcDate,
      status: String(m.status || '').toLowerCase(),
      home: m.homeTeam?.name,
      away: m.awayTeam?.name,
      venue: m.area?.name || '',
      league: 'soccer',
    }));
  } catch {
    return [];
  }
}

const ALL_OPTIONS = [
  { value: 'mlb', label: 'MLB' },
  { value: 'nhl', label: 'NHL' },
  { value: 'nba', label: 'NBA' },
  { value: 'nfl', label: 'NFL' },
  { value: 'mls', label: 'MLS' },
  { value: 'soccer', label: 'Soccer' },
] as const;

export default function SchedulesWidget() {
  const [tab, setTab] = useState<Tab>('live');
  const [date, setDate] = useState<string>(todayYYYYMMDD());
  const [selected, setSelected] = useState<string[]>(['mlb', 'nhl']);
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [notice, setNotice] = useState<string>('');
  const timerRef = useRef<number | null>(null);
  const spinnerTimeout = useRef<number | null>(null);

  const backend = useMemo(() => getEnv('BACKEND_URL') || '', []);
  const soccerProvider = useMemo(() => (getEnv('SOCCER_PROVIDER') || 'fd').toLowerCase(), []);
  const soccerToken = useMemo(() => getEnv('SOCCER_TOKEN') || '', []);

  useEffect(() => {
    if (tab === 'live') {
      // immediate load and then interval
      reloadIncremental();
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = window.setInterval(() => reloadIncremental(), 30000);
      return () => {
        if (timerRef.current) window.clearInterval(timerRef.current);
        timerRef.current = null;
      };
    } else {
      // upcoming: load once when inputs change
      reloadIncremental();
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, date, selected.join('|')]);

  function startSpinnerGuard() {
    setLoading(true);
    if (spinnerTimeout.current) window.clearTimeout(spinnerTimeout.current);
    spinnerTimeout.current = window.setTimeout(() => setLoading(false), 2000);
  }

  function stopSpinnerIfAny() {
    setLoading(false);
    if (spinnerTimeout.current) {
      window.clearTimeout(spinnerTimeout.current);
      spinnerTimeout.current = null;
    }
  }

  async function reloadIncremental() {
    setRows([]);
    setStatus('Loading…');
    setNotice('');
    startSpinnerGuard();

    const leagues = [...selected];
    const perLeaguePromises = leagues.map(async (league) => {
      try {
        let out: Row[] = [];
        if (backend) {
          out = await fetchBackend(league, date, backend);
        } else {
          if (league === 'mlb') out = await fetchMLB(date);
          else if (league === 'nhl') out = await fetchNHL(date);
          else if (league === 'soccer') out = await fetchSoccer(date, soccerProvider, soccerToken);
          else {
            // unsupported in fallback
            setNotice((prev) => `${prev ? prev + ' ' : ''}${league.toUpperCase()} is available when the backend is connected.`);
            out = [];
          }
        }
        // Filter based on tab now and merge
        const filtered = (tab === 'live') ? out.filter(isLive) : out.filter(isUpcoming);
        setRows((prev) => {
          const merged = [...prev, ...filtered];
          merged.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
          return merged;
        });
      } catch (e) {
        console.warn('League fetch failed', league, e);
      }
    });

    // Update status as results arrive
    let completed = 0;
    perLeaguePromises.forEach((p) =>
      p.finally(() => {
        completed += 1;
        setStatus(`Loaded ${completed}/${leagues.length} league${leagues.length > 1 ? 's' : ''}${rows.length ? ` • ${rows.length} games` : ''}`);
        if (rows.length > 0) stopSpinnerIfAny();
      })
    );

    // Ensure final status
    await Promise.allSettled(perLeaguePromises);
    setStatus(rows.length ? `Loaded ${rows.length} game${rows.length !== 1 ? 's' : ''}.` : 'No games found.');
    stopSpinnerIfAny();
  }

  function toggleOption(val: string) {
    setSelected((prev) => (prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]));
  }

  return (
    <section className="py-16 px-4" aria-labelledby="schedules-heading">
      <div className="container mx-auto">
        <header className="mb-6">
          <h2 id="schedules-heading" className="text-3xl font-bold mb-2">
            <span className="bg-gradient-to-r from-primary to-warning bg-clip-text text-transparent">Schedules</span>
          </h2>
          <p className="text-muted-foreground">Live and upcoming schedules across leagues</p>
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
                {ALL_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleOption(opt.value)}
                    className={`px-3 py-1 rounded-md border ${selected.includes(opt.value) ? 'bg-secondary text-foreground' : 'bg-background text-muted-foreground'} hover:border-primary transition-colors`}
                    aria-pressed={selected.includes(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="ml-auto flex items-center gap-2">
              <div role="status" aria-live="polite" className="text-sm text-muted-foreground">
                {status}
              </div>
              <button
                type="button"
                onClick={reloadIncremental}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm hover:border-primary"
              >
                Reload
              </button>
            </div>
          </div>

          {/* Tabs */}
          <nav className="flex gap-2 mb-3" role="tablist" aria-label="Schedules tabs">
            <button
              role="tab"
              aria-selected={tab === 'live'}
              className={`px-3 py-2 rounded-md border ${tab === 'live' ? 'outline outline-2 outline-primary' : 'hover:border-primary'}`}
              onClick={() => setTab('live')}
            >
              Live
            </button>
            <button
              role="tab"
              aria-selected={tab === 'upcoming'}
              className={`px-3 py-2 rounded-md border ${tab === 'upcoming' ? 'outline outline-2 outline-primary' : 'hover:border-primary'}`}
              onClick={() => setTab('upcoming')}
            >
              Upcoming
            </button>
          </nav>

          {notice && (
            <p className="text-xs text-muted-foreground mb-2" role="note">{notice}</p>
          )}

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
                  <th className="py-2">Venue</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && !loading ? (
                  <tr>
                    <td className="py-6 text-sm text-muted-foreground" colSpan={5}>No games found.</td>
                  </tr>
                ) : (
                  rows.map((g, idx) => (
                    <tr key={`${g.league}-${g.time}-${idx}`} className="border-t border-border/60">
                      <td className="py-2">{fmtLocal(g.time)}</td>
                      <td className="py-2">{g.away || ''}</td>
                      <td className="py-2">{g.home || ''}</td>
                      <td className="py-2 capitalize">{g.status || ''}</td>
                      <td className="py-2">{g.venue || ''}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  );
}
