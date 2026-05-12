import { useEffect, useMemo, useState } from "react";
import type { Lecture, BloomLevel } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Sparkles, CheckCircle2, Compass, Lightbulb, ArrowRight } from "lucide-react";
import { InfoTooltip, tooltipCopy, bloomLevelDescriptions } from "@/components/InfoTooltip";
import { BloomBadge } from "@/components/BloomBadge";
import { useT, translateStrings } from "@/lib/i18n";

type StudyTabId = "outline" | "summaries" | "flashcards" | "search" | "quiz" | "mindmap";

const LEVEL_TIPS: Record<BloomLevel, string> = {
  Remember:
    "Use the Flashcards tab to drill definitions. Focus on the 90-second summary first to anchor the vocabulary.",
  Understand:
    "Read the full summary section for these topics, then try explaining each one out loud in your own words.",
  Apply:
    "Use the Bottom Up quiz mode for these topics and work through the worked examples in the outline.",
  Analyze:
    "Use the Mind Map to draw connections between these concepts, then try the Top Down quiz mode.",
  Evaluate:
    "Use Mastery Mode and push through to the open-ended justification questions for these topics.",
  Create:
    "These are the highest-order concepts in the lecture. After quizzing, try adding your own nodes to the Mind Map.",
};

const LEVEL_TOOLS: Record<BloomLevel, { label: string; tab: StudyTabId }[]> = {
  Remember: [
    { label: "Open Flashcards", tab: "flashcards" },
    { label: "Read 90-sec summary", tab: "summaries" },
  ],
  Understand: [
    { label: "Read full summary", tab: "summaries" },
    { label: "Browse Outline", tab: "outline" },
  ],
  Apply: [
    { label: "Start Bottom Up quiz", tab: "quiz" },
    { label: "Jump to Outline examples", tab: "outline" },
  ],
  Analyze: [
    { label: "Open Mind Map", tab: "mindmap" },
    { label: "Try Top Down quiz", tab: "quiz" },
  ],
  Evaluate: [
    { label: "Start Mastery Mode", tab: "quiz" },
    { label: "Search lecture moments", tab: "search" },
  ],
  Create: [
    { label: "Open Mind Map", tab: "mindmap" },
    { label: "Start Mastery Mode", tab: "quiz" },
  ],
};

// (Summary depth is now exposed as anchored sections instead of a toggle.)

const BLOOM_ORDER: BloomLevel[] = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"];

// Full-saturation Bloom backgrounds (no opacity dimming)
const BLOOM_SOLID_BG: Record<BloomLevel, string> = {
  Remember: "bg-bloom-remember",
  Understand: "bg-bloom-understand",
  Apply: "bg-bloom-apply",
  Analyze: "bg-bloom-analyze",
  Evaluate: "bg-bloom-evaluate",
  Create: "bg-bloom-create",
};

const BLOOM_GERUND: Record<BloomLevel, string> = {
  Remember: "Remembering",
  Understand: "Understanding",
  Apply: "Applying",
  Analyze: "Analyzing",
  Evaluate: "Evaluating",
  Create: "Creating",
};

const profileFor = (
  dominant: BloomLevel,
  pct: Record<BloomLevel, number>,
): { recommendation: string; tools: string[] } => {
  const lower = pct.Remember + pct.Understand;
  const higher = pct.Analyze + pct.Evaluate + pct.Create;
  if (lower >= 55) {
    return {
      recommendation:
        "This lecture is concept- and definition-heavy. Start by locking in the vocabulary and core facts, then build up to applying them. Repetition matters more than synthesis here.",
      tools: [
        "Start with the 90-second summary to map the terrain",
        "Drill the Flashcards tab for spaced recall",
        "Run Bottom Up quiz mode to climb from Remember to Apply",
      ],
    };
  }
  if (higher >= 45) {
    return {
      recommendation:
        "This lecture lives in higher-order territory — judgment, analysis, and trade-offs. Don't try to memorize first; wrestle with the reasoning early so the structure sticks.",
      tools: [
        "Open the Mind Map to see how concepts connect",
        "Use Top Down quiz mode to start from Evaluate and scaffold down",
        "Read the Full summary to get the argumentative throughline",
      ],
    };
  }
  if (dominant === "Apply") {
    return {
      recommendation:
        "This lecture is procedure- and worked-example heavy. You'll learn fastest by doing, not just reading — get into practice problems quickly and review feedback closely.",
      tools: [
        "Skim the 5-minute summary for the procedure",
        "Run Mastery Mode quiz — it adapts difficulty as you go",
        "Use the Outline tab to jump to the worked-example moments",
      ],
    };
  }
  return {
    recommendation:
      "This lecture mixes recall and reasoning fairly evenly. A balanced approach works best — get the core ideas in place, then stress-test them with mixed-difficulty practice.",
    tools: [
      "Read the 5-minute summary first",
      "Use Mastery Mode quiz for an adaptive mix across Bloom's levels",
      "Revisit Flashcards for any concepts you missed",
    ],
  };
};

