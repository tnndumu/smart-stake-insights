import { useState, useEffect } from 'react';

interface Game {
  id: string;
  sport: string;
  homeTeam: string;
  awayTeam: string;
  gameTime: string;
  gameDate: string;
  status: 'upcoming' | 'live' | 'completed';
  homeScore?: number;
  awayScore?: number;
}

interface Prediction {
  id: number;
  sport: string;
  matchup: string;
  prediction: string;
  confidence: number;
  odds: string;
  status: 'pending' | 'won' | 'lost';
  time: string;
  date: string;
  analysis: string;
}

// Mock data service that simulates real API calls
const generateTodaysPredictions = (): Prediction[] => {
  const today = new Date();
  const todayStr = today.toLocaleDateString('en-US', { weekday: 'long' });
  
  const sports = ['NFL', 'NBA', 'MLB', 'NHL'];
  const teams = {
    NFL: ['Chiefs', 'Patriots', 'Cowboys', 'Packers', 'Steelers', 'Saints'],
    NBA: ['Lakers', 'Warriors', 'Celtics', 'Heat', 'Nets', 'Clippers'],
    MLB: ['Yankees', 'Red Sox', 'Dodgers', 'Giants', 'Astros', 'Braves'],
    NHL: ['Rangers', 'Bruins', 'Kings', 'Penguins', 'Blackhawks', 'Capitals']
  };
  
  const predictions: Prediction[] = [];
  
  // Generate 4-6 predictions for today
  const numPredictions = Math.floor(Math.random() * 3) + 4;
  
  for (let i = 0; i < numPredictions; i++) {
    const sport = sports[Math.floor(Math.random() * sports.length)] as keyof typeof teams;
    const sportTeams = teams[sport];
    const homeTeam = sportTeams[Math.floor(Math.random() * sportTeams.length)];
    let awayTeam = sportTeams[Math.floor(Math.random() * sportTeams.length)];
    
    // Ensure different teams
    while (awayTeam === homeTeam) {
      awayTeam = sportTeams[Math.floor(Math.random() * sportTeams.length)];
    }
    
    const matchup = `${awayTeam} vs ${homeTeam}`;
    
    // Generate random game time
    const hour = Math.floor(Math.random() * 6) + 6; // 6 PM to 11 PM
    const minute = Math.random() < 0.5 ? '00' : '30';
    const time = `${hour}:${minute} PM EST`;
    
    // Generate prediction types based on sport
    const predictionTypes = {
      NFL: [`${homeTeam} -${(Math.random() * 10 + 1).toFixed(1)}`, `Over ${(Math.random() * 20 + 40).toFixed(1)}`],
      NBA: [`${homeTeam} -${(Math.random() * 8 + 1).toFixed(1)}`, `Over ${(Math.random() * 30 + 210).toFixed(1)}`],
      MLB: [`${homeTeam} ML`, `Under ${(Math.random() * 2 + 8).toFixed(1)}`],
      NHL: [`${homeTeam} ML`, `Under ${(Math.random() * 2 + 5).toFixed(1)}`]
    };
    
    const prediction = predictionTypes[sport][Math.floor(Math.random() * 2)];
    const confidence = Math.floor(Math.random() * 30) + 65; // 65-95% confidence
    const odds = Math.random() < 0.5 ? `-${Math.floor(Math.random() * 30) + 105}` : `+${Math.floor(Math.random() * 200) + 100}`;
    
    predictions.push({
      id: i + 1,
      sport,
      matchup,
      prediction,
      confidence,
      odds,
      status: 'pending',
      time,
      date: 'Today',
      analysis: `Strong ${sport} matchup with favorable conditions for this prediction. Historical data supports this outcome.`
    });
  }
  
  return predictions;
};

export const useSportsData = () => {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPredictions = async () => {
      try {
        setLoading(true);
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const todaysPredictions = generateTodaysPredictions();
        setPredictions(todaysPredictions);
        setError(null);
      } catch (err) {
        setError('Failed to fetch sports data');
      } finally {
        setLoading(false);
      }
    };

    fetchPredictions();
    
    // Refresh data every 5 minutes
    const interval = setInterval(fetchPredictions, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  return { predictions, loading, error };
};