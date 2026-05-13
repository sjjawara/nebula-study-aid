import { useMemo, useState } from "react";
import { CheckCircle2, XCircle, Loader2, ChevronRight, Sparkles, RefreshCw, TrendingUp } from "lucide-react";
import type { Lecture, Flashcard, BloomLevel } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BloomBadge } from "@/components/BloomBadge";
import { cn } from "@/lib/utils";
import { FollowUpQuestions } from "./FollowUpQuestions";
import { GoDeeperCard } from "./GoDeeperCard";
import { buildTrueFalseStatement, cleanExplanation, pickDistractors, shuffle } from "@/lib/quizUtils";
import { InfoTooltip, tooltipCopy } from "@/components/InfoTooltip";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useT } from "@/lib/i18n";

const EVAL_URL = "https://nebulalearn-production.up.railway.app/evaluate-response";

const LEVELS: BloomLevel[] = ["Remember", "Understand", "Apply", "Analyze", "Evaluate"];

interface Props {
  lecture: Lecture;
  card: Flashcard;
  onNext?: () => void;
  onExit?: () => void;
  onSelectFollowUp?: (c: Flashcard) => void;
  feedbackMode?: "immediate" | "end";
  questionsPerLevel?: number;
  singleLevelMode?: boolean;
}

export const BottomUpQuiz = ({
  lecture,
  card,
  onNext,
  onExit,
  onSelectFollowUp,
  feedbackMode = "immediate",
  questionsPerLevel = 2,
  singleLevelMode = false,
}: Props) => {
  const { t } = useT();

  // If in single level mode, skip straight to the card's specific level
  const [levelIdx, setLevelIdx] = useState(() => {
    if (singleLevelMode) {
      const idx = LEVELS.indexOf(card.bloom);
      return idx >= 0 ? idx : 0;
    }
    return 0;
  });
  const level = LEVELS[levelIdx];

  const distractors = useMemo(() => pickDistractors(lecture, card, 3), [lecture, card]);
  const mcOptions = useMemo(() => shuffle([card.answer, ...distractors]), [card, distractors]);
  const tf = useMemo(() => buildTrueFalseStatement(lecture, card), [lecture, card]);

  // Per-level state
  const [tfChoice, setTfChoice] = useState<boolean | null>(null);
  const [recallText, setRecallText] = useState("");
  const [recallSubmitted, setRecallSubmitted] = useState(false);
  const [understandText, setUnderstandText] = useState("");
  const [mcChoice, setMcChoice] = useState<string | null>(null);
  const [analyzeText, setAnalyzeText] = useState("");
  const [justification, setJustification] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [feedbackText, setFeedbackText] = useState<string | null>(null);
  const [understandSubmitted, setUnderstandSubmitted] = useState(false);
  const [analyzeSubmitted, setAnalyzeSubmitted] = useState(false);

  const advance = () => {
    setSubmitError(null);
    setRecallSubmitted(false);
    setUnderstandSubmitted(false);
    setAnalyzeSubmitted(false);
    if (singleLevelMode) {
      setDone(true);
    } else if (levelIdx < LEVELS.length - 1) {
      setLevelIdx((i) => i + 1);
    } else {
      setDone(true);
    }
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
      advance();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not evaluate response.");
    } finally {
      setSubmitting(false);
    }
  };

  const tfCorrect = tfChoice !== null && tfChoice === tf?.correctValue;
  const mcCorrect = mcChoice === card.answer;
  const showImmediate = feedbackMode === "immediate";

  const FeedbackPanel = ({
    correct,
    bloom,
    why,
    correctAnswer,
  }: {
    correct: boolean | null;
    bloom: BloomLevel;
    why: string;
    correctAnswer?: string;
  }) => (
    <div
      className={cn(
        "rounded-xl border p-4 space-y-2 animate-fade-in",
        correct === true && "border-emerald-500/40 bg-emerald-500/5",
        correct === false && "border-destructive/40 bg-destructive/5",
        correct === null && "border-border bg-muted/30",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          {correct === true && (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="text-emerald-700">{t("Correct")}</span>
            </>
          )}
          {correct === false && (
            <>
              <XCircle className="h-4 w-4 text-destructive" />
              <span className="text-destructive">{t("Not quite")}</span>
            </>
          )}
          {correct === null && <span className="text-foreground">{t("Answer recorded")}</span>}
        </p>
        <BloomBadge level={bloom} />
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{cleanExplanation(why, correctAnswer)}</p>
      {correct === false && correctAnswer && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{t("Correct answer:")}</span> {correctAnswer}
        </p>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-card/60 p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-primary">
              {singleLevelMode ? t("Direct Quiz") : t("Bottom-up build")}
            </p>
            <h3 className="text-xl font-semibold leading-snug text-foreground">{card.question}</h3>
            {!singleLevelMode && (
              <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                {t("Earn your way up Bloom's taxonomy, one level at a time.")}
                <InfoTooltip content={tooltipCopy.bloomTaxonomy} label={t("About Bloom's Taxonomy")} />
              </p>
            )}
          </div>
          <BloomBadge level={card.bloom} />
        </div>

        {!singleLevelMode && (
          <>
            <div className="mt-5 flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">
                {t("Question")} {done ? LEVELS.length : levelIdx + 1} {t("of")} {LEVELS.length}
              </span>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <TrendingUp className="h-3 w-3" /> {done ? t("Mastery achieved") : t(level)}
              </span>
            </div>
            <TooltipProvider delayDuration={150}>
              <div className="mt-2 flex items-center gap-1.5">
                {LEVELS.map((l, i) => {
                  const isCompleted = i < levelIdx || done;
                  const isCurrent = i === levelIdx && !done;
                  const canJump = i < levelIdx && !done;
                  const bloomVar = `hsl(var(--bloom-${l.toLowerCase()}))`;
                  const bloomMuted = `hsl(var(--bloom-${l.toLowerCase()}) / 0.2)`;
                  const segment = (
                    <button
                      type="button"
                      onClick={() => {
                        if (canJump) {
                          setLevelIdx(i);
                          setSubmitError(null);
                          setRecallSubmitted(false);
                          setUnderstandSubmitted(false);
                          setAnalyzeSubmitted(false);
                        }
                      }}
                      disabled={!canJump}
                      aria-label={canJump ? `${t("Jump to")} ${t(l)}` : t(l)}
                      style={{
                        backgroundColor: isCompleted || isCurrent ? bloomVar : bloomMuted,
                        boxShadow: isCurrent ? `0 0 0 2px hsl(var(--bloom-${l.toLowerCase()}) / 0.35)` : undefined,
                      }}
                      className={cn(
                        "h-1.5 w-full rounded-full transition-all",
                        canJump ? "cursor-pointer hover:opacity-80" : "cursor-default",
                      )}
                    />
                  );
                  if (canJump || isCurrent || isCompleted)
                    return (
                      <div key={l} className="flex-1">
                        {segment}
                      </div>
                    );
                  return (
                    <Tooltip key={l}>
                      <TooltipTrigger asChild>
                        <div className="flex-1">{segment}</div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        {t("Complete the current level to unlock")}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </TooltipProvider>
          </>
        )}
      </div>

      {!done && level === "Remember" && (
        <div className="animate-fade-in rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{t("Recall")}</p>
              <p className="text-xs text-muted-foreground">
                {tf ? t("Is the following claim correct?") : t("Answer the question directly.")}
              </p>
            </div>
            <BloomBadge level="Remember" />
          </div>

          {tf ? (
            <>
              <p className="rounded-lg border border-border bg-background p-3 text-sm text-foreground leading-relaxed">
                {tf.statement}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "True", value: true },
                  { label: "False", value: false },
                ].map((o) => {
                  const selected = tfChoice === o.value;
                  const showRight = selected && o.value === tf.correctValue;
                  const showWrong = selected && o.value !== tf.correctValue;
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
                      {t(o.label)}
                    </button>
                  );
                })}
              </div>
              {showImmediate && tfChoice !== null && (
                <FeedbackPanel
                  correct={tfCorrect}
                  bloom="Remember"
                  why={`The lecture establishes that "${card.answer}". This confirms recognition.`}
                  correctAnswer={tf.correctValue ? "True" : "False"}
                />
              )}
              <div className="flex justify-end">
                <Button onClick={advance} disabled={!tfCorrect} className="bg-gradient-primary">
                  {singleLevelMode ? t("Finish") : t("Next level")} <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <>
              <Textarea
                value={recallText}
                onChange={(e) => setRecallText(e.target.value)}
                placeholder={t("Write your answer...")}
                className="min-h-[90px] resize-none bg-background"
                disabled={recallSubmitted}
              />
              {showImmediate && recallSubmitted && (
                <FeedbackPanel correct={null} bloom="Remember" why={`The reference answer is: ${card.answer}`} />
              )}
              <div className="flex justify-end gap-2">
                {!recallSubmitted ? (
                  <Button
                    onClick={() => setRecallSubmitted(true)}
                    disabled={recallText.trim().length < 1}
                    className="bg-gradient-primary"
                  >
                    {t("Submit Answer")} <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button onClick={advance} className="bg-gradient-primary">
                    {singleLevelMode ? t("Finish") : t("Next level")} <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {!done && level === "Understand" && (
        <div className="animate-fade-in rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{t("Explain in your own words")}</p>
              <p className="text-xs text-muted-foreground">{t("Briefly restate the key idea behind the answer.")}</p>
            </div>
            <BloomBadge level="Understand" />
          </div>
          <Textarea
            value={understandText}
            onChange={(e) => setUnderstandText(e.target.value)}
            placeholder={t("In a sentence or two...")}
            className="min-h-[90px] resize-none bg-background"
            disabled={understandSubmitted}
          />
          {showImmediate && understandSubmitted && (
            <FeedbackPanel correct={null} bloom="Understand" why={`The reference idea: ${card.answer}`} />
          )}
          <div className="flex justify-end gap-2">
            {!understandSubmitted ? (
              <Button
                onClick={() => setUnderstandSubmitted(true)}
                disabled={understandText.trim().length < 8}
                className="bg-gradient-primary"
              >
                {t("Submit Answer")} <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={advance} className="bg-gradient-primary">
                {singleLevelMode ? t("Finish") : t("Next level")} <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {!done && level === "Apply" && (
        <div className="animate-fade-in rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{t("Pick the best answer")}</p>
              <p className="text-xs text-muted-foreground">{t("Apply what you know to choose the right option.")}</p>
            </div>
            <BloomBadge level="Apply" />
          </div>
          <div className="grid gap-2">
            {mcOptions.map((opt) => {
              const isSelected = mcChoice === opt;
              const isCorrect = opt === card.answer;
              return (
                <button
                  key={opt}
                  onClick={() => setMcChoice(opt)}
                  className={cn(
                    "group flex items-start gap-3 rounded-xl border bg-background p-4 text-left text-sm transition-all hover:border-primary/40",
                    !isSelected && "border-border",
                    isSelected && isCorrect && "border-emerald-500/50 bg-emerald-500/5",
                    isSelected && !isCorrect && "border-destructive/50 bg-destructive/5",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                      !isSelected && "border-border",
                      isSelected && isCorrect && "border-emerald-500 bg-emerald-500 text-white",
                      isSelected && !isCorrect && "border-destructive bg-destructive text-white",
                    )}
                  >
                    {isSelected && isCorrect && <CheckCircle2 className="h-3 w-3" />}
                    {isSelected && !isCorrect && <XCircle className="h-3 w-3" />}
                  </span>
                  <span className="text-foreground">{opt}</span>
                </button>
              );
            })}
          </div>
          {showImmediate && mcChoice !== null && (
            <FeedbackPanel
              correct={mcCorrect}
              bloom="Apply"
              why={`"${card.answer}" is the strongest answer.`}
              correctAnswer={card.answer}
            />
          )}
          <div className="flex justify-end">
            <Button onClick={advance} disabled={!mcCorrect} className="bg-gradient-primary">
              {singleLevelMode ? t("Finish") : t("Next level")} <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {!done && level === "Analyze" && (
        <div className="animate-fade-in rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{t("Break it down")}</p>
              <p className="text-xs text-muted-foreground">{t("What underlying concepts make this correct?")}</p>
            </div>
            <BloomBadge level="Analyze" />
          </div>
          <Textarea
            value={analyzeText}
            onChange={(e) => setAnalyzeText(e.target.value)}
            placeholder={t("List the parts and how they connect...")}
            className="min-h-[110px] resize-none bg-background"
            disabled={analyzeSubmitted}
          />
          {showImmediate && analyzeSubmitted && (
            <FeedbackPanel correct={null} bloom="Analyze" why={`The grounding answer: ${card.answer}`} />
          )}
          <div className="flex justify-end gap-2">
            {!analyzeSubmitted ? (
              <Button
                onClick={() => setAnalyzeSubmitted(true)}
                disabled={analyzeText.trim().length < 12}
                className="bg-gradient-primary"
              >
                {t("Submit Answer")} <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={advance} className="bg-gradient-primary">
                {singleLevelMode ? t("Finish") : t("Next level")} <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {!done && level === "Evaluate" && (
        <div className="animate-fade-in rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{t("Defend your reasoning")}</p>
              <p className="text-xs text-muted-foreground">{t("Why is this the correct explanation?")}</p>
            </div>
            <BloomBadge level="Evaluate" />
          </div>
          <Textarea
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder={t("Write your justification here...")}
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
                  {t("Reviewing...")}
                </>
              ) : (
                <>
                  {t("Submit Answer")} <ChevronRight className="h-4 w-4" />
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
                  {singleLevelMode ? t("Question complete") : t("Mastery achieved")}
                </h4>
                <BloomBadge level={card.bloom} />
              </div>
              {feedbackText && <p className="text-sm leading-relaxed text-foreground">{feedbackText}</p>}
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{t("Correct explanation")}</p>
                <p className="mt-1 text-sm text-foreground">{card.answer}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {onExit && (
              <Button variant="ghost" onClick={onExit}>
                {t("Exit")}
              </Button>
            )}
            {onNext && (
              <Button onClick={onNext} className="bg-gradient-primary">
                <RefreshCw className="h-4 w-4" />
                {t("Next question")}
              </Button>
            )}
          </div>
        </div>
      )}

      {done && !singleLevelMode && <GoDeeperCard />}
      {done && !singleLevelMode && onSelectFollowUp && (
        <FollowUpQuestions lecture={lecture} current={{ ...card, bloom: "Evaluate" }} onSelect={onSelectFollowUp} />
      )}
    </div>
  );
};

export default BottomUpQuiz;
