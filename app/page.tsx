"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ArrowUp, BookOpen, Car, Check, Clock3, Compass, Download, LocateFixed, MapPin, Mic, MicOff, Navigation, Pause, Play, Route, Send, Sparkles, Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSession, distanceMetres, updateSession, type RouteSession, type RouteStep } from "@/lib/navigation";
import { selectAnnouncement, type ContextCandidate } from "@/lib/attention";
import { addJourneyEvent, addJourneySample, completeJourney, createJourney, summarizeJourney, type JourneyRecord } from "@/lib/journey";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

type LngLat = [number, number];
type SearchResult = { display_name: string; lat: string; lon: string };
type SearchFeature = { properties: { name?: string; city?: string; state?: string }; geometry: { coordinates: LngLat } };
type OsrmStep = { distance: number; duration: number; name?: string; maneuver?: { type?: string; modifier?: string; location: LngLat } };
type OsrmRoute = { distance: number; duration: number; geometry: GeoJSON.LineString; legs?: Array<{ steps?: OsrmStep[] }> };
type AskPayload = { answer: string; sources?: Array<{ name: string; url: string }> };
type SpeechResultEvent = { results: ArrayLike<{ 0: { transcript: string } }> };
type SpeechRecognitionInstance = { lang: string; interimResults: boolean; onstart: () => void; onend: () => void; onerror: () => void; onresult: (event: SpeechResultEvent) => void; start: () => void };
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;
type ModelContext = { registerTool: (tool: { name: string; description: string; inputSchema: object; execute: (input: { question: string }) => Promise<object> }) => void; unregisterTool?: (name: string) => void };
const DELHI: LngLat = [77.209, 28.6139];
const RED_FORT: LngLat = [77.241, 28.6562];
const INTERESTS = ["History", "Food", "Architecture", "Nature", "Culture"];
const DEMO_ROUTE: GeoJSON.Feature<GeoJSON.LineString> = { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[77.209,28.6139],[77.214,28.618],[77.218,28.625],[77.226,28.633],[77.232,28.642],[77.238,28.65],[77.241,28.6562]] } };
const DEMO_STEPS: RouteStep[] = [
  { id: "demo-1", instruction: "Continue northeast toward Minto Road", location: [77.218, 28.625], distanceMetres: 1800, durationSeconds: 300 },
  { id: "demo-2", instruction: "Continue on Netaji Subhash Marg", location: [77.232, 28.642], distanceMetres: 2300, durationSeconds: 480 },
  { id: "demo-3", instruction: "Arrive at Red Fort", location: RED_FORT, distanceMetres: 900, durationSeconds: 180 },
];

