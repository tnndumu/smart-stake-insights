
// supabase/functions/odds-proxy/index.ts
// Proxy for The Odds API. Reads ODDS_API_KEY from server secrets.
// Query params: sport, markets (csv), regions (csv), dateFrom, dateTo
// Example frontend call:
//   /functions/v1/odds-proxy?sport=baseball_mlb&markets=h2h,spreads,totals&regions=us

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const BASE = "https://api.the-odds-api.com/v4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function badRequest(msg: string) {
  return new Response(JSON.stringify({ error: msg }), {
    status: 400,
    headers: { 
      "content-type": "application/json",
      ...corsHeaders
    },
  });
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const apiKey = Deno.env.get("ODDS_API_KEY");
  if (!apiKey) return badRequest("Server missing ODDS_API_KEY");

  const sport = url.searchParams.get("sport");         // e.g., baseball_mlb
  const markets = url.searchParams.get("markets") ?? "h2h,spreads,totals";
  const regions = url.searchParams.get("regions") ?? "us"; // us,us2,eu,uk,au
  const dateFrom = url.searchParams.get("dateFrom");   // optional ISO
  const dateTo   = url.searchParams.get("dateTo");     // optional ISO

  if (!sport) return badRequest("Missing sport param");

  // We use /sports/{sport}/odds with multi-markets so the client makes one call.
  const params = new URLSearchParams({
    apiKey,
    regions,
    markets,
    oddsFormat: "american",
    dateFormat: "iso",
  });
  if (dateFrom) params.set("dateFormat", "iso"); // already default; kept for clarity

  const upstream = `${BASE}/sports/${encodeURIComponent(sport)}/odds/?${params.toString()}`;

  try {
    console.log(`Fetching odds from: ${upstream.replace(apiKey, '[REDACTED]')}`);
    const res = await fetch(upstream, { headers: { "accept": "application/json" }});
    
    // Pass through vendor rate-limit headers for visibility
    const body = await res.text();
    const headers = new Headers({
      "content-type": res.headers.get("content-type") ?? "application/json",
      "x-odds-requests-remaining": res.headers.get("x-requests-remaining") ?? "",
      "x-odds-requests-used": res.headers.get("x-requests-used") ?? "",
      ...corsHeaders
    });
    
    console.log(`Odds API response: ${res.status}, remaining requests: ${res.headers.get("x-requests-remaining")}`);
    return new Response(body, { status: res.status, headers });
  } catch (err) {
    console.error('Odds API fetch error:', err);
    return new Response(JSON.stringify({ error: "Upstream fetch failed", detail: String(err) }), {
      status: 502,
      headers: { 
        "content-type": "application/json",
        ...corsHeaders
      },
    });
  }
});
