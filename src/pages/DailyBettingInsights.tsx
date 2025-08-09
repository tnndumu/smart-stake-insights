import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trophy, Search, Filter, RefreshCw, Lock, Calendar, Clock, TrendingUp, Crown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Bet {
  id: string;
  sport: string;
  home_team: string;
  away_team: string;
  odds: number;
  prediction_confidence: number;
  reasoning: string;
  category: 'regular' | 'premium';
  game_date: string;
  game_time: string;
  created_at: string;
}

const DailyBettingInsights = () => {
  const [bets, setBets] = useState<Bet[]>([]);
  const [premiumBets, setPremiumBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sportFilter, setSportFilter] = useState('all');
  const [sortBy, setSortBy] = useState('confidence');
  const { user, isSubscriber } = useAuth();
  const { toast } = useToast();

  const fetchBets = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      // Mock data for demonstration since tables don't exist yet
      const mockBets: Bet[] = [
        {
          id: '1',
          sport: 'NFL',
          home_team: 'Chiefs',
          away_team: 'Patriots',
          odds: 1.85,
          prediction_confidence: 85,
          reasoning: 'Strong home field advantage and superior offensive statistics',
          category: 'regular',
          game_date: today,
          game_time: '20:00',
          created_at: new Date().toISOString()
        },
        {
          id: '2',
          sport: 'NBA',
          home_team: 'Lakers',
          away_team: 'Warriors',
          odds: 2.1,
          prediction_confidence: 78,
          reasoning: 'Lakers showing strong defensive improvements',
          category: 'regular',
          game_date: tomorrow,
          game_time: '19:30',
          created_at: new Date().toISOString()
        }
      ];

      const mockPremiumBets: Bet[] = isSubscriber ? [
        {
          id: '3',
          sport: 'NFL',
          home_team: 'Cowboys',
          away_team: 'Giants',
          odds: 1.95,
          prediction_confidence: 92,
          reasoning: 'Premium analysis indicates strong value in this matchup',
          category: 'premium',
          game_date: today,
          game_time: '21:00',
          created_at: new Date().toISOString()
        }
      ] : [];

      setBets(mockBets);
      setPremiumBets(mockPremiumBets);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch betting data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBets();
  }, [isSubscriber]);

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
    const matchesSearch = bet.home_team.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         bet.away_team.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         bet.sport.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSport = sportFilter === 'all' || bet.sport.toLowerCase() === sportFilter.toLowerCase();
    return matchesSearch && matchesSport;
  });

  const sortedBets = [...filteredBets].sort((a, b) => {
    switch (sortBy) {
      case 'confidence':
        return b.prediction_confidence - a.prediction_confidence;
      case 'odds':
        return b.odds - a.odds;
      case 'time':
        return new Date(a.game_date + ' ' + a.game_time).getTime() - new Date(b.game_date + ' ' + b.game_time).getTime();
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

  const sports = Array.from(new Set(bets.map(bet => bet.sport)));

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
                <p className="text-sm text-muted-foreground">Professional analysis and predictions</p>
              </div>
            </div>
            <Button onClick={fetchBets} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Premium 5 Bets Section */}
        <Card className="mb-8 bg-gradient-to-br from-primary/10 to-warning/10 border-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Crown className="h-6 w-6 text-warning" />
                <div>
                  <CardTitle className="text-2xl bg-gradient-to-r from-primary to-warning bg-clip-text text-transparent">
                    Premium 5 Bets
                  </CardTitle>
                  <CardDescription>Today's top 5 premium predictions</CardDescription>
                </div>
              </div>
              {!isSubscriber && (
                <Button onClick={handleSubscribe} className="bg-gradient-to-r from-primary to-warning">
                  Subscribe Now
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!isSubscriber ? (
              <div className="text-center py-8">
                <Lock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">Subscribe to unlock today's top 5 premium bets</h3>
                <p className="text-muted-foreground mb-6">
                  Get access to our highest confidence predictions with detailed analysis
                </p>
                <Button onClick={handleSubscribe} size="lg" className="bg-gradient-to-r from-primary to-warning">
                  Subscribe Now - $9.99/month
                </Button>
              </div>
            ) : premiumBets.length > 0 ? (
              <div className="space-y-4">
                {premiumBets.map((bet, index) => (
                  <Card key={bet.id} className="border-warning/30">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <Badge variant="secondary" className="bg-warning/20 text-warning">
                            #{index + 1}
                          </Badge>
                          <div>
                            <h4 className="font-semibold">{bet.away_team} vs {bet.home_team}</h4>
                            <p className="text-sm text-muted-foreground">{bet.sport}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant={getConfidenceVariant(bet.prediction_confidence)}>
                            {bet.prediction_confidence}% confidence
                          </Badge>
                          <p className="text-sm text-muted-foreground mt-1">Odds: {bet.odds}</p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-3">{bet.reasoning}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No premium bets available for today</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search teams or sports..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={sportFilter} onValueChange={setSportFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by sport" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sports</SelectItem>
              {sports.map(sport => (
                <SelectItem key={sport} value={sport.toLowerCase()}>{sport}</SelectItem>
              ))}
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

        {/* Tabs for Today/Tomorrow */}
        <Tabs defaultValue="today" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="today">Today's Bets</TabsTrigger>
            <TabsTrigger value="tomorrow">Tomorrow's Bets</TabsTrigger>
          </TabsList>
          
          <TabsContent value="today" className="mt-6">
            {loading ? (
              <div className="text-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                <p className="text-muted-foreground">Loading betting data...</p>
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Today's Regular Bets</CardTitle>
                  <CardDescription>All available predictions for today</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sport</TableHead>
                        <TableHead>Matchup</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Odds</TableHead>
                        <TableHead>Confidence</TableHead>
                        <TableHead>Analysis</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedBets
                        .filter(bet => bet.game_date === new Date().toISOString().split('T')[0])
                        .map((bet) => (
                        <TableRow key={bet.id}>
                          <TableCell>
                            <Badge variant="outline">{bet.sport}</Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            {bet.away_team} vs {bet.home_team}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-1 text-sm">
                              <Clock className="h-3 w-3" />
                              <span>{bet.game_time}</span>
                            </div>
                          </TableCell>
                          <TableCell>{bet.odds}</TableCell>
                          <TableCell>
                            <Badge variant={getConfidenceVariant(bet.prediction_confidence)}>
                              {bet.prediction_confidence}%
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-xs truncate" title={bet.reasoning}>
                            {bet.reasoning}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="tomorrow" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Tomorrow's Regular Bets</CardTitle>
                <CardDescription>Predictions for tomorrow's games</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sport</TableHead>
                      <TableHead>Matchup</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Odds</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Analysis</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedBets
                      .filter(bet => bet.game_date === new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0])
                      .map((bet) => (
                      <TableRow key={bet.id}>
                        <TableCell>
                          <Badge variant="outline">{bet.sport}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {bet.away_team} vs {bet.home_team}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1 text-sm">
                            <Clock className="h-3 w-3" />
                            <span>{bet.game_time}</span>
                          </div>
                        </TableCell>
                        <TableCell>{bet.odds}</TableCell>
                        <TableCell>
                          <Badge variant={getConfidenceVariant(bet.prediction_confidence)}>
                            {bet.prediction_confidence}%
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate" title={bet.reasoning}>
                          {bet.reasoning}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default DailyBettingInsights;