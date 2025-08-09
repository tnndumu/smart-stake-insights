import React from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface AnalysisModalProps {
  open: boolean;
  onClose: () => void;
  game: any;
}

export default function AnalysisModal({ open, onClose, game }: AnalysisModalProps) {
  if (!open || !game) return null;

  const sourceUrls = {
    MLB: 'statsapi.mlb.com',
    NBA: 'cdn.nba.com', 
    NHL: 'api-web.nhle.com',
    WNBA: 'stats.wnba.com',
    NFL: 'static.nfl.com',
    EPL: 'premierleague.com',
    MLS: 'api.mlssoccer.com'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-background w-full max-w-2xl rounded-xl p-6 space-y-4 mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">{game.away} @ {game.home}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">{game.league}</Badge>
              <span className="text-xs text-muted-foreground">
                Source: {sourceUrls[game.league as keyof typeof sourceUrls]}
              </span>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {game.venue && (
          <div className="text-sm text-muted-foreground">{game.venue}</div>
        )}
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/50 p-3 rounded-lg">
              <div className="text-sm text-muted-foreground">Home Win Probability</div>
              <div className="text-2xl font-bold text-primary">
                {(game.prediction.probHome * 100).toFixed(1)}%
              </div>
              <div className="text-sm font-medium">{game.home}</div>
            </div>
            <div className="bg-muted/50 p-3 rounded-lg">
              <div className="text-sm text-muted-foreground">Away Win Probability</div>
              <div className="text-2xl font-bold text-primary">
                {(game.prediction.probAway * 100).toFixed(1)}%
              </div>
              <div className="text-sm font-medium">{game.away}</div>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-medium mb-2">Analysis Factors</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {game.prediction.analysis.map((bullet: string, i: number) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
          
          {game.prediction.recommendation && (
            <div className="bg-primary/10 p-3 rounded-lg">
              <div className="text-sm font-medium text-primary">Recommendation</div>
              <div className="text-sm">{game.prediction.recommendation}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}