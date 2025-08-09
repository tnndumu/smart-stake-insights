import type { Game } from '@/services/leagues';

// Lightweight Elo with home advantage and recent-form boost
type TeamState = { elo: number; last5: number[]; lastPlayedUtc?: string };

const HOME_ADV = 55;        // Elo pts
const K = 18;               // update factor
const RECENT_WEIGHT = 30;   // extra Elo from recent form (+/-)

const state = new Map<string, TeamState>();

function get(team: string): TeamState {
  if (!state.has(team)) state.set(team, { elo: 1500, last5: [] });
  return state.get(team)!;
}

function winProb(eloA: number, eloB: number) {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

function recentAdj(team: TeamState) {
  if (!team.last5.length) return 0;
  const avg = team.last5.reduce((a,b)=>a+b,0) / team.last5.length; // +1 win, 0 loss
  return (avg - 0.5) * 2 * RECENT_WEIGHT; // range ~[-30,+30]
}

export function predict(game: Game) {
  const home = get(game.home);
  const away = get(game.away);
  const eloHome = home.elo + HOME_ADV + recentAdj(home);
  const eloAway = away.elo + recentAdj(away);

  const pHome = winProb(eloHome, eloAway);
  const pAway = 1 - pHome;

  // Human-readable analysis
  const bullets = [
    `Home advantage: +${HOME_ADV} Elo`,
    home.last5.length ? `Home recent form (last 5): ${home.last5.join('-')} => adj ${recentAdj(home).toFixed(0)}` : 'Home recent form: n/a',
    away.last5.length ? `Away recent form (last 5): ${away.last5.join('-')} => adj ${recentAdj(away).toFixed(0)}` : 'Away recent form: n/a',
    `Base ratings: ${game.home} ${home.elo.toFixed(0)} vs ${game.away} ${away.elo.toFixed(0)}`
  ];

  return {
    probHome: pHome,
    probAway: pAway,
    analysis: bullets,
    recommendation: pHome > 0.6 ? `Strong ${game.home} pick` : pAway > 0.6 ? `Strong ${game.away} pick` : 'Close matchup'
  };
}

// TODO: On final score ingest, update Elo and push last5 arrays.