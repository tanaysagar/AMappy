import { NextResponse } from "next/server";

function coordinate(value: string | null) {
  const [lon, lat] = String(value ?? "").split(",").map(Number);
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= 6 && lat <= 38 && lon >= 68 && lon <= 98 ? [lon, lat] : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const from = coordinate(url.searchParams.get("from"));
  const to = coordinate(url.searchParams.get("to"));
  if (!from || !to) return NextResponse.json({ error: "Route coordinates must be inside India" }, { status: 400 });
  try {
    const endpoint = `https://router.project-osrm.org/route/v1/driving/${from.join(",")};${to.join(",")}?overview=full&geometries=geojson&steps=true`;
    const response = await fetch(endpoint, { headers: { "User-Agent": "Marga/0.1 (India road guide prototype)" } });
    if (!response.ok) throw new Error();
    return NextResponse.json(await response.json(), { headers: { "Cache-Control": "public, max-age=60" } });
  } catch { return NextResponse.json({ error: "Routing provider unavailable" }, { status: 503 }); }
}
