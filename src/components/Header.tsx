import { Button } from "@/components/ui/button";
import { Trophy, TrendingUp, Target, User, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { BRAND } from "@/config/brand";

const Header = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

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
                {BRAND.NAME}
              </h1>
              <p className="text-xs text-muted-foreground">{BRAND.TAGLINE}</p>
            </div>
          </div>
          
          <nav className="hidden md:flex items-center space-x-6">
            <Button
              variant="ghost"
              onClick={() => navigate('/daily-betting-insights')}
            >
              Daily Insights
            </Button>
            <button 
              className="text-foreground hover:text-primary transition-colors cursor-pointer"
              onClick={() => {
                const element = document.getElementById('predictions');
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth' });
                }
              }}
            >
              Predictions
            </button>
            <button 
              className="text-foreground hover:text-primary transition-colors cursor-pointer"
              onClick={() => {
                const element = document.getElementById('stats');
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth' });
                }
              }}
            >
              Statistics
            </button>
          </nav>
          
          <div className="flex items-center space-x-3">
            {user ? (
              <>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate('/daily-betting-insights')}
                >
                  <Target className="h-4 w-4 mr-2" />
                  Insights
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={signOut}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate('/auth')}
                >
                  <User className="h-4 w-4 mr-2" />
                  Sign In
                </Button>
                <Button 
                  variant="default" 
                  size="sm"
                  onClick={() => navigate('/daily-betting-insights')}
                >
                  <Target className="h-4 w-4 mr-2" />
                  Get Picks
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;