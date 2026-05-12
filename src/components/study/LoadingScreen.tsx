import { useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Loader2, Sparkles, Lightbulb } from "lucide-react";
import type { BloomLevel } from "@/lib/mockData";
import { cn } from "@/lib/utils";

const stages = [
  "Extracting transcript and mapping lecture structure...",
  "Classifying content with Bloom's Taxonomy...",
  "Building your personalized study environment...",
];

const tips: { title: string; body: string }[] = [
  { title: "The Big Picture", body: "Bloom's Revised Taxonomy is a framework that classifies thinking into six levels, from basic recall to complex creation. Not all learning is equal — memorizing a formula is fundamentally different from knowing when to use it. NebulaLearn uses this framework to map every moment of your lecture to the type of thinking it requires." },
  { title: "Bloom's Revised Taxonomy Level 1: Remember", body: "Remember is the foundation — recalling facts, definitions, and terminology. In a biology class, this is knowing that mitosis produces two identical daughter cells. In linear algebra, it's recalling that a matrix is invertible if its determinant is non-zero. This is where studying usually starts, but it's only the beginning." },
  { title: "Bloom's Revised Taxonomy Level 2: Understand", body: "Understand means explaining concepts in your own words. In chemistry, it's not just knowing that ionic bonds form — it's explaining why sodium gives up an electron to chlorine. In economics, it's describing why supply curves slope upward. You understand something when you can teach it simply." },
  { title: "Bloom's Revised Taxonomy Level 3: Apply", body: "Apply means using knowledge to solve a new problem. In calculus, you're not just remembering the chain rule — you're using it to differentiate a composite function you've never seen before. In computer science, it's implementing a sorting algorithm from its description. Application is where understanding becomes skill." },
  { title: "Bloom's Revised Taxonomy Level 4: Analyze", body: "Analyze means breaking something down to examine its structure and relationships. In literature, it's identifying how an author's word choice creates tension. In physics, it's comparing Newton's laws across different reference frames. In a proof-based math course, it's examining why each step follows logically from the last." },
  { title: "Bloom's Revised Taxonomy Level 5: Evaluate", body: "Evaluate means making informed judgments. In statistics, it's critiquing whether a study's methodology supports its conclusions. In engineering, it's defending why one design approach is safer than another given specific constraints. Evaluation requires you to apply criteria — not just know them, but use them to judge." },
  { title: "Bloom's Revised Taxonomy Level 6: Create", body: "Create is the highest level — producing something original by synthesizing what you know. In architecture, it's designing a structure that meets competing constraints. In mathematics, it's constructing a novel proof. In a capstone course, it's building a system from scratch. Creation is the goal of deep learning." },
  { title: "Why It Matters for You", body: "Most students study all lecture content the same way. But a lecture on ionic bonding has Remember-level moments (what is an ionic bond), Understand-level moments (why does it form), and Analyze-level moments (how does it compare to covalent bonding). NebulaLearn identifies each one so you can study smarter — not longer." },
  { title: "Cognitive Load", body: "Cognitive Load Theory, developed by John Sweller, explains why some content feels harder to process than others. High cognitive load moments — dense terminology, abstract concepts, multiple simultaneous ideas — require more mental effort. NebulaLearn flags these moments in your outline so you know exactly where to slow down." },
  { title: "How NebulaLearn Uses This", body: "Your lecture is being processed by three AI agents right now. Agent 1 extracts and structures the transcript. Agent 2 classifies every segment using Bloom's Taxonomy and Cognitive Load Theory. Agent 3 builds your personalized study environment — flashcards calibrated to the right cognitive level, summaries at three depths, and a quiz system that matches how your brain actually learns." },
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
  const [restartKey, setRestartKey] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setTipIdx((i) => (i + 1) % tips.length);
        setFade(true);
      }, 350);
    }, 10000);
    return () => clearInterval(id);
  }, [restartKey]);

  const goToTip = (next: number) => {
    const target = ((next % tips.length) + tips.length) % tips.length;
    setFade(false);
    setTimeout(() => {
      setTipIdx(target);
      setFade(true);
    }, 200);
    setRestartKey((k) => k + 1);
  };

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
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary">
                <Lightbulb className="h-3.5 w-3.5" />
                Did you know?
              </div>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {tipIdx + 1} / {tips.length}
              </span>
            </div>
            <div
              key={tipIdx}
              className={cn(
                "transition-opacity duration-300 space-y-2",
                fade ? "opacity-100" : "opacity-0",
              )}
            >
              <h4 className="text-sm font-semibold tracking-tight text-foreground">
                {tips[tipIdx].title}
              </h4>
              <p className="text-sm leading-relaxed text-foreground/85">
                {tips[tipIdx].body}
              </p>
            </div>
            <div className="mt-4 flex gap-1.5">
              {tips.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-all duration-300",
                    i === tipIdx ? "bg-primary" : "bg-primary/15",
                  )}
                />
              ))}
            </div>
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
