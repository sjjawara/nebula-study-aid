import { useEffect, useRef, useState, useCallback } from "react";
import { ExternalLink, X, Minus, GripHorizontal, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { extractVideoId, registerEmbeddedSeekHandler } from "@/lib/timestamp";
import { cn } from "@/lib/utils";

type Props = { videoUrl: string };

const ASPECT = 16 / 9;
const MIN_W = 320;
const MAX_W = 800;
const SNAP_THRESHOLD = 24;
const MARGIN = 16;

export const YoutubePlayer = ({ videoUrl }: Props) => {
  const videoId = extractVideoId(videoUrl);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const readyRef = useRef(false);
  const failedRef = useRef(false);
  const loadedAtRef = useRef<number | null>(null);
  const [hidden, setHidden] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [failed, setFailed] = useState(false);

  const [size, setSize] = useState({ w: 420, h: Math.round(420 / ASPECT) });
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  // Initialize position to bottom-right once we know window size.
  useEffect(() => {
    if (pos !== null) return;
    const x = window.innerWidth - size.w - MARGIN;
    const y = window.innerHeight - size.h - 40 - MARGIN;
    setPos({ x: Math.max(MARGIN, x), y: Math.max(MARGIN, y) });
  }, [pos, size.w, size.h]);

  // Clamp on viewport resize.
  useEffect(() => {
    const onResize = () => {
      setPos((p) => {
        if (!p) return p;
        return {
          x: Math.min(Math.max(MARGIN, p.x), window.innerWidth - size.w - MARGIN),
          y: Math.min(Math.max(MARGIN, p.y), window.innerHeight - size.h - 40 - MARGIN),
        };
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [size.w, size.h]);

  // YouTube iframe API messages.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (typeof e.data !== "string") return;
      if (!e.origin || !/youtube\.com|youtube-nocookie\.com/.test(e.origin)) return;
      try {
        const data = JSON.parse(e.data);
        if (data?.event === "onReady" || data?.event === "initialDelivery") {
          readyRef.current = true;
        }
        if (data?.event === "onError" || data?.info?.errorCode) {
          failedRef.current = true;
          setFailed(true);
        }
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const send = useCallback((func: string, args: unknown[] = []) => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) return false;
    try {
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: "command", func, args }),
        "*",
      );
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    registerEmbeddedSeekHandler((reqVideoId, seconds) => {
      if (!videoId || reqVideoId !== videoId) return false;
      if (failedRef.current || hidden) return false;
      if (loadedAtRef.current === null) return false;
      if (!readyRef.current && Date.now() - loadedAtRef.current > 3000) {
        failedRef.current = true;
        setFailed(true);
        return false;
      }
      if (minimized) setMinimized(false);
      const ok = send("seekTo", [seconds, true]);
      send("playVideo", []);
      return ok;
    });
    return () => registerEmbeddedSeekHandler(null);
  }, [videoId, send, hidden, minimized]);

  const handleLoad = () => {
    loadedAtRef.current = Date.now();
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    try {
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: "listening", id: 1, channel: "widget" }),
        "*",
      );
    } catch {
      /* ignore */
    }
    setTimeout(() => {
      if (!readyRef.current) {
        failedRef.current = true;
        setFailed(true);
      }
    }, 4000);
  };

  // Dragging the panel.
  const dragStateRef = useRef<{ dx: number; dy: number } | null>(null);
  const onDragPointerDown = (e: React.PointerEvent) => {
    if (!pos) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    dragStateRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
  };
  const onDragPointerMove = (e: React.PointerEvent) => {
    const state = dragStateRef.current;
    if (!state) return;
    const headerH = 32;
    const totalH = minimized ? 56 : size.h + headerH;
    const totalW = minimized ? 180 : size.w;
    let x = e.clientX - state.dx;
    let y = e.clientY - state.dy;
    const maxX = window.innerWidth - totalW - MARGIN;
    const maxY = window.innerHeight - totalH - MARGIN;
    x = Math.min(Math.max(MARGIN, x), Math.max(MARGIN, maxX));
    y = Math.min(Math.max(MARGIN, y), Math.max(MARGIN, maxY));
    // Snap to edges.
    if (x - MARGIN < SNAP_THRESHOLD) x = MARGIN;
    if (maxX - x < SNAP_THRESHOLD) x = maxX;
    if (y - MARGIN < SNAP_THRESHOLD) y = MARGIN;
    if (maxY - y < SNAP_THRESHOLD) y = maxY;
    setPos({ x, y });
  };
  const onDragPointerUp = (e: React.PointerEvent) => {
    dragStateRef.current = null;
    try { (e.target as Element).releasePointerCapture(e.pointerId); } catch { /* */ }
  };

  // Resizing.
  const resizeStateRef = useRef<{ sx: number; sy: number; sw: number } | null>(null);
  const onResizePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    resizeStateRef.current = { sx: e.clientX, sy: e.clientY, sw: size.w };
  };
  const onResizePointerMove = (e: React.PointerEvent) => {
    const state = resizeStateRef.current;
    if (!state || !pos) return;
    const dx = e.clientX - state.sx;
    const dy = e.clientY - state.sy;
    // Use the larger of horizontal/vertical drag to drive width, then derive height.
    let newW = state.sw + Math.max(dx, dy * ASPECT);
    newW = Math.min(MAX_W, Math.max(MIN_W, newW));
    const maxByViewportW = window.innerWidth - pos.x - MARGIN;
    const maxByViewportH = (window.innerHeight - pos.y - 32 - MARGIN) * ASPECT;
    newW = Math.min(newW, maxByViewportW, maxByViewportH);
    newW = Math.max(MIN_W, newW);
    setSize({ w: Math.round(newW), h: Math.round(newW / ASPECT) });
  };
  const onResizePointerUp = (e: React.PointerEvent) => {
    resizeStateRef.current = null;
    try { (e.target as Element).releasePointerCapture(e.pointerId); } catch { /* */ }
  };

  if (!videoId || hidden || !pos) {
    if (!videoId || hidden) return null;
    return null;
  }

  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // Minimized thumbnail bubble.
  if (minimized) {
    return (
      <div
        className="fixed z-40 select-none rounded-full border border-border bg-card shadow-xl flex items-center gap-2 pl-2 pr-3 py-2 cursor-grab active:cursor-grabbing"
        style={{ left: pos.x, top: pos.y }}
        onPointerDown={onDragPointerDown}
        onPointerMove={onDragPointerMove}
        onPointerUp={onDragPointerUp}
      >
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setMinimized(false); }}
          className="flex items-center gap-2 text-xs font-medium"
          title="Expand player"
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Play className="h-3.5 w-3.5" />
          </span>
          Lecture
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setHidden(true); }}
          className="text-muted-foreground hover:text-foreground"
          title="Hide"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "fixed z-40 select-none",
        "rounded-xl border border-border bg-card shadow-xl overflow-hidden",
      )}
      style={{ left: pos.x, top: pos.y, width: size.w }}
    >
      {/* Drag handle */}
      <div
        className="flex items-center justify-between px-2 py-1 border-b border-border bg-card/80 backdrop-blur cursor-grab active:cursor-grabbing"
        onPointerDown={onDragPointerDown}
        onPointerMove={onDragPointerMove}
        onPointerUp={onDragPointerUp}
      >
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground truncate">
          <GripHorizontal className="h-3.5 w-3.5 opacity-60" />
          Lecture player
        </div>
        <div className="flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setMinimized(true)}
            title="Minimize"
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setHidden(true)}
            title="Hide player"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="p-2 space-y-2">
        {failed ? (
          <div
            className="w-full flex flex-col items-center justify-center gap-2 rounded-md bg-muted/50 p-4 text-center"
            style={{ height: size.h }}
          >
            <p className="text-xs text-muted-foreground">
              This video can't be embedded. Use the button below to open it on YouTube — timestamp links will open in a new tab.
            </p>
          </div>
        ) : (
          <div className="w-full overflow-hidden rounded-md bg-black" style={{ height: size.h }}>
            <iframe
              ref={iframeRef}
              className="youtube-player h-full w-full"
              src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1`}
              title="YouTube player"
              frameBorder={0}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              onLoad={handleLoad}
              onError={() => {
                failedRef.current = true;
                setFailed(true);
              }}
            />
          </div>
        )}
        <a
          href={youtubeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          Open in YouTube
        </a>
      </div>

      {/* Resize handle */}
      <div
        role="slider"
        aria-label="Resize player"
        className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize"
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
        style={{
          background:
            "linear-gradient(135deg, transparent 50%, hsl(var(--muted-foreground) / 0.6) 50%, hsl(var(--muted-foreground) / 0.6) 60%, transparent 60%, transparent 70%, hsl(var(--muted-foreground) / 0.6) 70%, hsl(var(--muted-foreground) / 0.6) 80%, transparent 80%)",
        }}
      />
    </div>
  );
};
