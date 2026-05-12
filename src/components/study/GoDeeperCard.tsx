import { Compass } from "lucide-react";
import { useT } from "@/lib/i18n";

/**
 * Shown at the end of any quiz that reached Evaluate (the highest level a quiz
 * can meaningfully assess). Nudges learners toward Create-level activities that
 * a quiz format cannot evaluate.
 */
export const GoDeeperCard = () => {
  const { t } = useT();
  return (
    <div className="animate-fade-in rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Compass className="h-5 w-5" />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wider text-primary">
            {t("Go Deeper")}
          </p>
          <h4 className="text-base font-semibold text-foreground">
            {t("You've reached the highest level this quiz can take you.")}
          </h4>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t(
              "Create-level thinking — designing, building, formulating something original — requires more than a quiz. Try applying these concepts in a project, a problem set, or by teaching someone else.",
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default GoDeeperCard;
