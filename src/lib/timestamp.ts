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
  if (!timestamp && timestamp !== 0) return 0;
  const str = String(timestamp).trim();
  if (!str) return 0;

  // Decimal format like "2.30" — treat as total seconds
  if (str.includes(".") && !str.includes(":")) {
    const f = parseFloat(str);
    return Number.isNaN(f) ? 0 : Math.floor(f);
  }

  // "M:SS" or "H:MM:SS"
  const parts = str.split(":");
  if (parts.length === 2) {
    const minutes = parseInt(parts[0], 10) || 0;
    const seconds = parseInt(parts[1], 10) || 0;
    return minutes * 60 + seconds;
  }
  if (parts.length === 3) {
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    const seconds = parseInt(parts[2], 10) || 0;
    return hours * 3600 + minutes * 60 + seconds;
  }

  // Plain seconds
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
  if (videoUrl) {
    const id = extractVideoId(videoUrl);
    if (id) return `https://www.youtube.com/watch?v=${id}&t=${seconds}s`;
    const sep = videoUrl.includes("?") ? "&" : "?";
    return `${videoUrl}${sep}t=${seconds}s`;
  }
  return null;
};

/** Open a YouTube video at a specific timestamp in a new tab. */
export const openYoutubeAt = (
  videoUrlOrId: string | null | undefined,
  timestamp: string | undefined,
) => {
  if (!videoUrlOrId || !timestamp) return;
  const seconds = timestampToSeconds(timestamp);
  const id =
    videoUrlOrId.startsWith("http") || videoUrlOrId.includes("/")
      ? extractVideoId(videoUrlOrId)
      : videoUrlOrId;
  const url = id
    ? `https://www.youtube.com/watch?v=${id}&t=${seconds}s`
    : null;
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
};
