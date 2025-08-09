import { MLBAdapter } from './mlb';
import { NBAAdapter } from './nba';
import { NHLAdapter } from './nhl';
import { WNBAAdapter } from './wnba';
import type { LeagueAdapter, Game } from './index';

export const adapters: LeagueAdapter[] = [
  MLBAdapter, NBAAdapter, NHLAdapter, WNBAAdapter
];

export async function fetchOfficialGames(dateYYYYMMDD: string) {
  const results = await Promise.allSettled(adapters.map(a => a.fetchByDate(dateYYYYMMDD)));
  const games = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
  
  // Sort by start time
  games.sort((a, b) => a.startUtc.localeCompare(b.startUtc));
  
  return games;
}