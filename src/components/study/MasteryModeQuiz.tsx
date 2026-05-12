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
  Trophy,
  BookOpen,
  Sparkles,
  Flag,
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
import { InfoTooltip, tooltipCopy } from "@/components/InfoTooltip";

const EVAL_URL = "https://nebulalearn-production.up.railway.app/evaluate-response";

interface Props {
  lecture: Lecture;
  onExit?: () => void;
}

type QType = "tf" | "mcq" | "open";
type FeedbackMode = "immediate" | "end";

const typeForLevel = (l: BloomLevel): QType => {
  if (l === "Remember") return "tf";
  if (l === "Understand" || l === "Apply") return "mcq";
  return "open";
};

const STEP_CORRECT = 1 / 3;
const STEP_WRONG = -1 / 2;

interface AnswerRecord {
  questionNum: number;
  level: BloomLevel;
  qType: QType;
  prompt: string;
  userAnswer: string;
  correctAnswer: string;
  correct: boolean;
  feedbackText?: string;
  topic?: string;
  timestamp?: string;
}

const encouragementFor = (correct: boolean, accuracy: number, streak: number): string => {
  if (correct) {
    if (streak >= 5) return "On fire — five in a row. Push for the next level.";
    if (streak >= 3) return "Three in a row. The model in your head is solidifying.";
    if (accuracy >= 80) return "Strong work. You're consistently picking the right reasoning.";
    return "Nice. Keep going to lock the concept in.";
  }
  if (accuracy >= 70) return "One slip — you've been solid overall. Read the explanation and keep going.";
  if (accuracy >= 40) return "Worth slowing down on this one. Re-read the explanation and try the next.";
  return "These are tough — that's the point. Productive struggle is how mastery sticks.";
};

const explanationFor = (record: Pick<AnswerRecord, "qType" | "correctAnswer" | "feedbackText" | "topic">): string => {
  if (record.feedbackText) return record.feedbackText;
  if (record.qType === "tf") {
    return `The statement reflects what was covered in the lecture: ${record.correctAnswer}. ${record.topic ? `This sits under "${record.topic}".` : ""}`.trim();
  }
  if (record.qType === "mcq") {
    return `"${record.correctAnswer}" is the strongest answer because it's the option grounded in the lecture. The distractors are plausible-sounding misconceptions drawn from related material.`;
  }
  return `A complete answer would land on: ${record.correctAnswer}.`;
};

