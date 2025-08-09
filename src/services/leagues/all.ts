import { MLBAdapter } from './mlb';
import { NBAAdapter } from './nba';
import { NHLAdapter } from './nhl';
import { WNBAAdapter } from './wnba';
import { NFLAdapter } from './nfl';
import { EPLAdapter } from './epl';
import { MLSAdapter } from './mls';
import type { LeagueAdapter, Game, League } from './index';

export const adapters: LeagueAdapter[] = [
  MLBAdapter, NBAAdapter, NHLAdapter, WNBAAdapter, NFLAdapter, EPLAdapter, MLSAdapter
];

export async function fetchOfficialGames(dateYYYYMMDD: string) {
  const results = await Promise.allSettled(
    adapters.map(a => a.fetchByDate ? a.fetchByDate(dateYYYYMMDD) : Promise.resolve([]))
  );
  const games = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
  // Sort by start time
  games.sort((a, b) => a.startUtc.localeCompare(b.startUtc));
  return games;
}

export async function fetchUpcomingGames(opts?: { days?: number }) {
  const days = opts?.days ?? 7;
  const today = new Date();
  const promises: Promise<Game[]>[] = [];

  for (let i = 0; i < days; i++) {
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

  const byLeague: Record<League, Game[]> = {
    NFL: [], NBA: [], MLB: [], NHL: [], WNBA: [], EPL: [], MLS: []
  } as Record<League, Game[]>;
  for (const g of uniqueGames) {
    (byLeague[g.league as League] ||= []).push(g);
  }

  const meta = {
    days,
    startDate: today.toISOString().split('T')[0],
    endDate: new Date(today.getTime() + (days - 1) * 86400000).toISOString().split('T')[0],
    total: uniqueGames.length
  };

  return { all: uniqueGames, byLeague, meta };
}

export async function fetchLiveGames() {
  const per = await Promise.all(
    adapters.map(async (a) => {
      try {
        const items = a.fetchLive ? await a.fetchLive() : [];
        return { league: a.id as League, games: items.map(g => ({ ...g, league: a.id })) };
      } catch {
        return { league: a.id as League, games: [] as Game[] };
      }
    })
  );
  const byLeague: Record<League, Game[]> = { NFL: [], NBA: [], MLB: [], NHL: [], WNBA: [], EPL: [], MLS: [] } as Record<League, Game[]>;
  per.forEach(x => { byLeague[x.league] = x.games; });
  const all = per.flatMap(x => x.games);
  return { all, byLeague };
}