import { NextResponse } from "next/server";

type PhotonFeature = { geometry: { coordinates: [number, number] } };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = String(url.searchParams.get("q") ?? "").trim().slice(0, 120);
  if (query.length < 3) return NextResponse.json({ features: [] });
  try {
    const endpoint = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=8&lang=en&bbox=68,6,98,38`;
    const response = await fetch(endpoint, { headers: { "User-Agent": "Marga/0.1 (India road guide prototype)" } });
    if (!response.ok) throw new Error();
    const data = await response.json() as { features?: PhotonFeature[] };
    const features = (data.features ?? []).filter((feature) => { const [lon, lat] = feature.geometry.coordinates; return lat >= 6 && lat <= 38 && lon >= 68 && lon <= 98; }).slice(0, 5);
    return NextResponse.json({ features }, { headers: { "Cache-Control": "public, max-age=3600" } });
  } catch { return NextResponse.json({ features: [], unavailable: true }, { status: 503 }); }
}
