import React, { useEffect, useState } from 'react';
import { DateTime } from 'luxon';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Search, Clock, Trophy, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { TZ } from '@/utils/time';
import { fetchUpcomingGames, fetchLiveGames } from '@/services/leagues/all';
import { predict } from '@/services/predict';
import AnalysisModal from '@/components/AnalysisModal';
import type { Game } from '@/services/leagues';

interface GameWithPrediction extends Game {
  prediction: {
    probHome: number;
    probAway: number;
    analysis: string[];
    recommendation?: string;
  };
}

const DailyBettingInsights = () => {
  const [live, setLive] = useState<{byLeague: Record<string, any[]>; all: any[]}>({ byLeague: {}, all: [] });
  const [upcoming, setUpcoming] = useState<{byLeague: Record<string, any[]>; all: any[]; meta?: any}>({ byLeague: {}, all: [] });
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sportFilter, setSportFilter] = useState('all');
  const [lastUpdated, setLastUpdated] = useState<DateTime | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<any | null>(null);
  const { toast } = useToast();

  const fetchData = async () => {
    let alive = true;
    setLoading(true);
    setError(null);

    try {
      const [liveNow, upNext] = await Promise.all([fetchLiveGames(), fetchUpcomingGames({ days: 30 })]);
      if (!alive) return;

      const mapWithPred = (by: Record<string, any[]>) => Object.fromEntries(
        Object.entries(by).map(([k, v]) => [k, v.map(g => ({ ...g, prediction: predict(g) }))])
      );

      setLive({ byLeague: mapWithPred(liveNow.byLeague), all: liveNow.all });
      setUpcoming({ byLeague: mapWithPred(upNext.byLeague), all: upNext.all, meta: upNext.meta });
      setLastUpdated(DateTime.now().setZone(TZ));
    } catch (e: any) {
      setError(e?.message || 'Failed to load games');
      console.error('Error fetching data:', e);
      toast({ title: 'Error', description: e?.message || 'Failed to load games', variant: 'destructive' });
    } finally {
      setLoading(false);
    }

    return () => { alive = false; };
  };

  useEffect(() => {
    let alive = true;
    fetchData();
    const t = setInterval(async () => {
      if (!alive) return;
      try {
        const liveNow = await fetchLiveGames();
        const mapWithPred = (by: Record<string, any[]>) => Object.fromEntries(
          Object.entries(by).map(([k, v]) => [k, v.map(g => ({ ...g, prediction: predict(g) }))])
        );
        setLive({ byLeague: mapWithPred(liveNow.byLeague), all: liveNow.all });
        setLastUpdated(DateTime.now().setZone(TZ));
      } catch {}
    }, 30000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const filteredUpcoming = upcoming.all.filter((game: any) => {
    const matchesSearch = (game.home || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (game.away || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (game.league || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSport = sportFilter === 'all' || (game.league || '').toLowerCase() === sportFilter.toLowerCase();
    return matchesSearch && matchesSport;
  });

  // Group games by league
  const gamesByLeague = filteredUpcoming.reduce((acc: any, game: any) => {
    if (!acc[game.league]) acc[game.league] = [];
    acc[game.league].push(game);
    return acc;
  }, {} as Record<string, any[]>);

  // Sort each league's games by start time
  Object.keys(gamesByLeague).forEach(league => {
    gamesByLeague[league].sort((a, b) => 
      new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime()
    );
  });

  const leagueOrder = ['NFL', 'NBA', 'MLB', 'NHL', 'WNBA', 'EPL', 'MLS'];
  const sortedLeagues = leagueOrder.filter(league => gamesByLeague[league]?.length > 0);

  const sourceUrls = {
    MLB: 'statsapi.mlb.com',
    NBA: 'cdn.nba.com', 
    NHL: 'api-web.nhle.com',
    WNBA: 'stats.wnba.com',
    NFL: 'static.nfl.com',
    EPL: 'premierleague.com',
    MLS: 'api.mlssoccer.com'
  };

  const renderGameCard = (game: any) => {
    const kickoffET = DateTime.fromISO(game.startUtc, { zone: 'utc' }).setZone(TZ);
    const isToday = kickoffET.hasSame(DateTime.now().setZone(TZ), 'day');
    const isTomorrow = kickoffET.hasSame(DateTime.now().setZone(TZ).plus({ days: 1 }), 'day');
    const isLive = (game as any).status === 'live' || String(game?.extra?.status?.state || '').toLowerCase() === 'live';

    return (
      <div key={`${game.id}-${game.league}`} className="border rounded-xl p-4 bg-card hover:bg-accent/50 transition-colors">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{game.league}</Badge>
            {isLive && <span className="text-xs px-2 py-0.5 rounded bg-destructive text-destructive-foreground">Live</span>}
            <span className="text-xs text-muted-foreground">
              Source: Official {sourceUrls[game.league as keyof typeof sourceUrls]} site
            </span>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              {isToday && <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">Today</span>}
              {isTomorrow && <span className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded">Tomorrow</span>}
            </div>
            <div>{kickoffET.toFormat('ccc, LLL d')}</div>
            <div>{kickoffET.toFormat('h:mm a')} ET</div>
          </div>
        </div>
        <div className="font-semibold text-lg mb-1">
          {game.away} @ {game.home}
        </div>
        {game.venue && (
          <div className="text-sm text-muted-foreground mb-2">{game.venue}</div>
        )}
        <div className="grid md:grid-cols-2 gap-4 mb-3">
          <div>
            <div className="text-sm font-medium mb-1">Win Probabilities</div>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span>{game.home}</span>
                <span className="font-medium">{(game.prediction.probHome * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span>{game.away}</span>
                <span className="font-medium">{(game.prediction.probAway * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>
          <div>
            <div className="text-sm font-medium mb-1">Quick Analysis</div>
            <div className="text-xs text-muted-foreground space-y-1">
              {game.prediction.analysis.slice(0, 2).map((bullet: string, idx: number) => (
                <div key={idx}>• {bullet}</div>
              ))}
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full cursor-pointer"
          onClick={() => setSelectedGame(game)}
        >
          View Full Analysis
        </Button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-background/95 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-primary to-warning p-2 rounded-lg">
                <Trophy className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-warning bg-clip-text text-transparent">
                  Upcoming Games & Analysis
                </h1>
                <p className="text-sm text-muted-foreground">Official schedules with AI predictions</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={fetchData} 
                variant="outline" 
                size="sm"
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Status Info */}
        <div className="text-sm text-muted-foreground bg-card p-3 rounded-lg mb-6">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Showing upcoming games (next 30 days)
            </span>
            {lastUpdated && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Last updated: {lastUpdated.toFormat('h:mm a ZZZZ')}
              </span>
            )}
            <span>Total games: {upcoming.all.length}</span>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search by team, sport, or match..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={sportFilter} onValueChange={setSportFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by sport" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sports</SelectItem>
                  <SelectItem value="NFL">NFL</SelectItem>
                  <SelectItem value="NBA">NBA</SelectItem>
                  <SelectItem value="MLB">MLB</SelectItem>
                  <SelectItem value="NHL">NHL</SelectItem>
                  <SelectItem value="WNBA">WNBA</SelectItem>
                  <SelectItem value="EPL">EPL</SelectItem>
                  <SelectItem value="MLS">MLS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Error State */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg mb-6">
            Error: {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
            <div>Loading official schedules and generating predictions...</div>
          </div>
        )}

        {/* No Games State */}
        {!loading && !error && upcoming.all.length === 0 && (
          <div className="text-center py-8 bg-card rounded-lg">
            <div className="text-muted-foreground">No upcoming games found.</div>
            <div className="text-sm text-muted-foreground/60 mt-1">(All leagues may be in offseason)</div>
          </div>
        )}

        {/* Games by League */}
        {!loading && !error && sortedLeagues.length > 0 && (
          <div className="space-y-8">
            {/* Live Now */}
            {live.all.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Badge variant="secondary">Live Now</Badge>
                    {live.all.length} games
                  </CardTitle>
                  <CardDescription>Official live data from each league</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    {live.all.map((g:any) => renderGameCard({ ...g, prediction: predict(g) }))}
                  </div>
                </CardContent>
              </Card>
            )}

            {sortedLeagues.map(league => (
              <Card key={league}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Badge variant="secondary">{league}</Badge>
                    {league} - {gamesByLeague[league].length} games
                  </CardTitle>
                  <CardDescription>
                    Source: Official {sourceUrls[league as keyof typeof sourceUrls]} site
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    {gamesByLeague[league].map(renderGameCard)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}


        {/* No Filtered Results */}
        {!loading && !error && upcoming.all.length > 0 && sortedLeagues.length === 0 && (
          <div className="text-center py-8 bg-card rounded-lg">
            <div className="text-muted-foreground">No games match your current filters.</div>
          </div>
        )}
      </div>

      {/* Analysis Modal */}
      <AnalysisModal 
        open={!!selectedGame} 
        onClose={() => setSelectedGame(null)} 
        game={selectedGame} 
      />
    </div>
  );
};

export default DailyBettingInsights;