export function americanToDecimal(odds: number) {
  if (!Number.isFinite(odds)) return NaN;
  return odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds);
}
export function impliedFromAmerican(odds: number) {
  if (!Number.isFinite(odds)) return NaN;
  return odds > 0 ? 100 / (odds + 100) : Math.abs(odds) / (Math.abs(odds) + 100);
}
export function fmtOdds(v?: number) { return typeof v === "number" ? (v > 0 ? `+${v}` : `${v}`) : "—"; }
export function fmtPct(p?: number)  { return typeof p === "number" ? `${Math.round(p * 100)}%` : "—"; }
export function fmtPoint(x?: number){ return typeof x === "number" ? (x>0?`+${x}`:`${x}`) : "—"; }

// Pick the side with larger model probability. Return edge vs market.
export function pickByModel(
  modelAway?: number, modelHome?: number, mlAway?: number, mlHome?: number
) {
  if (typeof modelAway !== "number" || typeof modelHome !== "number") return null;
  if (!Number.isFinite(mlAway!) || !Number.isFinite(mlHome!)) return null;

  const side = modelAway >= modelHome ? "away" : "home";
  const modelP = side === "away" ? modelAway : modelHome;
  const price  = side === "away" ? mlAway! : mlHome!;
  const marketP = impliedFromAmerican(price);

  // Edge = model% − market implied%
  const edge = modelP - marketP; // e.g., +0.06 = +6%
  return { side, modelP, price, marketP, edge };
}