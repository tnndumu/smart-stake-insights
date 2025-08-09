import { MLBAdapter } from './mlb';
import { NBAAdapter } from './nba';
import { NHLAdapter } from './nhl';
import { WNBAAdapter } from './wnba';
import { NFLAdapter } from './nfl';
import { EPLAdapter } from './epl';
import { MLSAdapter } from './mls';
import type { LeagueAdapter, Game } from './index';

export const adapters: LeagueAdapter[] = [
  MLBAdapter, NBAAdapter, NHLAdapter, WNBAAdapter, NFLAdapter, EPLAdapter, MLSAdapter
];

export async function fetchOfficialGames(dateYYYYMMDD: string) {
  const results = await Promise.allSettled(adapters.map(a => a.fetchByDate(dateYYYYMMDD)));
  const games = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
  
  // Sort by start time
  games.sort((a, b) => a.startUtc.localeCompare(b.startUtc));
  
  return games;
}

export async function fetchUpcomingGames() {
  const today = new Date();
  const promises = [];
  
  // Fetch next 30 days
  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    promises.push(fetchOfficialGames(dateStr));
  }
  
  const allResults = await Promise.all(promises);
  const allGames = allResults.flat();
  
  // Remove duplicates and sort by start time
  const uniqueGames = allGames.filter((game, index, self) => 
    index === self.findIndex(g => g.id === game.id && g.league === game.league)
  );
  
  uniqueGames.sort((a, b) => a.startUtc.localeCompare(b.startUtc));
  
  return uniqueGames;
}