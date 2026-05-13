import { useEffect, useRef, useState, useCallback } from "react";
import { ChevronDown, ChevronUp, ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { extractVideoId, registerEmbeddedSeekHandler } from "@/lib/timestamp";
import { cn } from "@/lib/utils";

type Props = { videoUrl: string };

/**
 * Sticky embedded YouTube player. Listens for seek requests via
 * registerEmbeddedSeekHandler. If the iframe fails to become "ready"
 * (some videos block embedding) or never loads, the handler returns
 * false so callers fall back to opening a new tab.
 */
export const YoutubePlayer = ({ videoUrl }: Props) => {
  const videoId = extractVideoId(videoUrl);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const readyRef = useRef(false);
  const failedRef = useRef(false);
  const loadedAtRef = useRef<number | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [failed, setFailed] = useState(false);

  // Listen for YouTube iframe API postMessage events.
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

  // Register seek handler — returns false to trigger new-tab fallback.
  useEffect(() => {
    registerEmbeddedSeekHandler((reqVideoId, seconds) => {
      if (!videoId || reqVideoId !== videoId) return false;
      if (failedRef.current || hidden) return false;
      // If iframe hasn't loaded at all yet, fallback.
      if (loadedAtRef.current === null) return false;
      // If load happened but no onReady within 3s → mark failed, fallback.
      if (!readyRef.current && Date.now() - loadedAtRef.current > 3000) {
        failedRef.current = true;
        setFailed(true);
        return false;
      }
      if (collapsed) setCollapsed(false);
      const ok = send("seekTo", [seconds, true]);
      send("playVideo", []);
      return ok;
    });
    return () => registerEmbeddedSeekHandler(null);
  }, [videoId, send, hidden, collapsed]);

  // Subscribe to YT iframe API events once the iframe loads.
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
    // If onReady never arrives within 4s, treat as failed.
    setTimeout(() => {
      if (!readyRef.current) {
        failedRef.current = true;
        setFailed(true);
      }
    }, 4000);
  };

  if (!videoId || hidden) return null;

  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

  return (
    <div
      className={cn(
        "fixed z-40 bottom-4 right-4 w-[420px] max-w-[calc(100vw-2rem)]",
        "rounded-xl border border-border bg-card shadow-xl overflow-hidden",
      )}
    >
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-card/80 backdrop-blur">
        <span className="text-xs font-medium text-muted-foreground truncate">
          Lecture player
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setHidden(true)}
            title="Hide player"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!collapsed && (
        <div className="p-2 space-y-2">
          {failed ? (
            <div className="aspect-video w-full flex flex-col items-center justify-center gap-2 rounded-md bg-muted/50 p-4 text-center">
              <p className="text-xs text-muted-foreground">
                This video can't be embedded. Use the button below to open it on YouTube — timestamp links will open in a new tab.
              </p>
            </div>
          ) : (
            <div className="aspect-video w-full overflow-hidden rounded-md bg-black">
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
      )}
    </div>
  );
};
