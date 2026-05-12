import { useMemo, useState } from "react";
import { CheckCircle2, XCircle, ChevronRight, ScrollText, BookOpen, X, Sparkles } from "lucide-react";
import type { Flashcard, Lecture } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { BloomBadge } from "@/components/BloomBadge";
import { cn } from "@/lib/utils";
import { pickDistractors, shuffle } from "@/lib/quizUtils";

export type ProofQuestionType =
  | "justify_step"
  | "what_comes_next"
  | "find_flaw"
  | "proof_strategy";

interface ProofItem {
  type: ProofQuestionType;
  card: Flashcard;
  prompt: string;
  theorem: string;
  steps: string[];      // numbered proof body (for find_flaw, proof context)
  flawIndex?: number;   // for find_flaw
  options: string[];
  correct: string;
  explanation: string;
}

const typeLabel: Record<ProofQuestionType, string> = {
  justify_step: "Justify the step",
  what_comes_next: "What comes next?",
  find_flaw: "Find the flaw",
  proof_strategy: "Choose the strategy",
};

const STRATEGIES = [
  "Direct proof",
  "Proof by contradiction",
  "Proof by induction",
  "Proof by contrapositive",
  "Proof by cases",
  "Constructive proof",
];

const sentenceSplit = (s: string): string[] =>
  s.split(/(?<=[.!?])\s+/).map((t) => t.trim()).filter(Boolean);

