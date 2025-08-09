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

export async function fetchUpcomingGames(opts?: { 
  days?: number; 
  onLeagueComplete?: (leagueName: string, games: Game[]) => void;
}) {
  const days = opts?.days ?? 7;
  const onLeagueComplete = opts?.onLeagueComplete;
  const today = new Date();
  
  // Track all games and completion
  const allGames: Game[] = [];
  const byLeague: Record<League, Game[]> = {
    NFL: [], NBA: [], MLB: [], NHL: [], WNBA: [], EPL: [], MLS: []
  } as Record<League, Game[]>;

  // Process each day and league with incremental callbacks
  const datePromises: Promise<void>[] = [];
  
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    
    // Process each adapter for this date
    for (const adapter of adapters) {
      const promise = (async () => {
        try {
          // Add 5 second timeout per league
          const timeoutPromise = new Promise<Game[]>((_, reject) => 
            setTimeout(() => reject(new Error(`${adapter.id} timeout`)), 5000)
          );
          
          const fetchPromise = adapter.fetchByDate 
            ? adapter.fetchByDate(dateStr) 
            : Promise.resolve([]);
          
          const games = await Promise.race([fetchPromise, timeoutPromise]);
          
          // Add league info to games
          const leagueGames = games.map(g => ({ ...g, league: adapter.id }));
          
          // Update collections
          allGames.push(...leagueGames);
          byLeague[adapter.id].push(...leagueGames);
          
          // Call callback immediately when this league completes
          if (onLeagueComplete && leagueGames.length > 0) {
            onLeagueComplete(adapter.id, leagueGames);
          }
          
        } catch (error) {
          console.warn(`${adapter.id} failed for ${dateStr}:`, error);
          // Still call callback with empty array to signal completion
          if (onLeagueComplete) {
            onLeagueComplete(adapter.id, []);
          }
        }
      })();
      
      datePromises.push(promise);
    }
  }

  // Wait for all to complete
  await Promise.allSettled(datePromises);

  // Remove duplicates and sort by start time
  const uniqueGames = allGames.filter((game, index, self) => 
    index === self.findIndex(g => g.id === game.id && g.league === game.league)
  );
  uniqueGames.sort((a, b) => a.startUtc.localeCompare(b.startUtc));

  // Update byLeague with deduplicated games
  const finalByLeague: Record<League, Game[]> = {
    NFL: [], NBA: [], MLB: [], NHL: [], WNBA: [], EPL: [], MLS: []
  } as Record<League, Game[]>;
  for (const g of uniqueGames) {
    (finalByLeague[g.league as League] ||= []).push(g);
  }

  const meta = {
    days,
    startDate: today.toISOString().split('T')[0],
    endDate: new Date(today.getTime() + (days - 1) * 86400000).toISOString().split('T')[0],
    total: uniqueGames.length
  };

  return { all: uniqueGames, byLeague: finalByLeague, meta };
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