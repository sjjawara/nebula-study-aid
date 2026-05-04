import { useState } from "react";
import type { Lecture } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const depths = [
  { id: "short", label: "90 seconds" },
  { id: "medium", label: "5 minutes" },
  { id: "full", label: "Full summary" },
] as const;

export const SummariesTab = ({ lecture }: { lecture: Lecture }) => {
  const [depth, setDepth] = useState<typeof depths[number]["id"]>("short");
  return (
    <div className="space-y-6">
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
