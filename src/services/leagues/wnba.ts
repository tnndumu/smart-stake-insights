import type { Game, LeagueAdapter } from './index';

// This path mirrors the data the schedule page uses; if it changes, fall back to Stats endpoints.
const FEED = 'https://stats.wnba.com/stats/scoreboardV2'; 
// Params: DayOffset, LeagueID=10, gameDate=MM/DD/YYYY

function toMMDDYYYY(yyyy_mm_dd: string) {
  const [y,m,d] = yyyy_mm_dd.split('-');
  return `${m}/${d}/${y}`;
}

export const WNBAAdapter: LeagueAdapter = {
  id: 'WNBA',
  async fetchByDate(date) {
    try {
      const params = new URLSearchParams({
        DayOffset: '0',
        LeagueID: '10',
        gameDate: toMMDDYYYY(date),
      });
      const r = await fetch(`${FEED}?${params.toString()}`, {
        headers: {
          'Origin': 'https://stats.wnba.com',
          'Referer': 'https://stats.wnba.com/',
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json, text/plain, */*',
        }
      });
      if (!r.ok) return [];
      const j = await r.json();
      // The scoreboardV2 response has resultSets; extract games from 'GameHeader'
      const rs = (j?.resultSets ?? []).find((x:any)=> x?.name === 'GameHeader');
      const rows = rs?.rowSet ?? [];
      const idx = Object.fromEntries(rs?.headers?.map((h:string,i:number)=>[h,i]) ?? []);
      return rows.map((row:any[]): Game => ({
        id: String(row[idx.GAME_ID]),
        league: 'WNBA',
        startUtc: row[idx.GAME_DATE_EST] ? new Date(row[idx.GAME_DATE_EST]).toISOString() : row[idx.GAME_STATUS_TEXT],
        home: row[idx.HOME_TEAM_ABBREVIATION] || row[idx.HOME_TEAM_ID] || 'Unknown',
        away: row[idx.VISITOR_TEAM_ABBREVIATION] || row[idx.VISITOR_TEAM_ID] || 'Unknown',
        venue: row[idx.ARENA_NAME],
        extra: row
      }));
    } catch (error) {
      console.warn('WNBA adapter failed:', error);
      return [];
    }
  }
};

export default WNBAAdapter;