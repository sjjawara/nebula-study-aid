import { useMemo, useState } from "react";
import type { Lecture, Flashcard, BloomLevel, SearchMoment } from "@/lib/mockData";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BloomBadge } from "@/components/BloomBadge";
import { Search, Sparkles, Plus, Check, ExternalLink, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface SearchTabProps {
  lecture: Lecture;
  videoUrl?: string;
  onSaveFlashcard?: (card: Flashcard) => void;
}

const timestampToSeconds = (ts: string): number => {
  const parts = ts.split(":").map((p) => parseInt(p, 10) || 0);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
};

const buildYoutubeLink = (videoUrl: string | undefined, ts: string): string | null => {
  if (!videoUrl) return null;
  const seconds = timestampToSeconds(ts);
  try {
    const u = new URL(videoUrl);
    u.searchParams.set("t", `${seconds}s`);
    return u.toString();
  } catch {
    const sep = videoUrl.includes("?") ? "&" : "?";
    return `${videoUrl}${sep}t=${seconds}s`;
  }
};

const generateFlashcard = (
  moment: SearchMoment,
  outline: Lecture["outline"]
): Flashcard => {
  const topic = moment.topic ?? "this moment";
  const keywords = moment.keywords ?? [];
  const matched = outline.find(
    (o) => o.timestamp === moment.timestamp || (moment.topic && o.topic === moment.topic)
  );
  const bloom: BloomLevel = matched?.bloom ?? "Understand";

  const verbByBloom: Record<BloomLevel, string> = {
    Remember: `What are the key facts about "${topic}"?`,
    Understand: `Explain "${topic}" in your own words.`,
    Apply: `How would you apply the concept of "${topic}" in practice?`,
    Analyze: `Analyze the relationship between "${topic}" and ${keywords.slice(0, 2).join(", ") || "related concepts"}.`,
    Evaluate: `Evaluate the significance of "${topic}".`,
    Create: `Design an example that demonstrates "${topic}".`,
  };

  let question = verbByBloom[bloom];
  if (keywords.length > 0 && bloom !== "Analyze") {
    question += ` Consider: ${keywords.slice(0, 3).join(", ")}.`;
  }

  return {
    question,
    answer: moment.excerpt || `See lecture at ${moment.timestamp}.`,
    bloom,
    timestamp: moment.timestamp,
  };
};

export const SearchTab = ({ lecture, videoUrl, onSaveFlashcard }: SearchTabProps) => {
  const [q, setQ] = useState("");
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());

  const results = useMemo(() => {
    if (!q.trim()) return lecture.searchIndex;
    const needle = q.toLowerCase();
    return lecture.searchIndex.filter((m) =>
      [m.excerpt, m.topic, ...(m.keywords ?? [])]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(needle))
    );
  }, [q, lecture.searchIndex]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask a question or search lecture content..."
          className="pl-10 h-12 bg-card"
        />
      </div>
      <div className="space-y-2">
        {results.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No matching moments found.</p>
        )}
        {results.map((m, idx) => {
          const isOpen = openIdx === idx;
          const card = isOpen ? generateFlashcard(m, lecture.outline) : null;
          const link = buildYoutubeLink(videoUrl, m.timestamp);
          const savedKey = `${m.timestamp}|${m.topic ?? ""}`;
          const isSaved = savedKeys.has(savedKey);

          return (
            <div key={idx} className="space-y-2">
              <button
                type="button"
                onClick={() => setOpenIdx(isOpen ? null : idx)}
                className={`w-full text-left flex gap-4 rounded-xl border bg-card p-4 shadow-card transition-colors ${
                  isOpen ? "border-primary/60" : "border-border hover:border-primary/40"
                }`}
              >
                <span className="font-mono text-sm text-primary tabular-nums shrink-0">{m.timestamp}</span>
                <div className="space-y-1 flex-1">
                  {m.topic && <p className="text-sm font-medium text-foreground">{m.topic}</p>}
                  <p className="text-sm text-foreground/80 leading-relaxed">{m.excerpt}</p>
                  {m.keywords && m.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {m.keywords.map((k) => (
                        <span key={k} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{k}</span>
                      ))}
                    </div>
                  )}
                </div>
                <Sparkles className={`h-4 w-4 shrink-0 mt-0.5 transition-colors ${isOpen ? "text-primary" : "text-muted-foreground"}`} />
              </button>

              {isOpen && card && (
                <div className="ml-0 md:ml-8 rounded-xl border border-primary/40 bg-card/80 p-5 shadow-glow space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="text-xs uppercase tracking-wider text-primary font-medium">Generated flashcard</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <BloomBadge level={card.bloom} />
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpenIdx(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Question</p>
                      <p className="text-base text-foreground leading-relaxed">{card.question}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Answer</p>
                      <p className="text-sm text-foreground/90 leading-relaxed">{card.answer}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
                    {link ? (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-mono text-primary hover:underline"
                      >
                        {card.timestamp}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-sm font-mono text-primary">{card.timestamp}</span>
                    )}

                    <Button
                      size="sm"
                      disabled={isSaved || !onSaveFlashcard}
                      onClick={() => {
                        onSaveFlashcard?.(card);
                        setSavedKeys((s) => new Set(s).add(savedKey));
                        toast({
                          title: "Saved to Flashcards",
                          description: "You can review it from the Flashcards tab.",
                        });
                      }}
                      className={isSaved ? "" : "bg-gradient-primary hover:opacity-90"}
                      variant={isSaved ? "secondary" : "default"}
                    >
                      {isSaved ? (
                        <>
                          <Check className="h-4 w-4 mr-1.5" /> Saved
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-1.5" /> Save to Flashcards
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
