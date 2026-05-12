import { useEffect, useMemo, useState } from "react";
import type { Lecture, Flashcard, BloomLevel, SearchMoment } from "@/lib/mockData";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BloomBadge } from "@/components/BloomBadge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Search, Sparkles, Plus, Check, ExternalLink, X, Loader2, Zap, Play } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const SEMANTIC_URL = "https://nebulalearn-production.up.railway.app/semantic-search";

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

const buildYoutubeLink = (videoUrl: string | undefined, ts: string): string | null => {
  if (!videoUrl) return null;
  const seconds = timestampToSeconds(ts);
  const id = extractVideoId(videoUrl);
  if (id) return `https://www.youtube.com/watch?v=${id}&t=${seconds}s`;
  const sep = videoUrl.includes("?") ? "&" : "?";
  return `${videoUrl}${sep}t=${seconds}s`;
};

const openExternal = (url: string) => {
  window.open(url, "_blank", "noopener,noreferrer");
};

const tokenize = (s: string): string[] =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !["the", "and", "for", "with", "from", "this", "that"].includes(w));

const dedupeKeywords = (keywords: string[] | undefined, topic: string | undefined): string[] => {
  if (!keywords) return [];
  const topicTokens = new Set(tokenize(topic ?? ""));
  const seen = new Set<string>();
  const result: string[] = [];

  for (const k of keywords) {
    const norm = k.trim().toLowerCase();
    if (!norm || seen.has(norm)) continue;

    // Skip if keyword equals topic
    if (topic && norm === topic.trim().toLowerCase()) continue;

    // Skip if keyword tokens are mostly contained in the topic (>=70% overlap)
    const kTokens = tokenize(k);
    if (kTokens.length > 0 && topicTokens.size > 0) {
      const overlap = kTokens.filter((t) => topicTokens.has(t)).length;
      if (overlap / kTokens.length > 0.5) continue;
    }

    seen.add(norm);
    result.push(k);
  }
  return result;
};

const bloomFor = (
  moment: SearchMoment | null,
  outline: Lecture["outline"]
): BloomLevel => {
  if (!moment) return "Understand";
  const matched = outline.find(
    (o) => o.timestamp === moment.timestamp || (moment.topic && o.topic === moment.topic)
  );
  return matched?.bloom ?? "Understand";
};

