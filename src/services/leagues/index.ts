export type Game = {
  id: string;
  league: 'MLB'|'NBA'|'NHL'|'WNBA'|'NFL'|'EPL'|'MLS';
  startUtc: string;            // ISO UTC
  home: string;
  away: string;
  venue?: string;
  extra?: Record<string, any>; // raw fields for debugging
};

export interface LeagueAdapter {
  id: Game['league'];
  fetchByDate(dateYYYYMMDD: string): Promise<Game[]>;
}