export const SummariesTab = ({
  lecture,
  englishLecture,
  onNavigate,
}: {
  lecture: Lecture;
  /**
   * Untranslated lecture used to construct Key Takeaway sentences.
   * Sentences are built in English, then sent in full to /translate so
   * we never combine translated topics with English templates.
   */
  englishLecture?: Lecture;
  onNavigate?: (tab: StudyTabId) => void;
}) => {
  const { language, t } = useT();
  const [selectedLevel, setSelectedLevel] = useState<BloomLevel | null>(null);
  const [translatedTakeaways, setTranslatedTakeaways] = useState<string[] | null>(null);

  const profile = useMemo(() => {
    const counts: Record<BloomLevel, number> = {
      Remember: 0, Understand: 0, Apply: 0, Analyze: 0, Evaluate: 0, Create: 0,
    };
    for (const o of lecture.outline) counts[o.bloom] = (counts[o.bloom] ?? 0) + 1;
    const total = lecture.outline.length || 1;
    const pct: Record<BloomLevel, number> = {
      Remember: 0, Understand: 0, Apply: 0, Analyze: 0, Evaluate: 0, Create: 0,
    };
    (Object.keys(counts) as BloomLevel[]).forEach((k) => {
      pct[k] = Math.round((counts[k] / total) * 100);
    });
    const dominant = (Object.entries(counts) as [BloomLevel, number][])
      .sort((a, b) => b[1] - a[1])[0][0];
    const { recommendation, tools } = profileFor(dominant, pct);
    return { counts, pct, dominant, total, recommendation, tools };
  }, [lecture.outline]);

  useEffect(() => {
    setSelectedLevel((prev) => prev ?? profile.dominant);
  }, [profile.dominant]);

  const activeLevel: BloomLevel = selectedLevel ?? profile.dominant;
  const topicsForLevel = useMemo(
    () => lecture.outline.filter((o) => o.bloom === activeLevel),
    [lecture.outline, activeLevel],
  );

  // Build takeaway sentences from the *English* lecture so we never combine
  // translated topic fragments with English templates. The full sentence array
  // is later sent to /translate as a single batch (see effect below).
  const takeaways = useMemo(() => {
    const source = englishLecture ?? lecture;
    // Prioritize the highest-order chunks: Analyze + Evaluate first.
    const highOrder = source.outline.filter(
      (o) => o.bloom === "Analyze" || o.bloom === "Evaluate",
    );
    const pool =
      highOrder.length >= 5
        ? highOrder
        : [
            ...highOrder,
            ...source.outline.filter((o) => o.bloom === "Apply" || o.bloom === "Create"),
            ...source.outline.filter((o) => o.bloom === "Understand"),
          ];

    const tsToSeconds = (ts?: string) => {
      if (!ts) return null;
      const parts = ts.split(":").map((p) => parseInt(p, 10));
      if (parts.some((n) => Number.isNaN(n))) return null;
      return parts.reduce((acc, n) => acc * 60 + n, 0);
    };

    const tokenize = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3);

    const stopish = new Set([
      "with", "from", "this", "that", "into", "your", "their", "they", "them",
      "what", "which", "where", "while", "about", "between", "using", "based",
    ]);

    const firstSentence = (text: string) => {
      const cleaned = text.trim().replace(/\s+/g, " ");
      const m = cleaned.match(/^(.{20,200}?[.!?])(\s|$)/);
      return (m ? m[1] : cleaned).trim().replace(/[.!?]+$/, "");
    };

    const findContext = (topic: string, timestamp: string): string => {
      const topicSeconds = tsToSeconds(timestamp);
      const topicTokens = tokenize(topic).filter((t) => !stopish.has(t));

      const score = (text: string, ts?: string) => {
        if (!text) return -1;
        const tokens = new Set(tokenize(text));
        const overlap = topicTokens.reduce((n, t) => n + (tokens.has(t) ? 1 : 0), 0);
        const candidateSeconds = tsToSeconds(ts);
        const proximity =
          topicSeconds !== null && candidateSeconds !== null
            ? Math.max(0, 1 - Math.abs(topicSeconds - candidateSeconds) / 600)
            : 0;
        return overlap * 2 + proximity;
      };

      let best = { text: "", s: -1 };
      for (const m of source.searchIndex) {
        const txt = m.excerpt || "";
        const s = score(txt, m.timestamp);
        if (s > best.s) best = { text: txt, s };
      }
      for (const f of source.flashcards) {
        const txt = f.answer || "";
        const s = score(`${f.question} ${txt}`, f.timestamp);
        if (s > best.s) best = { text: txt, s };
      }
      return best.text ? firstSentence(best.text) : "";
    };

    const lowerTopic = (topic: string) => {
      const t = topic.trim().replace(/[.!?]+$/, "");
      return /^[A-Z]{2,}/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1);
    };

    const frame = (topic: string, bloom: string, context: string): string => {
      const t = lowerTopic(topic);
      const ctx = context ? ` — ${context}.` : ".";
      if (bloom === "Evaluate") {
        return `Be ready to defend why ${t} matters and when it changes the right answer${ctx}`;
      }
      if (bloom === "Analyze") {
        return `Be ready to explain how the parts of ${t} fit together and why that structure matters${ctx}`;
      }
      if (bloom === "Apply" || bloom === "Create") {
        return `Be ready to walk someone through using ${t} on a new problem and justify each move${ctx}`;
      }
      return `Be ready to explain ${t} in your own words and say why it matters${ctx}`;
    };

    const seen = new Set<string>();
    const items: { sentence: string; timestamp: string; bloom: string }[] = [];
    for (const o of pool) {
      const key = o.topic.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const ctx = findContext(o.topic, o.timestamp);
      items.push({
        sentence: frame(o.topic, o.bloom, ctx),
        timestamp: o.timestamp,
        bloom: o.bloom,
      });
      if (items.length >= 7) break;
    }
    return items;
  }, [englishLecture, lecture]);

  // Whenever the language or takeaway set changes, send the full English
  // sentences to /translate as one batch and store the translated sentences
  // for direct rendering (no template reconstruction).
  useEffect(() => {
    let cancelled = false;
    if (language === "English" || takeaways.length === 0) {
      setTranslatedTakeaways(null);
      return;
    }
    translateStrings(language, takeaways.map((t) => t.sentence))
      .then((arr) => {
        if (!cancelled) setTranslatedTakeaways(arr);
      })
      .catch((err) => {
        console.error("[SummariesTab] takeaway translation failed", err);
        if (!cancelled) setTranslatedTakeaways(null);
      });
    return () => {
      cancelled = true;
    };
  }, [language, takeaways]);

  const [section, setSection] = useState<SectionId>("profile");
  const [summaryDepth, setSummaryDepth] = useState<SummaryDepth>("short");

  const sections: { id: SectionId; label: string; show: boolean }[] = [
    { id: "profile", label: t("Lecture Profile"), show: profile.total > 0 },
    { id: "takeaways", label: t("Key Takeaways"), show: takeaways.length > 0 },
    { id: "summary", label: t("Summary"), show: true },
    { id: "notes", label: t("Full Notes"), show: !!lecture.summaries.full?.trim() },
  ];
  const visibleSections = sections.filter((s) => s.show);
  const activeSection = visibleSections.some((s) => s.id === section)
    ? section
    : visibleSections[0]?.id ?? "summary";

  return (
    <div className="space-y-6">
      <SectionTabs
        sections={visibleSections}
        active={activeSection}
        onChange={(id) => setSection(id)}
      />

      {activeSection === "profile" && profile.total > 0 && (
        <section className="rounded-xl border border-border bg-card p-6 shadow-card space-y-5">
          <header className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">
              {t("Lecture Profile")}
            </h3>
            <InfoTooltip content={tooltipCopy.bloomTaxonomyProfile} label="About Bloom's Taxonomy" />
          </header>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-muted-foreground">{t("Dominant level:")}</span>
            <BloomBadge level={profile.dominant} />
            <span className="text-xs text-muted-foreground">
              {profile.pct[profile.dominant]}% of {profile.total} segments
            </span>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("Bloom's distribution")}{" "}
              <span className="ml-1 normal-case tracking-normal text-muted-foreground/70">
                {t("— click a segment for tailored study tips")}
              </span>
            </p>
            <div className="flex h-4 w-full overflow-hidden rounded-full border border-border bg-muted">
              {BLOOM_ORDER.map((lvl) => {
                if (!profile.pct[lvl]) return null;
                const isActive = activeLevel === lvl;
                return (
                  <button
                    type="button"
                    key={lvl}
                    onClick={() => setSelectedLevel(lvl)}
                    title={`${lvl} · ${profile.pct[lvl]}%`}
                    aria-label={`${lvl}: ${profile.pct[lvl]}% — show study tips`}
                    aria-pressed={isActive}
                    className={cn(
                      "h-full transition-all hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      BLOOM_SOLID_BG[lvl],
                      isActive && "ring-2 ring-foreground/40 ring-inset",
                    )}
                    style={{ width: `${profile.pct[lvl]}%` }}
                  />
                );
              })}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {BLOOM_ORDER.map((lvl) =>
                profile.pct[lvl] > 0 ? (
                  <button
                    type="button"
                    key={lvl}
                    onClick={() => setSelectedLevel(lvl)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded px-1 py-0.5 transition-colors hover:text-foreground",
                      activeLevel === lvl && "text-foreground font-medium",
                    )}
                  >
                    <span className={cn("h-2 w-2 rounded-full", BLOOM_SOLID_BG[lvl])} />
                    {t(lvl)} · {profile.pct[lvl]}%
                  </button>
                ) : null,
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-background/60 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <BloomBadge level={activeLevel} />
              <span className="text-xs text-muted-foreground">
                {profile.pct[activeLevel]}% of this lecture · {profile.counts[activeLevel]} chunk
                {profile.counts[activeLevel] === 1 ? "" : "s"}
              </span>
            </div>
            <p className="text-xs italic text-muted-foreground">
              {t(bloomLevelDescriptions[activeLevel])}
            </p>

            {topicsForLevel.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
                  {t("Topics at this level")}
                </p>
                <ul className="space-y-1">
                  {topicsForLevel.map((o, i) => (
                    <li
                      key={`${o.timestamp}-${i}`}
                      className="flex items-start gap-2 text-sm text-foreground/90"
                    >
                      <span className="mt-0.5 font-mono text-xs text-muted-foreground tabular-nums">
                        {o.timestamp}
                      </span>
                      <span>{o.topic}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
                <Lightbulb className="h-3.5 w-3.5 text-primary" />
                {t("Study Tips for")} {t(BLOOM_GERUND[activeLevel])}
              </p>
              <p className="text-sm leading-relaxed text-foreground/90">
                {t(LEVEL_TIPS[activeLevel])}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
                {t("Recommended Tools for This Level")}
              </p>
              <div className="flex flex-wrap gap-2">
                {LEVEL_TOOLS[activeLevel].map((tool) => (
                  <Button
                    key={tool.label}
                    size="sm"
                    variant="secondary"
                    onClick={() => onNavigate?.(tool.tab)}
                    disabled={!onNavigate}
                  >
                    {t(tool.label)}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-background/60 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
              {t("How to study this lecture")}
            </p>
            <p className="text-sm leading-relaxed text-foreground/90">
              {t(profile.recommendation)}
            </p>
          </div>

          <div>
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
              <Lightbulb className="h-3.5 w-3.5 text-primary" />
              {t("Suggested Tools for This Lecture")}
            </p>
            <ul className="space-y-1.5">
              {profile.tools.map((tool, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{t(tool)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {activeSection === "takeaways" && takeaways.length > 0 && (
        <section className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 to-transparent p-6 shadow-card">
          <header className="mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">
              {t("Key Takeaways")}
            </h3>
            <InfoTooltip content={tooltipCopy.keyTakeaways} label="About Key Takeaways" />
          </header>
          <ul className="space-y-2.5">
            {takeaways.map((tk, i) => (
              <li key={`${tk.timestamp}-${i}`} className="flex gap-3 items-start">
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <p className="text-sm leading-relaxed text-foreground/90">
                  {translatedTakeaways?.[i] ?? tk.sentence}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {activeSection === "summary" && (
        <section className="rounded-xl border border-border bg-card p-6 shadow-card space-y-4">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">
              Summary
            </h3>
            <DepthToggle depth={summaryDepth} onChange={setSummaryDepth} />
          </header>
          {summaryDepth === "short" && (
            <SummaryBody body={lecture.summaries.short} format="paragraphs" />
          )}
          {summaryDepth === "medium" && (
            <SummaryBody body={lecture.summaries.medium} format="chunked" />
          )}
          {summaryDepth === "full" && (
            <SummaryBody body={lecture.summaries.full} format="paragraphs" />
          )}
        </section>
      )}

      {activeSection === "notes" && (
        <section className="rounded-xl border border-border bg-card p-6 shadow-card space-y-4">
          <header className="flex items-center gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">
              Full Notes
            </h3>
            <span className="text-xs text-muted-foreground">
              Section-by-section breakdown of the lecture.
            </span>
          </header>
          <SummaryBody body={lecture.summaries.full} format="headers" />
        </section>
      )}
    </div>
  );
};


// --------- subcomponents & helpers below ---------

type SectionId = "profile" | "takeaways" | "summary" | "notes";
type SummaryDepth = "short" | "medium" | "full";

const SectionTabs = ({
  sections,
  active,
  onChange,
}: {
  sections: { id: SectionId; label: string }[];
  active: SectionId;
  onChange: (id: SectionId) => void;
}) => (
  <div
    role="tablist"
    aria-label="Analysis sections"
    className="grid w-full bg-card border border-border h-12 p-1 rounded-md"
    style={{ gridTemplateColumns: `repeat(${sections.length}, minmax(0, 1fr))` }}
  >
    {sections.map((s) => {
      const isActive = s.id === active;
      return (
        <button
          key={s.id}
          role="tab"
          aria-selected={isActive}
          onClick={() => onChange(s.id)}
          className={cn(
            "rounded-sm text-sm font-medium transition-all",
            isActive
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {s.label}
        </button>
      );
    })}
  </div>
);

const DEPTH_OPTIONS: { id: SummaryDepth; label: string }[] = [
  { id: "short", label: "90 Seconds" },
  { id: "medium", label: "5 Minutes" },
  { id: "full", label: "Full" },
];

const DepthToggle = ({
  depth,
  onChange,
}: {
  depth: SummaryDepth;
  onChange: (d: SummaryDepth) => void;
}) => (
  <div
    role="tablist"
    aria-label="Summary length"
    className="inline-flex rounded-lg border border-border bg-background p-1 text-xs"
  >
    {DEPTH_OPTIONS.map((d) => {
      const isActive = depth === d.id;
      return (
        <button
          key={d.id}
          role="tab"
          aria-selected={isActive}
          onClick={() => onChange(d.id)}
          className={cn(
            "rounded-md px-3 py-1.5 font-medium transition-colors",
            isActive
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {d.label}
        </button>
      );
    })}
  </div>
);


// --------- subcomponents & helpers below ---------

// Split a string into sentences (rough but good-enough for prose summaries).
const splitSentences = (text: string): string[] => {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  // Match ending punctuation followed by space + capital, or end.
  const parts = cleaned.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) ?? [cleaned];
  return parts.map((s) => s.trim()).filter(Boolean);
};

// Group sentences into paragraphs of N (3-4) sentences each.
const groupIntoParagraphs = (text: string, perParagraph = 4): string[] => {
  // Honor double-newline paragraph breaks if present.
  const explicit = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (explicit.length > 1) {
    return explicit.flatMap((para) => {
      const sentences = splitSentences(para);
      const grouped: string[] = [];
      for (let i = 0; i < sentences.length; i += perParagraph) {
        grouped.push(sentences.slice(i, i + perParagraph).join(" "));
      }
      return grouped.length ? grouped : [para];
    });
  }
  const sentences = splitSentences(text);
  const grouped: string[] = [];
  for (let i = 0; i < sentences.length; i += perParagraph) {
    grouped.push(sentences.slice(i, i + perParagraph).join(" "));
  }
  return grouped.length ? grouped : [text];
};

// Detect lines that look like a section header.
const looksLikeHeader = (line: string): boolean => {
  const t = line.trim();
  if (!t) return false;
  if (t.length > 90) return false;
  if (/^#{1,6}\s+/.test(t)) return true; // markdown
  if (/^\*\*[^*]+\*\*:?$/.test(t)) return true; // **Bold:**
  if (/^[A-Z0-9][A-Z0-9 ,&/\-]{3,}$/.test(t) && !/[.!?]$/.test(t)) return true; // ALL CAPS
  if (/^\d+[.)]\s+\S/.test(t) && t.length < 80 && !/[.!?]$/.test(t)) return true; // 1. Header
  if (/^[A-Z][^.!?]{3,80}:$/.test(t)) return true; // Trailing colon
  return false;
};

const stripHeaderMarkers = (line: string): string =>
  line
    .replace(/^#{1,6}\s+/, "")
    .replace(/^\*\*([^*]+)\*\*:?$/, "$1")
    .replace(/:$/, "")
    .trim();

interface BlockNode {
  type: "header" | "paragraph";
  text: string;
}

const formatWithHeaders = (text: string): BlockNode[] => {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const blocks: BlockNode[] = [];
  let buffer: string[] = [];
  const flush = () => {
    if (!buffer.length) return;
    const para = buffer.join(" ");
    for (const chunk of groupIntoParagraphs(para, 4)) {
      blocks.push({ type: "paragraph", text: chunk });
    }
    buffer = [];
  };
  for (const line of lines) {
    if (looksLikeHeader(line)) {
      flush();
      blocks.push({ type: "header", text: stripHeaderMarkers(line) });
    } else {
      buffer.push(line);
    }
  }
  flush();
  // If we found no headers, fall back to chunked paragraphs.
  if (!blocks.some((b) => b.type === "header")) {
    return groupIntoParagraphs(text, 4).map((p) => ({ type: "paragraph", text: p }));
  }
  return blocks;
};

const SummaryBody = ({
  body,
  format,
}: {
  body: string;
  format: "paragraphs" | "chunked" | "headers";
}) => {
  const trimmed = (body ?? "").trim();
  if (!trimmed) {
    return <p className="text-sm text-muted-foreground">No summary available.</p>;
  }
  if (format === "paragraphs") {
    return (
      <div className="space-y-3 text-base leading-relaxed text-foreground/90 whitespace-pre-line">
        {trimmed.split(/\n\s*\n/).map((p, i) => (
          <p key={i}>{p.trim()}</p>
        ))}
      </div>
    );
  }
  if (format === "chunked") {
    return (
      <div className="space-y-4 text-base leading-relaxed text-foreground/90">
        {groupIntoParagraphs(trimmed, 4).map((p, i, arr) => (
          <div key={i}>
            <p>{p}</p>
            {i < arr.length - 1 && (
              <div className="mt-4 h-px w-16 bg-border/70" aria-hidden />
            )}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-3 text-base leading-relaxed text-foreground/90">
      {formatWithHeaders(trimmed).map((b, i) =>
        b.type === "header" ? (
          <h4
            key={i}
            className="mt-5 text-base font-semibold tracking-tight text-foreground first:mt-0"
          >
            {b.text}
          </h4>
        ) : (
          <p key={i}>{b.text}</p>
        ),
      )}
    </div>
  );
};
