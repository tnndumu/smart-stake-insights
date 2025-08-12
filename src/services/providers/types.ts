export type NormalizedBookMarket = {
  key: 'h2h' | 'spreads' | 'totals';
  outcomes: Array<{ name: string; price: number; point?: number }>;
};

export type NormalizedBook = {
  key?: string; 
  bookmaker?: string; 
  title?: string;
  markets: NormalizedBookMarket[];
};

export type NormalizedOddsRow = {
  sportKey?: string;
  start: string; 
  home: string; 
  away: string;
  books: NormalizedBook[];
};