import { bloomColor, type BloomLevel } from "@/lib/mockData";
import { cn } from "@/lib/utils";

const bloomDots: Record<BloomLevel, number> = {
  Remember: 1,
  Understand: 2,
  Apply: 3,
  Analyze: 4,
  Evaluate: 5,
  Create: 6,
};

export const BloomBadge = ({ level, className }: { level: BloomLevel; className?: string }) => (
  <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", bloomColor[level], className)}>
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: bloomDots[level] }).map((_, i) => (
        <span key={i} className="h-1.5 w-1.5 rounded-full bg-current" />
      ))}
    </span>
    {level}
  </span>
);
