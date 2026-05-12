import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { Flashcard, Lecture, BloomLevel } from "@/lib/mockData";
import { Input } from "@/components/ui/input";
import { BloomBadge } from "@/components/BloomBadge";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

const FILTER_BLOOM_LEVELS: BloomLevel[] = [
  "Remember",
  "Understand",
  "Apply",
  "Analyze",
  "Evaluate",
];

export type LoadBucket = "Low" | "Medium" | "High";
const LOAD_BUCKETS: LoadBucket[] = ["Low", "Medium", "High"];

const loadToBucket = (load?: number): LoadBucket | null => {
  if (typeof load !== "number") return null;
  if (load <= 2) return "Low";
  if (load === 3) return "Medium";
  return "High";
};

/**
 * Build a lookup from flashcard timestamp → outline cognitive load + topic.
 * Flashcards don't carry these fields directly, but the outline does.
 */
const useOutlineLookup = (lecture: Lecture) =>
  useMemo(() => {
    const byTimestamp = new Map<string, { topic: string; load: number }>();
    for (const o of lecture.outline) {
      if (o.timestamp) byTimestamp.set(o.timestamp, { topic: o.topic, load: o.load });
    }
    return byTimestamp;
  }, [lecture.outline]);

export interface FlashcardFiltersState {
  query: string;
  bloomLevels: Set<BloomLevel>;
  loadBuckets: Set<LoadBucket>;
}

export const useFlashcardFilters = (lecture: Lecture) => {
  const [query, setQuery] = useState("");
  const [bloomLevels, setBloomLevels] = useState<Set<BloomLevel>>(new Set());
  const [loadBuckets, setLoadBuckets] = useState<Set<LoadBucket>>(new Set());
  const lookup = useOutlineLookup(lecture);

  const isActive =
    query.trim().length > 0 || bloomLevels.size > 0 || loadBuckets.size > 0;

  const matches = (card: Flashcard) => {
    if (bloomLevels.size > 0 && !bloomLevels.has(card.bloom)) return false;
    if (loadBuckets.size > 0) {
      const meta = card.timestamp ? lookup.get(card.timestamp) : undefined;
      const bucket = loadToBucket(meta?.load);
      if (!bucket || !loadBuckets.has(bucket)) return false;
    }
    const q = query.trim().toLowerCase();
    if (q) {
      const meta = card.timestamp ? lookup.get(card.timestamp) : undefined;
      const haystack = [card.question, card.answer, meta?.topic ?? ""]
        .join(" \u0001 ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  };

  const clear = () => {
    setQuery("");
    setBloomLevels(new Set());
    setLoadBuckets(new Set());
  };

  return {
    state: { query, bloomLevels, loadBuckets },
    setQuery,
    toggleBloom: (lvl: BloomLevel) =>
      setBloomLevels((prev) => {
        const next = new Set(prev);
        if (next.has(lvl)) next.delete(lvl);
        else next.add(lvl);
        return next;
      }),
    toggleLoad: (bucket: LoadBucket) =>
      setLoadBuckets((prev) => {
        const next = new Set(prev);
        if (next.has(bucket)) next.delete(bucket);
        else next.add(bucket);
        return next;
      }),
    clear,
    isActive,
    matches,
  };
};

interface FlashcardFiltersProps {
  filters: ReturnType<typeof useFlashcardFilters>;
  visibleCount: number;
  totalCount: number;
  className?: string;
}

export const FlashcardFilters = ({
  filters,
  visibleCount,
  totalCount,
  className,
}: FlashcardFiltersProps) => {
  const { t } = useT();
  const { state, setQuery, toggleBloom, toggleLoad, clear, isActive } = filters;
  return (
    <div className={cn("space-y-2.5 rounded-xl border border-border bg-card/40 p-3", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={state.query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("Search flashcards...")}
          className="h-8 pl-8 pr-8 text-sm"
        />
        {state.query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={t("Clear search")}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {t("Level")}
        </span>
        {FILTER_BLOOM_LEVELS.map((lvl) => {
          const active = state.bloomLevels.has(lvl);
          return (
            <button
              key={lvl}
              type="button"
              onClick={() => toggleBloom(lvl)}
              className={cn(
                "rounded-full border px-2 py-0.5 transition-colors",
                active
                  ? "border-primary/50 bg-primary/10"
                  : "border-border bg-background hover:border-primary/30",
              )}
            >
              <BloomBadge
                level={lvl}
                withInfo={false}
                dotsPosition="after"
                className={cn("border-0 px-1 py-0", !active && "grayscale opacity-70")}
              />
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {t("Load")}
        </span>
        {LOAD_BUCKETS.map((bucket) => {
          const active = state.loadBuckets.has(bucket);
          return (
            <button
              key={bucket}
              type="button"
              onClick={() => toggleLoad(bucket)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                active
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:border-primary/30",
              )}
            >
              {t(bucket)}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 pt-0.5">
        <p className="text-[11px] text-muted-foreground">
          {t("Showing {x} of {y} flashcards")
            .replace("{x}", String(visibleCount))
            .replace("{y}", String(totalCount))}
        </p>
        {isActive && (
          <button
            type="button"
            onClick={clear}
            className="text-[11px] text-primary hover:underline"
          >
            {t("Clear filters")}
          </button>
        )}
      </div>
    </div>
  );
};

export default FlashcardFilters;
