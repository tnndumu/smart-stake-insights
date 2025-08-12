import React, { createContext, useContext, useMemo, useState } from "react";
import { combineParlay } from "@/utils/odds";

export type ParlayLeg = {
  id: string;                 // stable key
  league: string;
  start: string;
  away: string;
  home: string;
  market: "ML" | "Spread" | "Total";
  side: "away" | "home" | "over" | "under";
  point?: number;
  price: number;
  book?: string;
};

type Ctx = {
  legs: ParlayLeg[];
  add: (leg: ParlayLeg) => void;
  remove: (id: string) => void;
  clear: () => void;
};

const ParlayCtx = createContext<Ctx | null>(null);

export function ParlayProvider({ children }: { children: React.ReactNode }) {
  const [legs, setLegs] = useState<ParlayLeg[]>([]);
  
  function add(leg: ParlayLeg) {
    setLegs((prev) => {
      const exists = prev.some((l) => l.id === leg.id);
      return exists ? prev : [...prev, leg];
    });
  }
  
  function remove(id: string) { 
    setLegs((prev) => prev.filter((l) => l.id !== id)); 
  }
  
  function clear() { 
    setLegs([]); 
  }
  
  const value = useMemo(() => ({ legs, add, remove, clear }), [legs]);
  return <ParlayCtx.Provider value={value}>{children}</ParlayCtx.Provider>;
}

export function useParlay() {
  const ctx = useContext(ParlayCtx);
  if (!ctx) throw new Error("useParlay must be used inside <ParlayProvider>");
  return ctx;
}

export function summarize(legs: ParlayLeg[], stake = 100) {
  const odds = legs.map((l) => l.price);
  const { american, implied } = combineParlay(odds);
  const payout = stake * (american > 0 ? american / 100 : 100 / Math.abs(american));
  return { american, implied, payout };
}