function formatDistance(metres: number) { return metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${Math.round(metres)} m`; }
function formatEta(durationSeconds: number) { return new Date(Date.now() + durationSeconds * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }

export default function Home() {
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const routeVersion = useRef(1);
  const sessionRef = useRef<RouteSession | null>(null);
  const watchRef = useRef<number | null>(null);
  const announcedSteps = useRef(new Set<string>());
  const mentionedIds = useRef(new Set<string>());
  const lastSpokenAt = useRef(0);
  const lastContext = useRef<{ position: LngLat; at: number } | null>(null);
  const preferencesReady = useRef(false);
  const [origin, setOrigin] = useState<LngLat>(DELHI);
  const [destination, setDestination] = useState("Red Fort, Delhi");
  const [destinationPoint, setDestinationPoint] = useState<LngLat>(RED_FORT);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [routeSummary, setRouteSummary] = useState({ distance: "6.4 km", duration: "22 min", eta: "—" });
  const [status, setStatus] = useState("Demo route ready");
  const [loading, setLoading] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [listening, setListening] = useState(false);
  const [companionOpen, setCompanionOpen] = useState(true);
  const [assistantText, setAssistantText] = useState("Red Fort is ahead on your right. Shah Jahan began its construction in 1638 when he moved the Mughal capital to Delhi.");
  const [interests, setInterests] = useState(["History", "Food", "Architecture"]);
  const [routeCoordinates, setRouteCoordinates] = useState<LngLat[]>(DEMO_ROUTE.geometry.coordinates as LngLat[]);
  const [routeSteps, setRouteSteps] = useState<RouteStep[]>(DEMO_STEPS);
  const [driving, setDriving] = useState(false);
  const [liveGuidance, setLiveGuidance] = useState(false);
  const [demoIndex, setDemoIndex] = useState(0);
  const [nextInstruction, setNextInstruction] = useState(DEMO_STEPS[0].instruction);
  const [nextDistance, setNextDistance] = useState(1800);
  const [contextCandidates, setContextCandidates] = useState<ContextCandidate[]>([]);
  const [contextLoading, setContextLoading] = useState(false);
  const [assistantSource, setAssistantSource] = useState({ name: "Wikipedia", url: "https://en.wikipedia.org/wiki/Red_Fort" });
  const [journey, setJourney] = useState<JourneyRecord | null>(null);
  const [talkativeness, setTalkativeness] = useState(2);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceLanguage, setVoiceLanguage] = useState("en-IN");
  const [availability, setAvailability] = useState<Record<string, boolean>>({ landmarks: false, food: false, weather: false, traffic: false, incidents: false, events: false, news: false });
  const [question, setQuestion] = useState("");

  const drawRoute = useCallback((route: GeoJSON.Feature<GeoJSON.LineString>, fit = true) => {
    const map = mapRef.current;
    if (!map) return;
    (map.getSource("route") as GeoJSONSource | undefined)?.setData(route);
    if (fit) {
      const bounds = new maplibregl.LngLatBounds();
      route.geometry.coordinates.forEach((coordinate) => bounds.extend(coordinate as LngLat));
      map.fitBounds(bounds, { padding: { top: 130, right: 70, bottom: 110, left: 410 }, duration: 900 });
    }
  }, []);

  useEffect(() => {
    if (!mapNode.current || mapRef.current) return;
    const map = new maplibregl.Map({ container: mapNode.current, center: [77.225, 28.636], zoom: 12.4, attributionControl: false, style: "https://tiles.openfreemap.org/styles/liberty" });
    mapRef.current = map;
    map.once("idle", () => setMapReady(true));
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    map.on("load", () => {
      map.addSource("route", { type: "geojson", data: DEMO_ROUTE });
      map.addLayer({ id: "route-shadow", type: "line", source: "route", paint: { "line-color": "#fff", "line-width": 10, "line-opacity": 0.9 } });
      map.addLayer({ id: "route-line", type: "line", source: "route", paint: { "line-color": "#176b5b", "line-width": 6 } });
      markers.current = [new maplibregl.Marker({ color: "#152e2a" }).setLngLat(DELHI).addTo(map), new maplibregl.Marker({ color: "#ef7b45" }).setLngLat(RED_FORT).addTo(map)];
    });
    return () => { markers.current.forEach((marker) => marker.remove()); map.remove(); mapRef.current = null; };
  }, [drawRoute]);

  useEffect(() => {
    const saved = localStorage.getItem("marga-route-session");
    if (saved) {
      try { sessionRef.current = JSON.parse(saved); } catch { localStorage.removeItem("marga-route-session"); }
    }
    const restoreTimer = window.setTimeout(() => {
      const savedJourney = localStorage.getItem("marga-current-journey");
      if (savedJourney) { try { setJourney(JSON.parse(savedJourney)); } catch { localStorage.removeItem("marga-current-journey"); } }
      const savedPreferences = localStorage.getItem("marga-preferences");
      if (savedPreferences) { try { const preferences = JSON.parse(savedPreferences); setInterests(preferences.interests ?? ["History", "Food", "Architecture"]); setTalkativeness(preferences.talkativeness ?? 2); setVoiceEnabled(preferences.voiceEnabled ?? true); setVoiceLanguage(preferences.voiceLanguage ?? "en-IN"); } catch { localStorage.removeItem("marga-preferences"); } }
      preferencesReady.current = true;
    }, 0);
    return () => { window.clearTimeout(restoreTimer); if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current); };
  }, []);

  // Initial context is intentionally loaded once; movement refreshes it by distance and age.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void refreshContext(); }, []);

  useEffect(() => { if (preferencesReady.current) localStorage.setItem("marga-preferences", JSON.stringify({ interests, talkativeness, voiceEnabled, voiceLanguage })); }, [interests, talkativeness, voiceEnabled, voiceLanguage]);

  useEffect(() => {
    if (!driving) return;
    const timer = window.setInterval(() => {
      setDemoIndex((current) => Math.min(current + 1, routeCoordinates.length - 1));
    }, 1600);
    return () => window.clearInterval(timer);
  }, [driving, routeCoordinates.length]);

  useEffect(() => {
    if (!driving || !routeCoordinates[demoIndex]) return;
    handlePosition(routeCoordinates[demoIndex], 11);
    mapRef.current?.easeTo({ center: routeCoordinates[demoIndex], zoom: 15, duration: 700 });
    let arrivalTimer: number | undefined;
    if (demoIndex >= routeCoordinates.length - 1) arrivalTimer = window.setTimeout(() => { setDriving(false); setStatus("You have arrived"); setJourney((current) => current ? persistJourney(completeJourney(current)) : current); }, 0);
    return () => { if (arrivalTimer) window.clearTimeout(arrivalTimer); };
    // handlePosition consumes the route snapshot that triggered this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoIndex, driving, routeCoordinates]);

  async function searchPlaces(query: string) {
    if (query.trim().length < 3) { setSearchResults([]); return; }
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error();
      const data = await response.json() as { features: SearchFeature[] };
      setSearchResults(data.features.map((feature) => ({ display_name: [feature.properties.name, feature.properties.city, feature.properties.state].filter(Boolean).join(", "), lon: String(feature.geometry.coordinates[0]), lat: String(feature.geometry.coordinates[1]) })));
    } catch { setStatus("Search unavailable. Try demo route."); }
  }

  async function refreshContext(position = origin) {
    setContextLoading(true);
    try {
      const response = await fetch(`/api/context?lat=${position[1]}&lon=${position[0]}`);
      if (!response.ok) throw new Error();
      const data = await response.json() as { candidates: ContextCandidate[]; availability?: Record<string, boolean> };
      const candidates = data.candidates;
      setContextCandidates(candidates);
      if (data.availability) setAvailability(data.availability);
      lastContext.current = { position, at: Date.now() };
      const selected = selectAnnouncement(candidates, { position, headingDegrees: 35, speedMetresPerSecond: driving || liveGuidance ? 11 : 0, distanceToManeuver: nextDistance, interests, mentionedIds: mentionedIds.current, lastSpokenAt: lastSpokenAt.current, cooldownMs: talkativeness === 1 ? 180_000 : talkativeness === 3 ? 45_000 : 90_000, now: Date.now() });
      const candidate = selected ?? candidates[0];
      if (candidate) {
        setAssistantText(candidate.summary); setAssistantSource({ name: candidate.sourceName, url: candidate.sourceUrl });
        if (selected) mentionedIds.current.add(selected.id);
        setJourney((current) => current ? persistJourney(addJourneyEvent(current, { type: "encounter", title: candidate.title, detail: candidate.summary, sourceUrl: candidate.sourceUrl, at: Date.now() })) : current);
      }
    } catch { setStatus("Nearby context unavailable. Navigation continues."); }
    finally { setContextLoading(false); }
  }

  async function calculateRoute(point = destinationPoint, start = origin) {
    setLoading(true); setStatus("Finding best route…");
    try {
      const response = await fetch(`/api/route?from=${start.join(",")}&to=${point.join(",")}`);
      if (!response.ok) throw new Error();
      const data = await response.json() as { routes?: OsrmRoute[] }; const route = data.routes?.[0]; if (!route) throw new Error();
      const coordinates = route.geometry.coordinates as LngLat[];
      const steps: RouteStep[] = (route.legs?.[0]?.steps ?? []).map((step, index) => ({
        id: `route-${routeVersion.current + 1}-${index}`,
        instruction: step.maneuver?.type === "arrive" ? `Arrive at ${destination}` : `${step.maneuver?.type === "turn" ? "Turn" : "Continue"}${step.maneuver?.modifier ? ` ${step.maneuver.modifier}` : ""}${step.name ? ` on ${step.name}` : ""}`,
        location: step.maneuver?.location as LngLat,
        distanceMetres: step.distance,
        durationSeconds: step.duration,
      }));
      routeVersion.current += 1;
      sessionRef.current = null;
      setRouteCoordinates(coordinates);
      setRouteSteps(steps.length ? steps : DEMO_STEPS);
      setNextInstruction(steps[0]?.instruction ?? "Continue on route");
      setNextDistance(steps[0]?.distanceMetres ?? route.distance);
      drawRoute({ type: "Feature", properties: {}, geometry: route.geometry });
      setRouteSummary({ distance: formatDistance(route.distance), duration: `${Math.max(1, Math.round(route.duration / 60))} min`, eta: formatEta(route.duration) });
      setStatus("Route ready");
      markers.current.forEach((marker) => marker.remove());
      if (mapRef.current) markers.current = [new maplibregl.Marker({ color: "#152e2a" }).setLngLat(start).addTo(mapRef.current), new maplibregl.Marker({ color: "#ef7b45" }).setLngLat(point).addTo(mapRef.current)];
    } catch { setRouteCoordinates(DEMO_ROUTE.geometry.coordinates as LngLat[]); setRouteSteps(DEMO_STEPS); drawRoute(DEMO_ROUTE); setRouteSummary({ distance: "6.4 km", duration: "22 min", eta: formatEta(22 * 60) }); setStatus("Live routing unavailable. Showing saved demo route."); }
    finally { setLoading(false); }
  }

  function pickResult(result: SearchResult) { const point: LngLat = [Number(result.lon), Number(result.lat)]; setDestination(result.display_name); setDestinationPoint(point); setSearchResults([]); void calculateRoute(point); }
  function handlePosition(position: LngLat, speedMetresPerSecond: number) {
    if (!sessionRef.current || sessionRef.current.routeVersion !== routeVersion.current) sessionRef.current = createSession(routeVersion.current, position);
    const update = updateSession(sessionRef.current, position, routeCoordinates, routeSteps);
    sessionRef.current = update.session;
    localStorage.setItem("marga-route-session", JSON.stringify(update.session));
    setJourney((current) => current ? persistJourney(addJourneySample(current, position)) : current);
    const previousContext = lastContext.current;
    if (!previousContext || Date.now() - previousContext.at >= 45_000 || distanceMetres(previousContext.position, position) >= 700) void refreshContext(position);
    if (update.nextStep) {
      const distance = distanceMetres(position, update.nextStep.location);
      setNextDistance(distance);
      setNextInstruction(update.nextStep.instruction);
      if (distance < Math.max(90, speedMetresPerSecond * 10) && !announcedSteps.current.has(update.nextStep.id)) {
        announcedSteps.current.add(update.nextStep.id);
        speak(update.nextStep.instruction, "guidance");
      }
    }
    if (update.shouldReroute) { setStatus("Off route. Recalculating…"); sessionRef.current.offRouteStrikes = 0; void calculateRoute(destinationPoint, position); }
  }
  function toggleDemoDrive() {
    if (!driving && demoIndex >= routeCoordinates.length - 1) setDemoIndex(0);
    if (!driving && (!journey || journey.endedAt || journey.destination !== destination)) setJourney(persistJourney(createJourney(destination, routeCoordinates[demoIndex] ?? origin)));
    setDriving((current) => !current);
    setStatus(driving ? "Drive paused" : "Demo drive running");
  }
  function startLiveDrive() {
    if (!navigator.geolocation) return setStatus("Live location not supported");
    if (watchRef.current !== null) { navigator.geolocation.clearWatch(watchRef.current); watchRef.current = null; setLiveGuidance(false); return setStatus("Live guidance stopped"); }
    setStatus("Live guidance started");
    setLiveGuidance(true);
    if (!journey || journey.endedAt || journey.destination !== destination) setJourney(persistJourney(createJourney(destination, origin)));
    watchRef.current = navigator.geolocation.watchPosition(({ coords }) => handlePosition([coords.longitude, coords.latitude], Math.max(coords.speed ?? 8, 2.5)), () => setStatus("Live location unavailable"), { enableHighAccuracy: true, maximumAge: 1000, timeout: 12000 });
  }
  function locateMe() {
    if (!navigator.geolocation) return setStatus("Location not supported");
    setStatus("Finding your location…");
    navigator.geolocation.getCurrentPosition(({ coords }) => { const point: LngLat = [coords.longitude, coords.latitude]; setOrigin(point); mapRef.current?.flyTo({ center: point, zoom: 14 }); setStatus("Using your current location"); }, () => setStatus("Location permission was not granted"), { enableHighAccuracy: true, timeout: 10000 });
  }
  function speak(text = assistantText, priority: "companion" | "guidance" = "companion") { if (!voiceEnabled || !("speechSynthesis" in window) || (priority === "companion" && nextDistance < 200)) return; window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = voiceLanguage; utterance.rate = priority === "guidance" ? 1.02 : .96; window.speechSynthesis.speak(utterance); }
  function answerQuestion(question: string) {
    const q = question.toLowerCase();
    let answer = "I found a few places ahead. Ask for food, history, or a scenic stop.";
    if (q.includes("building") || q.includes("right")) answer = "That is likely the Red Fort complex on your right, about 800 metres ahead.";
    else if (q.includes("eat") || q.includes("food")) { const food = contextCandidates.find((candidate) => candidate.type === "food"); answer = food?.summary ?? "I do not have a sufficiently reliable food result nearby yet."; }
    else if (q.includes("interesting") || q.includes("ahead")) { const place = contextCandidates.find((candidate) => candidate.type === "landmark"); answer = place?.summary ?? "I do not have a verified landmark ahead yet."; }
    else if (q.includes("weather")) { const weather = contextCandidates.find((candidate) => candidate.type === "weather"); answer = weather?.summary ?? "Current weather data is unavailable."; }
    else if (q.includes("happening") || q.includes("news")) { const news = contextCandidates.find((candidate) => candidate.type === "news"); answer = news?.summary ?? "I do not have sufficiently relevant local news right now."; }
    setAssistantText(answer); setCompanionOpen(true); speak(answer); lastSpokenAt.current = Date.now(); return answer;
  }
  async function askGrounded(prompt: string) {
    if (!prompt.trim()) return "";
    try {
      const response = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: prompt, evidence: contextCandidates }) });
      if (!response.ok) throw new Error();
      const data = await response.json() as AskPayload;
      setAssistantText(data.answer); setCompanionOpen(true); lastSpokenAt.current = Date.now();
      if (data.sources?.[0]) setAssistantSource(data.sources[0]);
      speak(data.answer);
      setJourney((current) => current ? persistJourney(addJourneyEvent(current, { type: "announcement", title: prompt, detail: data.answer, sourceUrl: data.sources?.[0]?.url, at: Date.now() })) : current);
      return data.answer as string;
    } catch { return answerQuestion(prompt); }
  }
  function toggleVoice() {
    const speechWindow = window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
    const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) { const reply = "Voice input is not supported here. Try asking: What is interesting ahead?"; setAssistantText(reply); speak(reply); return; }
    const recognition = new SpeechRecognition(); recognition.lang = voiceLanguage; recognition.interimResults = false;
    recognition.onstart = () => setListening(true); recognition.onend = () => setListening(false); recognition.onerror = () => setListening(false);
    recognition.onresult = (event) => { void askGrounded(String(event.results[0][0].transcript)); }; recognition.start();
  }
  function toggleInterest(interest: string) { setInterests((current) => current.includes(interest) ? current.filter((item) => item !== interest) : [...current, interest]); }
  function submit(event: FormEvent) { event.preventDefault(); if (searchResults[0]) pickResult(searchResults[0]); else void calculateRoute(); }
  function submitQuestion(event: FormEvent) { event.preventDefault(); const prompt = question; setQuestion(""); void askGrounded(prompt); }
  function persistJourney(record: JourneyRecord) { localStorage.setItem("marga-current-journey", JSON.stringify(record)); return record; }
  function exportJourney() {
    if (!journey) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(journey, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `${journey.id}.json`; link.click(); URL.revokeObjectURL(url);
  }

  useEffect(() => {
    const context = (navigator as Navigator & { modelContext?: ModelContext }).modelContext;
    if (!context?.registerTool) return;
    const tool = {
      name: "ask_road_guide",
      description: "Ask Marga about useful places or context along the current route.",
      inputSchema: { type: "object", properties: { question: { type: "string" } }, required: ["question"] },
      execute: async ({ question }: { question: string }) => ({ content: [{ type: "text", text: await askGrounded(question) }] }),
    };
    context.registerTool(tool);
    return () => context.unregisterTool?.(tool.name);
  });

  return <main className="app-shell">
    <div ref={mapNode} className="map" aria-label="Interactive navigation map" />
    {!mapReady && <div className="map-fallback" role="img" aria-label="Saved Delhi route map" />}
    <header className="topbar">
      <div className="brand"><span className="brand-mark"><Navigation size={18}/></span><span>Marga</span><small>India web</small></div>
      <div className="status-pill"><span className="status-dot"/>{status}</div>
      <div className="top-actions"><Sheet><SheetTrigger asChild><Button variant="outline" size="icon" aria-label="Open journey journal"><BookOpen size={18}/></Button></SheetTrigger><SheetContent><SheetHeader><SheetTitle>Journey journal</SheetTitle><SheetDescription>{journey ? `Trip to ${journey.destination}` : "Start navigation to create a journal."}</SheetDescription></SheetHeader>{journey && <Journal journey={journey} onExport={exportJourney}/>}</SheetContent></Sheet><Button variant="outline" size="icon" onClick={locateMe} aria-label="Use current location"><LocateFixed size={18}/></Button></div>
    </header>
    <section className="route-panel" aria-label="Route planner">
      <div className="route-heading"><div><p>Plan journey</p><h1>Where to?</h1></div><span className="mode-badge"><Car size={15}/>Driving</span></div>
      <form onSubmit={submit} className="route-form">
        <div className="field-row"><span className="origin-dot"/><Input value="Current location · New Delhi" readOnly aria-label="Starting location"/></div>
        <div className="field-row destination-field"><MapPin size={17}/><Input value={destination} onChange={(event) => { setDestination(event.target.value); void searchPlaces(event.target.value); }} aria-label="Destination" autoComplete="off"/>{destination && <button type="button" className="clear-search" aria-label="Clear destination" onClick={() => { setDestination(""); setSearchResults([]); }}><X size={15}/></button>}</div>
        {searchResults.length > 0 && <div className="search-results">{searchResults.map((result,index) => <button type="button" onClick={() => pickResult(result)} key={`${result.lon}-${result.lat}-${index}`}><MapPin size={15}/><span>{result.display_name}</span></button>)}</div>}
        <Button type="submit" className="route-button" disabled={loading || !destination}><Route size={17}/>{loading ? "Calculating…" : "Find route"}</Button>
      </form>
      <div className="route-card">
        <div className="trip-stats"><strong>{routeSummary.duration}</strong><span>{routeSummary.distance}</span><span>ETA {routeSummary.eta}</span></div>
        <div className="next-turn"><span><ArrowUp size={22}/></span><div><small>IN {formatDistance(nextDistance).toUpperCase()}</small><strong>{nextInstruction}</strong></div></div>
        <div className="route-note"><Clock3 size={14}/>Fastest route based on available data</div>
        <div className="navigation-actions"><Button type="button" onClick={toggleDemoDrive}>{driving ? <Pause size={15}/> : <Play size={15}/>} {driving ? "Pause demo" : "Start demo"}</Button><Button type="button" variant="outline" onClick={startLiveDrive}><LocateFixed size={15}/> {liveGuidance ? "Stop GPS" : "Live GPS"}</Button></div>
      </div>
      <div className="interest-block"><div><p>Your interests</p><span>Guide prioritizes these</span></div><div className="interest-list">{INTERESTS.map((interest) => <button key={interest} onClick={() => toggleInterest(interest)} className={interests.includes(interest) ? "selected" : ""}>{interests.includes(interest) && <Check size={13}/>} {interest}</button>)}</div></div>
      <div className="preference-block"><div className="preference-heading"><span>Talkativeness</span><strong>{["", "Quiet", "Balanced", "Talkative"][talkativeness]}</strong></div><Slider min={1} max={3} step={1} value={[talkativeness]} onValueChange={(value) => setTalkativeness(value[0])} aria-label="Companion talkativeness"/><div className="voice-setting"><label htmlFor="voice-toggle">Voice responses</label><Switch id="voice-toggle" checked={voiceEnabled} onCheckedChange={setVoiceEnabled}/></div><select value={voiceLanguage} onChange={(event) => setVoiceLanguage(event.target.value)} aria-label="Voice language"><option value="en-IN">English (India)</option><option value="hi-IN">Hindi</option><option value="bn-IN">Bengali</option><option value="ta-IN">Tamil</option><option value="te-IN">Telugu</option><option value="mr-IN">Marathi</option></select></div>
      <div className="provider-health"><p>Live sources</p><div>{["weather","landmarks","food","traffic","incidents","events","news"].map((source) => <span key={source} className={availability[source] ? "available" : "unavailable"}><i/>{source}</span>)}</div></div>
    </section>
    <button className="map-control" aria-label="Reset compass" onClick={() => mapRef.current?.easeTo({ bearing: 0, pitch: 0 })}><Compass size={20}/></button>
    {companionOpen && <aside className="companion-card" aria-live="polite"><div className="companion-top"><span className="guide-icon"><Sparkles size={17}/></span><div><small>ROAD GUIDE</small><strong>Worth knowing now</strong></div><button aria-label="Dismiss" onClick={() => setCompanionOpen(false)}><X size={17}/></button></div><p>{assistantText}</p><div className="source-row"><a href={assistantSource.url} target="_blank" rel="noreferrer">Source: {assistantSource.name}</a><button onClick={() => speak()}><Volume2 size={15}/>Read aloud</button><button onClick={() => void refreshContext()}>{contextLoading ? "Checking…" : "Refresh"}</button></div></aside>}
    <form className="voice-dock" onSubmit={submitQuestion}><button type="button" className={listening ? "voice-button listening" : "voice-button"} onClick={toggleVoice} aria-label={listening ? "Stop listening" : "Ask road guide"}>{listening ? <MicOff size={24}/> : <Mic size={24}/>}</button><div><strong>{listening ? "Listening…" : "Ask your road guide"}</strong><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Anything interesting ahead?" aria-label="Question for road guide"/></div><button type="submit" className="send-question" aria-label="Send question" disabled={!question.trim()}><Send size={17}/></button></form>
  </main>;
}

function Journal({ journey, onExport }: { journey: JourneyRecord; onExport: () => void }) {
  const summary = summarizeJourney(journey);
  return <div className="journal"><div className="journal-stats"><div><strong>{formatDistance(summary.distanceMetres)}</strong><span>travelled</span></div><div><strong>{summary.durationMinutes} min</strong><span>duration</span></div><div><strong>{summary.encounters.length}</strong><span>discoveries</span></div></div><div className="journal-timeline">{journey.events.map((event) => <article key={event.id}><span>{new Date(event.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span><div><strong>{event.title}</strong>{event.detail && <p>{event.detail}</p>}{event.sourceUrl && <a href={event.sourceUrl} target="_blank" rel="noreferrer">View source</a>}</div></article>)}</div><Button onClick={onExport}><Download size={16}/>Export journey data</Button></div>;
}
