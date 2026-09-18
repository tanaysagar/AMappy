"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ArrowUp, Car, Check, Clock3, Compass, LocateFixed, MapPin, Mic, MicOff, Navigation, Route, Sparkles, Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type LngLat = [number, number];
type SearchResult = { display_name: string; lat: string; lon: string };
const DELHI: LngLat = [77.209, 28.6139];
const RED_FORT: LngLat = [77.241, 28.6562];
const INTERESTS = ["History", "Food", "Architecture", "Nature", "Culture"];
const DEMO_ROUTE: GeoJSON.Feature<GeoJSON.LineString> = { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[77.209,28.6139],[77.214,28.618],[77.218,28.625],[77.226,28.633],[77.232,28.642],[77.238,28.65],[77.241,28.6562]] } };

function formatDistance(metres: number) { return metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${Math.round(metres)} m`; }

export default function Home() {
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const [origin, setOrigin] = useState<LngLat>(DELHI);
  const [destination, setDestination] = useState("Red Fort, Delhi");
  const [destinationPoint, setDestinationPoint] = useState<LngLat>(RED_FORT);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [routeSummary, setRouteSummary] = useState({ distance: "6.4 km", duration: "22 min" });
  const [status, setStatus] = useState("Demo route ready");
  const [loading, setLoading] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [listening, setListening] = useState(false);
  const [companionOpen, setCompanionOpen] = useState(true);
  const [assistantText, setAssistantText] = useState("Red Fort is ahead on your right. Shah Jahan began its construction in 1638 when he moved the Mughal capital to Delhi.");
  const [interests, setInterests] = useState(["History", "Food", "Architecture"]);

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

  async function searchPlaces(query: string) {
    if (query.trim().length < 3) { setSearchResults([]); return; }
    try {
      const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&lang=en`);
      if (!response.ok) throw new Error();
      const data = await response.json();
      setSearchResults(data.features.map((feature: any) => ({ display_name: [feature.properties.name, feature.properties.city, feature.properties.state].filter(Boolean).join(", "), lon: String(feature.geometry.coordinates[0]), lat: String(feature.geometry.coordinates[1]) })));
    } catch { setStatus("Search unavailable. Try demo route."); }
  }

  async function calculateRoute(point = destinationPoint) {
    setLoading(true); setStatus("Finding best route…");
    try {
      const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${origin[0]},${origin[1]};${point[0]},${point[1]}?overview=full&geometries=geojson&steps=true`);
      if (!response.ok) throw new Error();
      const data = await response.json(); const route = data.routes?.[0]; if (!route) throw new Error();
      drawRoute({ type: "Feature", properties: {}, geometry: route.geometry });
      setRouteSummary({ distance: formatDistance(route.distance), duration: `${Math.max(1, Math.round(route.duration / 60))} min` });
      setStatus("Route ready");
      markers.current.forEach((marker) => marker.remove());
      if (mapRef.current) markers.current = [new maplibregl.Marker({ color: "#152e2a" }).setLngLat(origin).addTo(mapRef.current), new maplibregl.Marker({ color: "#ef7b45" }).setLngLat(point).addTo(mapRef.current)];
    } catch { drawRoute(DEMO_ROUTE); setRouteSummary({ distance: "6.4 km", duration: "22 min" }); setStatus("Live routing unavailable. Showing saved demo route."); }
    finally { setLoading(false); }
  }

  function pickResult(result: SearchResult) { const point: LngLat = [Number(result.lon), Number(result.lat)]; setDestination(result.display_name); setDestinationPoint(point); setSearchResults([]); void calculateRoute(point); }
  function locateMe() {
    if (!navigator.geolocation) return setStatus("Location not supported");
    setStatus("Finding your location…");
    navigator.geolocation.getCurrentPosition(({ coords }) => { const point: LngLat = [coords.longitude, coords.latitude]; setOrigin(point); mapRef.current?.flyTo({ center: point, zoom: 14 }); setStatus("Using your current location"); }, () => setStatus("Location permission was not granted"), { enableHighAccuracy: true, timeout: 10000 });
  }
  function speak(text = assistantText) { if (!("speechSynthesis" in window)) return; window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = "en-IN"; utterance.rate = .96; window.speechSynthesis.speak(utterance); }
  function answerQuestion(question: string) {
    const q = question.toLowerCase();
    let answer = "I found a few places ahead. Ask for food, history, or a scenic stop.";
    if (q.includes("building") || q.includes("right")) answer = "That is likely the Red Fort complex on your right, about 800 metres ahead.";
    else if (q.includes("eat") || q.includes("food")) answer = "Chandni Chowk is 7 minutes ahead with several local food stops and almost no detour.";
    else if (q.includes("interesting") || q.includes("ahead")) answer = "Red Fort is the strongest match ahead. I will tell you more after your next turn.";
    setAssistantText(answer); setCompanionOpen(true); speak(answer); return answer;
  }
  function toggleVoice() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { const reply = "Voice input is not supported here. Try asking: What is interesting ahead?"; setAssistantText(reply); speak(reply); return; }
    const recognition = new SpeechRecognition(); recognition.lang = "en-IN"; recognition.interimResults = false;
    recognition.onstart = () => setListening(true); recognition.onend = () => setListening(false); recognition.onerror = () => setListening(false);
    recognition.onresult = (event: any) => { answerQuestion(String(event.results[0][0].transcript)); }; recognition.start();
  }
  function toggleInterest(interest: string) { setInterests((current) => current.includes(interest) ? current.filter((item) => item !== interest) : [...current, interest]); }
  function submit(event: FormEvent) { event.preventDefault(); if (searchResults[0]) pickResult(searchResults[0]); else void calculateRoute(); }

  useEffect(() => {
    const context = (navigator as any).modelContext;
    if (!context?.registerTool) return;
    const tool = {
      name: "ask_road_guide",
      description: "Ask Marga about useful places or context along the current route.",
      inputSchema: { type: "object", properties: { question: { type: "string" } }, required: ["question"] },
      execute: async ({ question }: { question: string }) => ({ content: [{ type: "text", text: answerQuestion(question) }] }),
    };
    context.registerTool(tool);
    return () => context.unregisterTool?.(tool.name);
  });

  return <main className="app-shell">
    <div ref={mapNode} className="map" aria-label="Interactive navigation map" />
    {!mapReady && <div className="map-fallback" role="img" aria-label="Saved Delhi route map" />}
    <header className="topbar">
      <div className="brand"><span className="brand-mark"><Navigation size={18}/></span><span>Marga</span><small>India preview</small></div>
      <div className="status-pill"><span className="status-dot"/>{status}</div>
      <Button variant="outline" size="icon" className="locate-button" onClick={locateMe} aria-label="Use current location"><LocateFixed size={18}/></Button>
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
        <div className="trip-stats"><strong>{routeSummary.duration}</strong><span>{routeSummary.distance}</span><span>ETA 10:42</span></div>
        <div className="next-turn"><span><ArrowUp size={22}/></span><div><small>IN 350 M</small><strong>Continue on Netaji Subhash Marg</strong></div></div>
        <div className="route-note"><Clock3 size={14}/>Fastest route based on available data</div>
      </div>
      <div className="interest-block"><div><p>Your interests</p><span>Guide prioritizes these</span></div><div className="interest-list">{INTERESTS.map((interest) => <button key={interest} onClick={() => toggleInterest(interest)} className={interests.includes(interest) ? "selected" : ""}>{interests.includes(interest) && <Check size={13}/>} {interest}</button>)}</div></div>
    </section>
    <button className="map-control" aria-label="Reset compass" onClick={() => mapRef.current?.easeTo({ bearing: 0, pitch: 0 })}><Compass size={20}/></button>
    {companionOpen && <aside className="companion-card" aria-live="polite"><div className="companion-top"><span className="guide-icon"><Sparkles size={17}/></span><div><small>ROAD GUIDE</small><strong>Worth knowing now</strong></div><button aria-label="Dismiss" onClick={() => setCompanionOpen(false)}><X size={17}/></button></div><p>{assistantText}</p><div className="source-row"><span>Historical place · 2 min ahead</span><button onClick={() => speak()}><Volume2 size={15}/>Read aloud</button></div></aside>}
    <div className="voice-dock"><button className={listening ? "voice-button listening" : "voice-button"} onClick={toggleVoice} aria-label={listening ? "Stop listening" : "Ask road guide"}>{listening ? <MicOff size={24}/> : <Mic size={24}/>}</button><div><strong>{listening ? "Listening…" : "Ask your road guide"}</strong><span>“Anything interesting ahead?”</span></div></div>
  </main>;
}
