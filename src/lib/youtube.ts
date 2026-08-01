// A YouTube id is always 11 characters of [A-Za-z0-9_-]. Anything else came
// out of a bad OCR read and must not become an iframe.
const ID_RE = /^[A-Za-z0-9_-]{11}$/;
const ID_CAPTURE = "([A-Za-z0-9_-]{11})";

const URL_PATTERNS = [
  new RegExp(`youtube\\.com/watch\\?(?:[^\\s]*&)?v=${ID_CAPTURE}`, "i"),
  new RegExp(`youtu\\.be/${ID_CAPTURE}`, "i"),
  new RegExp(`youtube(?:-nocookie)?\\.com/embed/${ID_CAPTURE}`, "i"),
  new RegExp(`youtube\\.com/shorts/${ID_CAPTURE}`, "i"),
  new RegExp(`youtube\\.com/live/${ID_CAPTURE}`, "i"),
];

export type MediaItem = {
  type: "youtube";
  videoId: string;
  title: string;
  start: number;
};

/** Accepts a full URL or a bare id. Returns null if it is not a valid id. */
export function extractVideoId(input: string): string | null {
  if (!input) return null;
  const value = String(input).trim();
  if (ID_RE.test(value)) return value;
  for (const pattern of URL_PATTERNS) {
    const match = value.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

/** Reads `t=90`, `t=1m30s` or `start=90` out of a URL, in seconds. */
export function extractStart(input: string): number {
  if (!input) return 0;
  const match = String(input).match(/[?&#](?:t|start)=([0-9hms]+)/i);
  if (!match) return 0;
  const raw = match[1];
  if (/^\d+$/.test(raw)) return parseInt(raw, 10);
  const parts = raw.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/i);
  if (!parts) return 0;
  return (
    parseInt(parts[1] ?? "0", 10) * 3600 +
    parseInt(parts[2] ?? "0", 10) * 60 +
    parseInt(parts[3] ?? "0", 10)
  );
}

/** Finds every YouTube link in a blob of text. Used as a safety net so a link
 *  the model overlooked still reaches the student. */
export function findVideoIds(text: string): string[] {
  if (!text) return [];
  const found = new Set<string>();
  for (const pattern of URL_PATTERNS) {
    const global = new RegExp(pattern.source, "gi");
    for (const match of text.matchAll(global)) {
      if (match[1]) found.add(match[1]);
    }
  }
  return [...found];
}

/** Normalises whatever the model returned into safe, renderable media items. */
export function normaliseMedia(raw: unknown): MediaItem[] {
  if (!Array.isArray(raw)) return [];
  const out: MediaItem[] = [];
  const seen = new Set<string>();

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    // The model may hand back a url, a videoId, or both.
    const videoId =
      extractVideoId(String(item.videoId ?? "")) ??
      extractVideoId(String(item.url ?? ""));
    if (!videoId || seen.has(videoId)) continue;
    seen.add(videoId);

    const start =
      Number(item.start) > 0
        ? Math.floor(Number(item.start))
        : extractStart(String(item.url ?? ""));

    out.push({
      type: "youtube",
      videoId,
      title: String(item.title ?? "").slice(0, 200),
      start: Number.isFinite(start) && start > 0 ? start : 0,
    });
  }
  return out;
}

export function parseMedia(json: string): MediaItem[] {
  try {
    return normaliseMedia(JSON.parse(json || "[]"));
  } catch {
    return [];
  }
}

/** Privacy-friendly embed host, no related videos from other channels. */
export function embedUrl(item: MediaItem): string {
  const params = new URLSearchParams({ rel: "0", modestbranding: "1" });
  if (item.start > 0) params.set("start", String(item.start));
  return `https://www.youtube-nocookie.com/embed/${item.videoId}?${params}`;
}

export function watchUrl(item: MediaItem): string {
  return `https://www.youtube.com/watch?v=${item.videoId}${item.start ? `&t=${item.start}` : ""}`;
}
