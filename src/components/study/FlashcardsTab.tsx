import { useState } from "react";
import type { Lecture, Flashcard } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { BloomBadge } from "@/components/BloomBadge";
import { ChevronLeft, ChevronRight, RotateCw, Sparkles, Play } from "lucide-react";

interface FlashcardsTabProps {
  lecture: Lecture;
  videoUrl?: string;
  onQuizCard?: (card: Flashcard) => void;
}

const timestampToSeconds = (ts: string): number => {
  const parts = ts.split(":").map((p) => parseInt(p, 10) || 0);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
};

const extractVideoId = (videoUrl: string): string | null => {
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

const openTimestamp = (videoId: string, seconds: number) => {
  const url = `https://www.youtube.com/watch?v=${videoId}&t=${seconds}s`;
  window.open(url, "_blank", "noopener,noreferrer");
};

export const TimestampBadge = ({
  videoId,
  timestamp,
}: {
  videoId: string | null;
  timestamp?: string;
}) => {
  if (!timestamp) return null;
  if (!videoId) {
    return (
      <span className="font-mono text-xs text-muted-foreground tabular-nums">{timestamp}</span>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        openTimestamp(videoId, timestampToSeconds(timestamp));
      }}
      className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 font-mono text-xs text-primary tabular-nums hover:bg-primary/20 transition-colors"
      aria-label={`Open YouTube at ${timestamp}`}
    >
      <Play className="h-3 w-3 fill-current" />
      {timestamp}
    </button>
  );
};

export const FlashcardsTab = ({ lecture, videoUrl, onQuizCard }: FlashcardsTabProps) => {
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const total = lecture.flashcards.length;
  const videoId = videoUrl ? extractVideoId(videoUrl) : null;

  if (total === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No flashcards available.</p>;
  }

  const card = lecture.flashcards[i % total];

  const go = (delta: number) => {
    setFlipped(false);
    setI((prev) => (prev + delta + total) % total);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Card {i + 1} of {total}</span>
          {card.timestamp && <TimestampBadge videoId={videoId} timestamp={card.timestamp} />}
        </div>
        <div className="flex items-center gap-2">
          {onQuizCard && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onQuizCard(card)}
              className="h-7 gap-1 text-xs"
            >
              <Sparkles className="h-3 w-3" />
              Quiz me on this
            </Button>
          )}
          <BloomBadge level={card.bloom} />
        </div>
      </div>

      <button
        onClick={() => setFlipped((f) => !f)}
        className="group relative w-full min-h-[280px] rounded-2xl border border-border bg-card p-8 shadow-card transition-all hover:border-primary/40 hover:shadow-glow text-left"
      >
        <div className="absolute top-4 right-4 text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <RotateCw className="h-3 w-3" />
          {flipped ? "Answer" : "Question"}
        </div>
        {card.timestamp && (
          <div className="absolute top-4 left-4">
            <TimestampBadge videoId={videoId} timestamp={card.timestamp} />
          </div>
        )}
        <div className="flex h-full min-h-[220px] items-center justify-center">
          <p className="text-xl leading-relaxed text-center text-foreground">
            {flipped ? card.answer : card.question}
          </p>
        </div>
      </button>

      <div className="flex items-center justify-center gap-3">
        <Button variant="secondary" size="icon" onClick={() => go(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="secondary" onClick={() => setFlipped((f) => !f)}>
          Flip card
        </Button>
        <Button variant="secondary" size="icon" onClick={() => go(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
