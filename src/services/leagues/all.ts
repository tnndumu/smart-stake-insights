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