export function americanToDecimal(odds: number) {
  if (!Number.isFinite(odds)) return NaN;
  return odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds);
}

export function decimalToAmerican(dec: number) {
  if (!Number.isFinite(dec) || dec <= 1) return NaN;
  return dec >= 2 ? Math.round((dec - 1) * 100) : Math.round(-100 / (dec - 1));
}

export function impliedFromAmerican(odds: number) {
  if (!Number.isFinite(odds)) return NaN;
  return odds > 0 ? 100 / (odds + 100) : Math.abs(odds) / (Math.abs(odds) + 100);
}

export function combineParlay(legs: number[]) {
  const dec = legs.map(americanToDecimal).reduce((a, b) => a * b, 1);
  const am = decimalToAmerican(dec);
  const imp = 1 - legs.map(impliedFromAmerican).reduce((acc, p) => acc * (1 - p), 1);
  return { decimal: dec, american: am, implied: imp };
}

export function formatAmerican(v?: number | null) {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  return v > 0 ? `+${v}` : `${v}`;
}

export function formatPoint(v?: number | null) {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  return v > 0 ? `+${v}` : `${v}`;
}

/** "Better for the bettor" comparison via decimal odds  */
export function isBetterPrice(a?: number, b?: number) {
  if (!Number.isFinite(a)) return false;
  if (!Number.isFinite(b)) return true;
  return americanToDecimal(a!) > americanToDecimal(b!);
}