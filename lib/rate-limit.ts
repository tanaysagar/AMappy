const windows = new Map<string, { count: number; resetAt: number }>();

export function allowRequest(request: Request, bucket: string, limit: number, windowMs: number, now = Date.now()) {
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const key = `${bucket}:${ip}`;
  const current = windows.get(key);
  if (!current || current.resetAt <= now) { windows.set(key, { count: 1, resetAt: now + windowMs }); return true; }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
  // ponytail: per-instance limiter; replace with durable shared counters before multi-region scale.
}