/** Build a synthetic proof body from the card's answer (and steps when present). */
const buildProofSteps = (card: Flashcard): string[] => {
  if (card.steps && card.steps.length >= 2) return card.steps;
  const sents = sentenceSplit(card.answer);
  if (sents.length >= 2) return sents;
  // Fallback: split on commas / semicolons
  return card.answer
    .split(/[;,]\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
};

const pickStrategyOptions = (correct: string): string[] => {
  const others = shuffle(STRATEGIES.filter((s) => s !== correct)).slice(0, 3);
  return shuffle([correct, ...others]);
};

const buildItem = (
  lecture: Lecture,
  card: Flashcard,
  type: ProofQuestionType,
): ProofItem => {
  const steps = buildProofSteps(card);
  const theorem = card.question.replace(/[?.!]+$/, "").trim();

  if (type === "proof_strategy") {
    // Heuristic: pick a strategy based on theorem keywords.
    const t = theorem.toLowerCase();
    let correct = "Direct proof";
    if (/\b(not|no|impossible|cannot|irrational)\b/.test(t)) correct = "Proof by contradiction";
    else if (/\b(all natural|every n|for all n|sum|sequence|recursively)\b/.test(t))
      correct = "Proof by induction";
    else if (/\bif and only if|iff\b/.test(t)) correct = "Proof by cases";
    else if (/\bimplies|\bif\b/.test(t)) correct = "Proof by contrapositive";
    return {
      type,
      card,
      theorem,
      steps,
      prompt: "Which proof strategy is the strongest fit for this theorem?",
      options: pickStrategyOptions(correct),
      correct,
      explanation: `${correct} works best here because the theorem's structure (${theorem}) matches its standard pattern. The other strategies either over-complicate the argument or don't yield a clean derivation.`,
    };
  }

  if (type === "find_flaw") {
    const flawIndex = Math.floor(Math.random() * Math.max(steps.length, 1));
    const distractors = pickDistractors(lecture, card, 3);
    const options = shuffle([
      `Step ${flawIndex + 1}`,
      ...["Step " + (((flawIndex + 1) % steps.length) + 1), "Step " + (((flawIndex + 2) % steps.length) + 1), "No flaw — the proof is valid"]
        .filter((v, i, a) => a.indexOf(v) === i)
        .slice(0, 3),
    ]);
    return {
      type,
      card,
      theorem,
      steps,
      flawIndex,
      prompt: "One step contains an unjustified leap. Which one?",
      options,
      correct: `Step ${flawIndex + 1}`,
      explanation:
        `Step ${flawIndex + 1} introduces a claim that doesn't follow from the preceding line. ` +
        `A rigorous proof requires each step to follow from prior steps, definitions, or established results. ` +
        `Distractors: ${distractors.slice(0, 1).join("; ")}`.trim(),
    };
  }

  // justify_step or what_comes_next — 4 option radio layout
  const distractors = pickDistractors(lecture, card, 3);
  const correct = card.answer;
  const options = shuffle([correct, ...distractors]).slice(0, 4);
  // Ensure exactly 4 options
  while (options.length < 4) options.push(`Restate: ${theorem}`);
  return {
    type,
    card,
    theorem,
    steps,
    prompt:
      type === "justify_step"
        ? "Which justification supports the highlighted step?"
        : "Given the proof so far, which step comes next?",
    options,
    correct,
    explanation: `The correct choice is grounded in the lecture: ${correct}. The other options either reverse the logical direction, rely on an unstated lemma, or apply a definition outside its valid scope.`,
  };
};

const TYPE_ROTATION: ProofQuestionType[] = [
  "justify_step",
  "what_comes_next",
  "find_flaw",
  "proof_strategy",
];

interface Props {
  lecture: Lecture;
  cards: Flashcard[];
  onExit: () => void;
}

export const ProofModeQuiz = ({ lecture, cards, onExit }: Props) => {
  const items = useMemo<ProofItem[]>(
    () => cards.map((c, i) => buildItem(lecture, c, TYPE_ROTATION[i % TYPE_ROTATION.length])),
    [cards, lecture],
  );

  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<(string | null)[]>(() => cards.map(() => null));
  const [revealProof, setRevealProof] = useState(false);

  const item = items[idx];
  const chosen = answers[idx];
  const answered = chosen !== null;
  const isLast = idx === items.length - 1;
  const allDone = answers.every((a) => a !== null);

  const choose = (opt: string) => {
    if (answered) return;
    setAnswers((prev) => {
      const next = [...prev];
      next[idx] = opt;
      return next;
    });
  };

  if (revealProof) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 rounded-lg border border-bloom-evaluate/40 bg-bloom-evaluate/5 px-3 py-1.5 text-xs font-medium text-bloom-evaluate">
            <ScrollText className="h-3.5 w-3.5" />
            Full Proof — annotated
          </div>
          <Button variant="ghost" size="sm" onClick={onExit}>
            <X className="h-4 w-4" />
            Exit
          </Button>
        </div>
        <div className="space-y-4">
          {items.map((it, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wider text-primary">
                  {typeLabel[it.type]} — Question {i + 1}
                </p>
                <BloomBadge level={it.card.bloom} />
              </div>
              <p className="mb-2 text-sm font-semibold text-foreground">{it.theorem}</p>
              <ol className="space-y-1.5 text-sm text-foreground/90">
                {it.steps.map((s, si) => (
                  <li
                    key={si}
                    className={cn(
                      "rounded-lg border px-3 py-2",
                      it.type === "find_flaw" && it.flawIndex === si
                        ? "border-destructive/40 bg-destructive/5"
                        : "border-border bg-background",
                    )}
                  >
                    <span className="mr-2 text-xs font-semibold text-muted-foreground">
                      {si + 1}.
                    </span>
                    {s}
                  </li>
                ))}
              </ol>
              <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-foreground">
                <p className="mb-1 font-medium text-primary">Annotation</p>
                <p className="leading-relaxed">{it.explanation}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <Button onClick={onExit} className="bg-gradient-primary">
            <Sparkles className="h-4 w-4" />
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-2 rounded-lg border border-bloom-evaluate/40 bg-bloom-evaluate/5 px-3 py-1.5 text-xs font-medium text-bloom-evaluate">
          <ScrollText className="h-3.5 w-3.5" />
          Proof Mode — {idx + 1} / {items.length}
        </div>
        <Button variant="ghost" size="sm" onClick={onExit}>
          <X className="h-4 w-4" />
          Exit
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-wider text-primary">
            {typeLabel[item.type]}
          </p>
          <BloomBadge level={item.card.bloom} />
        </div>

        {/* Theorem / context per type */}
        {item.type === "proof_strategy" && (
          <div className="rounded-xl border border-bloom-evaluate/30 bg-bloom-evaluate/5 p-5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-bloom-evaluate">
              Theorem
            </p>
            <p className="mt-1.5 text-base font-semibold leading-snug text-foreground">
              {item.theorem}
            </p>
          </div>
        )}

        {item.type === "find_flaw" && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">{item.theorem}</p>
            <ol className="space-y-1.5">
              {item.steps.map((s, si) => (
                <li
                  key={si}
                  className="flex gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                >
                  <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                    {si + 1}.
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {(item.type === "justify_step" || item.type === "what_comes_next") && (
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Theorem
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">{item.theorem}</p>
            {item.steps.length > 0 && (
              <ol className="mt-3 space-y-1 text-xs text-muted-foreground">
                {item.steps.slice(0, Math.max(1, item.steps.length - 1)).map((s, si) => (
                  <li key={si}>
                    <span className="font-semibold text-foreground/80">{si + 1}.</span> {s}
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        <p className="text-sm font-medium text-foreground">{item.prompt}</p>

        <div className="grid gap-2">
          {item.options.map((opt) => {
            const selected = chosen === opt;
            const isCorrect = opt === item.correct;
            const showRight = answered && isCorrect;
            const showWrong = answered && selected && !isCorrect;
            return (
              <button
                key={opt}
                onClick={() => choose(opt)}
                disabled={answered}
                className={cn(
                  "group flex items-start gap-3 rounded-xl border bg-background p-4 text-left text-sm transition-all",
                  !answered && "hover:border-primary/40",
                  !selected && !showRight && "border-border",
                  selected && !answered && "border-primary/50 bg-primary/5",
                  showRight && "border-emerald-500/50 bg-emerald-500/5",
                  showWrong && "border-destructive/50 bg-destructive/5",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                    !selected && !showRight && "border-border",
                    selected && !answered && "border-primary bg-primary text-primary-foreground",
                    showRight && "border-emerald-500 bg-emerald-500 text-white",
                    showWrong && "border-destructive bg-destructive text-white",
                  )}
                >
                  {showRight && <CheckCircle2 className="h-3 w-3" />}
                  {showWrong && <XCircle className="h-3 w-3" />}
                </span>
                <span className="text-foreground">{opt}</span>
              </button>
            );
          })}
        </div>

        {answered && (
          <div
            className={cn(
              "rounded-xl border p-4 space-y-2",
              chosen === item.correct
                ? "border-emerald-500/40 bg-emerald-500/5"
                : "border-destructive/40 bg-destructive/5",
            )}
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              {chosen === item.correct ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="text-emerald-700">Correct</span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-destructive" />
                  <span className="text-destructive">Not quite</span>
                </>
              )}
            </div>
            {chosen !== item.correct && (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Correct answer:</span>{" "}
                {item.correct}
              </p>
            )}
            <p className="text-xs text-foreground/90 leading-relaxed">
              <span className="font-medium">Explanation:</span> {item.explanation}
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-xs text-muted-foreground">
            {answers.filter((a) => a !== null).length} / {items.length} answered
          </p>
          <div className="flex gap-2">
            {!isLast && (
              <Button
                onClick={() => setIdx((i) => Math.min(i + 1, items.length - 1))}
                disabled={!answered}
                className="bg-gradient-primary"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
            {isLast && allDone && (
              <Button onClick={() => setRevealProof(true)} className="bg-gradient-primary">
                <BookOpen className="h-4 w-4" />
                Show me the full proof
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProofModeQuiz;
