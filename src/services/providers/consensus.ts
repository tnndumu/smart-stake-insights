import type { NormalizedBook, NormalizedOddsRow } from "./types";

export function norm(s: string) {
  return String(s || "").toUpperCase().replace(/[^A-Z0-9 ]+/g, "").replace(/\s+/g, " ").trim();
}

/** MLB nicknames → canonical */
const MLB_SYNONYMS: Record<string,string> = {
  "D BACKS":"ARIZONA DIAMONDBACKS","DBACKS":"ARIZONA DIAMONDBACKS","D-BACKS":"ARIZONA DIAMONDBACKS",
  "BOSOX":"BOSTON RED SOX","RED SOX":"BOSTON RED SOX",
  "WHITESOX":"CHICAGO WHITE SOX","WHITE SOX":"CHICAGO WHITE SOX","CHISOX":"CHICAGO WHITE SOX",
  "JAYS":"TORONTO BLUE JAYS","BLUE JAYS":"TORONTO BLUE JAYS",
  "YANKS":"NEW YORK YANKEES","YANKEES":"NEW YORK YANKEES","METS":"NEW YORK METS",
  "HALOS":"LOS ANGELES ANGELS","ANGELS":"LOS ANGELES ANGELS","DODGERS":"LOS ANGELES DODGERS",
  "GUARDS":"CLEVELAND GUARDIANS","CARDS":"ST. LOUIS CARDINALS","ROX":"COLORADO ROCKIES",
  "NATS":"WASHINGTON NATIONALS","OS":"BALTIMORE ORIOLES","O S":"BALTIMORE ORIOLES","O'S":"BALTIMORE ORIOLES"
};
export function canonicalMLB(s: string) {
  const n = norm(s);
  if (MLB_SYNONYMS[n]) return MLB_SYNONYMS[n];
  if (n.includes("SOX")) return n.includes("WHITE") ? "CHICAGO WHITE SOX" : "BOSTON RED SOX";
  return n;
}

/** Soccer nicknames → canonical (EPL/MLS – keep conservative) */
const SOCCER_SYNONYMS: Record<string,string> = {
  "MAN CITY":"MANCHESTER CITY","MAN U":"MANCHESTER UNITED","MAN UNITED":"MANCHESTER UNITED",
  "SPURS":"TOTTENHAM HOTSPUR","GUNNERS":"ARSENAL","HAMMERS":"WEST HAM UNITED","TOON":"NEWCASTLE UNITED",
  "WOLVES":"WOLVERHAMPTON WANDERERS","BRIGHTON":"BRIGHTON AND HOVE ALBION","ASTON VILLA":"ASTON VILLA",
  "CHELSEA":"CHELSEA","LIVERPOOL":"LIVERPOOL","EVERTON":"EVERTON","FULHAM":"FULHAM","BRENTFORD":"BRENTFORD",
  // MLS
  "LAFC":"LOS ANGELES FC","LA GALAXY":"LA GALAXY","RED BULLS":"NEW YORK RED BULLS","NYCFC":"NEW YORK CITY FC",
  "INTER MIAMI":"INTER MIAMI CF","AUSTIN":"AUSTIN FC","CHARLOTTE":"CHARLOTTE FC","SOUNDERS":"SEATTLE SOUNDERS FC"
};
export function canonicalSoccer(s: string) {
  const n = norm(s);
  return SOCCER_SYNONYMS[n] || n;
}

type Price = { price: number; point?: number; source: string };
const BOOK_KEYS = ["fanduel","draftkings","betmgm","caesars"];

function collectPrices(books: NormalizedBook[], teamOrOU: string, market: "h2h"|"spreads"|"totals", isSoccer=false): Price[] {
  const out: Price[] = [];
  for (const b of books) {
    const source = (b.bookmaker || b.key || "").toString().toLowerCase();
    const m = (b.markets || []).find(m => m.key === market);
    if (!m) continue;
    if (market === "totals") {
      for (const o of m.outcomes || []) {
        if (/^over$/i.test(o.name) || /^under$/i.test(o.name)) {
          out.push({ price: Number(o.price), point: o.point, source });
        }
      }
    } else {
      const canon = isSoccer ? canonicalSoccer : canonicalMLB;
      const t = (m.outcomes || []).find(o => canon(o.name) === canon(teamOrOU));
      if (t && isFinite(Number(t.price))) out.push({ price: Number(t.price), point: t.point, source });
    }
  }
  return out;
}

function cluster<T extends Price>(arr: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const p of arr) {
    const key = (p.point != null ? `${p.point}` : "") + `@${p.price}`;
    const list = map.get(key) || []; list.push(p); map.set(key, list);
  }
  return map;
}

/** 2-of-3 consensus: primary aggregator books (filtered) + ESPN */
export function consensusForTeam(
  teamOrOU: string,
  primary: NormalizedBook[],
  espn: NormalizedBook[],
  market: "h2h"|"spreads"|"totals",
  isSoccer=false
) {
  const primaryFiltered = primary.filter(b => BOOK_KEYS.includes((b.bookmaker||b.key||"").toString().toLowerCase()));
  const all = [
    ...collectPrices(primaryFiltered, teamOrOU, market, isSoccer),
    ...collectPrices(espn, teamOrOU, market, isSoccer).map(x => ({ ...x, source: "espn" }))
  ];
  if (!all.length) return null;
  const buckets = [...cluster(all).values()].sort((a,b)=>b.length - a.length);
  const top = buckets[0];
  return top.length >= 2 ? top[0] : null; // need agreement from ≥2 sources
}

export function consensusRow(
  sport: "MLB"|"NBA"|"NHL"|"NFL"|"EPL"|"MLS",
  rowPrimary: NormalizedOddsRow | null,
  rowESPN: NormalizedOddsRow | null
) {
  if (!rowPrimary && !rowESPN) return null;
  const isSoccer = sport === "EPL" || sport === "MLS";
  const home = (rowPrimary || rowESPN)!.home;
  const away = (rowPrimary || rowESPN)!.away;
  const pb = rowPrimary?.books || [];
  const eb = rowESPN?.books || [];
  const hHome = consensusForTeam(home, pb, eb, "h2h", isSoccer);
  const hAway = consensusForTeam(away, pb, eb, "h2h", isSoccer);
  const spHome = consensusForTeam(home, pb, eb, "spreads", isSoccer);
  const spAway = consensusForTeam(away, pb, eb, "spreads", isSoccer);
  const tOver  = consensusForTeam("Over", pb, eb, "totals", isSoccer);
  const tUnder = consensusForTeam("Under", pb, eb, "totals", isSoccer);
  return { home, away, hHome, hAway, spHome, spAway, tOver, tUnder };
}