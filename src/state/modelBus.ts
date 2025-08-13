// Simple in-memory bus. No UI change. Keyed by league+date+teams.
type Key = string;
type Prob = { league: string; dateISO: string; away: string; home: string; awayProb?: number; homeProb?: number };
const mem = new Map<Key, Prob>();

function norm(s: string) {
  return String(s || "").toUpperCase().replace(/[^A-Z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}
function k(league: string, dateISO: string, away: string, home: string) {
  return `${norm(league)}|${dateISO}|${norm(away)}@${norm(home)}`;
}

export function putModelProb(p: Prob) {
  mem.set(k(p.league, p.dateISO, p.away, p.home), p);
}

export function getModelProb(league: string, dateISO: string, away: string, home: string): Prob | null {
  return mem.get(k(league, dateISO, away, home)) || null;
}