export const MasteryModeQuiz = ({ lecture, onExit }: Props) => {
  const [feedbackMode, setFeedbackMode] = useState<FeedbackMode>("immediate");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [used, setUsed] = useState<Set<string>>(new Set());
  const [card, setCard] = useState<Flashcard | null>(null);
  const [questionNum, setQuestionNum] = useState(1);
  const [records, setRecords] = useState<AnswerRecord[]>([]);
  const [finished, setFinished] = useState(false);
  const [peakLevel, setPeakLevel] = useState<BloomLevel>("Remember");

  const currentLevel: BloomLevel = useMemo(() => {
    const idx = Math.min(BLOOM_ORDER.length - 1, Math.max(0, Math.floor(score)));
    return BLOOM_ORDER[idx];
  }, [score]);

  useEffect(() => {
    if (BLOOM_ORDER.indexOf(currentLevel) > BLOOM_ORDER.indexOf(peakLevel)) {
      setPeakLevel(currentLevel);
    }
  }, [currentLevel, peakLevel]);

  // Pick first card
  useEffect(() => {
    if (!card && !finished) {
      const next = pickCardForLevel(lecture, currentLevel, used);
      if (next) {
        setCard(next);
        setUsed((u) => new Set(u).add(next.question));
      }
    }
  }, [card, finished, lecture, currentLevel, used]);

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

  const lookupTopic = (c: Flashcard): { topic?: string; timestamp?: string } => {
    if (!c.timestamp) return {};
    const match = lecture.outline.find((o) => o.timestamp === c.timestamp);
    return { topic: match?.topic, timestamp: c.timestamp };
  };

  const recordResult = (
    correct: boolean,
    userAnswer: string,
    extras: { feedbackText?: string } = {},
  ) => {
    if (!card) return;
    const meta = lookupTopic(card);
    const record: AnswerRecord = {
      questionNum,
      level: currentLevel,
      qType,
      prompt: qType === "tf" && tf ? tf.statement : card.question,
      userAnswer,
      correctAnswer: qType === "tf" && tf ? (tf.correctValue ? "True" : "False") : card.answer,
      correct,
      feedbackText: extras.feedbackText,
      topic: meta.topic,
      timestamp: meta.timestamp,
    };
    setRecords((r) => [...r, record]);
    setAnswered(true);
    setWasCorrect(correct);
    setStreak((s) => (correct ? s + 1 : 0));
    setScore((s) => {
      const next = s + (correct ? STEP_CORRECT : STEP_WRONG);
      return Math.max(0, Math.min(BLOOM_ORDER.length - 0.001, next));
    });

    // In end-of-quiz mode, auto-advance silently
    if (feedbackMode === "end") {
      // small delay so the click registers visually
      setTimeout(() => {
        nextQuestion();
      }, 120);
    }
  };

  const handleTF = (value: boolean) => {
    if (answered || !tf) return;
    recordResult(value === tf.correctValue, value ? "True" : "False");
  };

  const handleMC = (opt: string) => {
    if (answered || !card) return;
    recordResult(opt === card.answer, opt);
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
      const fb = typeof data.feedback === "string" ? data.feedback : undefined;
      if (fb) setOpenFeedback(fb);
      const correct =
        typeof data.correct === "boolean"
          ? data.correct
          : typeof data.score === "number"
          ? data.score >= 0.6
          : openText.trim().length >= 40;
      recordResult(correct, openText.trim(), { feedbackText: fb });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not evaluate response.");
    } finally {
      setSubmitting(false);
    }
  };

  function nextQuestion() {
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
      setUsed(new Set());
      const recycled = pickCardForLevel(lecture, currentLevel, new Set());
      setCard(recycled);
    }
    setQuestionNum((n) => n + 1);
  }

  const masteryPct = (score / BLOOM_ORDER.length) * 100;
  const correctCount = records.filter((r) => r.correct).length;
  const accuracy = records.length ? Math.round((correctCount / records.length) * 100) : 0;

  // ===== End of quiz summary =====
  if (finished) {
    const perLevel = BLOOM_ORDER.map((lvl) => {
      const lvlRecs = records.filter((r) => r.level === lvl);
      const right = lvlRecs.filter((r) => r.correct).length;
      return {
        level: lvl,
        total: lvlRecs.length,
        right,
        pct: lvlRecs.length ? Math.round((right / lvlRecs.length) * 100) : 0,
      };
    });

    // Topics to study: derive from missed records (unique by topic)
    const struggleMap = new Map<string, { topic: string; level: BloomLevel; count: number; timestamp?: string }>();
    for (const r of records.filter((x) => !x.correct)) {
      const key = r.topic ?? r.prompt.slice(0, 60);
      const existing = struggleMap.get(key);
      if (existing) existing.count += 1;
      else
        struggleMap.set(key, {
          topic: r.topic ?? r.prompt.slice(0, 60),
          level: r.level,
          count: 1,
          timestamp: r.timestamp,
        });
    }
    const studyTopics = Array.from(struggleMap.values()).sort((a, b) => b.count - a.count);

    const overall = encouragementFor(accuracy >= 60, accuracy, 0);

    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-primary">Quiz complete</p>
              <h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                {accuracy}% overall · peak level {peakLevel}
              </h3>
              <p className="text-sm text-muted-foreground">{overall}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onExit}>
                <X className="h-4 w-4" />
                Close
              </Button>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-primary"
                style={{ width: `${(BLOOM_ORDER.indexOf(peakLevel) + 1) / BLOOM_ORDER.length * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
              {BLOOM_ORDER.map((l) => (
                <span key={l} className={cn(l === peakLevel && "font-semibold text-primary")}>
                  {l.slice(0, 4)}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Per-Bloom breakdown */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h4 className="text-sm font-semibold text-foreground mb-3">Performance by Bloom's level</h4>
          <div className="space-y-2.5">
            {perLevel.map((row) => (
              <div key={row.level} className="flex items-center gap-3">
                <div className="w-24 shrink-0">
                  <BloomBadge level={row.level} />
                </div>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      row.pct >= 70 ? "bg-emerald-500" : row.pct >= 40 ? "bg-amber-500" : "bg-destructive",
                    )}
                    style={{ width: `${row.total ? row.pct : 0}%` }}
                  />
                </div>
                <div className="w-24 text-right text-xs text-muted-foreground tabular-nums">
                  {row.total ? `${row.right}/${row.total} · ${row.pct}%` : "—"}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Study these topics */}
        {studyTopics.length > 0 && (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-50/40 dark:bg-amber-500/5 p-5 shadow-sm">
            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-amber-600" />
              Study these topics
            </h4>
            <ul className="space-y-2">
              {studyTopics.slice(0, 6).map((t, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-[11px] font-semibold text-amber-700">
                    {t.count}
                  </span>
                  <div className="flex-1">
                    <p className="text-foreground font-medium">{t.topic}</p>
                    <p className="text-xs text-muted-foreground">
                      Missed at {t.level} level{t.timestamp ? ` · ${t.timestamp}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* All questions with feedback, organized by Bloom */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h4 className="text-sm font-semibold text-foreground mb-3">All questions & feedback</h4>
          <div className="space-y-5">
            {BLOOM_ORDER.map((lvl) => {
              const items = records.filter((r) => r.level === lvl);
              if (!items.length) return null;
              return (
                <section key={lvl} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <BloomBadge level={lvl} />
                    <span className="text-xs text-muted-foreground">{items.length} question{items.length === 1 ? "" : "s"}</span>
                  </div>
                  <div className="space-y-2">
                    {items.map((r, i) => (
                      <div
                        key={`${lvl}-${i}`}
                        className={cn(
                          "rounded-xl border p-4 space-y-1.5",
                          r.correct
                            ? "border-emerald-500/30 bg-emerald-500/5"
                            : "border-destructive/30 bg-destructive/5",
                        )}
                      >
                        <div className="flex items-start gap-2">
                          {r.correct ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                          )}
                          <p className="text-sm text-foreground font-medium">{r.prompt}</p>
                        </div>
                        <p className="text-xs text-muted-foreground pl-6">
                          <span className="font-medium text-foreground">Your answer:</span> {r.userAnswer || "—"}
                        </p>
                        {!r.correct && (
                          <p className="text-xs text-muted-foreground pl-6">
                            <span className="font-medium text-foreground">Correct:</span> {r.correctAnswer}
                          </p>
                        )}
                        <p className="text-xs text-foreground/80 leading-relaxed pl-6">
                          {explanationFor(r)}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          {onExit && (
            <Button variant="ghost" onClick={onExit}>
              Exit
            </Button>
          )}
          <Button
            onClick={() => {
              setRecords([]);
              setScore(0);
              setStreak(0);
              setUsed(new Set());
              setCard(null);
              setQuestionNum(1);
              setFinished(false);
              setPeakLevel("Remember");
            }}
            className="bg-gradient-primary"
          >
            <RefreshCw className="h-4 w-4" />
            Start a new run
          </Button>
        </div>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center">
        <p className="text-sm text-muted-foreground">Loading questions…</p>
      </div>
    );
  }

  const lastRecord = records[records.length - 1];
  const showImmediateFeedback = answered && feedbackMode === "immediate" && lastRecord;

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
            <Button
              variant="secondary"
              size="sm"
              disabled={records.length === 0}
              onClick={() => setFinished(true)}
            >
              <Flag className="h-3.5 w-3.5" />
              End quiz
            </Button>
            {onExit && (
              <Button variant="ghost" size="sm" onClick={onExit}>
                <X className="h-4 w-4" />
                Exit
              </Button>
            )}
          </div>
        </div>

        {/* Feedback mode toggle */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-background p-1 text-xs">
            <span className="px-2 text-muted-foreground">Feedback:</span>
            {(["immediate", "end"] as FeedbackMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setFeedbackMode(mode)}
                className={cn(
                  "rounded-md px-3 py-1 font-medium transition-colors",
                  feedbackMode === mode
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {mode === "immediate" ? "Immediate" : "End of Quiz"}
              </button>
            ))}
          </div>
          {feedbackMode === "end" && (
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-primary" />
              Answers will be reviewed in one summary at the end.
            </span>
          )}
        </div>

        {/* Mastery bar */}
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
                const showResult = answered && feedbackMode === "immediate";
                const selected = showResult && tf.correctValue === o.value;
                const wrongPick = showResult && wasCorrect === false && o.value !== tf.correctValue;
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
              const showResult = answered && feedbackMode === "immediate";
              const showRight = showResult && isCorrect;
              const showWrong = showResult && !isCorrect && wasCorrect === false;
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

        {showImmediateFeedback && (
          <div
            className={cn(
              "rounded-xl border p-4 space-y-2",
              wasCorrect
                ? "border-emerald-500/40 bg-emerald-500/5"
                : "border-destructive/40 bg-destructive/5",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-semibold">
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
              <BloomBadge level={lastRecord.level} />
            </div>
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Why:</span>{" "}
              {explanationFor(lastRecord)}
            </div>
            {!wasCorrect && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Correct answer:</span> {lastRecord.correctAnswer}
              </div>
            )}
            <p className="text-xs text-foreground/80 italic">
              {encouragementFor(!!wasCorrect, accuracy, streak)}
            </p>
            <div className="flex justify-end pt-1">
              <Button onClick={nextQuestion} className="bg-gradient-primary">
                <RefreshCw className="h-4 w-4" />
                Next question
              </Button>
            </div>
          </div>
        )}

        {answered && feedbackMode === "end" && (
          <p className="text-xs text-muted-foreground italic text-right">
            Answer recorded. Loading next question…
          </p>
        )}
      </div>
    </div>
  );
};

export default MasteryModeQuiz;
