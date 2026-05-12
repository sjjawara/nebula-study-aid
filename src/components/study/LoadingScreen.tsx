import { useEffect, useState } from "react";
import { Check, Loader2, Sparkles, Lightbulb } from "lucide-react";
import type { BloomLevel } from "@/lib/mockData";
import { cn } from "@/lib/utils";

const stages = [
  "Extracting transcript and mapping lecture structure...",
  "Classifying content with Bloom's Taxonomy...",
  "Building your personalized study environment...",
];

const tips = [
  "Bloom's Revised Taxonomy was updated in 2001 by Anderson & Krathwohl to emphasize active learning over passive recall.",
  "Research shows that students who engage with material at the Analyze level retain 40% more than those who only summarize.",
  "Productive Failure, developed by Dr. Manu Kapur, shows that struggling with hard problems before instruction leads to deeper long-term understanding.",
  "Cognitive Load Theory suggests that breaking complex material into smaller chunks reduces mental effort and improves comprehension.",
  "Students who use spaced repetition — reviewing material at increasing intervals — retain information up to 80% longer than cramming.",
  "Active recall, the practice of testing yourself rather than re-reading, is one of the most effective study techniques supported by cognitive science.",
];

// Pyramid bottom→top (foundational → most complex)
const pyramid: { level: BloomLevel; widthPct: number; colorVar: string }[] = [
  { level: "Remember", widthPct: 100, colorVar: "var(--bloom-remember)" },
  { level: "Understand", widthPct: 86, colorVar: "var(--bloom-understand)" },
  { level: "Apply", widthPct: 72, colorVar: "var(--bloom-apply)" },
  { level: "Analyze", widthPct: 58, colorVar: "var(--bloom-analyze)" },
  { level: "Evaluate", widthPct: 44, colorVar: "var(--bloom-evaluate)" },
  { level: "Create", widthPct: 30, colorVar: "var(--bloom-create)" },
];

interface Props {
  stepIndex: number; // 0..2
  elapsed: number;
}

export const LoadingScreen = ({ stepIndex, elapsed }: Props) => {
  const [tipIdx, setTipIdx] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const id = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setTipIdx((i) => (i + 1) % tips.length);
        setFade(true);
      }, 350);
    }, 9000);
    return () => clearInterval(id);
  }, []);

  // Pyramid lights up progressively while Agent 2 (stepIndex === 1) runs,
  // then stays fully lit afterwards.
  const [pyramidLit, setPyramidLit] = useState(0);
  useEffect(() => {
    if (stepIndex < 1) {
      setPyramidLit(0);
      return;
    }
    if (stepIndex >= 2) {
      setPyramidLit(pyramid.length);
      return;
    }
    setPyramidLit(0);
    let n = 0;
    const id = setInterval(() => {
      n = Math.min(pyramid.length, n + 1);
      setPyramidLit(n);
      if (n >= pyramid.length) clearInterval(id);
    }, 1100);
    return () => clearInterval(id);
  }, [stepIndex]);

  return (
    <section className="py-12 md:py-16">
      <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-[minmax(0,1fr)_280px] md:gap-12">
        {/* Left column: stages, tip, ETA */}
        <div className="flex flex-col items-start gap-8">
          <div className="flex items-center gap-4">
            <div className="relative h-14 w-14">
              <div className="absolute inset-0 rounded-full bg-gradient-primary opacity-30 animate-ping" />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-primary shadow-glow">
                <Sparkles className="h-6 w-6 text-primary-foreground animate-pulse" />
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-primary font-medium">
                Processing lecture
              </p>
              <h2 className="text-2xl font-semibold tracking-tight">
                Crafting your study environment
              </h2>
            </div>
          </div>

          <ol className="w-full space-y-3">
            {stages.map((label, i) => {
              const state = i < stepIndex ? "done" : i === stepIndex ? "active" : "pending";
              return (
                <li
                  key={label}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border px-4 py-3 transition-all",
                    state === "active" && "border-primary/40 bg-card shadow-glow",
                    state === "done" && "border-border bg-card/60",
                    state === "pending" && "border-border/40 bg-transparent opacity-50",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                      state === "active" && "border-primary/50 bg-primary/10 text-primary",
                      state === "done" && "border-bloom-apply/50 bg-bloom-apply/15 text-bloom-apply",
                      state === "pending" && "border-border text-muted-foreground",
                    )}
                  >
                    {state === "done" ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : state === "active" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span
                    className={cn(
                      "text-sm leading-6",
                      state === "active" && "text-foreground",
                      state === "done" && "text-muted-foreground",
                      state === "pending" && "text-muted-foreground",
                    )}
                  >
                    {label}
                  </span>
                </li>
              );
            })}
          </ol>

          <p className="text-xs text-muted-foreground">
            This usually takes 60 – 90 seconds · {elapsed}s elapsed
          </p>

          {/* Did you know */}
          <div className="w-full rounded-2xl border border-primary/20 bg-card/80 p-5 shadow-card">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary">
              <Lightbulb className="h-3.5 w-3.5" />
              Did you know?
            </div>
            <p
              key={tipIdx}
              className={cn(
                "text-sm leading-relaxed text-foreground/90 transition-opacity duration-300",
                fade ? "opacity-100" : "opacity-0",
              )}
            >
              {tips[tipIdx]}
            </p>
          </div>
        </div>

        {/* Right column: Bloom's pyramid */}
        <aside className="hidden md:flex flex-col items-center gap-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Bloom's Taxonomy
          </p>
          <div className="flex w-full flex-col items-center gap-1.5">
            {[...pyramid].reverse().map((row, idx) => {
              // reversed: top of pyramid first (Create)
              const originalIdx = pyramid.length - 1 - idx;
              const lit = originalIdx < pyramidLit;
              return (
                <div
                  key={row.level}
                  className={cn(
                    "flex items-center justify-center rounded-md py-2 text-[11px] font-medium transition-all duration-500",
                    lit ? "opacity-100 shadow-glow" : "opacity-25",
                  )}
                  style={{
                    width: `${row.widthPct}%`,
                    background: lit ? `hsl(${row.colorVar})` : `hsl(${row.colorVar} / 0.25)`,
                    color: lit
                      ? row.level === "Create"
                        ? "white"
                        : "hsl(222 47% 11%)"
                      : "hsl(var(--muted-foreground))",
                  }}
                >
                  {row.level}
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            {stepIndex < 1
              ? "Awaiting classification..."
              : stepIndex === 1
              ? "Mapping cognitive levels..."
              : "Cognitive profile ready"}
          </p>
        </aside>
      </div>
    </section>
  );
};

export default LoadingScreen;
