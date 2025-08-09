import { Button } from "@/components/ui/button";
import { Trophy, TrendingUp, Target } from "lucide-react";

const Header = () => {
  return (
    <header className="border-b border-border bg-background/95 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-gradient-to-r from-primary to-warning p-2 rounded-lg">
              <Trophy className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-warning bg-clip-text text-transparent">
                WinPicks Pro
              </h1>
              <p className="text-xs text-muted-foreground">Professional Betting Analysis</p>
            </div>
          </div>
          
          <nav className="hidden md:flex items-center space-x-6">
            <a href="#predictions" className="text-foreground hover:text-primary transition-colors">
              Predictions
            </a>
            <a href="#stats" className="text-foreground hover:text-primary transition-colors">
              Statistics
            </a>
            <a href="#analysis" className="text-foreground hover:text-primary transition-colors">
              Analysis
            </a>
          </nav>
          
          <div className="flex items-center space-x-3">
            <Button variant="outline" size="sm">
              <TrendingUp className="h-4 w-4 mr-2" />
              Track Record
            </Button>
            <Button variant="default" size="sm">
              <Target className="h-4 w-4 mr-2" />
              Get Picks
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;