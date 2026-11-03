"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import type { Feature, LineString } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import { ArrowUp, BookOpen, Car, Check, Clock3, Compass, Download, LocateFixed, MapPin, Mic, MicOff, Navigation, Pause, Play, RefreshCw, Route, Send, Sparkles, Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSession, distanceMetres, maneuverInstruction, matchRoute, shouldAnnounceManeuver, updateSession, type RouteSession, type RouteStep } from "@/lib/navigation";
import { selectAnnouncement, type ContextCandidate } from "@/lib/attention";
import { addJourneyEvent, addJourneySample, completeJourney, createJourney, summarizeJourney, type JourneyRecord } from "@/lib/journey";
import { accuracyDiameterPixels, classifyLocationError, classifyLocationFix } from "@/lib/location";
import { parseTripSnapshot, type TripSnapshot } from "@/lib/trip-state";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

type LngLat = [number, number];
type SearchResult = { id: string; displayName: string; precision: string; provider: "Mappls" };
type SearchTarget = "origin" | "destination";
type GpsStatus = "idle" | "acquiring" | "active" | "poor" | "stale" | "denied" | "timeout" | "unavailable";
type MapHealth = "loading" | "ready" | "error";
type ReverseResult = { label: string; reference?: string; referenceDistanceMetres?: number; provider: "Mappls"; precision: "pin" };
type OsrmStep = { distance: number; duration: number; name?: string; maneuver?: { type?: string; modifier?: string; exit?: number; location: LngLat } };
type OsrmRoute = { distance: number; duration: number; geometry: LineString; legs?: Array<{ steps?: OsrmStep[] }> };
type AskPayload = { answer: string; sources?: Array<{ name: string; url: string }> };
type SpeechResultEvent = { results: ArrayLike<{ 0: { transcript: string } }> };
type SpeechRecognitionInstance = { lang: string; interimResults: boolean; onstart: () => void; onend: () => void; onerror: () => void; onresult: (event: SpeechResultEvent) => void; start: () => void; stop: () => void };
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;
type ModelContext = { registerTool: (tool: { name: string; description: string; inputSchema: object; execute: (input: { question: string }) => Promise<object> }) => void; unregisterTool?: (name: string) => void };
const DELHI: LngLat = [77.209, 28.6139];
const RED_FORT: LngLat = [77.241, 28.6562];
const INTERESTS = ["History", "Food", "Architecture", "Nature", "Culture", "Photography", "Shopping", "Sports", "Local events"];
const EMPTY_ROUTE: Feature<LineString> = { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } };
const TRIP_KEY = "marga-active-trip-v1";

