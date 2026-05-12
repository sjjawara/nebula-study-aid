import { bloomColor, type BloomLevel } from "@/lib/mockData";
import { cn } from "@/lib/utils";
import { InfoTooltip, bloomLevelDescriptions } from "@/components/InfoTooltip";

const bloomDots: Record<BloomLevel, number> = {
  Remember: 1,
  Understand: 2,
  Apply: 3,
  Analyze: 4,
  Evaluate: 5,
  Create: 6,
};

interface BloomBadgeProps {
  level: BloomLevel;
  className?: string;
  /** Show an inline ℹ️ tooltip with this Bloom level's description. Default: true */
  withInfo?: boolean;
}

export const BloomBadge = ({ level, className, withInfo = true }: BloomBadgeProps) => (
  <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", bloomColor[level], className)}>
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: bloomDots[level] }).map((_, i) => (
        <span key={i} className="h-1.5 w-1.5 rounded-full bg-current" />
      ))}
    </span>
    {level}
    {withInfo && (
      <InfoTooltip
        label={`About the ${level} level`}
        content={
          <span>
            <span className="font-semibold">{level}.</span>{" "}
            {bloomLevelDescriptions[level]}
          </span>
        }
        iconClassName="h-3 w-3"
        className="-mr-0.5 opacity-70 hover:opacity-100"
      />
    )}
  </span>
);
