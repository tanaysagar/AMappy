import { NextResponse } from "next/server";
import { mapplsFailure, parseMapplsPoint, parseMapplsRouteEndpoint } from "@/lib/mappls";
import { allowRequest } from "@/lib/rate-limit";

export async function GET(request: Request) {
  if (!allowRequest(request, "resolve", 30, 60_000)) return NextResponse.json({ error: "Too many place requests" }, { status: 429 });
  const url = new URL(request.url);
  const pin = String(url.searchParams.get("pin") ?? "").trim();
  if (!/^[A-Za-z0-9_-]{3,32}$/.test(pin)) return NextResponse.json({ error: "Invalid Mappls pin", code: "INVALID_PIN" }, { status: 400 });
  const key = process.env.MAPPLS_REST_KEY;
  if (!key) return NextResponse.json({ error: "Mappls is not configured", code: "MAPPLS_NOT_CONFIGURED" }, { status: 503 });
  try {
    const response = await fetch(`https://place.mappls.com/O2O/entity/place-details/${encodeURIComponent(pin)}?access_token=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error(`Mappls details returned ${response.status}`);
    let point = parseMapplsPoint(await response.json());
    if (!point) {
      const lat = Number(url.searchParams.get("lat")); const lon = Number(url.searchParams.get("lon"));
      const start = Number.isFinite(lat) && Number.isFinite(lon) && lat >= 6 && lat <= 38 && lon >= 68 && lon <= 98 ? `${lon},${lat}` : "77.209,28.6139";
      const params = new URLSearchParams({ steps: "false", geometries: "geojson", overview: "full", access_token: key });
      const route = await fetch(`https://route.mappls.com/route/direction/route_adv/driving/${start};${encodeURIComponent(pin)}?${params}`, { signal: AbortSignal.timeout(8_000) });
      if (route.ok) point = parseMapplsRouteEndpoint(await route.json());
    }
    if (!point) return NextResponse.json({ error: "Mappls could not resolve this place. Drop a pin to select it exactly.", code: "MAPPLS_COORDINATES_UNAVAILABLE" }, { status: 422 });
    return NextResponse.json({ point, provider: "Mappls" }, { headers: { "Cache-Control": "private, max-age=3600" } });
  } catch (error) {
    return NextResponse.json(mapplsFailure(error), { status: 503 });
  }
}
