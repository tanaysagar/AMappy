import { NextResponse } from "next/server";
import { mapplsFailure, parseMapplsGeocode, parseMapplsSearch } from "@/lib/mappls";
import { allowRequest } from "@/lib/rate-limit";

export async function GET(request: Request) {
  if (!allowRequest(request, "search", 60, 60_000)) return NextResponse.json({ error: "Too many searches" }, { status: 429 });
  const url = new URL(request.url);
  const query = String(url.searchParams.get("q") ?? "").trim().slice(0, 200);
  if (query.length < 3) return NextResponse.json({ results: [] });
  const key = process.env.MAPPLS_REST_KEY;
  if (!key) return NextResponse.json({ results: [], error: "Mappls is not configured", code: "MAPPLS_NOT_CONFIGURED" }, { status: 503 });
  try {
    const params = new URLSearchParams({ query, region: "IND", access_token: key });
    const lat = Number(url.searchParams.get("lat"));
    const lon = Number(url.searchParams.get("lon"));
    if (Number.isFinite(lat) && Number.isFinite(lon) && lat >= 6 && lat <= 38 && lon >= 68 && lon <= 98) params.set("location", `${lat},${lon}`);
    const search = async (kind: "autosuggest" | "textsearch") => {
      const response = await fetch(`https://search.mappls.com/search/places/${kind}/json?${params}`, { signal: AbortSignal.timeout(8_000) });
      if (!response.ok && response.status !== 204) throw new Error(`Mappls search returned ${response.status}`);
      const text = await response.text();
      return text ? parseMapplsSearch(JSON.parse(text)) : [];
    };
    let results = query.length <= 45 ? await search("autosuggest") : [];
    if (!results.length && query.length <= 45) results = await search("textsearch");
    if (!results.length) {
      const geocodeParams = new URLSearchParams({ address: query, itemCount: "5", region: "IND", access_token: key });
      const response = await fetch(`https://search.mappls.com/search/address/geocode?${geocodeParams}`, { signal: AbortSignal.timeout(8_000) });
      if (!response.ok && response.status !== 204) throw new Error(`Mappls geocode returned ${response.status}`);
      const text = await response.text();
      results = text ? parseMapplsGeocode(JSON.parse(text)) : [];
    }
    return NextResponse.json({ results, provider: "Mappls" }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (error) {
    return NextResponse.json({ results: [], ...mapplsFailure(error) }, { status: 503 });
  }
}
