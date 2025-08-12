import React from 'react';

const LiveOddsWidget = () => {
  return (
    <div id="wp-sched-odds" style={{ maxWidth: '1150px', margin: 'auto' }}>
      <style dangerouslySetInnerHTML={{
        __html: `
          .wp-card{background:#0e1529;border:1px solid #1f2a4d;border-radius:14px;padding:12px}
          @media (prefers-color-scheme: light){ .wp-card{background:#fff;border-color:#e6ebff;color:#0b1020} }
          .wp-row{display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-bottom:8px}
          .wp-inp,.wp-sel{padding:8px 10px;border:1px solid #1f2a4d;border-radius:10px;background:#121a33;color:#eaf0ff}
          @media (prefers-color-scheme: light){ .wp-inp,.wp-sel{background:#fff;color:#0b1020;border-color:#e6ebff} }
          table{width:100%;border-collapse:collapse} th,td{padding:10px;border-bottom:1px solid #1f2a4d}
          @media (prefers-color-scheme: light){ th,td{border-color:#e6ebff} }
          .muted{color:#9fb0d9}@media (prefers-color-scheme: light){.muted{color:#4b5a7a}}
          /* odds highlighter */
          .hi{position:relative;padding:6px 8px;border:1px solid #1f2a4d;border-radius:10px}
          @media (prefers-color-scheme: light){ .hi{border-color:#e6ebff} }
          .hi .bar{position:absolute;inset:0;pointer-events:none;border-radius:inherit;background:linear-gradient(90deg,#ffd84a33,#ffd84a00);transform-origin:left;width:var(--pct,0%)}
          .hi .line{position:relative;font-weight:600}
          .hi .meta{position:relative;font-size:12px;opacity:.9;display:flex;gap:8px;flex-wrap:wrap}
          .hi .book{padding:2px 6px;border:1px solid #1f2a4d;border-radius:999px}
          @media (prefers-color-scheme: light){ .hi .book{border-color:#e6ebff} }
          .drawer{position:fixed;inset:auto 0 0 0;max-height:70vh;background:inherit;border-top:1px solid #1f2a4d;padding:16px;display:none;overflow:auto}
          .drawer.open{display:block}
        `
      }} />
      
      <script dangerouslySetInnerHTML={{
        __html: `
          (function(){
            const ENV=(window.env||{}), BACKEND=(ENV.BACKEND_URL||"").trim();
            const KEY=(ENV.ODDS_API_KEY||"").trim(), REGION=(ENV.ODDS_REGION||"us"), BOOKS=(ENV.ODDS_BOOKMAKERS||"draftkings,betmgm,fanduel,caesars");
            const SPORT={nba:"basketball_nba",nhl:"icehockey_nhl",mlb:"baseball_mlb",nfl:"americanfootball_nfl",mls:"soccer_usa_mls",soccer:"soccer_usa_mls"};

            const root=document.getElementById("wp-sched-odds");
            root.innerHTML=\`
              <div class="wp-card">
                <div class="wp-row">
                  <label>Date <input id="d" class="wp-inp" type="date"></label>
                  <label>Leagues
                    <select id="leagues" class="wp-sel" multiple size="6">
                      <option value="mlb" selected>MLB</option><option value="nhl" selected>NHL</option>
                      <option value="nba">NBA</option><option value="nfl">NFL</option>
                      <option value="mls">MLS</option><option value="soccer">Soccer</option>
                    </select>
                  </label>
                  <button id="tabLive" class="wp-inp">Live</button>
                  <button id="tabUpcoming" class="wp-inp">Upcoming</button>
                  <button id="reload" class="wp-inp">Reload</button>
                  <span id="status" class="muted" aria-live="polite"></span>
                </div>
                <div style="overflow:auto">
                  <table aria-live="polite" aria-describedby="status">
                    <thead><tr>
                      <th>Time (local)</th><th>Away</th><th>Home</th><th>Status</th>
                      <th>Best ML<br><span class="muted">(Away / Home)</span></th>
                      <th>Best Spread</th><th>Best Total (O/U)</th><th>Venue</th>
                    </tr></thead>
                    <tbody id="body"></tbody>
                  </table>
                </div>
              </div>
              <div id="drawer" class="drawer" role="dialog" aria-modal="true" aria-label="Game odds details"></div>
            \`;

            const el=id=>document.getElementById(id);
            const today=new Date(); el("d").valueAsNumber=today.setMinutes(today.getMinutes()-today.getTimezoneOffset());
            let tab="upcoming", timer=null;
            el("tabLive").addEventListener("click",()=>setTab("live"));
            el("tabUpcoming").addEventListener("click",()=>setTab("upcoming"));
            el("reload").addEventListener("click", reload);
            setTab("upcoming");

            function setTab(t){ tab=t; if(timer) clearInterval(timer); reload(); timer=setInterval(reload, t==="live"?30000:120000); }
            async function reload(){
              const date=el("d").value; const leagues=[...el("leagues").selectedOptions].map(o=>o.value);
              el("status").textContent="Loading…"; const tbody=el("body"); tbody.innerHTML="";
              try{
                const schedules=(await Promise.all(leagues.map(l=>getSchedule(l,date)))).flat();
                const oddsLists=(await Promise.all(leagues.map(l=>getOdds(l)))).flat();
                const rows=schedules.map(s=>({...s,odds:findOdds(oddsLists,s.away,s.home,s.time)}))
                                    .filter(r=>tab==="live"?isLive(r.status):isUpcoming(r.status))
                                    .sort((a,b)=>new Date(a.time)-new Date(b.time));
                if(!rows.length){ el("status").textContent="No games found."; return; }
                el("status").textContent=\`Loaded \${rows.length} games.\`;
                for(const r of rows){
                  const tr=document.createElement("tr");
                  tr.innerHTML=\`
                    <td>\${tlocal(r.time)}</td>
                    <td>\${esc(r.away)}</td>
                    <td>\${esc(r.home)}</td>
                    <td>\${esc(r.status||"")}</td>
                    <td>\${r.odds?bestML(r.odds):"not yet"}</td>
                    <td>\${r.odds?bestSpread(r.odds):"not yet"}</td>
                    <td>\${r.odds?bestTotal(r.odds):"not yet"}</td>
                    <td>\${esc(r.venue||"")}</td>\`;
                  tr.addEventListener("click",()=>openDrawer(r));
                  tbody.appendChild(tr);
                }
              }catch(e){ console.error(e); el("status").textContent="Error loading."; }
            }

            // schedules
            async function getSchedule(league,date){
              if(BACKEND){ const r=await fetch(\`\${BACKEND}/api/schedule?league=\${league}&date=\${date}\`); const j=await r.json();
                if(Array.isArray(j)) return j.map(n=>({league,time:n.date_utc,status:(n.status||"").toLowerCase(),home:n.home?.name,away:n.away?.name,venue:n.venue,gamePk:n.extras?.gamePk||n.game_id}));
                return []; }
              if(league==="mlb"){ const r=await fetch(\`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=\${date}\`); const j=await r.json(); const out=[];
                for(const d of j.dates||[]) for(const g of d.games||[]) out.push({league,time:g.gameDate,status:(g.status?.detailedState||"").toLowerCase(),home:g.teams?.home?.team?.name,away:g.teams?.away?.team?.name,venue:g.venue?.name||"",gamePk:g.gamePk}); return out; }
              if(league==="nhl"){ const r=await fetch(\`https://statsapi.web.nhl.com/api/v1/schedule?date=\${date}\`); const j=await r.json(); const out=[];
                for(const d of j.dates||[]) for(const g of d.games||[]) out.push({league,time:g.gameDate,status:(g.status?.detailedState||"").toLowerCase(),home:g.teams?.home?.team?.name,away:g.teams?.away?.team?.name,venue:g.venue?.name||"",gamePk:g.gamePk}); return out; }
              return []; // others via backend
            }

            // odds (The Odds API)
            async function getOdds(league){
              if(!KEY) return [];
              const k=SPORT[league]; if(!k) return [];
              const u=new URL(\`https://api.the-odds-api.com/v4/sports/\${k}/odds\`);
              u.searchParams.set("regions",REGION); u.searchParams.set("markets","h2h,spreads,totals");
              u.searchParams.set("oddsFormat","american"); u.searchParams.set("dateFormat","iso");
              u.searchParams.set("bookmakers",BOOKS); u.searchParams.set("apiKey",KEY);
              const r=await fetch(u); if(!r.ok) return []; const a=await r.json();
              return (a||[]).map(e=>({start:e.commence_time,home:e.home_team,away:e.away_team,books:e.bookmakers||[]}));
            }

            // merge helpers
            const N=s=>String(s||"").toUpperCase().replace(/[^A-Z0-9 ]+/g,"").replace(/\\s+/g," ").trim();
            function findOdds(list,away,home,time){ const A=N(away),H=N(home),t=+new Date(time); let match=null,best=1e15;
              for(const o of list){ const oa=N(o.away),oh=N(o.home),dt=Math.abs(+new Date(o.start)-t); if(oa===A&&oh===H&&dt<best){best=dt;match=o;} }
              return match; }

            // odds formatting + highlight
            function implied(am){ const v=Number(am); if(!isFinite(v)||v===0) return null; return v>0?100/(v+100):(-v)/((-v)+100); }
            function collect(o){ const out={h2h:[],spreads:[],totals:[]}; for(const b of o.books||[]){const bk=b.title||b.key||"book";
              for(const m of b.markets||[]){const k=m.key||m.market||""; if(k==="h2h") out.h2h.push({book:bk,outcomes:m.outcomes||[]});
                if(k==="spreads") out.spreads.push({book:bk,outcomes:m.outcomes||[]}); if(k==="totals") out.totals.push({book:bk,outcomes:m.outcomes||[]});}}
              return out; }
            function bestML(o){ const M=collect(o).h2h; if(!M.length) return "not yet"; let a=null,h=null;
              for(const m of M){const A=m.outcomes.find(x=>/away|visitor/i.test(x.name))||m.outcomes[0]; const H=m.outcomes.find(x=>/home/i.test(x.name))||m.outcomes[1];
                if(A && (!a || Number(A.price)>Number(a.price))) a={...A,book:m.book}; if(H && (!h || Number(H.price)>Number(h.price))) h={...H,book:m.book};}
              if(!a||!h) return "not yet"; const pA=implied(a.price), pH=implied(h.price), fav=Math.max(pA||0,pH||0);
              return \`<div class="hi"><div class="bar" style="--pct:\${(fav*100).toFixed(0)}%"></div>
                <div class="line">\${a.price} / \${h.price}</div>
                <div class="meta"><span>\${pct(pA)} / \${pct(pH)}</span><span class="book">\${esc(a.book)}</span><span class="book">\${esc(h.book)}</span></div></div>\`; }
            function bestSpread(o){ const M=collect(o).spreads; if(!M.length) return "not yet"; let best=null;
              for(const m of M){ for(const x of m.outcomes){ if(!best||Number(x.price)>Number(best.price)) best={...x,book:m.book}; } }
              return \`<div class="hi"><div class="bar" style="--pct:100%"></div><div class="line">\${esc(best.name)} \${best.point??""} @ \${best.price}</div><div class="meta"><span class="book">\${esc(best.book)}</span></div></div>\`; }
            function bestTotal(o){ const M=collect(o).totals; if(!M.length) return "not yet"; let O=null,U=null;
              for(const m of M){ for(const x of m.outcomes){ if(/over/i.test(x.name)){ if(!O||Number(x.price)>Number(O.price)) O={...x,book:m.book}; }
                                       if(/under/i.test(x.name)){ if(!U||Number(x.price)>Number(U.price)) U={...x,book:m.book}; } } }
              return \`<div class="hi"><div class="bar" style="--pct:100%"></div>
                <div class="line">\${O?\`O \${O.point} @ \${O.price}\`:""} \${O&&U?\`/\`:""} \${U?\`U \${U.point} @ \${U.price}\`:""}</div>
                <div class="meta">\${O?\`<span class="book">\${esc(O.book)}</span>\`:""} \${U?\`<span class="book">\${esc(U.book)}</span>\`:""}</div></div>\`; }
            function pct(x){ return x==null?"not yet":(x*100).toFixed(1)+"%"; }

            // drawer
            function openDrawer(r){ const d=el("drawer"); const o=r.odds?collect(r.odds):null; const mlb=(r.league==="mlb"&&r.gamePk)?\`https://www.mlb.com/gameday/\${r.gamePk}\`:"";
              d.innerHTML=\`<button class="wp-inp" onclick="this.parentElement.classList.remove('open')">Close</button>
                <h3 style="margin:8px 0">\${esc(r.away)} @ \${esc(r.home)}</h3>
                <div class="muted">\${tlocal(r.time)} • \${esc(r.venue||"")} • \${r.league.toUpperCase()}</div>
                \${o?renderFull(o):'<div class="muted">No odds available.</div>'}
                \${mlb?\`<div style="margin-top:10px"><a class="wp-inp" target="_blank" rel="noopener" href="\${mlb}">Official Gameday</a></div>\`:""}\`; d.classList.add("open"); }
            function renderFull(m){ const row=(t)=>t.map(v=>\`<div style="display:grid;grid-template-columns:1fr auto auto auto;gap:6px;border-bottom:1px dashed #1f2a4d;padding:6px 0">
              <strong>\${esc(v.book)}</strong><span>\${(v.outcomes||[]).map(o=>esc(o.name)).join(' / ')}</span>
              <span>\${(v.outcomes||[]).map(o=>o.point??'').join(' / ')}</span><span>\${(v.outcomes||[]).map(o=>esc(o.price)).join(' / ')}</span></div>\`).join("");
              return \`<h4>Moneyline</h4>\${row(m.h2h)}<h4>Spreads</h4>\${row(m.spreads)}<h4>Totals</h4>\${row(m.totals)}\`; }

            // utils
            function isLive(s){ s=(s||"").toLowerCase(); return /live|in[- ]progress|period|quarter|top|bottom|half|ot|so/.test(s); }
            function isUpcoming(s){ s=(s||"").toLowerCase(); return /scheduled|pre|preview|time tbd|warmup/.test(s); }
            function tlocal(iso){ const d=new Date(iso); return isNaN(d)?"":d.toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}); }
            function esc(s){ return String(s||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","'":"&#039;"}[m])); }
          })();
        `
      }} />
    </div>
  );
};

export default LiveOddsWidget;