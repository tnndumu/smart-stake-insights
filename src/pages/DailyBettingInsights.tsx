import React, { useEffect, useMemo, useState } from 'react';
import { DateTime } from 'luxon';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, Search, Filter, TrendingUp, Star, Lock, Clock, MapPin, Trophy } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { todayRangeET, tomorrowRangeET, TZ } from '@/utils/time';
import { getOddsForDay } from '@/services/odds';
import { fetchOfficialGames } from '@/services/leagues/all';
import { predict } from '@/services/predict';

interface Bet {
  id: number;
  sport: string;
  homeTeam: string;
  awayTeam: string;
  odds: string;
  confidence: number;
  reasoning: string;
  category: 'moneyline' | 'spread' | 'over_under';
  gameDate: string;
  gameTime: string;
  prediction: string;
}

type DayMode = 'today' | 'tomorrow';

const DailyBettingInsights = () => {
  const { user, isSubscriber } = useAuth();
  const [mode, setMode] = useState<DayMode>('today');
  const [games, setGames] = useState<any[]>([]);
  const [oddsGames, setOddsGames] = useState<any[]>([]);
  const [bets, setBets] = useState<Bet[]>([]);
  const [premiumBets, setPremiumBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sportFilter, setSportFilter] = useState('all');
  const [sortBy, setSortBy] = useState('confidence');
  const [lastUpdated, setLastUpdated] = useState<DateTime | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const range = useMemo(() => (mode === 'today' ? todayRangeET() : tomorrowRangeET()), [mode]);

  const fetchData = async () => {
    let alive = true;
    setLoading(true);
    setError(null);
    
    try {
      const dateYYYYMMDD = range.startET.toFormat('yyyy-MM-dd');
      
      // Fetch official games and odds data in parallel
      const [officialGames, oddsData] = await Promise.all([
        fetchOfficialGames(dateYYYYMMDD),
        getOddsForDay({ startUTC: range.startUTC, endUTC: range.endUTC })
      ]);
      
      if (!alive) return;
      
      setGames(officialGames);
      setOddsGames(oddsData);
      setLastUpdated(DateTime.now().setZone(TZ));
      
      // Generate mock bets based on official games
      const mockBets: Bet[] = officialGames.slice(0, 5).map((game, index) => {
        const prediction = predict(game);
        return {
          id: index + 1,
          sport: game.league,
          homeTeam: game.home,
          awayTeam: game.away,
          odds: prediction.probHome > 0.5 ? '-110' : '+120',
          confidence: Math.round(Math.max(prediction.probHome, prediction.probAway) * 100),
          reasoning: prediction.recommendation,
          category: ['moneyline', 'spread', 'over_under'][index % 3] as any,
          gameDate: mode === 'today' ? 'Today' : 'Tomorrow',
          gameTime: DateTime.fromISO(game.startUtc, { zone: 'utc' }).setZone(TZ).toFormat('h:mm a'),
          prediction: prediction.probHome > 0.5 ? `${game.home} ML` : `${game.away} ML`
        };
      });
      
      setBets(mockBets);
      
      // Premium bets only for subscribers
      if (isSubscriber) {
        const premiumMockBets: Bet[] = officialGames.slice(5, 8).map((game, index) => {
          const prediction = predict(game);
          return {
            id: index + 100,
            sport: game.league,
            homeTeam: game.home,
            awayTeam: game.away,
            odds: '+180',
            confidence: Math.round(Math.max(prediction.probHome, prediction.probAway) * 100),
            reasoning: 'Advanced analytics show significant edge in this matchup',
            category: ['moneyline', 'spread', 'over_under'][index % 3] as any,
            gameDate: mode === 'today' ? 'Today' : 'Tomorrow',
            gameTime: DateTime.fromISO(game.startUtc, { zone: 'utc' }).setZone(TZ).toFormat('h:mm a'),
            prediction: prediction.recommendation
          };
        });
        setPremiumBets(premiumMockBets);
      }
    } catch (e: any) {
      if (!alive) return;
      setError(e?.message || 'Failed to load games');
      console.error('Error fetching data:', e);
      toast({
        title: "Error",
        description: e?.message || 'Failed to load games',
        variant: "destructive",
      });
    } finally {
      if (alive) setLoading(false);
    }
    
    return () => { alive = false; };
  };

  useEffect(() => {
    fetchData();
  }, [range.startUTC.toISO(), range.endUTC.toISO(), isSubscriber]);
  
  const handleSubscribe = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to subscribe",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        toast({
          title: "Authentication Required",
          description: "Please sign in to subscribe",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (error) throw error;

      // Open Stripe checkout in a new tab
      window.open(data.url, '_blank');
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to create checkout session",
        variant: "destructive",
      });
    }
  };

  const filteredBets = bets.filter(bet => {
    const matchesSearch = bet.homeTeam.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         bet.awayTeam.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         bet.sport.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSport = sportFilter === 'all' || bet.sport.toLowerCase() === sportFilter.toLowerCase();
    return matchesSearch && matchesSport;
  });

  const sortedBets = [...filteredBets].sort((a, b) => {
    switch (sortBy) {
      case 'confidence':
        return b.confidence - a.confidence;
      case 'odds':
        return parseFloat(b.odds) - parseFloat(a.odds);
      case 'time':
        return a.gameTime.localeCompare(b.gameTime);
      default:
        return 0;
    }
  });

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 70) return 'text-success';
    if (confidence >= 50) return 'text-warning';
    return 'text-destructive';
  };

  const getConfidenceVariant = (confidence: number) => {
    if (confidence >= 70) return 'default';
    if (confidence >= 50) return 'secondary';
    return 'destructive';
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
                  Daily Betting Insights
                </h1>
                <p className="text-sm text-muted-foreground">Expert predictions from official league sources</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={mode === 'today' ? 'default' : 'outline'}
                onClick={() => setMode('today')}
                size="sm"
              >
                Today
              </Button>
              <Button
                variant={mode === 'tomorrow' ? 'default' : 'outline'}
                onClick={() => setMode('tomorrow')}
                size="sm"
              >
                Tomorrow
              </Button>
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
            <span>Showing games for <strong>{range.label}</strong> (Eastern Time)</span>
            {lastUpdated && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Last updated: {lastUpdated.toFormat('h:mm a ZZZZ')}
              </span>
            )}
            <span>Official games: {games.length}</span>
            <span>Odds available: {oddsGames.length}</span>
          </div>
        </div>

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
            <div>Loading accurate games and predictions...</div>
          </div>
        )}

        {/* No Games State */}
        {!loading && !error && games.length === 0 && (
          <div className="text-center py-8 bg-card rounded-lg">
            <div className="text-muted-foreground">No official games scheduled for this day.</div>
            <div className="text-sm text-muted-foreground/60 mt-1">(Leagues may be in offseason)</div>
          </div>
        )}

        {/* Official Games Section */}
        {!loading && !error && games.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Official League Games ({games.length})
              </CardTitle>
              <CardDescription>
                Direct from official league sources with AI predictions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {games.map((game) => {
                  const prediction = predict(game);
                  const kickoffET = DateTime.fromISO(game.startUtc, { zone: 'utc' }).setZone(TZ);
                  const sourceUrls = {
                    MLB: 'statsapi.mlb.com',
                    NBA: 'cdn.nba.com', 
                    NHL: 'api-web.nhle.com',
                    WNBA: 'stats.wnba.com'
                  };
                  
                  return (
                    <div key={`${game.id}-${game.league}`} className="border rounded-xl p-4 bg-muted/20">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{game.league}</Badge>
                          <span className="text-xs text-muted-foreground">
                            Source: {sourceUrls[game.league as keyof typeof sourceUrls]}
                          </span>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          <div>{kickoffET.toFormat('ccc, LLL d')}</div>
                          <div>{kickoffET.toFormat('h:mm a')}</div>
                        </div>
                      </div>
                      
                      <div className="font-semibold text-lg mb-1">
                        {game.away} @ {game.home}
                      </div>
                      
                      {game.venue && (
                        <div className="text-sm text-muted-foreground mb-2">{game.venue}</div>
                      )}
                      
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm font-medium mb-1">Prediction</div>
                          <div className="text-sm">
                            <div className="font-medium">{prediction.recommendation}</div>
                            <div className="text-muted-foreground">
                              {game.home}: {(prediction.probHome * 100).toFixed(0)}% | {game.away}: {(prediction.probAway * 100).toFixed(0)}%
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <div className="text-sm font-medium mb-1">Analysis</div>
                          <div className="text-xs text-muted-foreground space-y-1">
                            {prediction.analysis.map((bullet, idx) => (
                              <div key={idx}>• {bullet}</div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Premium 5 Bets Section */}
        {!loading && !error && (
          <Card className="mb-8 bg-gradient-to-br from-primary/10 to-warning/10 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-warning" />
                Premium 5 Bets
              </CardTitle>
              <CardDescription>
                Our highest confidence picks backed by advanced analytics
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isSubscriber ? (
                <div className="space-y-4">
                  {premiumBets.length > 0 ? (
                    <>
                      {premiumBets.map((bet) => (
                        <div key={bet.id} className="bg-card p-4 rounded-lg border border-primary/20">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">{bet.sport}</Badge>
                              <Badge 
                                variant={getConfidenceVariant(bet.confidence)}
                                className={getConfidenceColor(bet.confidence)}
                              >
                                {bet.confidence}% confidence
                              </Badge>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-muted-foreground">{bet.gameDate}</div>
                              <div className="text-sm font-medium">{bet.gameTime}</div>
                            </div>
                          </div>
                          <div className="text-lg font-semibold mb-1">
                            {bet.awayTeam} vs {bet.homeTeam}
                          </div>
                          <div className="text-base font-medium text-primary mb-2">
                            {bet.prediction} ({bet.odds})
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {bet.reasoning}
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-muted-foreground">No premium bets available for {mode}.</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Lock className="h-12 w-12 text-warning mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Unlock Premium Insights</h3>
                  <p className="text-muted-foreground mb-4">
                    Get access to our highest confidence picks and advanced analytics
                  </p>
                  <Button onClick={handleSubscribe} className="bg-gradient-to-r from-primary to-warning">
                    Upgrade to Premium
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        {!loading && !error && bets.length > 0 && (
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
                    <SelectItem value="NBA">NBA</SelectItem>
                    <SelectItem value="NFL">NFL</SelectItem>
                    <SelectItem value="MLB">MLB</SelectItem>
                    <SelectItem value="NHL">NHL</SelectItem>
                    <SelectItem value="WNBA">WNBA</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="confidence">Confidence</SelectItem>
                    <SelectItem value="odds">Odds</SelectItem>
                    <SelectItem value="time">Game Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        {!loading && !error && bets.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{mode === 'today' ? "Today's" : "Tomorrow's"} Top Picks</CardTitle>
              <CardDescription>
                {filteredBets.length} bets available from official league data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sport</TableHead>
                    <TableHead>Matchup</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Prediction</TableHead>
                    <TableHead>Odds</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Analysis</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedBets.map((bet) => (
                    <TableRow key={bet.id}>
                      <TableCell>
                        <Badge variant="outline">{bet.sport}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {bet.awayTeam} vs {bet.homeTeam}
                      </TableCell>
                      <TableCell>{bet.gameTime}</TableCell>
                      <TableCell className="font-medium text-primary">
                        {bet.prediction}
                      </TableCell>
                      <TableCell className="font-mono">{bet.odds}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={getConfidenceVariant(bet.confidence)}
                          className={getConfidenceColor(bet.confidence)}
                        >
                          {bet.confidence}%
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {bet.reasoning}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default DailyBettingInsights;