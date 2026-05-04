import { bloomColor, type BloomLevel } from "@/lib/mockData";
import { cn } from "@/lib/utils";

export const BloomBadge = ({ level, className }: { level: BloomLevel; className?: string }) => (
  <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", bloomColor[level], className)}>
    {level}
  </span>
);
