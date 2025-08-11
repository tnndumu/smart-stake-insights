import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart3, TrendingUp, Users, Clock } from "lucide-react";

const analysisData = [
  {
    title: "Advanced Analytics Dashboard",
    description: "Deep dive into team performance metrics, injury reports, and historical matchup data",
    features: ["Real-time odds tracking", "Weather impact analysis", "Player prop insights", "Line movement alerts"],
    icon: BarChart3,
    gradient: "from-primary to-warning"
  },
  {
    title: "Expert Consensus",
    description: "Aggregated insights from our team of professional handicappers and data scientists",
    features: ["Sharp money indicators", "Public betting percentages", "Contrarian opportunities", "Value bet alerts"],
    icon: Users,
    gradient: "from-success to-primary"
  },
  {
    title: "Live Game Analysis",
    description: "Real-time adjustments and in-game betting opportunities as events unfold",
    features: ["Live odds comparison", "Momentum indicators", "Quarter-by-quarter analysis", "Injury updates"],
    icon: Clock,
    gradient: "from-warning to-success"
  }
];

const AnalysisSection = () => {
  return (
    <section className="py-16 px-4" id="analysis">
      <div className="container mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">
            <span className="bg-gradient-to-r from-primary to-warning bg-clip-text text-transparent">
              Advanced Analysis
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Professional-grade analysis tools and insights that give you the edge in sports betting
          </p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {analysisData.map((item, index) => (
            <Card key={index} className="p-6 bg-gradient-to-br from-card to-secondary/30 border-border/50 hover:border-primary/50 transition-all duration-300 group">
              <div className={`bg-gradient-to-r ${item.gradient} w-16 h-16 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                <item.icon className="h-8 w-8 text-primary-foreground" />
              </div>
              
              <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">
                {item.title}
              </h3>
              
              <p className="text-muted-foreground mb-6 leading-relaxed">
                {item.description}
              </p>
              
              <div className="space-y-2 mb-6">
                {item.features.map((feature, featureIndex) => (
                  <div key={featureIndex} className="flex items-center space-x-2">
                    <TrendingUp className="h-4 w-4 text-success" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>
              
              <Button variant="outline" className="w-full group-hover:border-primary/50">
                Learn More
              </Button>
            </Card>
          ))}
        </div>
        
        <div className="text-center mt-12">
          <div className="bg-gradient-to-r from-primary/10 to-warning/10 rounded-2xl p-8 max-w-4xl mx-auto border border-primary/20">
            <h3 className="text-2xl font-bold mb-4">
              Ready to elevate your betting strategy?
            </h3>
            <p className="text-muted-foreground mb-6 text-lg">
              Access professional betting analysis and real-time data insights
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="bg-gradient-to-r from-primary to-warning hover:opacity-90">
                <BarChart3 className="h-5 w-5 mr-2" />
                View Analysis Tools
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AnalysisSection;