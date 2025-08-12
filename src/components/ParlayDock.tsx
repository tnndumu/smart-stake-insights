import React, { useMemo, useState } from "react";
import { useParlay, summarize } from "@/state/parlay";
import { formatAmerican } from "@/utils/odds";

export default function ParlayDock() {
  const { legs, remove, clear } = useParlay();
  const [open, setOpen] = useState(false);
  const [stake, setStake] = useState(50);

  const summary = useMemo(() => summarize(legs, stake), [legs, stake]);
  const count = legs.length;

  return (
    <>
      <button
        aria-label="Parlay"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-50 rounded-xl shadow-lg bg-amber-500 hover:bg-amber-600 text-black px-4 py-2 font-semibold"
      >
        Parlay {count ? `(${count})` : ""}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setOpen(false)}>
          <div className="absolute right-0 top-0 h-full w-[380px] bg-zinc-950 border-l border-zinc-800 p-4 overflow-y-auto" onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Parlay Picker</h3>
              <button className="text-sm text-zinc-400 hover:text-white" onClick={() => setOpen(false)}>Close</button>
            </div>

            {count === 0 ? (
              <div className="text-sm text-zinc-400">No legs yet. Click "Add to Parlay" on any game.</div>
            ) : (
              <>
                <ul className="space-y-2 mb-4">
                  {legs.map((l) => (
                    <li key={l.id} className="p-2 rounded-lg border border-zinc-800">
                      <div className="text-sm font-medium">{l.away} @ {l.home}</div>
                      <div className="text-xs text-zinc-400">
                        {l.market} • {l.side.toUpperCase()} {l.point!=null ? ` ${l.point>0?`+${l.point}`:l.point}` : ""} • {formatAmerican(l.price)} • {l.book || "book"}
                      </div>
                      <div className="text-xs text-zinc-500">{new Date(l.start).toLocaleString()}</div>
                      <button onClick={() => remove(l.id)} className="mt-1 text-xs text-rose-300 hover:text-rose-200">Remove</button>
                    </li>
                  ))}
                </ul>

                <div className="space-y-2">
                  <label className="text-sm">Stake ($)</label>
                  <input type="number" min={1} value={stake} onChange={(e)=>setStake(Number(e.target.value))}
                         className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2" />
                  <div className="text-sm">
                    Combined odds: <span className="font-semibold">{formatAmerican(summary.american)}</span><br/>
                    Implied win chance: <span className="font-semibold">{Math.round(summary.implied*100)}%</span><br/>
                    Est. payout: <span className="font-semibold">${summary.payout.toFixed(2)}</span>
                  </div>
                  <button onClick={clear} className="text-xs text-zinc-400 hover:text-white">Clear all</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}