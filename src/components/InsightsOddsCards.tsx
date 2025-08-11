import React from 'react';

const InsightsOddsCards = () => {
  return (
    <div id="insights-cards" style={{ maxWidth: '1150px', margin: 'auto' }}>
      <style dangerouslySetInnerHTML={{
        __html: `
          .grid{display:grid;gap:14px}
          @media (min-width:900px){ .grid{grid-template-columns:1fr 1fr} }
          .card{background:#0e1529;border:1px solid #1f2a4d;border-radius:14px;padding:16px}
          @media (prefers-color-scheme: light){ .card{background:#fff;border-color:#e6ebff;color:#0b1020} }
          .row{display:flex;justify-content:space-between;align-items:center;gap:10px}
          .pill{font-size:12px;padding:4px 8px;border:1px solid #1f2a4d;border-radius:999px}
          .title{font-weight:700;font-size:18px;margin:8px 0}
          .muted{color:#9fb0d9}@media (prefers-color-scheme: light){.muted{color:#4b5a7a}}
          .btn{display:inline-flex;gap:8px;align-items:center;justify-content:center;padding:10px 12px;border:1px solid #1f2a4d;border-radius:10px;background:#121a33;color:#eaf0ff;cursor:pointer;width:100%}
          .btn:hover{filter:brightness(1.05)}
          .drawer{position:fixed;inset:auto 0 0 0;max-height:70vh;background:inherit;border-top:1px solid #1f2a4d;padding:16px;display:none;overflow:auto;box-shadow:0 -10px 40px rgba(0,0,0,.4)}
          .drawer.open{display:block}
          .book{display:grid;grid-template-columns:1fr auto auto auto;gap:6px;border-bottom:1px dashed #1f2a4d;padding:6px 0}
          .best{outline:2px solid #6aa2ff;border-radius:6px;padding:0 4px}
          .hdr{display:flex;gap:8px;align-items:center}
          .live{color:#6efacc}
        `
      }} />
      
      <script dangerouslySetInnerHTML={{
        __html: `
          (function(){
            // ----- CONFIG from Site Variables -----
            const ENV = (window.env||{});
            const ODDS_KEY = (ENV.ODDS_API_KEY||"").trim();
            const ODDS_REGION = (ENV.ODDS_REGION||"us").trim();
            const ODDS_BOOKMAKERS = (ENV.ODDS_BOOKMAKERS||"draftkings,betmgm,fanduel,caesars").trim();
            const BACKEND = (ENV.BACKEND_URL||"").trim(); // optional schedules proxy

            // Map league slug -> The Odds API sport key
            const SPORT_KEY = {
              mlb: "baseball_mlb",
              nba: "basketball_nba",
              nhl: "icehockey_nhl",
              nfl: "americanfootball_nfl",
              mls: "soccer_usa_mls",
              soccer: "soccer_usa_mls" // extend later if you show other comps
            };

            // ----- UI SHELL -----
            const root = document.getElementById("insights-cards");
            root.innerHTML = \`
              <div class="row" style="margin-bottom:10px">
                <div class="hdr">
                  <label class="muted">League</label>
                  <select id="lg" class="pill">
                    <option value="mlb" selected>MLB</option>
                    <option value="nba">NBA</option>
                    <option value="nhl">NHL</option>
                    <option value="nfl">NFL</option>
                    <option value="mls">MLS</option>
                    <option value="soccer">Soccer</option>
                  </select>
                  <label class="muted">Date</label>
                  <input id="dt" type="date" class="pill">
                  <button id="refresh" class="pill">Reload</button>
                  <span id="status" class="muted" aria-live="polite"></span>
                </div>
                <div class="muted">Live auto-refresh 30s</div>
              </div>
              <div id="cards" class="grid" aria-live="polite"></div>
              <div id="drawer" class="drawer" role="dialog" aria-modal="true" aria-label="Game analysis"></div>
            \`;

            // ----- DATE DEFAULT -----
            const el = id => document.getElementById(id);
            const today = new Date(); el("dt").valueAsNumber = today.setMinutes(today.getMinutes() - today.getTimezoneOffset());

            // ----- EVENTS -----
            let timer = null, currentLeague = "mlb";
            el("lg").addEventListener("change", () => { currentLeague = el("lg").value; load(); });
            el("dt").addEventListener("change", load);
            el("refresh").addEventListener("click", load);

            // first load + polling
            load();
            if (timer) clearInterval(timer);
            timer = setInterval(load, 30000); // refresh odds/scores every 30s

            // ----- LOAD PIPELINE -----
            async function load(){
              const league = currentLeague;
              const date = el("dt").value;
              const status = el("status"); status.textContent = "Loading…";
              const cards = el("cards"); cards.innerHTML = "";

              try{
                // 1) Schedule
                const schedule = await getSchedule(league, date);
                // 2) Odds (real)
                const odds = await getOdds(league);
                // 3) Merge by team names + time proximity
                const rows = merge(schedule, odds);

                if(!rows.length){ status.textContent = "No games found."; return; }
                status.textContent = \`Loaded \${rows.length} games.\`;
                rows.sort((a,b)=> new Date(a.time) - new Date(b.time));

                for(const g of rows){
                  const conf = g.odds ? calcConfidence(g.odds) : null; // implied, not dummy
                  const bestML = g.odds ? formatBestML(g.odds) : "—";
                  const liveTag = isLive(g.status) ? '<span class="pill live">LIVE</span>' : '';

                  const card = document.createElement("div");
                  card.className = "card";
                  card.innerHTML = \`
                    <div class="row">
                      <span class="pill">\${league.toUpperCase()}</span>
                      <span class="pill">\${fmtDate(g.time)}</span>
                      \${officialTag(league, g)}
                    </div>
                    <div class="title">\${esc(g.away)} @ \${esc(g.home)}</div>
                    <div class="muted" style="margin:6px 0">\${liveTag} Status: \${esc(g.status||"scheduled")} • Venue: \${esc(g.venue||"")}</div>
                    <div class="muted" style="margin:6px 0">Best ML (Away/Home): \${bestML}</div>
                    <div class="muted">\${conf ? \`Confidence: <strong>\${(conf*100).toFixed(1)}%</strong> (\${esc(conf>0.5?g.home:g.away)} slight edge)\` : "Confidence: —"}</div>
                    <div style="margin-top:10px"><button class="btn">🔎 View Full Analysis</button></div>
                  \`;
                  card.querySelector(".btn").addEventListener("click", ()=> openDrawer(g));
                  cards.appendChild(card);
                }
              }catch(e){ console.error(e); status.textContent="Error loading data."; }
            }

            // ----- SCHEDULES -----
            async function getSchedule(league, date){
              if (BACKEND){
                const u = \`\${BACKEND}/api/schedule?league=\${league}&date=\${date}\`;
                const r = await fetch(u); const j = await r.json();
                if (Array.isArray(j)) return j.map(n => ({
                  league, time:n.date_utc, status:(n.status||"").toLowerCase(),
                  home:n.home?.name, away:n.away?.name, venue:n.venue, gamePk:n.extras?.gamePk||n.game_id
                }));
                return [];
              }
              // client fallback (MLB/NHL public endpoints)
              if (league==="mlb"){
                const r = await fetch(\`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=\${date}\`); const j = await r.json(); const out=[];
                for(const d of j.dates||[]) for(const g of d.games||[]) out.push({
                  league, time:g.gameDate, status:(g.status?.detailedState||"").toLowerCase(),
                  home:g.teams?.home?.team?.name, away:g.teams?.away?.team?.name, venue:g.venue?.name||"", gamePk:g.gamePk
                });
                return out;
              }
              if (league==="nhl"){
                const r = await fetch(\`https://statsapi.web.nhl.com/api/v1/schedule?date=\${date}\`); const j = await r.json(); const out=[];
                for(const d of j.dates||[]) for(const g of d.games||[]) out.push({
                  league, time:g.gameDate, status:(g.status?.detailedState||"").toLowerCase(),
                  home:g.teams?.home?.team?.name, away:g.teams?.away?.team?.name, venue:g.venue?.name||"", gamePk:g.gamePk
                });
                return out;
              }
              // NBA/NFL/MLS/Soccer need the backend for schedules in fallback mode
              return [];
            }

            // ----- ODDS (The Odds API, real) -----
            async function getOdds(league){
              if (!ODDS_KEY) return []; // show schedules without odds if key missing
              const key = SPORT_KEY[league];
              if (!key) return [];
              const url = new URL(\`https://api.the-odds-api.com/v4/sports/\${key}/odds\`);
              url.searchParams.set("regions", ODDS_REGION);
              url.searchParams.set("markets", "h2h,spreads,totals");
              url.searchParams.set("oddsFormat", "american");
              url.searchParams.set("dateFormat", "iso");
              url.searchParams.set("bookmakers", ODDS_BOOKMAKERS);
              url.searchParams.set("apiKey", ODDS_KEY);
              const r = await fetch(url);
              if (!r.ok) return [];
              const arr = await r.json();
              return (arr||[]).map(e => ({
                start: e.commence_time,
                home: e.home_team, away: e.away_team,
                books: e.bookmakers||[]
              }));
            }

            // ----- MERGE -----
            function merge(sched, odds){
              const norm = s => String(s||"").toUpperCase().replace(/[^A-Z0-9 ]+/g,"").replace(/\\s+/g," ").trim();
              const rows = [];
              for (const s of sched){
                const A = norm(s.away), H = norm(s.home), t = new Date(s.time).getTime();
                let match = null, bestDelta = Infinity;
                for (const o of odds){
                  const oa = norm(o.away), oh = norm(o.home), ot = new Date(o.start).getTime();
                  const delta = Math.abs(ot - t);
                  if ((oa===A && oh===H) && delta < bestDelta){ bestDelta = delta; match = o; }
                }
                rows.push({ ...s, odds: match });
              }
              return rows;
            }

            // ----- CONFIDENCE from odds (vig-adjusted) -----
            function implied(am){
              const v = Number(am);
              if (!isFinite(v) || v===0) return null;
              return v>0 ? 100/(v+100) : (-v)/((-v)+100);
            }
            function calcConfidence(odd){
              const m = collectMarkets(odd).h2h;
              // choose best ML (highest price) per side across books
              let bestAway=null, bestHome=null;
              for (const bk of m){
                const a = bk.outcomes.find(x=>/away|visitor/i.test(x.name)) || bk.outcomes[0];
                const h = bk.outcomes.find(x=>/home/i.test(x.name)) || bk.outcomes[1];
                if (a && (!bestAway || Number(a.price) > Number(bestAway.price))) bestAway = a;
                if (h && (!bestHome || Number(h.price) > Number(bestHome.price))) bestHome = h;
              }
              const pA = implied(bestAway?.price), pH = implied(bestHome?.price);
              if (pA==null || pH==null) return null;
              // no-vig normalization so they sum to 1
              const Z = pA + pH;
              const nh = pH / Z; // home win probability
              return Math.max(nh, 1-nh); // confidence of the favorite
            }

            // ----- MARKETS HELPERS -----
            function collectMarkets(odd){
              const out = { h2h:[], spreads:[], totals:[] };
              for (const b of odd.books||[]){
                const bk = b.title || b.key || "book";
                for (const m of (b.markets||[])){
                  const k = m.key || m.market || "";
                  if (k==="h2h") out.h2h.push({book:bk, outcomes:(m.outcomes||[]).map(x=>({name:x.name, price:x.price}))});
                  if (k==="spreads") out.spreads.push({book:bk, outcomes:(m.outcomes||[]).map(x=>({name:x.name, price:x.price, point:x.point}))});
                  if (k==="totals") out.totals.push({book:bk, outcomes:(m.outcomes||[]).map(x=>({name:x.name, price:x.price, point:x.point}))});
                }
              }
              return out;
            }
            function formatBestML(odd){
              const mkts = collectMarkets(odd).h2h;
              if (!mkts.length) return "—";
              const away = [], home = [];
              for (const m of mkts){
                const a = m.outcomes.find(x=>/away|visitor/i.test(x.name)) || m.outcomes[0];
                const h = m.outcomes.find(x=>/home/i.test(x.name)) || m.outcomes[1];
                if (a) away.push(a.price);
                if (h) home.push(h.price);
              }
              const bA = away.sort((x,y)=>y-x)[0], bH = home.sort((x,y)=>y-x)[0];
              const pA = implied(bA), pH = implied(bH);
              return (bA!=null && bH!=null)
                ? \`<span class="best">\${bA}</span> / <span class="best">\${bH}</span> <span class="muted">(\${pct(pA)}/\${pct(pH)})</span>\`
                : "—";
            }
            function pct(x){ return (x==null) ? "—" : (x*100).toFixed(1)+"%"; }

            // ----- DRAWER (Full Analysis) -----
            function openDrawer(row){
              const d = el("drawer");
              const o = row.odds ? collectMarkets(row.odds) : null;
              const mlbLink = (row.league==="mlb" && row.gamePk) ? \`https://www.mlb.com/gameday/\${row.gamePk}\` : "";
              const nhlScores = (row.league==="nhl") ? \`https://www.nhl.com/scores/\${formatDate(row.time)}\` : "";

              d.innerHTML = \`
                <button class="pill" onclick="this.parentElement.classList.remove('open')">Close</button>
                <h3 style="margin:8px 0">\${esc(row.away)} @ \${esc(row.home)}</h3>
                <div class="muted">\${fmtDateTime(row.time)} • \${esc(row.venue||"")} • \${row.league.toUpperCase()}</div>
                \${o ? \`
                  <h4>Moneyline (all books)</h4>
                  \${renderBookTable(o.h2h)}
                  <h4>Spreads</h4>
                  \${renderBookTable(o.spreads)}
                  <h4>Totals</h4>
                  \${renderBookTable(o.totals)}
                \` : \`<div class="muted">No odds available for this matchup.</div>\`}
                <div style="margin-top:10px">
                  \${mlbLink?\`<a class="pill" target="_blank" rel="noopener" href="\${mlbLink}">Official Gameday</a>\`:""}
                  \${nhlScores?\`<a class="pill" target="_blank" rel="noopener" href="\${nhlScores}">Official Scoreboard</a>\`:""}
                </div>
              \`;
              d.classList.add("open");
            }
            function renderBookTable(mkt){
              if (!mkt || !mkt.length) return "<div class='muted'>—</div>";
              return mkt.map(m=>\`
                <div class="book">
                  <strong>\${esc(m.book)}</strong>
                  <span>\${(m.outcomes||[]).map(o=>esc(o.name)).join(" / ")}</span>
                  <span>\${(m.outcomes||[]).map(o=>o.point!=null?esc(o.point):"").join(" / ")}</span>
                  <span>\${(m.outcomes||[]).map(o=>esc(o.price)).join(" / ")}</span>
                </div>\`).join("");
            }

            // ----- UTILITIES -----
            function isLive(s){ s=(s||"").toLowerCase(); return /live|in[- ]progress|period|quarter|top|bottom|half|ot|so/.test(s); }
            function fmtDate(iso){ const d=new Date(iso); return isNaN(d)?"":d.toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}); }
            function fmtDateTime(iso){ const d=new Date(iso); return isNaN(d)?"":d.toLocaleString([], {weekday:'short', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}); }
            function formatDate(iso){ const d=new Date(iso); const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,"0"), da=String(d.getDate()).padStart(2,"0"); return \`\${y}-\${m}-\${da}\`; }
            function esc(s){ return String(s||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","'":"&#039;"}[m])); }
            function officialTag(league, g){ return league==="mlb" && g.gamePk ? '<span class="pill">OFFICIAL</span>' : ''; }
          })();
        `
      }} />
    </div>
  );
};

export default InsightsOddsCards;