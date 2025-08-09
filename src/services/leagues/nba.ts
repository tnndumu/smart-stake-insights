import type { Game, LeagueAdapter } from './index';

const URL = 'https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json';

export const NBAAdapter: LeagueAdapter = {
  id: 'NBA',
  async fetchByDate(date) {
    try {
      const r = await fetch(URL, { headers: { 'x-nba-stats-origin': 'stats' }});
      if (!r.ok) return [];
      const j = await r.json();
      const target = date; // YYYY-MM-DD
      const days = j?.leagueSchedule?.gameDates ?? [];
      const out: Game[] = [];
      for (const day of days) {
        if (day?.gameDate !== target) continue;
        for (const g of (day.games ?? [])) {
          out.push({
            id: String(g.gameId),
            league: 'NBA',
            startUtc: g.gameDateTimeUTC, // ISO UTC
            home: g.homeTeam?.teamName || 'Unknown',
            away: g.awayTeam?.teamName || 'Unknown',
            venue: g.arenaName,
            extra: g
          });
        }
      }
      return out;
    } catch (error) {
      console.warn('NBA adapter failed:', error);
      return [];
    }
  },
  async fetchLive() {
    try {
      const r = await fetch('https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json');
      if (!r.ok) return [];
      const j = await r.json();
      const games = j?.scoreboard?.games ?? [];
      return games
        .filter((g:any)=> g.gameStatus === 2)
        .map((g:any): Game => ({
          id: String(g.gameId || g.gameID || g.gameCode),
          league: 'NBA',
          startUtc: g.gameTimeUTC || new Date().toISOString(),
          home: g.homeTeam?.teamName || g.homeTeam?.teamTricode || 'Unknown',
          away: g.awayTeam?.teamName || g.awayTeam?.teamTricode || 'Unknown',
          venue: g.arenaName,
          extra: g
        }));
    } catch (error) {
      console.warn('NBA live failed:', error);
      return [];
    }
  }
};

export default NBAAdapter;