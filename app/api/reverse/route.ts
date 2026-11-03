import { NextResponse } from "next/server";
import { parseMapplsReverse } from "@/lib/mappls";
import { allowRequest } from "@/lib/rate-limit";

export async function GET(request: Request) {
  if (!allowRequest(request, "reverse", 30, 60_000)) return NextResponse.json({ error: "Too many location requests" }, { status: 429 });
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 6 || lat > 38 || lon < 68 || lon > 98) return NextResponse.json({ error: "Coordinates must be within India", code: "OUTSIDE_INDIA" }, { status: 400 });
  const key = process.env.MAPPLS_REST_KEY;
  if (!key) return NextResponse.json({ error: "Mappls is not configured", code: "MAPPLS_NOT_CONFIGURED" }, { status: 503 });
  try {
    const params = new URLSearchParams({ lat: String(lat), lng: String(lon), access_token: key });
    const response = await fetch(`https://search.mappls.com/search/address/rev-geocode?${params}`, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error(`Mappls reverse geocode returned ${response.status}`);
    const result = parseMapplsReverse(await response.json());
    if (!result) return NextResponse.json({ error: "No Mappls address found", code: "NO_ADDRESS" }, { status: 404 });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Mappls reverse geocoding is unavailable", code: "MAPPLS_UNAVAILABLE" }, { status: 503 });
  }
}
