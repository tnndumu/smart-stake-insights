import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, Lock, Crown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const SimpleDailyInsights = () => {
  const { user, isSubscriber } = useAuth();

  const handleSubscribe = () => {
    if (!user) {
      window.location.href = '/auth';
      return;
    }
    // Stripe checkout will work once secret key is configured
    alert('Please configure Stripe secret key in Supabase Edge Functions settings');
  };

  const mockBets = [
    {
      id: '1',
      sport: 'NFL',
      matchup: 'Patriots vs Chiefs',
      confidence: 85,
      odds: '1.85',
      time: '8:00 PM EST'
    },
    {
      id: '2',
      sport: 'NBA',
      matchup: 'Lakers vs Warriors',
      confidence: 78,
      odds: '2.10',
      time: '7:30 PM EST'
    }
  ];

  const mockPremiumBets = [
    {
      id: '3',
      sport: 'NFL',
      matchup: 'Cowboys vs Giants',
      confidence: 92,
      odds: '1.95',
      reasoning: 'Premium analysis indicates strong value in this matchup with favorable weather conditions and key player matchups.'
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-background/95 backdrop-blur-md">
        <div className="container mx-auto px-4 py-6">
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
            ) : (
              <div className="space-y-4">
                {mockPremiumBets.map((bet, index) => (
                  <Card key={bet.id} className="border-warning/30">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-4">
                          <Badge variant="secondary" className="bg-warning/20 text-warning">
                            #{index + 1}
                          </Badge>
                          <div>
                            <h4 className="font-semibold">{bet.matchup}</h4>
                            <p className="text-sm text-muted-foreground">{bet.sport}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="default" className="bg-success">
                            {bet.confidence}% confidence
                          </Badge>
                          <p className="text-sm text-muted-foreground mt-1">Odds: {bet.odds}</p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{bet.reasoning}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Regular Bets */}
        <Card>
          <CardHeader>
            <CardTitle>Today's Regular Bets</CardTitle>
            <CardDescription>Free predictions available to all users</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {mockBets.map((bet) => (
                <div key={bet.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <Badge variant="outline">{bet.sport}</Badge>
                    <div>
                      <h4 className="font-semibold">{bet.matchup}</h4>
                      <p className="text-sm text-muted-foreground">{bet.time}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={bet.confidence >= 80 ? 'default' : 'secondary'}>
                      {bet.confidence}% confidence
                    </Badge>
                    <p className="text-sm text-muted-foreground mt-1">Odds: {bet.odds}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SimpleDailyInsights;