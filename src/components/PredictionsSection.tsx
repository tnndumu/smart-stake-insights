import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, TrendingUp, Target, Calendar, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchLiveGames, fetchUpcomingGames } from "@/services/leagues/all";
import { predict } from "@/services/predict";
import { DateTime } from "luxon";

const PredictionsSection = () => {
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const live = await fetchLiveGames();
        const upcoming = await fetchUpcomingGames({ days: 30 });
        const nowISO = DateTime.now().toUTC().toISO();
        const next = [
          ...live.all,
          ...upcoming.all.filter((g: any) => !g.startUtc || g.startUtc >= nowISO)
        ]
          .slice(0, 6)
          .map((g: any) => ({ ...g, prediction: predict(g) }));
        if (alive) setCards(next);
      } catch (e: any) {
        if (alive) setError(e?.message || 'Failed to load games');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

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
                {prediction.prediction.analysis[0]}
              </p>

              <Button variant="outline" size="sm" className="w-full group-hover:border-primary/50" onClick={() => (window.location.href = '/daily-betting-insights')}>
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
    </section>
  );
};

export default PredictionsSection;