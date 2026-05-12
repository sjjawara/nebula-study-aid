import { bloomColor, type BloomLevel } from "@/lib/mockData";
import { cn } from "@/lib/utils";
import { InfoTooltip, bloomLevelDescriptions } from "@/components/InfoTooltip";
import { useT } from "@/lib/i18n";

const bloomDots: Record<BloomLevel, number> = {
  Remember: 1,
  Understand: 2,
  Apply: 3,
  Analyze: 4,
  Evaluate: 5,
  Create: 6,
};

const bloomDotColor: Record<BloomLevel, string> = {
  Remember: "bg-bloom-remember",
  Understand: "bg-bloom-understand",
  Apply: "bg-bloom-apply",
  Analyze: "bg-bloom-analyze",
  Evaluate: "bg-bloom-evaluate",
  Create: "bg-bloom-create",
};

const bloomTextColor: Record<BloomLevel, string> = {
  Remember: "text-bloom-remember",
  Understand: "text-bloom-understand",
  Apply: "text-bloom-apply",
  Analyze: "text-bloom-analyze",
  Evaluate: "text-bloom-evaluate",
  Create: "text-bloom-create",
};

interface BloomBadgeProps {
  level: BloomLevel;
  className?: string;
  /** Show an inline ℹ️ tooltip with this Bloom level's description. Default: true */
  withInfo?: boolean;
  /** "filled" = colored pill (default). "dots" = minimal colored dots + label only. */
  variant?: "filled" | "dots";
  /** Position of dots relative to label (dots variant only). Default: "before" */
  dotsPosition?: "before" | "after";
}

export const BloomBadge = ({ level, className, withInfo = true, variant = "dots", dotsPosition = "before" }: BloomBadgeProps) => {
  const { t } = useT();
  const label = t(level);
  if (variant === "dots") {
    const c = `hsl(var(--bloom-${level.toLowerCase()}))`;
    const cAlpha = (a: number) => `hsl(var(--bloom-${level.toLowerCase()}) / ${a})`;
    const dots = (
      <span className="inline-flex items-center gap-0.5">
        {Array.from({ length: bloomDots[level] }).map((_, i) => (
          <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c }} />
        ))}
      </span>
    );
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
          className,
        )}
        style={{
          backgroundColor: cAlpha(0.15),
          borderColor: cAlpha(0.6),
          color: c,
        }}
      >
        {dotsPosition === "before" && dots}
        {label}
        {dotsPosition === "after" && dots}
        {withInfo && (
          <InfoTooltip
            label={`About the ${level} level`}
            content={
              <span>
                <span className="font-semibold">{label}.</span>{" "}
                {bloomLevelDescriptions[level]}
              </span>
            }
            iconClassName="h-3 w-3"
            className="-mr-0.5 opacity-70 hover:opacity-100"
          />
        )}
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", bloomColor[level], className)}>
      <span className="inline-flex items-center gap-0.5">
        {Array.from({ length: bloomDots[level] }).map((_, i) => (
          <span key={i} className="h-1.5 w-1.5 rounded-full bg-current" />
        ))}
      </span>
      {label}
      {withInfo && (
        <InfoTooltip
          label={`About the ${level} level`}
          content={
            <span>
              <span className="font-semibold">{label}.</span>{" "}
              {bloomLevelDescriptions[level]}
            </span>
          }
          iconClassName="h-3 w-3"
          className="-mr-0.5 opacity-70 hover:opacity-100"
        />
      )}
    </span>
  );
};
