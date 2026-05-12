import { useMemo, useState } from "react";
import {
  Lightbulb,
  Lock,
  Unlock,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { FollowUpQuestions } from "./FollowUpQuestions";
import type { Lecture, Flashcard, BloomLevel } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BloomBadge } from "@/components/BloomBadge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { buildTrueFalseStatement, pickDistractors, shuffle } from "@/lib/quizUtils";

const EVAL_URL = "https://nebulalearn-production.up.railway.app/evaluate-response";

type Feedback = {
  verdict?: string;
  feedback?: string;
  score?: number;
  correct?: boolean;
  what_was_right?: string;
  what_was_wrong?: string;
  what_to_improve?: string;
  learning_outcome?: string;
  bloom_level_demonstrated?: string;
  [k: string]: unknown;
};

type Stage = "l5" | "l4" | "l3" | "l1" | "done";

const Section = ({
  children,
  show,
  badge,
}: {
  children: React.ReactNode;
  show: boolean;
  badge?: string;
}) =>
  show ? (
    <div className="animate-fade-in rounded-2xl border border-border bg-card p-6 shadow-sm">
      {badge && (
        <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
          <Unlock className="h-3 w-3" />
          {badge}
        </div>
      )}
      {children}
    </div>
  ) : null;


interface Props {
  lecture: Lecture;
  card: Flashcard;
  onNext?: () => void;
  onExit?: () => void;
  onSelectFollowUp?: (c: Flashcard) => void;
  feedbackMode?: "immediate" | "end";
}

