import { useEffect, useMemo, useState } from "react";
import type { Lecture, BloomLevel } from "@/lib/mockData";
import { bloomColor } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Sparkles, CheckCircle2, Compass, Lightbulb, ArrowRight } from "lucide-react";
import { InfoTooltip, tooltipCopy, bloomLevelDescriptions } from "@/components/InfoTooltip";
import { BloomBadge } from "@/components/BloomBadge";

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

const depths = [
  { id: "short", label: "90 seconds" },
  { id: "medium", label: "5 minutes" },
  { id: "full", label: "Full summary" },
] as const;

const BLOOM_ORDER: BloomLevel[] = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"];

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
  onNavigate,
}: {
  lecture: Lecture;
  onNavigate?: (tab: StudyTabId) => void;
}) => {
  const [depth, setDepth] = useState<typeof depths[number]["id"]>("short");
  const [selectedLevel, setSelectedLevel] = useState<BloomLevel | null>(null);

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

  const takeaways = useMemo(() => {
    // Prioritize the highest-order chunks: Analyze + Evaluate first.
    const highOrder = lecture.outline.filter(
      (o) => o.bloom === "Analyze" || o.bloom === "Evaluate",
    );
    const pool =
      highOrder.length >= 5
        ? highOrder
        : [
            ...highOrder,
            ...lecture.outline.filter((o) => o.bloom === "Apply" || o.bloom === "Create"),
            ...lecture.outline.filter((o) => o.bloom === "Understand"),
          ];

    // Helpers to find supporting context for each topic.
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
      "with",
      "from",
      "this",
      "that",
      "into",
      "your",
      "their",
      "they",
      "them",
      "what",
      "which",
      "where",
      "while",
      "about",
      "between",
      "using",
      "based",
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
      for (const m of lecture.searchIndex) {
        const txt = m.excerpt || "";
        const s = score(txt, m.timestamp);
        if (s > best.s) best = { text: txt, s };
      }
      for (const f of lecture.flashcards) {
        const txt = f.answer || "";
        const s = score(`${f.question} ${txt}`, f.timestamp);
        if (s > best.s) best = { text: txt, s };
      }
      return best.text ? firstSentence(best.text) : "";
    };

    const lowerTopic = (topic: string) => {
      const t = topic.trim().replace(/[.!?]+$/, "");
      // Keep acronyms / proper-noun-ish words capitalized.
      return /^[A-Z]{2,}/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1);
    };

    const frame = (
      topic: string,
      bloom: string,
      context: string,
    ): string => {
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
  }, [lecture.outline, lecture.searchIndex, lecture.flashcards]);

  return (
    <div className="space-y-6">
      {profile.total > 0 && (
        <section className="rounded-xl border border-border bg-card p-6 shadow-card space-y-5">
          <header className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">
              Lecture Profile
            </h3>
            <InfoTooltip content={tooltipCopy.bloomTaxonomyProfile} label="About Bloom's Taxonomy" />
          </header>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-muted-foreground">Dominant level:</span>
            <BloomBadge level={profile.dominant} />
            <span className="text-xs text-muted-foreground">
              {profile.pct[profile.dominant]}% of {profile.total} chunks
            </span>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Bloom's distribution
            </p>
            <div className="flex h-3 w-full overflow-hidden rounded-full border border-border bg-muted">
              {BLOOM_ORDER.map((lvl) => {
                if (!profile.pct[lvl]) return null;
                return (
                  <div
                    key={lvl}
                    title={`${lvl} · ${profile.pct[lvl]}%`}
                    className={cn("h-full", bloomColor[lvl].split(" ")[0])}
                    style={{ width: `${profile.pct[lvl]}%` }}
                  />
                );
              })}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {BLOOM_ORDER.map((lvl) =>
                profile.pct[lvl] > 0 ? (
                  <span key={lvl} className="inline-flex items-center gap-1.5">
                    <span className={cn("h-2 w-2 rounded-full", bloomColor[lvl].split(" ")[0])} />
                    {lvl} · {profile.pct[lvl]}%
                  </span>
                ) : null,
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-background/60 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
              How to study this lecture
            </p>
            <p className="text-sm leading-relaxed text-foreground/90">
              {profile.recommendation}
            </p>
          </div>

          <div>
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
              <Lightbulb className="h-3.5 w-3.5 text-primary" />
              Suggested NebulaLearn tools
            </p>
            <ul className="space-y-1.5">
              {profile.tools.map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {takeaways.length > 0 && (
        <section className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 to-transparent p-6 shadow-card">
          <header className="mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">
              Key Takeaways
            </h3>
            <InfoTooltip content={tooltipCopy.keyTakeaways} label="About Key Takeaways" />
          </header>
          <ul className="space-y-2.5">
            {takeaways.map((t, i) => (
              <li key={`${t.timestamp}-${i}`} className="flex gap-3 items-start">
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <p className="text-sm leading-relaxed text-foreground/90">
                  {t.sentence}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        {depths.map((d) => (
          <Button
            key={d.id}
            variant={depth === d.id ? "default" : "secondary"}
            onClick={() => setDepth(d.id)}
            className={cn(depth === d.id && "bg-gradient-primary")}
          >
            {d.label}
          </Button>
        ))}
      </div>
      <article className="rounded-xl border border-border bg-card p-6 shadow-card">
        <p className="text-base leading-relaxed text-foreground/90 whitespace-pre-line">
          {lecture.summaries[depth] || "No summary available."}
        </p>
      </article>
    </div>
  );
};
