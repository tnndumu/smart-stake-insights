import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TrendingUp, Target, Award, BarChart3 } from "lucide-react";

const Hero = () => {
  return (
    <section className="py-20 px-4">
      <div className="container mx-auto text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            <span className="bg-gradient-to-r from-primary via-warning to-primary bg-clip-text text-transparent">
              Professional
            </span>
            <br />
            <span className="text-foreground">Betting Predictions</span>
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Data-driven analysis and expert predictions to help you make informed decisions. 
            No betting, just pure intelligence.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Button 
              size="lg" 
              className="bg-gradient-to-r from-primary to-warning hover:opacity-90 text-lg px-8 py-3"
              onClick={() => {
                const element = document.getElementById('predictions');
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth' });
                }
              }}
            >
              <Target className="h-5 w-5 mr-2" />
              View Today's Picks
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="text-lg px-8 py-3"
              onClick={() => {
                const element = document.getElementById('stats');
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth' });
                }
              }}
            >
              <BarChart3 className="h-5 w-5 mr-2" />
              See Track Record
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <Card className="p-6 bg-gradient-to-br from-card to-secondary/50 border-border/50 hover:shadow-xl transition-all duration-300">
              <div className="bg-success/20 w-12 h-12 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <TrendingUp className="h-6 w-6 text-success" />
              </div>
              <h3 className="text-xl font-semibold mb-2">85% Win Rate</h3>
              <p className="text-muted-foreground">Consistently accurate predictions across all major sports</p>
            </Card>
            
            <Card className="p-6 bg-gradient-to-br from-card to-secondary/50 border-border/50 hover:shadow-xl transition-all duration-300">
              <div className="bg-primary/20 w-12 h-12 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <Award className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Expert Analysis</h3>
              <p className="text-muted-foreground">Professional analysts with years of experience</p>
            </Card>
            
            <Card className="p-6 bg-gradient-to-br from-card to-secondary/50 border-border/50 hover:shadow-xl transition-all duration-300">
              <div className="bg-warning/20 w-12 h-12 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <BarChart3 className="h-6 w-6 text-warning" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Data Driven</h3>
              <p className="text-muted-foreground">Advanced algorithms and statistical models</p>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;