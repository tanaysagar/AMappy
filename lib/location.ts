export type LocationFixStatus = "active" | "poor" | "stale";
export type LocationErrorStatus = "denied" | "timeout" | "unavailable";

export function classifyLocationFix(accuracyMetres: number, timestamp: number, now = Date.now()): LocationFixStatus {
  if (!Number.isFinite(timestamp) || now - timestamp > 15_000) return "stale";
  if (!Number.isFinite(accuracyMetres) || accuracyMetres < 0 || accuracyMetres > 100) return "poor";
  return "active";
}

export function classifyLocationError(code: number): LocationErrorStatus {
  if (code === 1) return "denied";
  if (code === 3) return "timeout";
  return "unavailable";
}

export function accuracyDiameterPixels(accuracyMetres: number, latitude: number, zoom: number) {
  const metresPerPixel = 156543.03392 * Math.cos(latitude * Math.PI / 180) / 2 ** zoom;
  return Math.max(26, Math.min(220, accuracyMetres * 2 / Math.max(metresPerPixel, 0.1)));
}
