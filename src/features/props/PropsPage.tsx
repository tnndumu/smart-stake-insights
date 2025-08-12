import React, { useEffect, useState } from "react";

export default function PropsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [league, setLeague] = useState("NBA"); // good default for props
  const [dateISO, setDateISO] = useState(new Date().toISOString().slice(0,10));

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Try The Odds API player props (may require higher plan)
        const sportKeyMap: any = {
          NBA: "basketball_nba", NFL: "americanfootball_nfl", MLB: "baseball_mlb",
          NHL: "icehockey_nhl", EPL: "soccer_epl", MLS: "soccer_usa_mls", WNBA: "basketball_wnba"
        };
        const sport = sportKeyMap[league];
        const base = (window as any)?.env?.VITE_SUPABASE_URL || import.meta.env?.VITE_SUPABASE_URL;
        const url = base
          ? `${base.replace(/\/$/,"")}/functions/v1/odds-proxy?sport=${sport}&regions=us&bookmakers=draftkings,betmgm,fanduel,caesars&markets=player_points,player_assists,player_rebounds,player_goals,player_shots_on_target&date=${dateISO}`
          : "";
        if (!url) { setRows([]); return; }
        const r = await fetch(url);
        setRows(r.ok ? await r.json() : []);
      } catch { setRows([]); }
      setLoading(false);
    })();
  }, [league, dateISO]);

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h2 className="text-xl font-semibold mb-3">Best Props (beta)</h2>
      <div className="flex gap-2 mb-3">
        <select value={league} onChange={(e)=>setLeague(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1">
          {["NBA","NFL","MLB","NHL","EPL","MLS","WNBA"].map(l => <option key={l}>{l}</option>)}
        </select>
        <input type="date" value={dateISO} onChange={(e)=>setDateISO(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1"/>
      </div>

      {loading ? <div className="text-sm text-zinc-400">Loading props…</div> :
       !rows?.length ? <div className="text-sm text-zinc-400">not yet (enable props markets on your odds provider plan)</div> :
       <div className="grid md:grid-cols-2 gap-3">
         {rows.slice(0,50).map((g:any, i:number) => (
           <div key={i} className="p-3 rounded-xl border border-zinc-800">
             <div className="text-sm font-medium mb-1">{g.away} @ {g.home}</div>
             {(g.books||[]).map((b:any, bi:number) => (
               <div key={bi} className="text-xs mb-1">
                 <div className="font-semibold">{b.bookmaker||b.key}</div>
                 {(b.markets||[]).filter((m:any)=>String(m.key).startsWith("player_")).slice(0,6).map((m:any, mi:number) => (
                   <div key={mi} className="text-zinc-300">
                     • {m.key}: {(m.outcomes||[]).slice(0,5).map((o:any)=>`${o.name} ${o.point ?? ""} (${o.price})`).join(" | ")}
                   </div>
                 ))}
               </div>
             ))}
           </div>
         ))}
       </div>}
    </div>
  );
}