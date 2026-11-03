import { NextResponse } from "next/server";
import { allowRequest } from "@/lib/rate-limit";
import { distanceMetres, type Coordinate } from "@/lib/navigation";

type RoutePayload = { code?: string; routes?: unknown[]; waypoints?: Array<{ location?: unknown }> };

function coordinate(value: string | null) {
  const [lon, lat] = String(value ?? "").split(",").map(Number);
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= 6 && lat <= 38 && lon >= 68 && lon <= 98 ? [lon, lat] : null;
}

function withDestinationAccess(data: RoutePayload, requested: number[]) {
  const value = data.waypoints?.at(-1)?.location;
  const routedDestination = Array.isArray(value) && value.length === 2 && value.every(Number.isFinite) ? value as Coordinate : null;
  return { ...data, routedDestination, destinationAccessDistanceMetres: routedDestination ? Math.round(distanceMetres(requested as Coordinate, routedDestination)) : null };
}

export async function GET(request: Request) {
  if (!allowRequest(request, "route", 30, 60_000)) return NextResponse.json({ error: "Too many route requests" }, { status: 429 });
  const url = new URL(request.url);
  const from = coordinate(url.searchParams.get("from"));
  const to = coordinate(url.searchParams.get("to"));
  if (!from || !to) return NextResponse.json({ error: "Route coordinates must be inside India" }, { status: 400 });
  const key = process.env.MAPPLS_REST_KEY;
  if (key) {
    try {
      const params = new URLSearchParams({ steps: "true", geometries: "geojson", overview: "full", region: "ind", access_token: key });
      const endpoint = `https://route.mappls.com/route/direction/route_eta/driving/${from.join(",")};${to.join(",")}?${params}`;
      const response = await fetch(endpoint, { signal: AbortSignal.timeout(12_000) });
      const data = response.ok ? await response.json() as RoutePayload : null;
      if (data?.code === "Ok" && data.routes?.length) return NextResponse.json({ ...withDestinationAccess(data, to), provider: "Mappls", trafficAwareEta: true }, { headers: { "Cache-Control": "private, max-age=30" } });
    } catch { /* Fall back to basic routing so navigation remains available. */ }
  }
  try {
    const endpoint = `https://router.project-osrm.org/route/v1/driving/${from.join(",")};${to.join(",")}?overview=full&geometries=geojson&steps=true`;
    const response = await fetch(endpoint, { headers: { "User-Agent": "Marga/0.1 (India road guide prototype)" }, signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw new Error();
    const data = await response.json() as RoutePayload;
    if (data.code !== "Ok" || !data.routes?.length) throw new Error();
    return NextResponse.json({ ...withDestinationAccess(data, to), provider: "OSRM", trafficAwareEta: false }, { headers: { "Cache-Control": "private, max-age=30" } });
  } catch { return NextResponse.json({ error: "Routing provider unavailable" }, { status: 503 }); }
}
