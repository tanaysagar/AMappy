const searches = [
  ["Delhi", "India Gate Delhi"],
  ["Mumbai", "Gateway of India Mumbai"],
  ["Kolkata", "Victoria Memorial Kolkata"],
  ["Hyderabad", "Charminar Hyderabad"],
  ["Kochi", "Fort Kochi Kerala"],
  ["Guwahati", "Kamakhya Temple Guwahati"],
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
for (const [city, query] of searches) {
  try {
    const data = await json(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1&lang=en`);
    results.push({ city, capability: "search", passed: Boolean(data.features?.length) });
  } catch (error) {
    results.push({ city, capability: "search", passed: false, error: error.message });
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
const failed = results.filter((result) => !result.passed);
console.log(`${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exitCode = 1;
