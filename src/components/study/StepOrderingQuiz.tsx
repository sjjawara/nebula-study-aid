import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  GripVertical,
  Lightbulb,
  RotateCcw,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import type { Flashcard, BloomLevel } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { BloomBadge } from "@/components/BloomBadge";
import { cn } from "@/lib/utils";

interface Props {
  cards: Flashcard[];
  onExit: () => void;
}

interface StepItem {
  id: string;
  text: string;
  /** Index in the original (correct) order. */
  originalIndex: number;
}

const shuffle = <T,>(arr: T[]): T[] => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const buildItems = (steps: string[]): StepItem[] =>
  steps.map((text, i) => ({ id: `s-${i}`, text, originalIndex: i }));

/** If card.bloom is below Apply, escalate; step ordering targets Apply/Analyze. */
const skillFor = (card: Flashcard): BloomLevel => {
  const order: BloomLevel[] = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"];
  const min = order.indexOf("Apply");
  return order[Math.max(min, order.indexOf(card.bloom))];
};

export const StepOrderingQuiz = ({ cards, onExit }: Props) => {
  const [idx, setIdx] = useState(0);
  const card = cards[idx];

  // Shuffled working order, re-seeded whenever the card changes.
  const initialShuffled = useMemo(() => {
    if (!card?.steps?.length) return [] as StepItem[];
    const correct = buildItems(card.steps);
    if (correct.length < 2) return correct;
    let attempt = shuffle(correct);
    // Avoid (very rare) accidentally-correct shuffle.
    let safety = 0;
    while (
      attempt.every((item, i) => item.originalIndex === i) &&
      safety++ < 5
    ) {
      attempt = shuffle(correct);
    }
    return attempt;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card]);

  const [order, setOrder] = useState<StepItem[]>(initialShuffled);
  const [submitted, setSubmitted] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  // Re-sync when card changes.
  if (order.length === 0 && initialShuffled.length > 0 && !submitted) {
    setOrder(initialShuffled);
  }

  if (!card || !card.steps || card.steps.length < 2) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center space-y-3">
        <p className="text-sm text-muted-foreground">
          No step-sequence flashcards available. Add one in the Flashcards tab to use Step Ordering mode.
        </p>
        <Button variant="ghost" onClick={onExit}>Back</Button>
      </div>
    );
  }

  const move = (from: number, to: number) => {
    if (submitted) return;
    if (to < 0 || to >= order.length || from === to) return;
    const next = order.slice();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setOrder(next);
  };

  const onDragStart = (id: string) => (e: React.DragEvent<HTMLLIElement>) => {
    if (submitted) return;
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", id); } catch { /* ignore */ }
  };
  const onDragOver = (overId: string) => (e: React.DragEvent<HTMLLIElement>) => {
    if (submitted || !dragId || dragId === overId) return;
    e.preventDefault();
    const from = order.findIndex((s) => s.id === dragId);
    const to = order.findIndex((s) => s.id === overId);
    if (from < 0 || to < 0 || from === to) return;
    const next = order.slice();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setOrder(next);
  };
  const onDragEnd = () => setDragId(null);

  const reset = () => {
    setOrder(initialShuffled);
    setSubmitted(false);
  };

  const submit = () => setSubmitted(true);

  const next = () => {
    setSubmitted(false);
    setOrder([]); // triggers re-sync next render
    setIdx((i) => i + 1);
  };

  const isMulti = !!card.multiPath;
  const correctMask = order.map((item, i) => item.originalIndex === i);
  const allCorrect = correctMask.every(Boolean);
  const correctCount = correctMask.filter(Boolean).length;
  const passed = isMulti ? true : allCorrect;
  const skill = skillFor(card);
  const correctOrder = card.steps;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-card/60 p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-primary inline-flex items-center gap-1.5">
              <Target className="h-3 w-3" />
              Step Ordering · Card {idx + 1} of {cards.length}
            </p>
            <h3 className="text-lg font-semibold text-foreground">{card.question}</h3>
            <p className="text-xs text-muted-foreground">
              Drag the steps into the correct order, then submit.
              {isMulti && " Multiple valid orderings are accepted."}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <BloomBadge level={skill} />
            <Button variant="ghost" size="sm" onClick={onExit}>
              <X className="h-4 w-4" />
              Exit
            </Button>
          </div>
        </div>
      </div>

      {/* Step list */}
      <ol className="space-y-2">
        {order.map((item, i) => {
          const correctHere = item.originalIndex === i;
          const showRed = submitted && !isMulti && !correctHere;
          const showGreen = submitted && (isMulti || correctHere);
          return (
            <li
              key={item.id}
              draggable={!submitted}
              onDragStart={onDragStart(item.id)}
              onDragOver={onDragOver(item.id)}
              onDragEnd={onDragEnd}
              onDrop={(e) => e.preventDefault()}
              className={cn(
                "flex items-center gap-3 rounded-xl border bg-card px-3 py-3 shadow-sm transition-colors",
                !submitted && "cursor-grab active:cursor-grabbing hover:border-primary/40",
                dragId === item.id && "opacity-60",
                showRed && "border-destructive/60 bg-destructive/5",
                showGreen && "border-emerald-500/50 bg-emerald-500/5",
                !submitted && "border-border",
              )}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                {i + 1}
              </span>
              {!submitted && <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />}
              <p className="flex-1 text-sm text-foreground">{item.text}</p>
              {submitted ? (
                showGreen ? (
                  <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <X className="h-4 w-4 text-destructive shrink-0" />
                )
              ) : (
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => move(i, i - 1)}
                    disabled={i === 0}
                    aria-label="Move up"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => move(i, i + 1)}
                    disabled={i === order.length - 1}
                    aria-label="Move down"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {/* Actions */}
      {!submitted ? (
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={reset}>
            <RotateCcw className="h-4 w-4" />
            Reshuffle
          </Button>
          <Button onClick={submit} className="bg-gradient-primary">
            <Check className="h-4 w-4" />
            Submit order
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Verdict */}
          <div
            className={cn(
              "rounded-2xl border p-4",
              passed
                ? "border-emerald-500/40 bg-emerald-500/5"
                : "border-destructive/40 bg-destructive/5",
            )}
          >
            <p className="text-sm font-semibold text-foreground">
              {isMulti
                ? "Your approach is valid. Here's another way to think about it:"
                : allCorrect
                ? "Perfect — every step is in the right place."
                : `${correctCount} of ${order.length} steps were in the correct position.`}
            </p>
            {isMulti && (
              <p className="mt-1 text-xs text-muted-foreground">
                This problem has multiple correct orderings. Compare your sequence with the canonical one below.
              </p>
            )}
          </div>

          {/* Reference order with explanations */}
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {isMulti ? "Alternative sequence" : "Correct sequence"}
            </p>
            <ol className="space-y-2">
              {correctOrder.map((step, i) => (
                <li key={i} className="flex items-start gap-3 rounded-lg border border-border bg-background px-3 py-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {i + 1}
                  </span>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm text-foreground">{step}</p>
                    {card.stepExplanations?.[i] && (
                      <p className="text-xs text-muted-foreground inline-flex items-start gap-1">
                        <Lightbulb className="h-3 w-3 mt-0.5 shrink-0 text-amber-500" />
                        {card.stepExplanations[i]}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Skill banner */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" />
              Cognitive skill developed
            </p>
            <div className="mt-2 flex items-center gap-2">
              <BloomBadge level={skill} />
              <p className="text-sm text-foreground/90">
                {skill === "Analyze"
                  ? "Sequencing trains analytical thinking — breaking a procedure into ordered components and reasoning about dependencies."
                  : "Putting steps in the right order trains application — using a procedure correctly in context."}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <Button variant="ghost" onClick={reset}>
              <RotateCcw className="h-4 w-4" />
              Try again
            </Button>
            {idx < cards.length - 1 ? (
              <Button onClick={next} className="bg-gradient-primary">
                Next problem
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={onExit} className="bg-gradient-primary">
                Finish
                <Check className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StepOrderingQuiz;
