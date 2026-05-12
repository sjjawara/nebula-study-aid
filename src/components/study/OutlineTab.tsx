import type { Lecture } from "@/lib/mockData";
import { BloomBadge } from "@/components/BloomBadge";
import { CognitiveLoad } from "@/components/CognitiveLoad";
import { AlertTriangle, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { InfoTooltip, tooltipCopy } from "@/components/InfoTooltip";

type LoadBucket = "low" | "medium" | "high";

const bucketFor = (load: number): LoadBucket => {
  if (load <= 2) return "low";
  if (load === 3) return "medium";
  return "high";
};

const dotClass: Record<LoadBucket, string> = {
  low: "bg-emerald-500",
  medium: "bg-amber-500",
  high: "bg-red-500",
};

const labelFor: Record<LoadBucket, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

import { extractVideoId, openYoutubeAt } from "@/lib/timestamp";

export const OutlineTab = ({ lecture, videoUrl }: { lecture: Lecture; videoUrl?: string }) => {
  const videoId = videoUrl ? extractVideoId(videoUrl) : null;

  return (
  <div className="space-y-3">
    {/* Legend */}
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/60 px-4 py-2.5 text-xs text-muted-foreground">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-medium text-foreground inline-flex items-center gap-1">
          Cognitive load:
          <InfoTooltip content={tooltipCopy.cognitiveLoad} label="About cognitive load" />
        </span>
        {(["low", "medium", "high"] as LoadBucket[]).map((b) => (
          <span key={b} className="inline-flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", dotClass[b])} />
            {labelFor[b]}
          </span>
        ))}
      </div>
      <span className="inline-flex items-center gap-1.5 text-amber-600">
        <AlertTriangle className="h-3.5 w-3.5" />
        Slow down on high-load moments — they need extra processing time.
      </span>
    </div>

    {lecture.outline.map((item, idx) => {
      const bucket = bucketFor(item.load);
      const isHigh = bucket === "high";
      return (
        <div
          key={`${item.timestamp}-${idx}`}
          className={cn(
            "group flex items-center gap-4 rounded-xl border bg-card p-4 shadow-card transition-colors hover:border-primary/40",
            isHigh ? "border-red-500/40 bg-red-500/5" : "border-border",
          )}
        >
          <span
            className={cn(
              "h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-background",
              dotClass[bucket],
              isHigh && "animate-pulse",
            )}
            title={`${labelFor[bucket]} cognitive load (${item.load}/5)`}
            aria-label={`${labelFor[bucket]} cognitive load`}
          />
          {videoId ? (
            <button
              type="button"
              onClick={() => openYoutubeAt(videoId, item.timestamp)}
              className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 font-mono text-xs text-primary tabular-nums hover:bg-primary/20 transition-colors"
              aria-label={`Open YouTube at ${item.timestamp}`}
            >
              <Play className="h-3 w-3 fill-current" />
              {item.timestamp}
            </button>
          ) : (
            <span className="font-mono text-sm text-muted-foreground tabular-nums w-14">
              {item.timestamp}
            </span>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{item.topic}</p>
            {isHigh && (
              <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-red-600">
                <AlertTriangle className="h-3 w-3" />
                High load — slow down to process
              </p>
            )}
          </div>
          <BloomBadge level={item.bloom} variant="dots" />
          <CognitiveLoad value={item.load} />
        </div>
      );
    })}
  </div>
  );
};
