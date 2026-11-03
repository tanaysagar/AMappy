import { mkdir, readFile, writeFile } from "node:fs/promises";

const radians = (value) => value * Math.PI / 180;
function distanceMetres(a, b) {
  const lat1 = radians(a[1]), lat2 = radians(b[1]);
  const dLat = radians(b[1] - a[1]), dLon = radians(b[0] - a[0]);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

const cases = JSON.parse(await readFile(new URL("../data/address-acceptance.india.json", import.meta.url), "utf8"));
const limitArg = process.argv.find((value) => value.startsWith("--limit="));
const nameArg = process.argv.find((value) => value.startsWith("--name="));
const kindArg = process.argv.find((value) => value.startsWith("--kind="));
const matching = cases.filter((item) => (!nameArg || item.name.toLowerCase().includes(nameArg.split("=")[1].toLowerCase())) && (!kindArg || item.kind === kindArg.split("=")[1]));
const selected = limitArg ? matching.slice(0, Number(limitArg.split("=")[1])) : matching;
const key = process.env.MAPPLS_REST_KEY;
if (!key) throw new Error("MAPPLS_REST_KEY is required. Put it in ignored .env.local.");

async function json(url) {
  const started = performance.now();
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  return { body: text ? JSON.parse(text) : null, latencyMs: Math.round(performance.now() - started) };
}

async function findPlace(item) {
  const params = new URLSearchParams({ query: item.query, location: `${item.bias[1]},${item.bias[0]}`, region: "IND", access_token: key });
  const autosuggest = item.query.length <= 45 ? await json(`https://search.mappls.com/search/places/autosuggest/json?${params}`) : { body: null, latencyMs: 0 };
  let first = autosuggest.body?.suggestedLocations?.[0] ?? autosuggest.body?.userAddedLocations?.[0];
  if (first) return { first, latencyMs: autosuggest.latencyMs };
  const text = item.query.length <= 45 ? await json(`https://search.mappls.com/search/places/textsearch/json?${params}`) : { body: null, latencyMs: 0 };
  first = text.body?.suggestedLocations?.[0] ?? text.body?.userAddedLocations?.[0];
  if (first) return { first, latencyMs: autosuggest.latencyMs + text.latencyMs };
  const geocodeParams = new URLSearchParams({ address: item.query, itemCount: "5", region: "IND", access_token: key });
  const geocode = await json(`https://search.mappls.com/search/address/geocode?${geocodeParams}`);
  const results = Array.isArray(geocode.body?.copResults) ? geocode.body.copResults : geocode.body?.copResults ? [geocode.body.copResults] : [];
  first = results[0] ? { ...results[0], eLoc: results[0].eLoc ?? results[0].eloc, placeName: results[0].houseName ?? results[0].poi, placeAddress: results[0].formattedAddress ?? results[0].formatted_address } : null;
  return { first, latencyMs: autosuggest.latencyMs + text.latencyMs + geocode.latencyMs };
}

const results = [];
for (const item of selected) {
  try {
    const search = await findPlace(item);
    const first = search.first;
    const pin = first?.eLoc ?? first?.mapplsPin;
    if (!pin) throw new Error("No Mappls Pin");
    const routeParams = new URLSearchParams({ steps: "false", geometries: "geojson", overview: "false", access_token: key });
    const resolved = await json(`https://route.mappls.com/route/direction/route_adv/driving/${item.bias.join(",")};${encodeURIComponent(pin)}?${routeParams}`);
    const point = resolved.body.waypoints?.at(-1)?.location;
    if (!Array.isArray(point) || point.length !== 2) throw new Error("Pin did not resolve");
    const errorMetres = Math.round(distanceMetres(point, item.expected));
    results.push({ name: item.name, kind: item.kind, passed: errorMetres <= item.maxErrorMetres, errorMetres, maxErrorMetres: item.maxErrorMetres, searchLatencyMs: search.latencyMs, resolveLatencyMs: resolved.latencyMs, result: first.placeName || first.placeAddress || pin });
  } catch (error) {
    results.push({ name: item.name, kind: item.kind, passed: false, error: error.message });
  }
}

const passed = results.filter((item) => item.passed).length;
const latencies = results.flatMap((item) => [item.searchLatencyMs, item.resolveLatencyMs]).filter(Number.isFinite).sort((a, b) => a - b);
const report = { runAt: new Date().toISOString(), total: results.length, passed, passRate: results.length ? passed / results.length : 0, medianLatencyMs: latencies.length ? latencies[Math.floor(latencies.length / 2)] : null, results };
await mkdir(new URL("../outputs/", import.meta.url), { recursive: true });
const reportName = nameArg || kindArg || limitArg ? "address-acceptance.filtered.json" : "address-acceptance.json";
await writeFile(new URL(`../outputs/${reportName}`, import.meta.url), JSON.stringify(report, null, 2));
console.table(results);
console.log(`${passed}/${results.length} address checks passed; report: outputs/${reportName}`);
if (passed !== results.length) process.exitCode = 1;
