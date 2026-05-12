// Single source of truth for timestamp → seconds conversion and YouTube URL building.
// Used across Outline, Flashcards, Search, Mind Map, and Quiz tabs so every link
// jumps to the correct moment.

/** Convert "h:mm:ss" or "m:ss" (or "ss") to total seconds. */
export const timestampToSeconds = (timestamp: string): number => {
  if (!timestamp) return 0;
  const parts = timestamp.split(":").map((p) => parseInt(p, 10));
  if (parts.some((n) => Number.isNaN(n))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return 0;
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
