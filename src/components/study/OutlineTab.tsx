import type { Lecture } from "@/lib/mockData";
import { BloomBadge } from "@/components/BloomBadge";
import { CognitiveLoad } from "@/components/CognitiveLoad";

export const OutlineTab = ({ lecture }: { lecture: Lecture }) => (
  <div className="space-y-2">
    {lecture.outline.map((item, idx) => (
      <div
        key={`${item.timestamp}-${idx}`}
        className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-card transition-colors hover:border-primary/40"
      >
        <span className="font-mono text-sm text-muted-foreground tabular-nums w-14">{item.timestamp}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{item.topic}</p>
        </div>
        <BloomBadge level={item.bloom} />
        <CognitiveLoad value={item.load} />
      </div>
    ))}
  </div>
);
