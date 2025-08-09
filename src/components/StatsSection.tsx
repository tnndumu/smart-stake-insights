import { Card } from "@/components/ui/card";
import { TrendingUp, Target, Award, Calendar } from "lucide-react";

const stats = [
  {
    label: "Overall Win Rate",
    value: "85.2%",
    subtext: "Last 30 days",
    icon: TrendingUp,
    gradient: "from-success to-success/70"
  },
  {
    label: "Total Predictions",
    value: "2,847",
    subtext: "This season",
    icon: Target,
    gradient: "from-primary to-warning"
  },
  {
    label: "Best Streak",
    value: "23",
    subtext: "Consecutive wins",
    icon: Award,
    gradient: "from-warning to-primary"
  },
  {
    label: "Average Odds",
    value: "+165",
    subtext: "Per winning pick",
    icon: Calendar,
    gradient: "from-success to-primary"
  }
];

const sportStats = [
  { sport: "NFL", winRate: 87, total: 156, color: "success" },
  { sport: "NBA", winRate: 84, total: 243, color: "primary" },
  { sport: "MLB", winRate: 82, total: 421, color: "warning" },
  { sport: "NHL", winRate: 89, total: 134, color: "success" },
  { sport: "Soccer", winRate: 78, total: 187, color: "primary" }
];

const StatsSection = () => {
  return (
    <section className="py-16 px-4 bg-secondary/20" id="stats">
      <div className="container mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">
            <span className="bg-gradient-to-r from-success to-primary bg-clip-text text-transparent">
              Track Record
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Proven results backed by data and transparent performance metrics
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {stats.map((stat, index) => (
            <Card key={index} className="p-6 text-center bg-gradient-to-br from-card to-secondary/50 border-border/50 hover:shadow-xl transition-all duration-300">
              <div className={`bg-gradient-to-r ${stat.gradient} w-12 h-12 rounded-lg flex items-center justify-center mb-4 mx-auto`}>
                <stat.icon className="h-6 w-6 text-primary-foreground" />
              </div>
              <h3 className="text-3xl font-bold mb-1">{stat.value}</h3>
              <p className="text-lg font-medium text-foreground mb-1">{stat.label}</p>
              <p className="text-sm text-muted-foreground">{stat.subtext}</p>
            </Card>
          ))}
        </div>
        
        <div className="max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-center mb-8">Performance by Sport</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {sportStats.map((sport, index) => (
              <Card key={index} className="p-4 text-center bg-gradient-to-br from-card to-secondary/30 border-border/50">
                <h4 className="text-lg font-semibold mb-2">{sport.sport}</h4>
                <div className="mb-3">
                  <div className={`text-2xl font-bold ${
                    sport.color === 'success' ? 'text-success' :
                    sport.color === 'primary' ? 'text-primary' :
                    'text-warning'
                  }`}>
                    {sport.winRate}%
                  </div>
                  <div className="text-sm text-muted-foreground">Win Rate</div>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">{sport.total} predictions</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2 mt-3">
                  <div 
                    className={`h-2 rounded-full ${
                      sport.color === 'success' ? 'bg-success' :
                      sport.color === 'primary' ? 'bg-primary' :
                      'bg-warning'
                    }`}
                    style={{ width: `${sport.winRate}%` }}
                  ></div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default StatsSection;