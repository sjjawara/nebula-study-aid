import { useMemo, useState } from "react";
import type { Lecture, BloomLevel } from "@/lib/mockData";
import { bloomColor } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Sparkles, CheckCircle2, Compass, Lightbulb } from "lucide-react";
import { InfoTooltip, tooltipCopy } from "@/components/InfoTooltip";
import { BloomBadge } from "@/components/BloomBadge";

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

export const SummariesTab = ({ lecture }: { lecture: Lecture }) => {
  const [depth, setDepth] = useState<typeof depths[number]["id"]>("short");

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
