const searches = [
  ["Delhi", "India Gate Delhi", [77.209, 28.6139]],
  ["Mumbai", "Gateway of India Mumbai", [72.8777, 19.076]],
  ["Kolkata", "Victoria Memorial Kolkata", [88.3639, 22.5726]],
  ["Hyderabad", "Charminar Hyderabad", [78.4867, 17.385]],
  ["Kochi", "Fort Kochi Kerala", [76.2673, 9.9312]],
  ["Guwahati", "Kamakhya Temple Guwahati", [91.7362, 26.1445]],
];

const routes = [
  ["Delhi", [77.209, 28.6139], [77.241, 28.6562]],
  ["Mumbai", [72.8777, 19.076], [72.8347, 18.922]],
  ["Bengaluru", [77.5946, 12.9716], [77.6209, 12.9352]],
  ["Chennai", [80.2707, 13.0827], [80.2824, 13.0475]],
  ["Guwahati", [91.7362, 26.1445], [91.7500, 26.1800]],
  ["Srinagar", [74.7973, 34.0837], [74.8738, 34.1106]],
];

async function json(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

const results = [];
for (const [city, query, start] of searches) {
  if (!process.env.MAPPLS_REST_KEY) {
    results.push({ city, capability: "Mappls search", passed: null, skipped: "MAPPLS_REST_KEY missing" });
    continue;
  }
  try {
    const params = new URLSearchParams({ query, region: "IND", access_token: process.env.MAPPLS_REST_KEY });
    const data = await json(`https://search.mappls.com/search/places/autosuggest/json?${params}`);
    const first = data.suggestedLocations?.[0] ?? data.userAddedLocations?.[0];
    results.push({ city, capability: "Mappls search", passed: Boolean(first?.eLoc || first?.mapplsPin) });
    if (first) {
      const pin = first.eLoc ?? first.mapplsPin;
      const routeParams = new URLSearchParams({ steps: "false", access_token: process.env.MAPPLS_REST_KEY });
      const resolved = await json(`https://route.mappls.com/route/direction/route_adv/driving/${start.join(",")};${encodeURIComponent(pin)}?${routeParams}`);
      results.push({ city, capability: "Mappls pin resolution", passed: resolved.code === "Ok" && resolved.waypoints?.at(-1)?.location?.length === 2 });
    } else results.push({ city, capability: "Mappls pin resolution", passed: false, error: "No Mappls Pin returned" });
  } catch (error) {
    results.push({ city, capability: "Mappls search", passed: false, error: error.message });
  }
}

for (const [city, start, end] of routes) {
  try {
    const data = await json(`https://router.project-osrm.org/route/v1/driving/${start.join(",")};${end.join(",")}?overview=false`);
    results.push({ city, capability: "route", passed: data.code === "Ok" && Boolean(data.routes?.length) });
  } catch (error) {
    results.push({ city, capability: "route", passed: false, error: error.message });
  }
}

console.table(results);
const executed = results.filter((result) => result.passed !== null);
const failed = executed.filter((result) => !result.passed);
console.log(`${executed.length - failed.length}/${executed.length} executed checks passed; ${results.length - executed.length} skipped`);
if (failed.length) process.exitCode = 1;
