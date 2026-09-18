import { NextResponse } from "next/server";

const jsonHeaders = { "Cache-Control": "public, max-age=300, stale-while-revalidate=900" };
type WikiPlace = { pageid: number; title: string; dist: number; lon: number; lat: number };
type OsmPlace = { id: number; type: string; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags: { name: string; amenity: string; cuisine?: string } };
type PhotonPlace = { geometry: { coordinates: [number, number] }; properties: { name?: string; osm_type?: string; osm_id?: number } };
type NewsArticle = { url: string; title: string; domain?: string };
type ContextItem = { id: string; type: string; title: string; summary: string; location?: [number, number]; sourceName: string; sourceUrl: string; fetchedAt: number; validUntil: number; confidence: number; urgency: number };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 6 || lat > 38 || lon < 68 || lon > 98) return NextResponse.json({ error: "Coordinates must be inside India" }, { status: 400 });
  const fetchedAt = Date.now();
  const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}%7C${lon}&gsradius=10000&gslimit=8&format=json&origin=*`;
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&timezone=auto`;
  const overpassQuery = `[out:json][timeout:8];nwr(around:10000,${lat},${lon})[amenity~"restaurant|cafe"][name];out center tags 15;`;
  const [wikiResult, weatherResult, placesResult] = await Promise.allSettled([
    fetch(wikiUrl, { headers: { "User-Agent": "Marga/0.1 (India road guide prototype)" } }).then((response) => response.json()),
    fetch(weatherUrl).then((response) => response.json()),
    fetch("https://overpass-api.de/api/interpreter", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ data: overpassQuery }) }).then((response) => response.json()),
  ]);
  const wikiPayload = wikiResult.status === "fulfilled" ? wikiResult.value as { query?: { geosearch?: WikiPlace[] } } : null;
  const places: ContextItem[] = (wikiPayload?.query?.geosearch ?? []).map((place) => ({
    id: `wikipedia-${place.pageid}`,
    type: "landmark",
    title: place.title,
    summary: `${place.title} is a notable place about ${Math.max(1, Math.round(place.dist / 100) / 10)} km from your current position. Ask Marga for verified details before visiting.`,
    location: [place.lon, place.lat],
    sourceName: "Wikipedia",
    sourceUrl: `https://en.wikipedia.org/?curid=${place.pageid}`,
    fetchedAt,
    validUntil: fetchedAt + 7 * 24 * 60 * 60 * 1000,
    confidence: .76,
    urgency: .15,
  }));
  const weatherPayload = weatherResult.status === "fulfilled" ? weatherResult.value as { current?: { time: string; temperature_2m: number; apparent_temperature: number; precipitation: number; wind_speed_10m: number } } : null;
  const current = weatherPayload?.current ?? null;
  const osmPayload = placesResult.status === "fulfilled" ? placesResult.value as { elements?: OsmPlace[] } : null;
  let food: ContextItem[] = (osmPayload?.elements ?? []).map((place) => ({
    id: `osm-${place.type}-${place.id}`,
    type: "food",
    title: place.tags.name,
    summary: `${place.tags.name} is a nearby ${place.tags.amenity}${place.tags.cuisine ? ` serving ${place.tags.cuisine.replaceAll(";", ", ")}` : ""}. Opening hours and ratings are not verified.`,
    location: [place.lon ?? place.center?.lon, place.lat ?? place.center?.lat],
    sourceName: "OpenStreetMap",
    sourceUrl: `https://www.openstreetmap.org/${place.type}/${place.id}`,
    fetchedAt,
    validUntil: fetchedAt + 24 * 60 * 60 * 1000,
    confidence: .68,
    urgency: .08,
  })).filter((place) => place.location?.every(Number.isFinite));
  if (!food.length) {
    try {
      const photon = await fetch(`https://photon.komoot.io/api/?q=restaurant&lat=${lat}&lon=${lon}&limit=12&lang=en`, { headers: { "User-Agent": "Marga/0.1 (India road guide prototype)" } }).then((response) => response.json());
      food = ((photon.features ?? []) as PhotonPlace[]).map((place) => ({ id: `photon-${place.properties.osm_type}-${place.properties.osm_id}`, type: "food", title: place.properties.name ?? "Nearby restaurant", summary: `${place.properties.name ?? "A restaurant"} is a nearby food option from OpenStreetMap data. Opening hours and ratings are not verified.`, location: place.geometry.coordinates, sourceName: "OpenStreetMap via Photon", sourceUrl: `https://www.openstreetmap.org/${place.properties.osm_type}/${place.properties.osm_id}`, fetchedAt, validUntil: fetchedAt + 24 * 60 * 60 * 1000, confidence: .66, urgency: .08 })).filter((place) => place.location?.every(Number.isFinite));
    } catch { food = []; }
  }
  let news: ContextItem[] = [];
  try {
    const reverse = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}`, { headers: { "User-Agent": "Marga/0.1 (India road guide prototype)" } }).then((response) => response.json());
    const locality = reverse.features?.[0]?.properties?.city ?? reverse.features?.[0]?.properties?.district ?? reverse.features?.[0]?.properties?.state;
    if (locality) {
      const gdeltUrl = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(`"${locality}" India`)}&mode=artlist&format=json&maxrecords=5&timespan=24h&sort=datedesc`;
      const gdelt = await fetch(gdeltUrl, { headers: { "User-Agent": "Marga/0.1 (India road guide prototype)" } }).then((response) => response.json());
      news = ((gdelt.articles ?? []) as NewsArticle[]).map((article, index) => ({ id: `gdelt-${article.url}-${index}`, type: "news", title: article.title, summary: article.title, sourceName: article.domain ?? "Local news", sourceUrl: article.url, fetchedAt, validUntil: fetchedAt + 6 * 60 * 60 * 1000, confidence: .66, urgency: .05 }));
    }
  } catch { news = []; }
  const weather = current ? {
    id: `weather-${lat.toFixed(2)}-${lon.toFixed(2)}-${current.time}`,
    type: "weather",
    title: "Current weather",
    summary: `${Math.round(current.temperature_2m)}°C, feels like ${Math.round(current.apparent_temperature)}°C. Wind ${Math.round(current.wind_speed_10m)} km/h${current.precipitation > 0 ? ` with ${current.precipitation} mm precipitation` : ""}.`,
    sourceName: "Open-Meteo",
    sourceUrl: "https://open-meteo.com/",
    fetchedAt,
    validUntil: fetchedAt + 30 * 60 * 1000,
    confidence: .9,
    urgency: current.precipitation > 2 || current.wind_speed_10m > 40 ? .72 : .18,
  } : null;
  return NextResponse.json({ candidates: [...(weather ? [weather] : []), ...places, ...food, ...news], availability: { landmarks: places.length > 0, food: food.length > 0, weather: Boolean(weather), traffic: false, incidents: false, events: false, news: news.length > 0 }, limitations: { traffic: "No reliable free nationwide feed configured", incidents: "No verified incident provider configured", events: "No reliable nationwide event feed configured" }, fetchedAt }, { headers: jsonHeaders });
}
