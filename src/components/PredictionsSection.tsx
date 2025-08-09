import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, TrendingUp, Target, Calendar, RefreshCw } from "lucide-react";
import { useSportsData } from "@/hooks/useSportsData";

const PredictionsSection = () => {
  const { predictions, loading, error } = useSportsData();

  if (loading) {
    return (
      <section className="py-16 px-4" id="predictions">
        <div className="container mx-auto">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading today's predictions...</p>
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
          {predictions.map((prediction) => (
            <Card key={prediction.id} className="p-6 bg-gradient-to-br from-card to-secondary/30 border-border/50 hover:border-primary/50 transition-all duration-300 group">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <Badge variant="secondary" className="text-xs">
                    {prediction.sport}
                  </Badge>
                  <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>{prediction.date}</span>
                  </div>
                  <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{prediction.time}</span>
                  </div>
                </div>
                
                <Badge 
                  variant={
                    prediction.status === "won" ? "default" : 
                    prediction.status === "lost" ? "destructive" : 
                    "outline"
                  }
                  className={
                    prediction.status === "won" ? "bg-success hover:bg-success/90" :
                    prediction.status === "pending" ? "border-warning text-warning" :
                    ""
                  }
                >
                  {prediction.status === "won" ? "WON" : 
                   prediction.status === "lost" ? "LOST" : 
                   "PENDING"}
                </Badge>
              </div>
              
              <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                {prediction.matchup}
              </h3>
              
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <div>
                    <p className="text-lg font-bold text-primary">{prediction.prediction}</p>
                    <p className="text-sm text-muted-foreground">Odds: {prediction.odds}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-4 w-4 text-success" />
                    <span className="text-sm font-medium">{prediction.confidence}% confidence</span>
                  </div>
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground mb-4">
                {prediction.analysis}
              </p>
              
              <Button variant="outline" size="sm" className="w-full group-hover:border-primary/50">
                <Target className="h-4 w-4 mr-2" />
                View Full Analysis
              </Button>
            </Card>
          ))}
        </div>
        
        <div className="text-center mt-12">
          <Button size="lg" className="bg-gradient-to-r from-primary to-warning hover:opacity-90">
            View All Predictions
          </Button>
        </div>
      </div>
    </section>
  );
};

export default PredictionsSection;