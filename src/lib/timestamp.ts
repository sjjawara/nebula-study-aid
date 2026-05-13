// Single source of truth for timestamp → seconds conversion and YouTube URL building.
// Used across Outline, Flashcards, Search, Mind Map, and Quiz tabs so every link
// jumps to the correct moment.

/**
 * Convert a timestamp to total seconds. Supports:
 *   - "M:SS" or "H:MM:SS"
 *   - decimal like "2.30" → treated as total seconds (NOT minutes.seconds)
 *   - plain integer seconds
 */
export const timestampToSeconds = (timestamp: string | number | null | undefined): number => {
  if (timestamp === null || timestamp === undefined || timestamp === "") return 0;

  // Numeric input — treat as plain seconds (NOT milliseconds, NOT decimal MM.SS).
  if (typeof timestamp === "number") {
    return Number.isFinite(timestamp) ? Math.floor(timestamp) : 0;
  }

  // Normalize: trim, strip leading "[" / trailing "]" (transcript brackets),
  // strip trailing "s" / "sec" labels, swap full-width colon for ASCII colon.
  let str = String(timestamp).trim();
  str = str.replace(/^\[+|\]+$/g, "").trim();
  str = str.replace(/[：]/g, ":");
  str = str.replace(/\s*(seconds?|secs?|s)$/i, "").trim();
  if (!str) return 0;

  // Support "1h2m3s" / "2m30s" style.
  const hmsMatch = str.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/i);
  if (hmsMatch && (hmsMatch[1] || hmsMatch[2] || hmsMatch[3])) {
    const h = parseInt(hmsMatch[1] ?? "0", 10) || 0;
    const m = parseInt(hmsMatch[2] ?? "0", 10) || 0;
    const s = parseInt(hmsMatch[3] ?? "0", 10) || 0;
    if (h || m || /[hms]/i.test(str)) return h * 3600 + m * 60 + s;
  }

  // Colon-separated: "M:SS", "MM:SS", "H:MM:SS"
  if (str.includes(":")) {
    const parts = str.split(":").map((p) => parseInt(p, 10) || 0);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 4) return parts[0] * 86400 + parts[1] * 3600 + parts[2] * 60 + parts[3];
  }

  // Decimal like "2.30" — treat as total seconds, NOT minutes.seconds.
  if (str.includes(".")) {
    const f = parseFloat(str);
    return Number.isNaN(f) ? 0 : Math.floor(f);
  }

  // Plain integer seconds.
  const num = parseInt(str, 10);
  return Number.isNaN(num) ? 0 : num;
};

export const extractVideoId = (videoUrl: string): string | null => {
  try {
    const u = new URL(videoUrl);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1) || null;
    const v = u.searchParams.get("v");
    if (v) return v;
    const m = u.pathname.match(/\/(?:embed|shorts|v)\/([^/?#]+)/);
    if (m) return m[1];
    return null;
  } catch {
    return null;
  }
};

/** Build a YouTube URL that jumps to the given timestamp. */
export const buildYoutubeUrl = (
  videoUrl: string | undefined,
  timestamp: string | undefined,
): string | null => {
  if (!timestamp) return null;
  const seconds = timestampToSeconds(timestamp);
  console.log("Opening YouTube at seconds:", seconds, "from timestamp:", timestamp);
  if (videoUrl) {
    const id = extractVideoId(videoUrl);
    if (id) return `https://www.youtube.com/watch?v=${id}&t=${seconds}s`;
    const sep = videoUrl.includes("?") ? "&" : "?";
    return `${videoUrl}${sep}t=${seconds}s`;
  }
  return null;
};

/**
 * Embedded-player handler. The YoutubePlayer component registers a function
 * that receives (videoId, seconds) and returns true if it successfully
 * dispatched a seek to its iframe. Returning false (or no handler) triggers
 * the new-tab fallback.
 */
type EmbeddedSeekHandler = (videoId: string, seconds: number) => boolean;
let embeddedSeekHandler: EmbeddedSeekHandler | null = null;
export const registerEmbeddedSeekHandler = (h: EmbeddedSeekHandler | null) => {
  embeddedSeekHandler = h;
};

/** Open a YouTube video at a specific timestamp — embedded player if available, else new tab. */
export const openYoutubeAt = (
  videoUrlOrId: string | null | undefined,
  timestamp: string | undefined,
) => {
  if (!videoUrlOrId || !timestamp) return;
  const seconds = timestampToSeconds(timestamp);
  console.log("Opening YouTube at seconds:", seconds, "from timestamp:", timestamp);
  const id =
    videoUrlOrId.startsWith("http") || videoUrlOrId.includes("/")
      ? extractVideoId(videoUrlOrId)
      : videoUrlOrId;
  if (id && embeddedSeekHandler && embeddedSeekHandler(id, seconds)) return;
  const url = id
    ? `https://www.youtube.com/watch?v=${id}&t=${seconds}s`
    : null;
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
};
