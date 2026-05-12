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
    "Bloom's Revised Taxonomy (Anderson & Krathwohl, 2001) classifies thinking into 6 levels from basic recall (Remember) to complex creation (Create). Higher levels require deeper understanding.",
  bloomTaxonomyProfile:
    "Bloom's Revised Taxonomy (Anderson & Krathwohl, 2001) is a hierarchical framework classifying cognitive learning into six levels: Remember, Understand, Apply, Analyze, Evaluate, and Create. Originally developed by Benjamin Bloom in 1956 and updated in 2001, it is widely used by educators to design curricula and assessments that develop higher-order thinking skills.",
  bloomTaxonomyQuiz:
    "Bloom's Revised Taxonomy (Anderson & Krathwohl, 2001) classifies thinking into six cognitive levels from basic recall to complex creation. NebulaLearn calibrates every quiz question to the Bloom's level of the source content — so you're always being tested at the right cognitive depth.",
  feedbackMode:
    "Immediate feedback accelerates learning by correcting misconceptions before they solidify — research shows it improves retention by up to 25% compared to delayed feedback (Hattie & Timperley, 2007). End of Quiz mode reduces interruptions and simulates exam conditions, helping students build focus and self-assessment skills.",
  topDown:
    "Productive Failure is a learning design developed by Dr. Manu Kapur (ETH Zürich). His research found that students who attempt complex problems before receiving instruction outperform those taught conventionally — developing deeper conceptual understanding and better transfer skills. Source: Kapur, M. (2016). Examining Productive Failure, Constructive Failure, and Instructive Failure. Educational Psychologist, 51(2).",
  bottomUp:
    "The Build Up approach is grounded in scaffolding theory (Vygotsky, 1978) and mastery learning research (Bloom, 1968). Students build foundational knowledge before advancing to complex tasks, staying within their Zone of Proximal Development. Research shows scaffolded learning improves both confidence and long-term retention, particularly for students encountering unfamiliar material. Source: Wood, Bruner & Ross (1976). The role of tutoring in problem solving. Journal of Child Psychology and Psychiatry, 17(2).",
  cognitiveLoad:
    "Cognitive Load Theory (Sweller): High load sections require more mental effort. Slow down and review these moments.",
  keyTakeaways:
    "Derived from the highest Bloom's level chunks in this lecture — the concepts that require the most sophisticated thinking.",
  masteryMode:
    "Mastery Mode is based on Benjamin Bloom's Learning for Mastery model (1968), which found that 95% of students can achieve high levels of learning when given adequate time and appropriate instruction. Combined with spaced repetition principles (Ebbinghaus, 1885), the adaptive difficulty in Mastery Mode ensures concepts are reinforced at increasing cognitive depth — mirroring how long-term memory consolidation actually works.",
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
