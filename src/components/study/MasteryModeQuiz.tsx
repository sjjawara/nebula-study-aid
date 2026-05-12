import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  RefreshCw,
  TrendingUp,
  Flame,
  X,
} from "lucide-react";
import type { Lecture, Flashcard, BloomLevel } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BloomBadge } from "@/components/BloomBadge";
import { cn } from "@/lib/utils";
import {
  BLOOM_ORDER,
  buildTrueFalseStatement,
  pickCardForLevel,
  pickDistractors,
  shuffle,
} from "@/lib/quizUtils";

const EVAL_URL = "https://nebulalearn-production.up.railway.app/evaluate-response";

interface Props {
  lecture: Lecture;
  onExit?: () => void;
}

type QType = "tf" | "mcq" | "open";

const typeForLevel = (l: BloomLevel): QType => {
  if (l === "Remember") return "tf";
  if (l === "Understand" || l === "Apply") return "mcq";
  return "open";
};

// Mastery score: 0..(BLOOM_ORDER.length). Each correct = +1/3, each wrong = -1/2.
// Floor of score = current bloom index.
const STEP_CORRECT = 1 / 3;
const STEP_WRONG = -1 / 2;

export const MasteryModeQuiz = ({ lecture, onExit }: Props) => {
  const [score, setScore] = useState(0); // 0..5 (Remember..Create)
  const [streak, setStreak] = useState(0);
  const [used, setUsed] = useState<Set<string>>(new Set());
  const [card, setCard] = useState<Flashcard | null>(null);
  const [questionNum, setQuestionNum] = useState(1);
  const [history, setHistory] = useState<{ correct: boolean; level: BloomLevel }[]>([]);

  const currentLevel: BloomLevel = useMemo(() => {
    const idx = Math.min(BLOOM_ORDER.length - 1, Math.max(0, Math.floor(score)));
    return BLOOM_ORDER[idx];
  }, [score]);

  // Pick first card
  useEffect(() => {
    if (!card) {
      const next = pickCardForLevel(lecture, currentLevel, used);
      if (next) {
        setCard(next);
        setUsed((u) => new Set(u).add(next.question));
      }
    }
  }, [card, lecture, currentLevel, used]);

  // ----- Per-question state -----
  const [answered, setAnswered] = useState(false);
  const [wasCorrect, setWasCorrect] = useState<boolean | null>(null);
  const [openText, setOpenText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [openFeedback, setOpenFeedback] = useState<string | null>(null);

  const qType: QType = card ? typeForLevel(currentLevel) : "tf";

  const tf = useMemo(
    () => (card && qType === "tf" ? buildTrueFalseStatement(lecture, card) : null),
    [card, qType, lecture],
  );

  const mcOptions = useMemo(() => {
    if (!card || qType !== "mcq") return [] as string[];
    const distractors = pickDistractors(lecture, card, 3);
    return shuffle([card.answer, ...distractors]);
  }, [card, qType, lecture]);

  const recordResult = (correct: boolean) => {
    setAnswered(true);
    setWasCorrect(correct);
    setHistory((h) => [...h, { correct, level: currentLevel }]);
    setStreak((s) => (correct ? s + 1 : 0));
    setScore((s) => {
      const next = s + (correct ? STEP_CORRECT : STEP_WRONG);
      return Math.max(0, Math.min(BLOOM_ORDER.length - 0.001, next));
    });
  };

  const handleTF = (value: boolean) => {
    if (answered || !tf) return;
    recordResult(value === tf.correctValue);
  };

  const handleMC = (opt: string) => {
    if (answered || !card) return;
    recordResult(opt === card.answer);
  };

  const submitOpen = async () => {
    if (!card || answered || !openText.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(EVAL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: card.question,
          response: openText.trim(),
          topic: lecture.title,
        }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = (await res.json()) as { feedback?: string; correct?: boolean; score?: number };
      if (typeof data.feedback === "string") setOpenFeedback(data.feedback);
      const correct =
        typeof data.correct === "boolean"
          ? data.correct
          : typeof data.score === "number"
          ? data.score >= 0.6
          : openText.trim().length >= 40;
      recordResult(correct);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not evaluate response.");
    } finally {
      setSubmitting(false);
    }
  };

  const nextQuestion = () => {
    setAnswered(false);
    setWasCorrect(null);
    setOpenText("");
    setOpenFeedback(null);
    setSubmitError(null);
    const next = pickCardForLevel(lecture, currentLevel, used);
    if (next) {
      setUsed((u) => new Set(u).add(next.question));
      setCard(next);
    } else {
      // Reset used pool to recycle if we run out
      setUsed(new Set());
      const recycled = pickCardForLevel(lecture, currentLevel, new Set());
      setCard(recycled);
    }
    setQuestionNum((n) => n + 1);
  };

  const masteryPct = (score / BLOOM_ORDER.length) * 100;
  const correctCount = history.filter((h) => h.correct).length;
  const accuracy = history.length ? Math.round((correctCount / history.length) * 100) : 0;

  if (!card) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center">
        <p className="text-sm text-muted-foreground">Loading questions…</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Mastery header */}
      <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-card/60 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-primary">
              Mastery mode
            </p>
            <h3 className="text-lg font-semibold text-foreground">
              Question {questionNum} · current level: {currentLevel}
            </h3>
            <p className="text-xs text-muted-foreground">
              3 in a row levels you up. One miss drops you back half a level.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Flame className={cn("h-3.5 w-3.5", streak > 0 ? "text-orange-500" : "text-muted-foreground")} />
              Streak {streak}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              {accuracy}% acc
            </span>
            {onExit && (
              <Button variant="ghost" size="sm" onClick={onExit}>
                <X className="h-4 w-4" />
                Exit
              </Button>
            )}
          </div>
        </div>

        {/* Mastery bar with bloom checkpoints */}
        <div className="mt-5 space-y-2">
          <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-primary transition-[width] duration-500"
              style={{ width: `${masteryPct}%` }}
            />
            {BLOOM_ORDER.map((_, i) => (
              <div
                key={i}
                className="absolute top-0 h-full w-px bg-background/70"
                style={{ left: `${(i / BLOOM_ORDER.length) * 100}%` }}
              />
            ))}
          </div>
          <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
            {BLOOM_ORDER.map((l) => (
              <span
                key={l}
                className={cn(
                  "transition-colors",
                  l === currentLevel && "font-semibold text-primary",
                )}
              >
                {l.slice(0, 4)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Question card */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
        <div className="flex items-start justify-between gap-3">
          <h4 className="text-base font-semibold leading-snug text-foreground">
            {qType === "tf"
              ? "Is the following statement correct?"
              : card.question}
          </h4>
          <BloomBadge level={currentLevel} />
        </div>

        {qType === "tf" && tf && (
          <>
            <p className="rounded-lg border border-border bg-background p-4 text-sm text-foreground leading-relaxed">
              {tf.statement}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "True", value: true },
                { label: "False", value: false },
              ].map((o) => {
                const selected = answered && wasCorrect !== null && tf.correctValue === o.value;
                const wrongPick = answered && wasCorrect === false && o.value !== tf.correctValue;
                return (
                  <button
                    key={o.label}
                    onClick={() => handleTF(o.value)}
                    disabled={answered}
                    className={cn(
                      "rounded-xl border bg-background p-4 text-sm font-medium transition-all",
                      !answered && "border-border text-foreground hover:border-primary/40",
                      selected && "border-emerald-500/50 bg-emerald-500/5 text-emerald-700",
                      wrongPick && "border-destructive/50 bg-destructive/5 text-destructive",
                    )}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {qType === "mcq" && (
          <div className="grid gap-2">
            {mcOptions.map((opt) => {
              const isCorrect = opt === card.answer;
              const showRight = answered && isCorrect;
              const showWrong = answered && !isCorrect && wasCorrect === false;
              return (
                <button
                  key={opt}
                  onClick={() => handleMC(opt)}
                  disabled={answered}
                  className={cn(
                    "group flex items-start gap-3 rounded-xl border bg-background p-4 text-left text-sm transition-all",
                    !answered && "border-border hover:border-primary/40",
                    showRight && "border-emerald-500/50 bg-emerald-500/5",
                    showWrong && "border-destructive/50 bg-destructive/5 opacity-70",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                      !answered && "border-border",
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
        )}

        {qType === "open" && (
          <div className="space-y-3">
            <Textarea
              value={openText}
              onChange={(e) => setOpenText(e.target.value)}
              placeholder="Write your reasoning here..."
              className="min-h-[140px] resize-none bg-background"
              disabled={answered}
            />
            {submitError && <p className="text-xs text-destructive">{submitError}</p>}
            {!answered && (
              <div className="flex justify-end">
                <Button
                  onClick={submitOpen}
                  disabled={!openText.trim() || submitting}
                  className="bg-gradient-primary"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Evaluating…
                    </>
                  ) : (
                    <>
                      Submit <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        {answered && (
          <div
            className={cn(
              "rounded-xl border p-4 space-y-2",
              wasCorrect
                ? "border-emerald-500/40 bg-emerald-500/5"
                : "border-destructive/40 bg-destructive/5",
            )}
          >
            <p className="flex items-center gap-2 text-sm font-medium">
              {wasCorrect ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="text-emerald-700">Correct — mastery increased</span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-destructive" />
                  <span className="text-destructive">Not quite — mastery dropped half a level</span>
                </>
              )}
            </p>
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Correct answer:</span> {card.answer}
            </div>
            {openFeedback && (
              <p className="text-xs text-foreground/80 leading-relaxed">{openFeedback}</p>
            )}
            <div className="flex justify-end pt-1">
              <Button onClick={nextQuestion} className="bg-gradient-primary">
                <RefreshCw className="h-4 w-4" />
                Next question
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MasteryModeQuiz;
