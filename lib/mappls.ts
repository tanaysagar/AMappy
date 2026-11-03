export type MapplsSearchResult = {
  id: string;
  displayName: string;
  precision: string;
  provider: "Mappls";
};

export type MapplsReverseResult = {
  label: string;
  reference?: string;
  referenceDistanceMetres?: number;
  provider: "Mappls";
  precision: "pin";
};

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" ? value as UnknownRecord : null;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function finiteNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

export function mapplsFailure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/HTTP|returned/.test(message) && /401/.test(message)) return { error: "This Mappls capability is not enabled for the current key. Try English or choose an exact pin.", code: "MAPPLS_NOT_AUTHORIZED" };
  if (/HTTP|returned/.test(message) && /(403|429)/.test(message)) return { error: "Mappls quota or key restrictions blocked this request. Choose an exact pin or try later.", code: "MAPPLS_LIMITED" };
  return { error: "Mappls is temporarily unavailable. Choose an exact pin or try again.", code: "MAPPLS_UNAVAILABLE" };
}

export function parseMapplsSearch(payload: unknown): MapplsSearchResult[] {
  const root = record(payload);
  const combined = [
    ...(Array.isArray(root?.suggestedLocations) ? root.suggestedLocations : []),
    ...(Array.isArray(root?.userAddedLocations) ? root.userAddedLocations : []),
  ];
  const seen = new Set<string>();
  return combined.flatMap((value) => {
    const item = record(value);
    const id = text(item?.eLoc ?? item?.mapplsPin);
    if (!id || seen.has(id)) return [];
    seen.add(id);
    const name = text(item?.placeName);
    const address = text(item?.placeAddress);
    return [{ id, displayName: [name, address].filter(Boolean).join(", ") || id, precision: text(item?.type) || "place", provider: "Mappls" as const }];
  }).slice(0, 5);
}

export function parseMapplsGeocode(payload: unknown): MapplsSearchResult[] {
  const root = record(payload);
  const values = Array.isArray(root?.copResults) ? root.copResults : root?.copResults ? [root.copResults] : [];
  return values.flatMap((value) => {
    const item = record(value);
    const id = text(item?.eLoc ?? item?.eloc);
    if (!id) return [];
    const address = text(item?.formattedAddress ?? item?.formatted_address);
    const name = text(item?.houseName ?? item?.poi);
    return [{ id, displayName: address || name || id, precision: text(item?.geocodeLevel) || "address", provider: "Mappls" as const }];
  }).slice(0, 5);
}

export function parseMapplsPoint(payload: unknown): [number, number] | null {
  const root = record(payload);
  const candidate = record(root?.copResults) ?? record(root?.result) ?? root;
  const latitude = finiteNumber(candidate?.latitude ?? candidate?.lat);
  const longitude = finiteNumber(candidate?.longitude ?? candidate?.lng ?? candidate?.lon);
  if (latitude === null || longitude === null || latitude < 6 || latitude > 38 || longitude < 68 || longitude > 98) return null;
  return [longitude, latitude];
}

export function parseMapplsRouteEndpoint(payload: unknown): [number, number] | null {
  const root = record(payload);
  const waypoints = Array.isArray(root?.waypoints) ? root.waypoints : [];
  const last = record(waypoints.at(-1));
  const location = last?.location;
  if (!Array.isArray(location) || location.length !== 2) return null;
  const longitude = finiteNumber(location[0]); const latitude = finiteNumber(location[1]);
  if (latitude === null || longitude === null || latitude < 6 || latitude > 38 || longitude < 68 || longitude > 98) return null;
  return [longitude, latitude];
}

export function parseMapplsReverse(payload: unknown): MapplsReverseResult | null {
  const root = record(payload);
  const first = Array.isArray(root?.results) ? record(root.results[0]) : null;
  if (!first) return null;
  const label = text(first.formatted_address) || [text(first.poi), text(first.street), text(first.locality), text(first.city), text(first.state)].filter(Boolean).join(", ");
  if (!label) return null;
  const reference = text(first.poi) || undefined;
  const distance = finiteNumber(first.poi_dist);
  return { label, reference, referenceDistanceMetres: distance === null ? undefined : distance, provider: "Mappls", precision: "pin" };
}