export const TopDownMasteryQuiz = ({ lecture, card, onNext, onExit, onSelectFollowUp, feedbackMode = "immediate" }: Props) => {
  const distractors = useMemo(() => pickDistractors(lecture, card, 3), [lecture, card]);

  const mcOptions = useMemo(
    () => shuffle([card.answer, ...distractors]),
    [card, distractors],
  );

  const tf = useMemo(() => buildTrueFalseStatement(lecture, card), [lecture, card]);

  const [stage, setStage] = useState<Stage>("l5");
  const [unlocked, setUnlocked] = useState<Set<Stage>>(new Set(["l5"]));
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [justification, setJustification] = useState("");
  const [brainstorm, setBrainstorm] = useState("");
  const [mcChoice, setMcChoice] = useState<string | null>(null);
  const [tfChoice, setTfChoice] = useState<boolean | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [demonstratedLevel, setDemonstratedLevel] = useState<BloomLevel>("Evaluate");

  const requestScaffold = () => setConfirmOpen(true);

  const advance = () => {
    setConfirmOpen(false);
    const next: Stage =
      stage === "l5" ? "l4" : stage === "l4" ? "l3" : stage === "l3" ? "l1" : "l1";
    setUnlocked((u) => new Set([...u, next]));
    setStage(next);
    if (next === "l4") setDemonstratedLevel("Analyze");
    if (next === "l3") setDemonstratedLevel("Apply");
    if (next === "l1") setDemonstratedLevel("Remember");
  };

  const submitJustification = async () => {
    if (!justification.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(EVAL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: card.question,
          response: justification.trim(),
          topic: lecture.title,
        }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = (await res.json()) as Feedback;
      setFeedback(data);
      setStage("done");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not evaluate response.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-5">
        {/* Prompt header */}
        <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-card/60 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-primary">
                Top-down mastery
              </p>
              <h3 className="text-xl font-semibold leading-snug text-foreground">
                {card.question}
              </h3>
              <p className="text-xs text-muted-foreground">
                Start at the top. We scaffold down only if you ask.
              </p>
            </div>
            <BloomBadge level="Evaluate" />
          </div>
        </div>

        {/* Level 1 — True/False */}
        <Section show={!!tf && unlocked.has("l1") && stage !== "done"} badge="Hint Unlocked">
          {tf && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Foundational check — true or false?
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tf.question}
                  </p>
                </div>
                <BloomBadge level="Remember" />
              </div>
              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
                  Proposed answer
                </p>
                <p className="text-sm text-foreground leading-relaxed">{tf.statement}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "True", value: true },
                  { label: "False", value: false },
                ].map((o) => {
                  const selected = tfChoice === o.value;
                  const correct = o.value === tf.correctValue;
                  const showRight = selected && correct;
                  const showWrong = selected && !correct;
                  return (
                    <button
                      key={o.label}
                      onClick={() => setTfChoice(o.value)}
                      className={cn(
                        "rounded-xl border bg-background p-4 text-sm font-medium transition-all hover:border-primary/40",
                        !selected && "border-border text-foreground",
                        showRight && "border-emerald-500/50 bg-emerald-500/5 text-emerald-700",
                        showWrong && "border-destructive/50 bg-destructive/5 text-destructive",
                      )}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
              {feedbackMode === "immediate" && tfChoice !== null && (
                <div
                  className={cn(
                    "rounded-xl border p-4 space-y-2",
                    tfChoice === tf.correctValue
                      ? "border-emerald-500/40 bg-emerald-500/5"
                      : "border-destructive/40 bg-destructive/5",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      {tfChoice === tf.correctValue ? (
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
                    </p>
                    <BloomBadge level="Remember" />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <span className="font-medium text-foreground">Why:</span>{" "}
                    The lecture grounds the claim "{card.answer}". This Remember-level check confirms recognition.
                  </p>
                  {tfChoice !== tf.correctValue && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Correct answer:</span>{" "}
                      {tf.correctValue ? "True" : "False"}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </Section>

        {/* Level 3 — Multiple choice */}
        <Section show={unlocked.has("l3") && stage !== "done"} badge="Hint Unlocked">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Narrow it down — which is the strongest answer?
                </p>
                <p className="text-xs text-muted-foreground">
                  Each option is a plausible read of the question. Pick the one that holds up under scrutiny.
                </p>
              </div>
              <BloomBadge level="Apply" />
            </div>
            <div className="grid gap-2">
              {mcOptions.map((opt) => {
                const isSelected = mcChoice === opt;
                const isCorrect = opt === card.answer;
                const showWrong = isSelected && !isCorrect;
                const showRight = isSelected && isCorrect;
                return (
                  <button
                    key={opt}
                    onClick={() => setMcChoice(opt)}
                    className={cn(
                      "group flex items-start gap-3 rounded-xl border bg-background p-4 text-left text-sm transition-all hover:border-primary/40",
                      !isSelected && "border-border",
                      showRight && "border-emerald-500/50 bg-emerald-500/5",
                      showWrong && "border-destructive/50 bg-destructive/5",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                        !isSelected && "border-border",
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
            {feedbackMode === "immediate" && mcChoice !== null && (
              <div
                className={cn(
                  "rounded-xl border p-4 space-y-2",
                  mcChoice === card.answer
                    ? "border-emerald-500/40 bg-emerald-500/5"
                    : "border-destructive/40 bg-destructive/5",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    {mcChoice === card.answer ? (
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
                  </p>
                  <BloomBadge level="Apply" />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-medium text-foreground">Why:</span>{" "}
                  "{card.answer}" is grounded directly in the lecture; the other options are plausible-sounding distractors drawn from related material.
                </p>
                {mcChoice !== card.answer && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Correct answer:</span> {card.answer}
                  </p>
                )}
              </div>
            )}
            {stage === "l3" && (
              <div className="flex justify-end">
                <Button variant="secondary" onClick={requestScaffold}>
                  Show foundational check
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </Section>

        {/* Level 4 — Brainstorm */}
        <Section show={unlocked.has("l4") && stage !== "done"} badge="Hint Unlocked">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  What concepts are relevant here?
                </p>
                <p className="text-xs text-muted-foreground">
                  Free-write the ideas, terms, or relationships you'd need.
                </p>
              </div>
              <BloomBadge level="Analyze" />
            </div>
            <Textarea
              value={brainstorm}
              onChange={(e) => setBrainstorm(e.target.value)}
              placeholder="List the concepts that come to mind..."
              className="min-h-[100px] resize-none bg-background"
            />
            {stage === "l4" && (
              <div className="flex justify-end">
                <Button variant="secondary" onClick={requestScaffold}>
                  Still stuck — show options
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </Section>

        {/* Level 5 — Justify */}
        <Section show={unlocked.has("l5") && stage !== "done"}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Defend your reasoning
                </p>
                <p className="text-xs text-muted-foreground">
                  Why is this the correct explanation, and not an alternative? Justify it.
                </p>
              </div>
              <BloomBadge level="Evaluate" />
            </div>
            <Textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Write your justification here..."
              className="min-h-[140px] resize-none bg-background"
            />
            {submitError && (
              <p className="text-xs text-destructive">{submitError}</p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={requestScaffold}
                    className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    I'm stuck, break it down for me
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Struggling a bit longer improves retention.
                </TooltipContent>
              </Tooltip>
              <Button
                onClick={submitJustification}
                disabled={!justification.trim() || submitting}
                className="bg-gradient-primary"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Evaluating...
                  </>
                ) : (
                  <>
                    Submit Justification
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </Section>

        {/* Done */}
        {stage === "done" && (
          <div className="animate-fade-in space-y-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-base font-semibold text-foreground">
                    Response evaluated
                  </h4>
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                    <Sparkles className="h-3 w-3" />
                    Learning outcome achieved
                  </span>
                  <BloomBadge level={demonstratedLevel} />
                </div>
                {feedback && (
                  <div className="space-y-2 text-sm text-foreground">
                    {typeof feedback.feedback === "string" && (
                      <p className="leading-relaxed">{feedback.feedback}</p>
                    )}
                    {typeof feedback.verdict === "string" && (
                      <p className="text-xs text-muted-foreground">
                        Verdict: {feedback.verdict}
                      </p>
                    )}
                  </div>
                )}
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    Correct explanation
                  </p>
                  <p className="mt-1 text-sm text-foreground">{card.answer}</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {onExit && (
                <Button variant="ghost" onClick={onExit}>
                  Exit
                </Button>
              )}
              {onNext && (
                <Button onClick={onNext} className="bg-gradient-primary">
                  <RefreshCw className="h-4 w-4" />
                  Next question
                </Button>
              )}
            </div>
          </div>
        )}

        {stage === "done" && onSelectFollowUp && (
          <FollowUpQuestions
            lecture={lecture}
            current={card}
            onSelect={onSelectFollowUp}
          />
        )}

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-primary" />
                Are you sure?
              </DialogTitle>
              <DialogDescription>
                Research shows that productive struggle leads to better long-term memory.
                Try a bit longer?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:justify-end">
              <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
                Keep trying
              </Button>
              <Button onClick={advance} className="bg-gradient-primary">
                <Lock className="h-4 w-4" />
                Break it down
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};

export default TopDownMasteryQuiz;
