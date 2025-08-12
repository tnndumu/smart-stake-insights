import React from 'react';
import { Trophy } from 'lucide-react';
import InsightsOddsCards from '@/components/InsightsOddsCards';
import { BRAND } from '@/config/brand';

const SimpleDailyInsights = () => {

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
              <p className="text-sm text-muted-foreground">{BRAND.TAGLINE}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <InsightsOddsCards />
      </div>
    </div>
  );
};

export default SimpleDailyInsights;