const generateFlashcard = (
  moment: SearchMoment,
  outline: Lecture["outline"]
): Flashcard => {
  const topic = moment.topic ?? "this moment";
  const keywords = moment.keywords ?? [];
  const bloom = bloomFor(moment, outline);

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

const generateKeywordFlashcard = (
  keyword: string,
  moment: SearchMoment,
  outline: Lecture["outline"]
): Flashcard => {
  const topic = moment.topic ?? "the lecture";
  const bloom = bloomFor(moment, outline);

  const promptByBloom: Record<BloomLevel, string> = {
    Remember: `Define "${keyword}" as it appears in "${topic}".`,
    Understand: `Explain "${keyword}" in the context of "${topic}".`,
    Apply: `How is "${keyword}" applied within "${topic}"?`,
    Analyze: `Analyze the role of "${keyword}" within "${topic}".`,
    Evaluate: `Why is "${keyword}" important to "${topic}"?`,
    Create: `Construct an example that uses "${keyword}" to illustrate "${topic}".`,
  };

  return {
    question: promptByBloom[bloom],
    answer: moment.excerpt
      ? `In the context of "${topic}": ${moment.excerpt}`
      : `Refer to "${topic}" at ${moment.timestamp}.`,
    bloom,
    timestamp: moment.timestamp,
  };
};

type RankedMoment = SearchMoment & { score?: number };

export const SearchTab = ({ lecture, videoUrl, onSaveFlashcard }: SearchTabProps) => {
  const [q, setQ] = useState("");
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [modalCard, setModalCard] = useState<{ card: Flashcard; saveKey: string } | null>(null);
  const [aiResults, setAiResults] = useState<RankedMoment[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const videoId = videoUrl ? extractVideoId(videoUrl) : null;


  // Instant keyword fallback — also serves as the baseline before AI returns
  const keywordResults = useMemo<RankedMoment[]>(() => {
    if (!q.trim()) return lecture.searchIndex;
    const needle = q.toLowerCase();
    return lecture.searchIndex.filter((m) =>
      [m.excerpt, m.topic, ...(m.keywords ?? [])]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(needle))
    );
  }, [q, lecture.searchIndex]);

  // Reset / debounce semantic search
  useEffect(() => {
    if (!q.trim()) {
      setAiResults(null);
      setAiError(null);
      setAiLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setAiLoading(true);
    setAiError(null);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(SEMANTIC_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: q.trim(),
            search_index: lecture.searchIndex,
          }),
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const payload = await res.json();
        const raw = payload?.data ?? payload?.results ?? payload;
        const list = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.results)
          ? raw.results
          : [];

        // Map server results back to our SearchMoment shape with a score 0..1
        const mapped: RankedMoment[] = list
          .map((entry: { timestamp?: string; topic?: string; keywords?: string[]; excerpt?: string; summary?: string; score?: number; relevance?: number; confidence?: number }) => {
            const ts = entry.timestamp;
            const fromIndex = ts
              ? lecture.searchIndex.find((m) => m.timestamp === ts)
              : undefined;
            const base: SearchMoment =
              fromIndex ?? {
                timestamp: ts ?? "",
                excerpt: entry.excerpt ?? entry.summary ?? "",
                topic: entry.topic,
                keywords: entry.keywords,
              };
            const rawScore = entry.score ?? entry.relevance ?? entry.confidence;
            const score =
              typeof rawScore === "number"
                ? rawScore > 1
                  ? Math.min(1, rawScore / 100)
                  : Math.max(0, rawScore)
                : undefined;
            return { ...base, score };
          })
          .filter((m: RankedMoment) => m.timestamp || m.excerpt);
        setAiResults(mapped);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setAiError(err instanceof Error ? err.message : "Semantic search failed.");
        setAiResults(null);
      } finally {
        setAiLoading(false);
      }
    }, 350);
    return () => {
      ctrl.abort();
      clearTimeout(handle);
    };
  }, [q, lecture.searchIndex]);

  const results: RankedMoment[] =
    aiResults && aiResults.length > 0 ? aiResults : keywordResults;
  const usingAi = !!aiResults && aiResults.length > 0;

  const handleSave = (card: Flashcard, key: string) => {
    onSaveFlashcard?.(card);
    setSavedKeys((s) => new Set(s).add(key));
    toast({
      title: "Saved to Flashcards",
      description: "You can review it from the Flashcards tab.",
    });
  };

  const modalLink = modalCard ? buildYoutubeLink(videoUrl, modalCard.card.timestamp ?? "") : null;
  const modalSaved = modalCard ? savedKeys.has(modalCard.saveKey) : false;

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
        {aiLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />
        )}
      </div>

      {q.trim() && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            {usingAi ? (
              <>
                <Sparkles className="h-3 w-3 text-primary" />
                <span className="text-primary">AI semantic ranking</span>
              </>
            ) : aiLoading ? (
              <>
                <Zap className="h-3 w-3" />
                Showing instant matches while AI thinks…
              </>
            ) : aiError ? (
              <span className="text-destructive">AI search failed — showing keyword matches</span>
            ) : (
              <>
                <Zap className="h-3 w-3" />
                Keyword matches
              </>
            )}
          </span>
          <span>{results.length} result{results.length === 1 ? "" : "s"}</span>
        </div>
      )}

      <div className="space-y-2">
        {results.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No matching moments found.</p>
        )}
        {results.map((m, idx) => {
          const isOpen = openIdx === idx;
          const card = isOpen ? generateFlashcard(m, lecture.outline) : null;
          const link = buildYoutubeLink(videoUrl, m.timestamp);
          const savedKey = `moment|${m.timestamp}|${m.topic ?? ""}`;
          const isSaved = savedKeys.has(savedKey);
          const cleanKeywords = dedupeKeywords(m.keywords, m.topic);

          return (
            <div key={idx} className="space-y-2">
              <div
                className={`w-full text-left flex gap-4 rounded-xl border bg-card p-4 shadow-card transition-colors ${
                  isOpen ? "border-primary/60" : "border-border hover:border-primary/40"
                }`}
              >
                {videoId && m.timestamp ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const seconds = timestampToSeconds(m.timestamp);
                      window.open(
                        `https://www.youtube.com/watch?v=${videoId}&t=${seconds}s`,
                        "_blank",
                        "noopener,noreferrer",
                      );
                    }}
                    className="inline-flex items-center gap-1 self-start rounded-md bg-primary/10 px-2 py-1 font-mono text-xs text-primary tabular-nums hover:bg-primary/20 transition-colors shrink-0"
                    aria-label={`Open YouTube at ${m.timestamp}`}
                  >
                    <Play className="h-3 w-3 fill-current" />
                    {m.timestamp}
                  </button>
                ) : (
                  <span className="font-mono text-sm text-primary tabular-nums shrink-0">{m.timestamp}</span>
                )}
                <button
                  type="button"
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="flex gap-4 flex-1 text-left"
                >

                  <div className="space-y-1 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      {m.topic && <p className="text-sm font-medium text-foreground">{m.topic}</p>}
                      {typeof m.score === "number" && (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                            m.score >= 0.75
                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
                              : m.score >= 0.45
                              ? "border-primary/40 bg-primary/10 text-primary"
                              : "border-border bg-muted text-muted-foreground",
                          )}
                          title={`Relevance ${(m.score * 100).toFixed(0)}%`}
                        >
                          <span className="relative h-1 w-10 overflow-hidden rounded-full bg-foreground/10">
                            <span
                              className="absolute inset-y-0 left-0 rounded-full bg-current"
                              style={{ width: `${Math.round(m.score * 100)}%` }}
                            />
                          </span>
                          {Math.round(m.score * 100)}%
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-foreground/80 leading-relaxed">{m.excerpt}</p>
                  </div>
                  <Sparkles className={`h-4 w-4 shrink-0 mt-0.5 transition-colors ${isOpen ? "text-primary" : "text-muted-foreground"}`} />
                </button>
              </div>

              {cleanKeywords.length > 0 && (
                <div className="flex flex-wrap gap-1 pl-4">
                  {cleanKeywords.map((k) => {
                    const kKey = `kw|${m.timestamp}|${k.toLowerCase()}`;
                    const kSaved = savedKeys.has(kKey);
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const generated = generateKeywordFlashcard(k, m, lecture.outline);
                          setModalCard({ card: generated, saveKey: kKey });
                        }}
                        className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                          kSaved
                            ? "bg-primary/15 text-primary border-primary/30"
                            : "bg-muted text-muted-foreground border-transparent hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                        }`}
                      >
                        {k}
                      </button>
                    );
                  })}
                </div>
              )}

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
                      <button
                        type="button"
                        onClick={() => openExternal(link)}
                        className="inline-flex items-center gap-1.5 text-sm font-mono text-primary hover:underline"
                      >
                        {card.timestamp}
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    ) : (
                      <span className="text-sm font-mono text-primary">{card.timestamp}</span>
                    )}

                    <Button
                      size="sm"
                      disabled={isSaved || !onSaveFlashcard}
                      onClick={() => handleSave(card, savedKey)}
                      className={isSaved ? "" : "bg-gradient-primary hover:opacity-90"}
                      variant={isSaved ? "secondary" : "default"}
                    >
                      {isSaved ? (
                        <><Check className="h-4 w-4 mr-1.5" /> Saved</>
                      ) : (
                        <><Plus className="h-4 w-4 mr-1.5" /> Save to Flashcards</>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={!!modalCard} onOpenChange={(open) => !open && setModalCard(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Keyword flashcard
            </DialogTitle>
            <DialogDescription>
              Generated from a keyword in the lecture context.
            </DialogDescription>
          </DialogHeader>

          {modalCard && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <BloomBadge level={modalCard.card.bloom} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Question</p>
                <p className="text-base text-foreground leading-relaxed">{modalCard.card.question}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Answer</p>
                <p className="text-sm text-foreground/90 leading-relaxed">{modalCard.card.answer}</p>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border">
                {modalLink && modalCard.card.timestamp ? (
                  <button
                    type="button"
                    onClick={() => openExternal(modalLink)}
                    className="inline-flex items-center gap-1.5 text-sm font-mono text-primary hover:underline"
                  >
                    {modalCard.card.timestamp}
                    <ExternalLink className="h-3 w-3" />
                  </button>
                ) : (
                  <span className="text-sm font-mono text-primary">{modalCard.card.timestamp}</span>
                )}
                <Button
                  size="sm"
                  disabled={modalSaved || !onSaveFlashcard}
                  onClick={() => handleSave(modalCard.card, modalCard.saveKey)}
                  className={modalSaved ? "" : "bg-gradient-primary hover:opacity-90"}
                  variant={modalSaved ? "secondary" : "default"}
                >
                  {modalSaved ? (
                    <><Check className="h-4 w-4 mr-1.5" /> Saved</>
                  ) : (
                    <><Plus className="h-4 w-4 mr-1.5" /> Save to Flashcards</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
