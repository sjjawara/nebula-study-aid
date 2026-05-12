import { useMemo, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  Sparkles,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import type { Lecture, Flashcard, BloomLevel } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BloomBadge } from "@/components/BloomBadge";
import { cn } from "@/lib/utils";

const EVAL_URL = "https://nebulalearn-production.up.railway.app/evaluate-response";

const LEVELS: BloomLevel[] = ["Remember", "Understand", "Apply", "Analyze", "Evaluate"];

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

interface Props {
  lecture: Lecture;
  card: Flashcard;
  onNext?: () => void;
  onExit?: () => void;
}

export const BottomUpQuiz = ({ lecture, card, onNext, onExit }: Props) => {
  const [levelIdx, setLevelIdx] = useState(0);
  const level = LEVELS[levelIdx];

  const distractors = useMemo(() => {
    const others = lecture.flashcards
      .filter((f) => f.answer !== card.answer)
      .map((f) => f.answer);
    return shuffle(others).slice(0, 3);
  }, [lecture, card]);

  const mcOptions = useMemo(
    () => shuffle([card.answer, ...distractors]),
    [card, distractors],
  );

  // Per-level state
  const [tfChoice, setTfChoice] = useState<boolean | null>(null);
  const [understandText, setUnderstandText] = useState("");
  const [mcChoice, setMcChoice] = useState<string | null>(null);
  const [analyzeText, setAnalyzeText] = useState("");
  const [justification, setJustification] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [feedbackText, setFeedbackText] = useState<string | null>(null);

  const advance = () => {
    setSubmitError(null);
    if (levelIdx < LEVELS.length - 1) setLevelIdx((i) => i + 1);
    else setDone(true);
  };

  const callEvaluate = async (response: string, prompt: string) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(EVAL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: prompt,
          response,
          topic: lecture.title,
        }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = (await res.json()) as { feedback?: string; correct?: boolean };
      if (typeof data.feedback === "string") setFeedbackText(data.feedback);
      // Optimistic advance regardless of strict correctness — we still scaffold up
      advance();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not evaluate response.");
    } finally {
      setSubmitting(false);
    }
  };

  const tfCorrect = tfChoice === true;
  const mcCorrect = mcChoice === card.answer;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-card/60 p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-primary">
              Bottom-up build
            </p>
            <h3 className="text-xl font-semibold leading-snug text-foreground">
              {card.question}
            </h3>
            <p className="text-xs text-muted-foreground">
              Earn your way up Bloom's taxonomy, one level at a time.
            </p>
          </div>
          <BloomBadge level={card.bloom} />
        </div>
        {/* Progress */}
        <div className="mt-5 flex items-center gap-1.5">
          {LEVELS.map((l, i) => (
            <div
              key={l}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-all",
                i < levelIdx && "bg-emerald-500",
                i === levelIdx && !done && "bg-primary",
                i === levelIdx && done && "bg-emerald-500",
                i > levelIdx && "bg-muted",
              )}
            />
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Level {levelIdx + 1} of {LEVELS.length}</span>
          <span className="inline-flex items-center gap-1">
            <TrendingUp className="h-3 w-3" /> {done ? "Mastery achieved" : level}
          </span>
        </div>
      </div>

      {!done && level === "Remember" && (
        <div className="animate-fade-in rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Recall</p>
              <p className="text-xs text-muted-foreground">
                True or false: <span className="text-foreground">{card.answer}</span>
              </p>
            </div>
            <BloomBadge level="Remember" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "True", value: true },
              { label: "False", value: false },
            ].map((o) => {
              const selected = tfChoice === o.value;
              const showRight = selected && o.value === true;
              const showWrong = selected && o.value !== true;
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
          <div className="flex justify-end">
            <Button
              onClick={advance}
              disabled={!tfCorrect}
              className="bg-gradient-primary"
            >
              Next level <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {!done && level === "Understand" && (
        <div className="animate-fade-in rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Explain in your own words</p>
              <p className="text-xs text-muted-foreground">
                Briefly restate the key idea behind the answer.
              </p>
            </div>
            <BloomBadge level="Understand" />
          </div>
          <Textarea
            value={understandText}
            onChange={(e) => setUnderstandText(e.target.value)}
            placeholder="In a sentence or two..."
            className="min-h-[90px] resize-none bg-background"
          />
          <div className="flex justify-end">
            <Button
              onClick={advance}
              disabled={understandText.trim().length < 8}
              className="bg-gradient-primary"
            >
              Next level <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {!done && level === "Apply" && (
        <div className="animate-fade-in rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Pick the best answer</p>
              <p className="text-xs text-muted-foreground">
                Apply what you know to choose the right option.
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
          <div className="flex justify-end">
            <Button
              onClick={advance}
              disabled={!mcCorrect}
              className="bg-gradient-primary"
            >
              Next level <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {!done && level === "Analyze" && (
        <div className="animate-fade-in rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                Break it down
              </p>
              <p className="text-xs text-muted-foreground">
                What underlying concepts and relationships make this answer correct?
              </p>
            </div>
            <BloomBadge level="Analyze" />
          </div>
          <Textarea
            value={analyzeText}
            onChange={(e) => setAnalyzeText(e.target.value)}
            placeholder="List the parts and how they connect..."
            className="min-h-[110px] resize-none bg-background"
          />
          <div className="flex justify-end">
            <Button
              onClick={advance}
              disabled={analyzeText.trim().length < 12}
              className="bg-gradient-primary"
            >
              Next level <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {!done && level === "Evaluate" && (
        <div className="animate-fade-in rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Defend your reasoning</p>
              <p className="text-xs text-muted-foreground">
                Why is this the correct explanation, and not an alternative?
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
          {submitError && <p className="text-xs text-destructive">{submitError}</p>}
          <div className="flex justify-end">
            <Button
              onClick={() => callEvaluate(justification.trim(), card.question)}
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
                  Submit & finish <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {done && (
        <div className="animate-fade-in space-y-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-base font-semibold text-foreground">
                  Mastery achieved
                </h4>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                  <Sparkles className="h-3 w-3" />
                  All levels demonstrated
                </span>
                <BloomBadge level="Evaluate" />
              </div>
              {feedbackText && (
                <p className="text-sm leading-relaxed text-foreground">{feedbackText}</p>
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
    </div>
  );
};

export default BottomUpQuiz;