function formatDistance(metres: number) { return metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${Math.round(metres)} m`; }
function nowMs() { return Date.now(); }
function formatEta(durationSeconds: number) { return new Date(nowMs() + durationSeconds * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
function readStored(key: string) { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as unknown : null; } catch { return null; } }
function writeStored(key: string, value: unknown) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Navigation continues when storage is unavailable. */ } }
function removeStored(key: string) { try { localStorage.removeItem(key); } catch { /* Navigation continues when storage is unavailable. */ } }
function persistJourney(record: JourneyRecord) { writeStored("marga-current-journey", record); return record; }

export default function Home() {
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const liveMarker = useRef<Marker | null>(null);
  const liveMarkerElement = useRef<HTMLDivElement | null>(null);
  const routeVersion = useRef(1);
  const sessionRef = useRef<RouteSession | null>(null);
  const watchRef = useRef<number | null>(null);
  const searchTimer = useRef<number | null>(null);
  const searchRequest = useRef<AbortController | null>(null);
  const routeRequest = useRef<AbortController | null>(null);
  const endpointRequests = useRef<Record<SearchTarget, AbortController | null>>({ origin: null, destination: null });
  const endpointRevisions = useRef<Record<SearchTarget, number>>({ origin: 0, destination: 0 });
  const contextRequest = useRef<AbortController | null>(null);
  const rerouting = useRef(false);
  const lastRerouteAt = useRef(0);
  const routeCoordinatesRef = useRef<LngLat[]>([]);
  const routeStepsRef = useRef<RouteStep[]>([]);
  const destinationRef = useRef<LngLat | null>(RED_FORT);
  const tripSnapshotRef = useRef<TripSnapshot | null>(null);
  const latestPosition = useRef<{ point: LngLat; accuracy: number; heading: number | null; at: number } | null>(null);
  const attentionContext = useRef({ position: DELHI, headingDegrees: null as number | null, speedMetresPerSecond: 0, distanceToManeuver: Number.POSITIVE_INFINITY });
  const followingRef = useRef(true);
  const announcedSteps = useRef(new Set<string>());
  const departureWeatherPending = useRef(false);
  const mentionedIds = useRef(new Set<string>());
  const lastSpokenAt = useRef(0);
  const lastContext = useRef<{ position: LngLat; at: number } | null>(null);
  const contextCandidatesRef = useRef<ContextCandidate[]>([]);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const preferencesReady = useRef(false);
  const [origin, setOrigin] = useState<LngLat>(DELHI);
  const [originText, setOriginText] = useState("New Delhi, Delhi");
  const [originSelected, setOriginSelected] = useState(true);
  const [destination, setDestination] = useState("Red Fort, Delhi");
  const [destinationPoint, setDestinationPoint] = useState<LngLat>(RED_FORT);
  const [destinationSelected, setDestinationSelected] = useState(true);
  const [searchTarget, setSearchTarget] = useState<SearchTarget>("destination");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [routeSummary, setRouteSummary] = useState<{ distance: string; duration: string; eta: string } | null>(null);
  const [destinationAccessDistance, setDestinationAccessDistance] = useState<number | null>(null);
  const [status, setStatus] = useState("Choose a start and destination");
  const [loading, setLoading] = useState(false);
  const [mapHealth, setMapHealth] = useState<MapHealth>("loading");
  const [listening, setListening] = useState(false);
  const [companionOpen, setCompanionOpen] = useState(true);
  const [assistantText, setAssistantText] = useState("Choose a route or use your current location, then I’ll look for verified information around you.");
  const [interests, setInterests] = useState(["History", "Food", "Architecture"]);
  const [routeCoordinates, setRouteCoordinates] = useState<LngLat[]>([]);
  const [driving, setDriving] = useState(false);
  const [liveGuidance, setLiveGuidance] = useState(false);
  const [demoIndex, setDemoIndex] = useState(0);
  const [nextInstruction, setNextInstruction] = useState("Plan a route to begin");
  const [nextDistance, setNextDistance] = useState(0);
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>("idle");
  const [following, setFollowing] = useState(true);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [hasLocation, setHasLocation] = useState(false);
  const [contextCandidates, setContextCandidates] = useState<ContextCandidate[]>([]);
  const [contextLoading, setContextLoading] = useState(false);
  const [assistantSource, setAssistantSource] = useState<{ name: string; url: string } | null>(null);
  const [journey, setJourney] = useState<JourneyRecord | null>(null);
  const [talkativeness, setTalkativeness] = useState(2);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceLanguage, setVoiceLanguage] = useState("en-IN");
  const [availability, setAvailability] = useState<Record<string, boolean>>({ landmarks: false, food: false, weather: false, traffic: false, incidents: false, events: false, news: false });
  const [question, setQuestion] = useState("");
  const [pinTarget, setPinTarget] = useState<SearchTarget | null>(null);

  function invalidateEndpoint(target: SearchTarget) {
    endpointRequests.current[target]?.abort();
    endpointRequests.current[target] = null;
    endpointRevisions.current[target] += 1;
    return endpointRevisions.current[target];
  }

  function cancelSearch() {
    if (searchTimer.current !== null) window.clearTimeout(searchTimer.current);
    searchTimer.current = null;
    searchRequest.current?.abort();
    searchRequest.current = null;
    setSearchResults([]);
  }

  const drawRoute = useCallback((route: Feature<LineString>, fit = true) => {
    const map = mapRef.current;
    if (!map) return;
    (map.getSource("route") as GeoJSONSource | undefined)?.setData(route);
    if (fit) {
      const bounds = new maplibregl.LngLatBounds();
      route.geometry.coordinates.forEach((coordinate) => bounds.extend(coordinate as LngLat));
      const mobile = window.innerWidth <= 800;
      map.fitBounds(bounds, { padding: mobile ? { top: 120, right: 30, bottom: Math.round(window.innerHeight * .5), left: 30 } : { top: 130, right: 70, bottom: 110, left: 410 }, duration: 900 });
    }
  }, []);

  function setFollowMode(value: boolean) { followingRef.current = value; setFollowing(value); }

  function updateLiveMarker(point: LngLat, accuracy: number, heading: number | null, follow = true) {
    const map = mapRef.current;
    if (!map) return;
    if (!liveMarker.current) {
      const element = document.createElement("div");
      element.className = "live-location-marker";
      element.innerHTML = '<span class="live-location-heading"></span><span class="live-location-dot"></span>';
      liveMarkerElement.current = element;
      liveMarker.current = new maplibregl.Marker({ element, anchor: "center" }).setLngLat(point).addTo(map);
    } else liveMarker.current.setLngLat(point);
    const diameter = accuracyDiameterPixels(accuracy, point[1], map.getZoom());
    const element = liveMarkerElement.current;
    if (element) {
      element.style.width = `${diameter}px`;
      element.style.height = `${diameter}px`;
      const headingElement = element.querySelector<HTMLElement>(".live-location-heading");
      if (headingElement) headingElement.style.transform = `translateX(-50%) rotate(${heading ?? 0}deg)`;
    }
    if (follow && followingRef.current) map.easeTo({ center: point, bearing: heading ?? map.getBearing(), zoom: Math.max(map.getZoom(), 15), duration: 500 });
  }

  function retryMap() {
    const map = mapRef.current;
    setMapHealth("loading");
    if (!map) return;
    map.setStyle("https://tiles.openfreemap.org/styles/liberty");
  }

  useEffect(() => {
    if (!mapNode.current || mapRef.current) return;
    const map = new maplibregl.Map({ container: mapNode.current, center: [77.225, 28.636], zoom: 12.4, attributionControl: false, style: "https://tiles.openfreemap.org/styles/liberty" });
    mapRef.current = map;
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    const loadingTimeout = window.setTimeout(() => setMapHealth("error"), 12_000);
    const ensureRouteLayer = () => {
      if (!map.getSource("route")) map.addSource("route", { type: "geojson", data: routeCoordinatesRef.current.length ? { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: routeCoordinatesRef.current } } : EMPTY_ROUTE });
      if (!map.getLayer("route-shadow")) map.addLayer({ id: "route-shadow", type: "line", source: "route", paint: { "line-color": "#fff", "line-width": 10, "line-opacity": 0.9 } });
      if (!map.getLayer("route-line")) map.addLayer({ id: "route-line", type: "line", source: "route", paint: { "line-color": "#176b5b", "line-width": 6 } });
    };
    const markReady = () => { window.clearTimeout(loadingTimeout); ensureRouteLayer(); setMapHealth("ready"); };
    const markLost = (event: Event) => { event.preventDefault(); setMapHealth("error"); };
    const restoreMap = () => retryMap();
    map.on("style.load", ensureRouteLayer);
    map.on("idle", markReady);
    map.getCanvas().addEventListener("webglcontextlost", markLost);
    map.getCanvas().addEventListener("webglcontextrestored", restoreMap);
    map.on("dragstart", () => { if (watchRef.current !== null) setFollowMode(false); });
    map.on("zoom", () => { const fix = latestPosition.current; if (fix) updateLiveMarker(fix.point, fix.accuracy, fix.heading, false); });
    return () => {
      window.clearTimeout(loadingTimeout);
      markers.current.forEach((marker) => marker.remove());
      liveMarker.current?.remove(); liveMarker.current = null; liveMarkerElement.current = null;
      map.getCanvas().removeEventListener("webglcontextlost", markLost);
      map.getCanvas().removeEventListener("webglcontextrestored", restoreMap);
      map.stop(); map.remove(); mapRef.current = null;
    };
  }, [drawRoute]);

  useEffect(() => {
    const endpointControllers = endpointRequests.current;
    const restoreTimer = window.setTimeout(() => {
      const snapshot = parseTripSnapshot(readStored(TRIP_KEY));
      if (snapshot) {
        tripSnapshotRef.current = snapshot; sessionRef.current = snapshot.session; routeVersion.current = snapshot.routeVersion;
        routeCoordinatesRef.current = snapshot.routeCoordinates; routeStepsRef.current = snapshot.routeSteps; destinationRef.current = snapshot.destinationPoint;
        setOrigin(snapshot.origin); setOriginText(snapshot.originText); setOriginSelected(true);
        setDestination(snapshot.destination); setDestinationPoint(snapshot.destinationPoint); setDestinationSelected(true);
        const restoredStep = snapshot.routeSteps[snapshot.session?.currentStepIndex ?? 0];
        setRouteCoordinates(snapshot.routeCoordinates); setNextInstruction(restoredStep?.instruction ?? "Continue on route"); setNextDistance(restoredStep?.distanceMetres ?? snapshot.distanceMetres);
        setDestinationAccessDistance(snapshot.destinationAccessDistanceMetres);
        setRouteSummary({ distance: formatDistance(snapshot.distanceMetres), duration: `${Math.max(1, Math.round(snapshot.durationSeconds / 60))} min`, eta: formatEta(snapshot.durationSeconds) });
        setAvailability((current) => ({ ...current, traffic: snapshot.trafficAwareEta }));
        drawRoute({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: snapshot.routeCoordinates } });
        showEndpointMarkers(snapshot.origin, snapshot.destinationPoint); setStatus("Trip restored · start GPS when ready");
      } else removeStored(TRIP_KEY);
      const savedJourney = readStored("marga-current-journey");
      if (savedJourney && typeof savedJourney === "object") setJourney(savedJourney as JourneyRecord);
      const savedPreferences = readStored("marga-preferences") as { interests?: string[]; talkativeness?: number; voiceEnabled?: boolean; voiceLanguage?: string } | null;
      if (savedPreferences) { setInterests(savedPreferences.interests ?? ["History", "Food", "Architecture"]); setTalkativeness(savedPreferences.talkativeness ?? 2); setVoiceEnabled(savedPreferences.voiceEnabled ?? true); setVoiceLanguage(savedPreferences.voiceLanguage ?? "en-IN"); }
      preferencesReady.current = true;
    }, 0);
    return () => {
      window.clearTimeout(restoreTimer);
      if (searchTimer.current !== null) window.clearTimeout(searchTimer.current);
      searchRequest.current?.abort(); routeRequest.current?.abort(); contextRequest.current?.abort();
      endpointControllers.origin?.abort(); endpointControllers.destination?.abort();
      recognitionRef.current?.stop(); recognitionRef.current = null;
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, [drawRoute]);

  useEffect(() => { if (preferencesReady.current) writeStored("marga-preferences", { interests, talkativeness, voiceEnabled, voiceLanguage }); }, [interests, talkativeness, voiceEnabled, voiceLanguage]);

  function scheduleSearch(query: string, target: SearchTarget) {
    setSearchTarget(target);
    setSearchResults([]);
    if (searchTimer.current !== null) window.clearTimeout(searchTimer.current);
    searchRequest.current?.abort();
    if (query.trim().length < 3) return;
    searchTimer.current = window.setTimeout(() => void searchPlaces(query, target), 300);
  }

  async function searchPlaces(query: string, target: SearchTarget) {
    const controller = new AbortController();
    searchRequest.current = controller;
    try {
      const bias = latestPosition.current?.point ?? origin;
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&lat=${bias[1]}&lon=${bias[0]}`, { signal: controller.signal });
      const data = await response.json() as { results?: SearchResult[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Place search unavailable");
      if (searchRequest.current !== controller) return;
      setSearchTarget(target);
      const results = data.results ?? [];
      setSearchResults(results);
      if (!results.length) setStatus("No Mappls results. Try English or Hindi, or choose an exact pin.");
    } catch (error) { if ((error as Error).name !== "AbortError") setStatus((error as Error).message); }
  }

  async function refreshContext(position = origin, headingDegrees: number | null = latestPosition.current?.heading ?? null, speedMetresPerSecond = 0) {
    if (contextRequest.current) return;
    const controller = new AbortController();
    contextRequest.current = controller;
    attentionContext.current = { ...attentionContext.current, position, headingDegrees, speedMetresPerSecond };
    lastContext.current = { position, at: nowMs() };
    setContextLoading(true);
    try {
      const response = await fetch(`/api/context?lat=${position[1]}&lon=${position[0]}`, { signal: controller.signal });
      if (!response.ok) throw new Error();
      const data = await response.json() as { candidates: ContextCandidate[]; availability?: Record<string, boolean> };
      if (contextRequest.current !== controller) return;
      const candidates = data.candidates;
      contextCandidatesRef.current = candidates;
      setContextCandidates(candidates);
      if (data.availability) setAvailability((current) => ({ ...data.availability, traffic: current.traffic || Boolean(data.availability?.traffic) }));
      const checkedAt = nowMs();
      const currentDrive = attentionContext.current;
      const selected = announceUsefulCandidate(candidates, currentDrive, checkedAt);
      const displayCandidate = selected ?? candidates.find((candidate) => candidate.type !== "weather") ?? candidates[0];
      if (displayCandidate && !selected) {
        setAssistantText(displayCandidate.summary); setAssistantSource({ name: displayCandidate.sourceName, url: displayCandidate.sourceUrl });
        setJourney((current) => current ? persistJourney(addJourneyEvent(current, { type: "encounter", title: displayCandidate.title, detail: displayCandidate.summary, sourceUrl: displayCandidate.sourceUrl, at: checkedAt })) : current);
      }
    } catch (error) { if ((error as Error).name !== "AbortError") setStatus("Nearby context unavailable. Navigation continues."); }
    finally { if (contextRequest.current === controller) { contextRequest.current = null; setContextLoading(false); } }
  }

  async function calculateRoute(point = destinationPoint, start = origin, preserveOnFailure = false) {
    routeRequest.current?.abort();
    const controller = new AbortController();
    routeRequest.current = controller;
    setLoading(true); setStatus("Finding best route…");
    try {
      const response = await fetch(`/api/route?from=${start.join(",")}&to=${point.join(",")}`, { signal: controller.signal });
      if (!response.ok) throw new Error();
      const data = await response.json() as { routes?: OsrmRoute[]; provider?: string; trafficAwareEta?: boolean; destinationAccessDistanceMetres?: number | null }; const route = data.routes?.[0]; if (!route) throw new Error();
      if (routeRequest.current !== controller) return;
      if (!preserveOnFailure) {
        contextRequest.current?.abort(); contextRequest.current = null; setContextLoading(false);
        lastContext.current = null; contextCandidatesRef.current = []; setContextCandidates([]);
        mentionedIds.current.clear(); lastSpokenAt.current = 0;
      }
      const coordinates = route.geometry.coordinates as LngLat[];
      const steps: RouteStep[] = (route.legs?.[0]?.steps ?? []).map((step, index) => ({
        id: `route-${routeVersion.current + 1}-${index}`,
        instruction: maneuverInstruction(step.maneuver ?? {}, step.name, destination),
        location: step.maneuver?.location as LngLat,
        distanceMetres: step.distance,
        durationSeconds: step.duration,
      }));
      routeVersion.current += 1;
      sessionRef.current = null;
      routeCoordinatesRef.current = coordinates;
      routeStepsRef.current = steps;
      setRouteCoordinates(coordinates);
      setNextInstruction(steps[0]?.instruction ?? "Continue on route");
      setNextDistance(steps[0]?.distanceMetres ?? route.distance);
      attentionContext.current = { position: start, headingDegrees: null, speedMetresPerSecond: 0, distanceToManeuver: steps[0]?.distanceMetres ?? route.distance };
      drawRoute({ type: "Feature", properties: {}, geometry: route.geometry });
      setRouteSummary({ distance: formatDistance(route.distance), duration: `${Math.max(1, Math.round(route.duration / 60))} min`, eta: formatEta(route.duration) });
      const accessDistance = Number.isFinite(data.destinationAccessDistanceMetres) ? data.destinationAccessDistanceMetres as number : null;
      setDestinationAccessDistance(accessDistance);
      const snapshot: TripSnapshot = { version: 1, origin: start, originText: start === origin ? originText : "Current position", destination, destinationPoint: point, routeCoordinates: coordinates, routeSteps: steps, routeVersion: routeVersion.current, distanceMetres: route.distance, durationSeconds: route.duration, trafficAwareEta: Boolean(data.trafficAwareEta), destinationAccessDistanceMetres: accessDistance, session: null };
      tripSnapshotRef.current = snapshot; writeStored(TRIP_KEY, snapshot);
      setAvailability((current) => ({ ...current, traffic: Boolean(data.trafficAwareEta) }));
      setStatus(data.trafficAwareEta ? "Route ready · Mappls traffic ETA" : `Route ready · ${data.provider ?? "basic routing"}`);
      void refreshContext(start);
      markers.current.forEach((marker) => marker.remove());
      if (mapRef.current) markers.current = [new maplibregl.Marker({ color: "#152e2a" }).setLngLat(start).addTo(mapRef.current), new maplibregl.Marker({ color: "#ef7b45" }).setLngLat(point).addTo(mapRef.current)];
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      if (routeRequest.current !== controller) return;
      if (preserveOnFailure) { setStatus("Reroute unavailable. Continuing on current route."); return; }
      routeCoordinatesRef.current = []; routeStepsRef.current = [];
      setRouteCoordinates([]); drawRoute(EMPTY_ROUTE, false); setRouteSummary(null);
      setNextInstruction("Route unavailable"); setNextDistance(0);
      setStatus("Could not calculate this route. Check both places and try again.");
    } finally { if (routeRequest.current === controller) { routeRequest.current = null; setLoading(false); } }
  }

  function stopLiveGuidance(message = "Live guidance stopped") {
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null; setLiveGuidance(false); setGpsStatus("idle"); setStatus(message);
  }

  function clearPlannedRoute(message = "Select both places to plan a route") {
    routeRequest.current?.abort(); routeRequest.current = null; setLoading(false);
    if (watchRef.current !== null) stopLiveGuidance(message);
    setDriving(false); setDemoIndex(0); sessionRef.current = null;
    setAvailability((current) => ({ ...current, traffic: false }));
    tripSnapshotRef.current = null; removeStored(TRIP_KEY);
    routeCoordinatesRef.current = []; routeStepsRef.current = [];
    setRouteCoordinates([]); setRouteSummary(null); setDestinationAccessDistance(null);
    setNextInstruction("Plan a route to begin"); setNextDistance(0); drawRoute(EMPTY_ROUTE, false); setStatus(message);
  }

  function showEndpointMarkers(start: LngLat, end: LngLat) {
    markers.current.forEach((marker) => marker.remove());
    if (mapRef.current) markers.current = [new maplibregl.Marker({ color: "#152e2a" }).setLngLat(start).addTo(mapRef.current), new maplibregl.Marker({ color: "#ef7b45" }).setLngLat(end).addTo(mapRef.current)];
  }

  function setExactEndpoint(point: LngLat, target: SearchTarget, label: string) {
    clearPlannedRoute();
    if (target === "origin") { setOrigin(point); setOriginText(label); setOriginSelected(true); showEndpointMarkers(point, destinationPoint); }
    else { setDestinationPoint(point); destinationRef.current = point; setDestination(label); setDestinationSelected(true); showEndpointMarkers(origin, point); }
    setSearchResults([]);
    setPinTarget(null);
  }

  async function reverseExactEndpoint(point: LngLat, target: SearchTarget, fallbackLabel: string, revision = invalidateEndpoint(target)) {
    if (point[1] < 6 || point[1] > 38 || point[0] < 68 || point[0] > 98) { setPinTarget(null); setStatus("Choose a point within India"); return; }
    if (endpointRevisions.current[target] !== revision) return;
    endpointRequests.current[target]?.abort();
    const controller = new AbortController();
    endpointRequests.current[target] = controller;
    cancelSearch();
    setExactEndpoint(point, target, fallbackLabel);
    try {
      const response = await fetch(`/api/reverse?lat=${point[1]}&lon=${point[0]}`, { signal: controller.signal });
      if (!response.ok) return;
      const result = await response.json() as ReverseResult;
      if (endpointRequests.current[target] !== controller || endpointRevisions.current[target] !== revision) return;
      const reference = result.reference && result.referenceDistanceMetres !== undefined && result.referenceDistanceMetres <= 250 ? ` · near ${result.reference}` : "";
      const label = `${result.label}${reference}`;
      if (target === "origin") setOriginText(label); else setDestination(label);
    } catch (error) { if ((error as Error).name !== "AbortError") return; }
  }

  async function pickResult(result: SearchResult, target: SearchTarget) {
    const revision = invalidateEndpoint(target);
    cancelSearch();
    const controller = new AbortController();
    endpointRequests.current[target] = controller;
    setStatus("Resolving Mappls place…");
    try {
      const bias = latestPosition.current?.point ?? origin;
      const response = await fetch(`/api/resolve?pin=${encodeURIComponent(result.id)}&lat=${bias[1]}&lon=${bias[0]}`, { signal: controller.signal });
      const data = await response.json() as { point?: LngLat; error?: string };
      if (!response.ok || !data.point) throw new Error(data.error || "Mappls could not resolve this place");
      if (endpointRequests.current[target] !== controller || endpointRevisions.current[target] !== revision) return;
      setExactEndpoint(data.point, target, result.displayName);
      setStatus(`${target === "origin" ? "Start" : "Destination"} selected from Mappls`);
    } catch (error) {
      if ((error as Error).name !== "AbortError") setStatus((error as Error).message);
    }
  }

  function startPinSelection(target: SearchTarget) {
    invalidateEndpoint(target);
    cancelSearch();
    setPinTarget(target);
    setStatus(`Click the map to set the exact ${target === "origin" ? "start" : "destination"}`);
  }

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !pinTarget) return;
    map.getCanvas().style.cursor = "crosshair";
    const selectPin = (event: { lngLat: { lng: number; lat: number } }) => {
      const point: LngLat = [event.lngLat.lng, event.lngLat.lat];
      void reverseExactEndpoint(point, pinTarget, `Dropped pin · ${point[1].toFixed(5)}, ${point[0].toFixed(5)}`);
    };
    map.once("click", selectPin);
    return () => { map.off("click", selectPin); map.getCanvas().style.cursor = ""; };
    // Endpoint selection intentionally uses the current route state captured when pin mode begins.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinTarget]);
  function speak(text = assistantText, priority: "companion" | "guidance" = "companion") { if (!voiceEnabled || !("speechSynthesis" in window) || (priority === "companion" && window.speechSynthesis.speaking)) return false; if (priority === "guidance") window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = voiceLanguage; utterance.rate = priority === "guidance" ? 1.02 : .96; window.speechSynthesis.speak(utterance); return true; }
  function announceUsefulCandidate(candidates: ContextCandidate[], drive: typeof attentionContext.current, at = nowMs()) {
    const departure = departureWeatherPending.current && watchRef.current !== null && drive.distanceToManeuver >= Math.max(180, drive.speedMetresPerSecond * 14) ? candidates.find(candidate => candidate.type === "weather" && candidate.validUntil >= at && candidate.confidence >= 0.62) : undefined;
    const selected = departure && !candidates.some(candidate => candidate.type === "safety" && candidate.validUntil >= at && !mentionedIds.current.has(candidate.id)) ? departure : selectAnnouncement(candidates, { ...drive, interests, mentionedIds: mentionedIds.current, lastSpokenAt: lastSpokenAt.current, cooldownMs: talkativeness === 1 ? 180_000 : talkativeness === 3 ? 45_000 : 90_000, now: at });
    if (!selected) return null;
    setAssistantText(selected.summary); setAssistantSource({ name: selected.sourceName, url: selected.sourceUrl });
    if (speak(selected.summary)) {
      if (selected.type === "weather") departureWeatherPending.current = false;
      mentionedIds.current.add(selected.id); lastSpokenAt.current = at;
      setJourney((current) => current ? persistJourney(addJourneyEvent(current, { type: "announcement", title: selected.title, detail: selected.summary, sourceUrl: selected.sourceUrl, at })) : current);
    }
    return selected;
  }
  function handlePosition(position: LngLat, speedMetresPerSecond: number, headingDegrees: number | null = null) {
    const activeRoute = routeCoordinatesRef.current;
    const activeSteps = routeStepsRef.current;
    if (activeRoute.length < 2) return;
    if (!sessionRef.current || sessionRef.current.routeVersion !== routeVersion.current) sessionRef.current = createSession(routeVersion.current, position);
    const update = updateSession(sessionRef.current, position, activeRoute, activeSteps);
    sessionRef.current = update.session;
    if (tripSnapshotRef.current) { tripSnapshotRef.current = { ...tripSnapshotRef.current, session: update.session }; writeStored(TRIP_KEY, tripSnapshotRef.current); }
    setJourney((current) => current ? persistJourney(addJourneySample(current, position)) : current);
    let distanceToManeuver = Number.POSITIVE_INFINITY;
    if (update.nextStep) {
      const distance = Math.max(0, matchRoute(update.nextStep.location, activeRoute).progressMetres - update.session.progressMetres);
      distanceToManeuver = distance;
      setNextDistance(distance);
      setNextInstruction(update.nextStep.instruction);
      if (shouldAnnounceManeuver(distance, speedMetresPerSecond, "near") && !announcedSteps.current.has(update.nextStep.id)) {
        announcedSteps.current.add(update.nextStep.id);
        speak(update.nextStep.instruction, "guidance");
      }
    }
    attentionContext.current = { position, headingDegrees, speedMetresPerSecond, distanceToManeuver };
    announceUsefulCandidate(contextCandidatesRef.current, attentionContext.current);
    const previousContext = lastContext.current;
    if (!previousContext || nowMs() - previousContext.at >= 45_000 || distanceMetres(previousContext.position, position) >= 700) void refreshContext(position, headingDegrees, speedMetresPerSecond);
    const activeTrip = tripSnapshotRef.current;
    if (activeTrip) {
      const remaining = Math.max(0, activeTrip.distanceMetres - update.session.progressMetres);
      const remainingSeconds = activeTrip.distanceMetres > 0 ? activeTrip.durationSeconds * remaining / activeTrip.distanceMetres : 0;
      setRouteSummary({ distance: formatDistance(remaining), duration: `${Math.max(1, Math.round(remainingSeconds / 60))} min`, eta: formatEta(remainingSeconds) });
    }
    const destinationPosition = destinationRef.current;
    if (watchRef.current !== null && destinationPosition && distanceMetres(position, destinationPosition) < 45) {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null; setLiveGuidance(false); setGpsStatus("idle"); setStatus("You have arrived");
      setJourney((current) => current ? persistJourney(completeJourney(current)) : current);
      return;
    }
    if (watchRef.current !== null && update.shouldReroute && destinationPosition && !rerouting.current && nowMs() - lastRerouteAt.current >= 30_000) {
      rerouting.current = true; lastRerouteAt.current = nowMs(); setStatus("Off route. Recalculating…"); sessionRef.current.offRouteStrikes = 0;
      void calculateRoute(destinationPosition, position, true).finally(() => { rerouting.current = false; });
    }
  }
  function toggleDemoDrive() {
    if (!driving && watchRef.current !== null) stopLiveGuidance("Live guidance stopped");
    if (!driving && demoIndex >= routeCoordinates.length - 1) setDemoIndex(0);
    if (!driving && (!journey || journey.endedAt || journey.destination !== destination)) setJourney(persistJourney(createJourney(destination, routeCoordinates[demoIndex] ?? origin)));
    setDriving((current) => !current);
    setStatus(driving ? "Drive paused" : "Demo drive running");
  }
  useEffect(() => {
    if (!driving) return;
    const timer = window.setInterval(() => setDemoIndex((current) => Math.min(current + 1, routeCoordinates.length - 1)), 1600);
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
  function startLiveDrive() {
    if (!navigator.geolocation) return setStatus("Live location not supported");
    if (!routeCoordinatesRef.current.length) return setStatus("Plan a route before starting live guidance");
    if (watchRef.current !== null) return stopLiveGuidance();
    setDriving(false); setGpsStatus("acquiring"); setStatus("Acquiring current location…"); setLiveGuidance(true); setFollowMode(true);
    if (!journey || journey.endedAt || journey.destination !== destination) setJourney(persistJourney(createJourney(destination, origin)));
    let firstFix = true;
    watchRef.current = navigator.geolocation.watchPosition(({ coords, timestamp }) => {
      const point: LngLat = [coords.longitude, coords.latitude];
      const heading = Number.isFinite(coords.heading) ? coords.heading : null;
      const accuracy = Math.max(0, coords.accuracy);
      latestPosition.current = { point, accuracy, heading, at: timestamp };
      setHasLocation(true);
      setGpsAccuracy(accuracy); updateLiveMarker(point, accuracy, heading);
      const fixStatus = classifyLocationFix(accuracy, timestamp);
      setGpsStatus(fixStatus);
      setStatus(fixStatus === "active" ? `Live guidance · accuracy ${Math.round(accuracy)} m` : fixStatus === "stale" ? "Waiting for a fresh GPS fix" : `Waiting for a better GPS fix · accuracy ${Math.round(accuracy)} m`);
      if (fixStatus === "active" && firstFix) {
        firstFix = false; departureWeatherPending.current = true; contextRequest.current?.abort(); contextRequest.current = null; contextCandidatesRef.current = []; lastContext.current = null;
      }
      if (fixStatus === "active") handlePosition(point, Math.max(coords.speed ?? 0, 0), heading);
    }, (error) => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
      const errorStatus = classifyLocationError(error.code);
      setGpsStatus(errorStatus); setLiveGuidance(false); watchRef.current = null;
      setStatus(errorStatus === "denied" ? "Location permission denied. Enter a starting place instead." : errorStatus === "timeout" ? "Location request timed out. Try again or enter a starting place." : "Current location unavailable. Enter a starting place instead.");
    }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 12000 });
  }
  function selectCurrentLocation(target: SearchTarget) {
    if (!navigator.geolocation) return setStatus("Location not supported");
    const revision = invalidateEndpoint(target);
    cancelSearch();
    const cached = latestPosition.current;
    if (cached && classifyLocationFix(cached.accuracy, cached.at) === "active") {
      void reverseExactEndpoint(cached.point, target, `${target === "origin" ? "Current location" : "GPS destination"} · accuracy ${Math.round(cached.accuracy)} m`, revision);
      setFollowMode(true); mapRef.current?.easeTo({ center: cached.point, zoom: 15, duration: 500 }); return;
    }
    setGpsStatus("acquiring"); setStatus("Finding your location…");
    navigator.geolocation.getCurrentPosition(({ coords, timestamp }) => {
      if (endpointRevisions.current[target] !== revision) return;
      const point: LngLat = [coords.longitude, coords.latitude]; const heading = Number.isFinite(coords.heading) ? coords.heading : null;
      latestPosition.current = { point, accuracy: coords.accuracy, heading, at: timestamp };
      setHasLocation(true);
      const fixStatus = classifyLocationFix(coords.accuracy, timestamp);
      setGpsAccuracy(coords.accuracy); setGpsStatus(fixStatus); updateLiveMarker(point, coords.accuracy, heading);
      if (fixStatus !== "active") { setStatus(fixStatus === "stale" ? "GPS fix is stale. Try again." : `GPS accuracy is ${Math.round(coords.accuracy)} m. Try again for a better fix.`); return; }
      void reverseExactEndpoint(point, target, `${target === "origin" ? "Current location" : "GPS destination"} · accuracy ${Math.round(coords.accuracy)} m`, revision);
      setFollowMode(true); void refreshContext(point, heading, Math.max(coords.speed ?? 0, 0)); setStatus(`Using current location · accuracy ${Math.round(coords.accuracy)} m`);
    }, (error) => { if (endpointRevisions.current[target] !== revision) return; const errorStatus = classifyLocationError(error.code); setGpsStatus(errorStatus); setStatus(errorStatus === "denied" ? "Location permission denied. Enter a starting place instead." : errorStatus === "timeout" ? "Location request timed out. Try again or enter a starting place." : "Current location unavailable. Enter a starting place instead."); }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 });
  }
  function locateMe() {
    if (latestPosition.current && classifyLocationFix(latestPosition.current.accuracy, latestPosition.current.at) === "active") { setFollowMode(true); mapRef.current?.easeTo({ center: latestPosition.current.point, zoom: 15, duration: 500 }); }
    else selectCurrentLocation("origin");
  }
  function answerQuestion(question: string) {
    const q = question.toLowerCase();
    let answer = "I do not have enough verified information to answer that yet.";
    if (q.includes("building") || q.includes("right")) answer = "I cannot reliably identify a building from location alone. Tell me its name or choose a nearby map result.";
    else if (q.includes("eat") || q.includes("food")) { const food = contextCandidates.find((candidate) => candidate.type === "food"); answer = food?.summary ?? "I do not have a sufficiently reliable food result nearby yet."; }
    else if (/park|nature|scenic|viewpoint|garden/.test(q)) { const place = contextCandidates.find((candidate) => candidate.type === "scenic"); answer = place?.summary ?? "I do not have a verified nature or scenic place nearby yet."; }
    else if (/shop|shopping|mall|market/.test(q)) { const place = contextCandidates.find((candidate) => candidate.type === "business"); answer = place?.summary ?? "I do not have a verified shopping place nearby yet."; }
    else if (/sport|stadium/.test(q)) { const place = contextCandidates.find((candidate) => candidate.type === "sport"); answer = place?.summary ?? "I do not have a verified sports venue nearby yet."; }
    else if (/museum|culture|gallery|art/.test(q)) { const place = contextCandidates.find((candidate) => candidate.type === "culture"); answer = place?.summary ?? "I do not have a verified cultural place nearby yet."; }
    else if (/event|festival/.test(q)) { const event = contextCandidates.find((candidate) => candidate.type === "event"); answer = event?.summary ?? "I do not have a verified current event nearby yet."; }
    else if (q.includes("interesting") || q.includes("ahead")) { const place = contextCandidates.find((candidate) => candidate.type === "landmark"); answer = place?.summary ?? "I do not have a verified landmark ahead yet."; }
    else if (q.includes("weather")) { const weather = contextCandidates.find((candidate) => candidate.type === "weather"); answer = weather?.summary ?? "Current weather data is unavailable."; }
    else if (q.includes("happening") || q.includes("news")) { const news = contextCandidates.find((candidate) => candidate.type === "news"); answer = news?.summary ?? "I do not have sufficiently relevant local news right now."; }
    setAssistantText(answer); setCompanionOpen(true); speak(answer); lastSpokenAt.current = nowMs(); return answer;
  }
  async function askGrounded(prompt: string) {
    if (!prompt.trim()) return "";
    try {
      const position = latestPosition.current?.point ?? origin;
      const response = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: prompt, lat: position[1], lon: position[0] }) });
      if (!response.ok) throw new Error();
      const data = await response.json() as AskPayload;
      const answeredAt = nowMs();
      setAssistantText(data.answer); setCompanionOpen(true); lastSpokenAt.current = answeredAt;
      setAssistantSource(data.sources?.[0] ?? null);
      speak(data.answer);
      setJourney((current) => current ? persistJourney(addJourneyEvent(current, { type: "announcement", title: prompt, detail: data.answer, sourceUrl: data.sources?.[0]?.url, at: answeredAt })) : current);
      return data.answer as string;
    } catch { return answerQuestion(prompt); }
  }
  function toggleVoice() {
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; setListening(false); return; }
    const speechWindow = window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
    const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) { const reply = "Voice input is not supported here. Try asking: What is interesting ahead?"; setAssistantText(reply); speak(reply); return; }
    const recognition = new SpeechRecognition(); recognitionRef.current = recognition; recognition.lang = voiceLanguage; recognition.interimResults = false;
    recognition.onstart = () => setListening(true); recognition.onend = () => { recognitionRef.current = null; setListening(false); }; recognition.onerror = () => { recognitionRef.current = null; setListening(false); };
    recognition.onresult = (event) => { void askGrounded(String(event.results[0][0].transcript)); }; recognition.start();
  }
  function toggleInterest(interest: string) { setInterests((current) => current.includes(interest) ? current.filter((item) => item !== interest) : [...current, interest]); }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!originSelected || !destinationSelected) return setStatus("Choose a search result for both start and destination");
    void calculateRoute();
  }
  function submitQuestion(event: FormEvent) { event.preventDefault(); const prompt = question; setQuestion(""); void askGrounded(prompt); }
  function resetOrFollowMap() {
    const fix = latestPosition.current;
    if (fix) { setFollowMode(true); mapRef.current?.easeTo({ center: fix.point, bearing: fix.heading ?? 0, zoom: 15 }); }
    else mapRef.current?.easeTo({ bearing: 0, pitch: 0 });
  }
  function exportJourney() {
    if (!journey) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(journey, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `${journey.id}.json`; link.click(); URL.revokeObjectURL(url);
  }
  function deleteJourney() { setJourney(null); removeStored("marga-current-journey"); }

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
    {mapHealth !== "ready" && <div className={`map-fallback ${mapHealth}`} role="status" aria-live="polite"><div className="map-state"><strong>{mapHealth === "error" ? "Live map unavailable" : "Loading live map…"}</strong><span>{mapHealth === "error" ? "Background image is only a placeholder. Routes and search may still work." : "Connecting to map tiles"}</span>{mapHealth === "error" && <Button type="button" size="sm" onClick={retryMap}><RefreshCw size={14}/>Retry map</Button>}</div></div>}
    <header className="topbar">
      <div className="brand"><span className="brand-mark"><Navigation size={18}/></span><span>Marga</span><small>India web</small></div>
      <div className="status-pill"><span className="status-dot"/>{status}</div>
      <div className="top-actions"><Sheet><SheetTrigger asChild><Button variant="outline" size="icon" aria-label="Open journey journal"><BookOpen size={18}/></Button></SheetTrigger><SheetContent><SheetHeader><SheetTitle>Journey journal</SheetTitle><SheetDescription>{journey ? `Trip to ${journey.destination}` : "Start navigation to create a journal."}</SheetDescription></SheetHeader>{journey && <Journal journey={journey} onExport={exportJourney} onDelete={deleteJourney}/>}</SheetContent></Sheet><Button variant="outline" size="icon" onClick={locateMe} aria-label={hasLocation ? "Recenter on current location" : "Use current location"}><LocateFixed size={18}/></Button></div>
    </header>
    <section className="route-panel" aria-label="Route planner">
      <div className="route-heading"><div><p>Plan journey</p><h1>Where to?</h1></div><span className="mode-badge"><Car size={15}/>Driving</span></div>
      <form onSubmit={submit} className="route-form">
        <div className="field-row"><span className="origin-dot"/><Input value={originText} onChange={(event) => { const value = event.target.value; invalidateEndpoint("origin"); setOriginText(value); setOriginSelected(false); clearPlannedRoute(); scheduleSearch(value, "origin"); }} aria-label="Starting location" autoComplete="off"/>{originText && <button type="button" className="clear-search" aria-label="Clear starting location" onClick={() => { invalidateEndpoint("origin"); cancelSearch(); setOriginText(""); setOriginSelected(false); clearPlannedRoute(); }}><X size={15}/></button>}</div>
        {searchTarget === "origin" && searchResults.length > 0 && <div className="search-results origin-results" role="listbox" aria-label="Starting place results">{searchResults.map((result) => <button type="button" role="option" aria-selected="false" onClick={() => void pickResult(result, "origin")} key={result.id}><MapPin size={15}/><span>{result.displayName}</span><small>{result.precision}</small></button>)}</div>}
        <div className="field-row destination-field"><MapPin size={17}/><Input value={destination} onChange={(event) => { const value = event.target.value; invalidateEndpoint("destination"); setDestination(value); setDestinationSelected(false); destinationRef.current = null; clearPlannedRoute(); scheduleSearch(value, "destination"); }} aria-label="Destination" autoComplete="off"/>{destination && <button type="button" className="clear-search" aria-label="Clear destination" onClick={() => { invalidateEndpoint("destination"); cancelSearch(); setDestination(""); setDestinationSelected(false); destinationRef.current = null; clearPlannedRoute(); }}><X size={15}/></button>}</div>
        {searchTarget === "destination" && searchResults.length > 0 && <div className="search-results destination-results" role="listbox" aria-label="Destination results">{searchResults.map((result) => <button type="button" role="option" aria-selected="false" onClick={() => void pickResult(result, "destination")} key={result.id}><MapPin size={15}/><span>{result.displayName}</span><small>{result.precision}</small></button>)}</div>}
        <div className="endpoint-actions" aria-label="Exact endpoint options">
          <button type="button" onClick={() => selectCurrentLocation("origin")}><LocateFixed size={14}/>GPS start</button>
          <button type="button" onClick={() => startPinSelection("origin")}><MapPin size={14}/>Pin start</button>
          <button type="button" onClick={() => selectCurrentLocation("destination")}><LocateFixed size={14}/>GPS destination</button>
          <button type="button" onClick={() => startPinSelection("destination")}><MapPin size={14}/>Pin destination</button>
        </div>
        <Button type="submit" className="route-button" disabled={loading || !originSelected || !destinationSelected}><Route size={17}/>{loading ? "Calculating…" : "Find route"}</Button>
      </form>
      {routeSummary && <div className="route-card">
        <div className="trip-stats"><strong>{routeSummary.duration}</strong><span>{routeSummary.distance}</span><span>ETA {routeSummary.eta}</span></div>
        <div className="next-turn"><span><ArrowUp size={22}/></span><div><small>IN {formatDistance(nextDistance).toUpperCase()}</small><strong>{nextInstruction}</strong></div></div>
        <div className="route-note"><Clock3 size={14}/>{gpsStatus === "poor" ? `Poor GPS accuracy · ${Math.round(gpsAccuracy ?? 0)} m` : liveGuidance ? `${following ? "Following location" : "Map follow paused"} · ${Math.round(gpsAccuracy ?? 0)} m accuracy` : "Route based on available map data"}</div>
        {destinationAccessDistance !== null && destinationAccessDistance > 75 && <div className="access-warning" role="status"><MapPin size={14}/>The route ends about {formatDistance(destinationAccessDistance)} from your selected pin. Check the correct entrance before arrival.</div>}
        <div className="navigation-actions"><Button type="button" onClick={toggleDemoDrive}>{driving ? <Pause size={15}/> : <Play size={15}/>} {driving ? "Pause preview" : "Preview route"}</Button><Button type="button" variant="outline" onClick={startLiveDrive}><LocateFixed size={15}/> {liveGuidance ? "End navigation" : "Start navigation"}</Button></div>
      </div>}
      <div className="interest-block"><div><p>Your interests</p><span>Guide prioritizes these</span></div><div className="interest-list">{INTERESTS.map((interest) => <button key={interest} onClick={() => toggleInterest(interest)} className={interests.includes(interest) ? "selected" : ""}>{interests.includes(interest) && <Check size={13}/>} {interest}</button>)}</div></div>
      <div className="preference-block"><div className="preference-heading"><span>Talkativeness</span><strong>{["", "Quiet", "Balanced", "Talkative"][talkativeness]}</strong></div><Slider min={1} max={3} step={1} value={[talkativeness]} onValueChange={(value) => setTalkativeness(value[0])} aria-label="Companion talkativeness"/><div className="voice-setting"><label htmlFor="voice-toggle">Voice responses</label><Switch id="voice-toggle" checked={voiceEnabled} onCheckedChange={setVoiceEnabled}/></div><select value={voiceLanguage} onChange={(event) => setVoiceLanguage(event.target.value)} aria-label="Voice language"><option value="en-IN">English (India)</option><option value="hi-IN">Hindi</option><option value="bn-IN">Bengali</option><option value="ta-IN">Tamil</option><option value="te-IN">Telugu</option><option value="mr-IN">Marathi</option></select></div>
      <div className="provider-health"><p>Data available for this area</p><div>{["weather","landmarks","food","culture","nature","shopping","sports","traffic","incidents","events","news"].map((source) => <span key={source} className={availability[source] ? "available" : "unavailable"}><i/>{source}</span>)}</div></div>
      <details className="privacy-note"><summary>Location &amp; privacy</summary><p>Route and nearby requests send coordinates to the listed map and information providers. Your preferences, active trip and journal stay in this browser. Clear a route or delete its journal to remove that local trip data.</p></details>
    </section>
    {pinTarget && <div className="pin-picker" role="status"><strong>Set exact {pinTarget}</strong><span>Click anywhere on the map, or use its centre.</span><div><button type="button" onClick={() => { const center = mapRef.current?.getCenter(); if (center) void reverseExactEndpoint([center.lng, center.lat], pinTarget, `Dropped pin · ${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`); }}>Use map centre</button><button type="button" onClick={() => { setPinTarget(null); setStatus("Pin selection cancelled"); }}>Cancel</button></div></div>}
    <button className="map-control" aria-label={hasLocation && !following ? "Resume map follow" : "Reset compass"} onClick={resetOrFollowMap}>{hasLocation && !following ? <LocateFixed size={20}/> : <Compass size={20}/>}</button>
    {companionOpen && <aside className="companion-card" aria-live="polite"><div className="companion-top"><span className="guide-icon"><Sparkles size={17}/></span><div><small>ROAD GUIDE</small><strong>Worth knowing now</strong></div><button aria-label="Dismiss" onClick={() => setCompanionOpen(false)}><X size={17}/></button></div><p>{assistantText}</p><div className="source-row">{assistantSource ? <a href={assistantSource.url} target="_blank" rel="noreferrer">Source: {assistantSource.name}</a> : <span>Waiting for verified context</span>}<button onClick={() => speak()}><Volume2 size={15}/>Read aloud</button><button onClick={() => void refreshContext()}>{contextLoading ? "Checking…" : "Refresh"}</button></div></aside>}
    <form className="voice-dock" onSubmit={submitQuestion}><button type="button" className={listening ? "voice-button listening" : "voice-button"} onClick={toggleVoice} aria-label={listening ? "Stop listening" : "Ask road guide"}>{listening ? <MicOff size={24}/> : <Mic size={24}/>}</button><div><strong>{listening ? "Listening…" : "Ask your road guide"}</strong><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Anything interesting ahead?" aria-label="Question for road guide"/></div><button type="submit" className="send-question" aria-label="Send question" disabled={!question.trim()}><Send size={17}/></button></form>
  </main>;
}

function Journal({ journey, onExport, onDelete }: { journey: JourneyRecord; onExport: () => void; onDelete: () => void }) {
  const summary = summarizeJourney(journey);
  return <div className="journal"><div className="journal-stats"><div><strong>{formatDistance(summary.distanceMetres)}</strong><span>travelled</span></div><div><strong>{summary.durationMinutes} min</strong><span>duration</span></div><div><strong>{summary.encounters.length}</strong><span>discoveries</span></div></div><div className="journal-timeline">{journey.events.map((event) => <article key={event.id}><span>{new Date(event.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span><div><strong>{event.title}</strong>{event.detail && <p>{event.detail}</p>}{event.sourceUrl && <a href={event.sourceUrl} target="_blank" rel="noreferrer">View source</a>}</div></article>)}</div><Button onClick={onExport}><Download size={16}/>Export journey data</Button><Button variant="outline" onClick={onDelete}>Delete local journal</Button></div>;
}
