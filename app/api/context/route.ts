import { NextResponse } from "next/server";
import { allowRequest } from "@/lib/rate-limit";

const jsonHeaders = { "Cache-Control": "private, max-age=60" };
type WikiPlace = { pageid: number; title: string; dist: number; lon: number; lat: number };
type WikiPage = { pageid: number; extract?: string };
type PhotonPlace = { geometry: { coordinates: [number, number] }; properties: { name?: string; osm_type?: string; osm_id?: number; osm_key?: string; osm_value?: string; city?: string; district?: string; state?: string } };
type NewsArticle = { url: string; title: string; domain?: string };
type ContextItem = { id: string; type: string; title: string; summary: string; location?: [number, number]; sourceName: string; sourceUrl: string; fetchedAt: number; validUntil: number; confidence: number; urgency: number };

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`Provider HTTP ${response.status}`);
  return response.json() as Promise<unknown>;
}

function distanceMetres(from: [number, number], to: [number, number]) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(to[1] - from[1]);
  const dLon = radians(to[0] - from[0]);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from[1])) * Math.cos(radians(to[1])) * Math.sin(dLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function osmUrl(place: PhotonPlace) {
  const kind = place.properties.osm_type === "N" ? "node" : place.properties.osm_type === "R" ? "relation" : "way";
  return `https://www.openstreetmap.org/${kind}/${place.properties.osm_id}`;
}

function matchesCategory(type: string, place: PhotonPlace) {
  const { osm_key: key, osm_value: value, name = "" } = place.properties;
  if (type === "food") return key === "amenity" && ["restaurant", "cafe", "fast_food"].includes(value ?? "");
  if (type === "culture") return (key === "tourism" && ["museum", "gallery", "artwork"].includes(value ?? "")) || key === "historic" || (key === "amenity" && ["arts_centre", "theatre"].includes(value ?? ""));
  if (type === "scenic") return (key === "leisure" && ["park", "garden", "nature_reserve"].includes(value ?? "")) || (key === "tourism" && value === "viewpoint") || key === "natural";
  if (type === "business") return key === "shop" || (["building", "landuse"].includes(key ?? "") && ["commercial", "retail", "yes"].includes(value ?? "") && /mall|shopping|market/i.test(name));
  if (type === "sport") return key === "sport" || (key === "leisure" && ["stadium", "sports_centre", "pitch", "track"].includes(value ?? ""));
  return false;
}

export async function GET(request: Request) {
  if (!allowRequest(request, "context", 30, 60_000)) return NextResponse.json({ error: "Too many context requests" }, { status: 429 });
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 6 || lat > 38 || lon < 68 || lon > 98) return NextResponse.json({ error: "Coordinates must be inside India" }, { status: 400 });
  const fetchedAt = Date.now();
  const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}%7C${lon}&gsradius=10000&gslimit=8&format=json&origin=*`;
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&timezone=auto`;
  const reverseUrl = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}`;
  const [wikiResult, weatherResult, reverseResult] = await Promise.allSettled([
    fetchJson(wikiUrl, { headers: { "User-Agent": "Marga/0.1 (India road guide prototype)" } }),
    fetchJson(weatherUrl),
    fetchJson(reverseUrl, { headers: { "User-Agent": "Marga/0.1 (India road guide prototype)" } }),
  ]);
  const wikiPayload = wikiResult.status === "fulfilled" ? wikiResult.value as { query?: { geosearch?: WikiPlace[] } } : null;
  const wikiPlaces = wikiPayload?.query?.geosearch ?? [];
  let extracts = new Map<number, string>();
  if (wikiPlaces.length) {
    try {
      const detailsUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&exsentences=2&pageids=${wikiPlaces.map((place) => place.pageid).join("|")}&format=json&origin=*`;
      const details = await fetchJson(detailsUrl, { headers: { "User-Agent": "Marga/0.1 (India road guide prototype)" } }) as { query?: { pages?: Record<string, WikiPage> } };
      extracts = new Map(Object.values(details.query?.pages ?? {}).flatMap((page) => page.extract ? [[page.pageid, page.extract.slice(0, 500)] as [number, string]] : []));
    } catch { extracts = new Map(); }
  }
  const places: ContextItem[] = wikiPlaces.map((place) => ({
    id: `wikipedia-${place.pageid}`,
    type: "landmark",
    title: place.title,
    summary: extracts.get(place.pageid) ?? `${place.title} is about ${Math.max(1, Math.round(place.dist / 100) / 10)} km from your current position.`,
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
  const reverse = reverseResult.status === "fulfilled" ? reverseResult.value as { features?: PhotonPlace[] } : null;
  const area = reverse?.features?.[0]?.properties;
  const locality = area?.city ?? area?.district ?? area?.state;
  const region = [locality, area?.state, "India"].filter((value, index, values) => value && values.indexOf(value) === index).join(" ");
  const categories = [
    { query: "restaurant", type: "food", label: "food option" },
    { query: "museum", type: "culture", label: "museum or cultural place" },
    { query: "park", type: "scenic", label: "park or nature stop" },
    { query: "shopping mall", type: "business", label: "shopping place" },
    { query: "stadium", type: "sport", label: "sports venue" },
  ];
  const categoryResults = locality ? await Promise.allSettled(categories.map((category) => fetchJson(`https://photon.komoot.io/api/?q=${encodeURIComponent(`${category.query} ${region}`)}&lat=${lat}&lon=${lon}&limit=8&lang=en`, { headers: { "User-Agent": "Marga/0.1 (India road guide prototype)" } }))) : [];
  const seenOsmIds = new Set<string>();
  const osmItems: ContextItem[] = categoryResults.flatMap((result, index) => {
    if (result.status !== "fulfilled") return [];
    const category = categories[index];
    const photon = result.value as { features?: PhotonPlace[] };
    return (photon.features ?? []).flatMap((place) => {
      const point = place.geometry.coordinates;
      const id = `photon-${place.properties.osm_type}-${place.properties.osm_id}`;
      const name = place.properties.name?.trim();
      if (!name || !matchesCategory(category.type, place) || !point.every(Number.isFinite) || distanceMetres([lon, lat], point) > 10_000 || seenOsmIds.has(id)) return [];
      seenOsmIds.add(id);
      const foodNote = category.type === "food" ? " Opening hours and ratings are not verified." : "";
      return [{ id, type: category.type, title: name, summary: `${name} is a nearby ${category.label} listed in OpenStreetMap.${foodNote}`, location: point, sourceName: "OpenStreetMap via Photon", sourceUrl: osmUrl(place), fetchedAt, validUntil: fetchedAt + 24 * 60 * 60 * 1000, confidence: .66, urgency: .08 }];
    });
  });
  const food = osmItems.filter((place) => place.type === "food");
  const localPlaces = osmItems.filter((place) => place.type !== "food");
  let news: ContextItem[] = [];
  try {
    if (locality) {
      const gdeltUrl = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(`"${locality}" India`)}&mode=artlist&format=json&maxrecords=5&timespan=24h&sort=datedesc`;
      const gdelt = await fetchJson(gdeltUrl, { headers: { "User-Agent": "Marga/0.1 (India road guide prototype)" } }) as { articles?: NewsArticle[] };
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
  return NextResponse.json({ candidates: [...(weather ? [weather] : []), ...places, ...localPlaces, ...food, ...news], availability: { landmarks: places.length > 0 || localPlaces.some((place) => place.type === "culture"), food: food.length > 0, weather: Boolean(weather), culture: localPlaces.some((place) => place.type === "culture"), nature: localPlaces.some((place) => place.type === "scenic"), shopping: localPlaces.some((place) => place.type === "business"), sports: localPlaces.some((place) => place.type === "sport"), traffic: false, incidents: false, events: false, news: news.length > 0 }, limitations: { traffic: "No reliable free nationwide feed configured", incidents: "No verified incident provider configured", events: "No reliable nationwide event feed configured" }, fetchedAt }, { headers: jsonHeaders });
}
