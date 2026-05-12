import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { BloomLevel } from "@/lib/mockData";

export const bloomLevelDescriptions: Record<BloomLevel, string> = {
  Remember:
    "Recall facts, terms, and basic concepts from memory. The foundation of all higher-order thinking.",
  Understand:
    "Explain ideas in your own words and grasp meaning. Demonstrates comprehension beyond memorization.",
  Apply:
    "Use what you've learned in new situations. Transfer knowledge to solve concrete problems.",
  Analyze:
    "Break down information and examine relationships between ideas. Find patterns, causes, and structure.",
  Evaluate:
    "Judge, critique, and defend positions using evidence. Weigh trade-offs and assess validity.",
  Create:
    "Generate original work by combining ideas in new ways. The most demanding cognitive level.",
};

export const tooltipCopy = {
  bloomTaxonomy:
    "Bloom's Revised Taxonomy classifies thinking into 6 levels from basic recall (Remember) to complex creation (Create). Higher levels require deeper understanding.",
  topDown:
    "Based on Manu Kapur's research: struggling with hard questions before easier ones leads to better long-term retention than starting easy.",
  bottomUp:
    "Builds foundational knowledge first, earning your way to higher-order thinking. Best for unfamiliar topics.",
  cognitiveLoad:
    "Cognitive Load Theory (Sweller): High load sections require more mental effort. Slow down and review these moments.",
  keyTakeaways:
    "Derived from the highest Bloom's level chunks in this lecture — the concepts that require the most sophisticated thinking.",
  masteryMode:
    "Adaptive practice that climbs and descends Bloom's levels based on your accuracy and streak.",
};

interface InfoTooltipProps {
  content: React.ReactNode;
  label?: string;
  className?: string;
  iconClassName?: string;
  side?: "top" | "right" | "bottom" | "left";
}

/**
 * Small ℹ️ icon that reveals a short tooltip on hover and a popover on click/tap.
 * Keep content to ≤ 2 sentences.
 */
export const InfoTooltip = ({
  content,
  label = "More information",
  className,
  iconClassName,
  side = "top",
}: InfoTooltipProps) => {
  return (
    <Popover>
      <Tooltip>
        <PopoverTrigger asChild>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={label}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                className,
              )}
            >
              <Info className={cn("h-3.5 w-3.5", iconClassName)} />
            </button>
          </TooltipTrigger>
        </PopoverTrigger>
        <TooltipContent side={side} className="max-w-xs text-xs leading-relaxed">
          {content}
        </TooltipContent>
      </Tooltip>
      <PopoverContent side={side} className="max-w-xs text-xs leading-relaxed">
        {content}
      </PopoverContent>
    </Popover>
  );
};
