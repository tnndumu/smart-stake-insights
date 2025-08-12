
// supabase/functions/odds-proxy/index.ts
// Proxy for The Odds API. Reads ODDS_API_KEY from server secrets.
// Query params: sport, markets (csv), regions (csv), dateFrom, dateTo
// Example frontend call:
//   /functions/v1/odds-proxy?sport=baseball_mlb&markets=h2h,spreads,totals&regions=us

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
const BASE = "https://api.the-odds-api.com/v4";

function badRequest(msg: string) {
  return new Response(JSON.stringify({ error: msg }), {
    status: 400,
    headers: { "content-type": "application/json" },
  });
}

serve(async (req: Request) => {
  const url = new URL(req.url);
  const apiKey = Deno.env.get("ODDS_API_KEY");
  if (!apiKey) return badRequest("Server missing ODDS_API_KEY");

  const sport = url.searchParams.get("sport");
  const markets = url.searchParams.get("markets") ?? "h2h,spreads,totals";
  const regions = url.searchParams.get("regions") ?? "us";
  const bookmakers = url.searchParams.get("bookmakers") ?? "";
  if (!sport) return badRequest("Missing sport param");

  const params = new URLSearchParams({
    apiKey, regions, markets, oddsFormat: "american", dateFormat: "iso",
  });
  if (bookmakers) params.set("bookmakers", bookmakers);

  const upstream = `${BASE}/sports/${encodeURIComponent(sport)}/odds/?${params.toString()}`;
  try {
    const res = await fetch(upstream, { headers: { accept: "application/json" } });
    const body = await res.text();
    const headers = new Headers({
      "content-type": res.headers.get("content-type") ?? "application/json",
      "x-odds-requests-remaining": res.headers.get("x-requests-remaining") ?? "",
      "x-odds-requests-used": res.headers.get("x-requests-used") ?? "",
    });
    return new Response(body, { status: res.status, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Upstream fetch failed", detail: String(err) }), {
      status: 502, headers: { "content-type": "application/json" },
    });
  }
});
