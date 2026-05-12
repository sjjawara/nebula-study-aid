import { useMemo, useState } from "react";
import type { Lecture } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Sparkles, CheckCircle2 } from "lucide-react";
import { InfoTooltip, tooltipCopy } from "@/components/InfoTooltip";

const depths = [
  { id: "short", label: "90 seconds" },
  { id: "medium", label: "5 minutes" },
  { id: "full", label: "Full summary" },
] as const;

export const SummariesTab = ({ lecture }: { lecture: Lecture }) => {
  const [depth, setDepth] = useState<typeof depths[number]["id"]>("short");

  const takeaways = useMemo(() => {
    const highOrder = lecture.outline.filter(
      (o) => o.bloom === "Analyze" || o.bloom === "Evaluate"
    );
    // Fallback up the hierarchy if there aren't enough Analyze/Evaluate items
    const pool = highOrder.length >= 5
      ? highOrder
      : [
          ...highOrder,
          ...lecture.outline.filter((o) => o.bloom === "Apply" || o.bloom === "Create"),
          ...lecture.outline.filter((o) => o.bloom === "Understand"),
        ];

    const seen = new Set<string>();
    const items: { topic: string; timestamp: string; bloom: string }[] = [];
    for (const o of pool) {
      const key = o.topic.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      items.push({ topic: o.topic, timestamp: o.timestamp, bloom: o.bloom });
      if (items.length >= 7) break;
    }
    return items.slice(0, Math.max(5, Math.min(7, items.length)));
  }, [lecture.outline]);

  const renderTakeaway = (topic: string) => {
    const trimmed = topic.trim().replace(/[.!?]+$/, "");
    return /^(why|how|what|when|where|who)\b/i.test(trimmed)
      ? `${trimmed}?`
      : `${trimmed}.`;
  };

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
                  {renderTakeaway(t.topic)}
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
