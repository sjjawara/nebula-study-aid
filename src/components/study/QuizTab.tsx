import { useEffect, useMemo, useState } from "react";
import { Sparkles, ArrowDown, ArrowUp, Play, X, Gauge, Settings2, ChevronDown, FunctionSquare, ListOrdered, ScrollText } from "lucide-react";
import { ProofModeQuiz } from "./ProofModeQuiz";
import type { Lecture, Flashcard, BloomLevel } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BloomBadge } from "@/components/BloomBadge";
import { TopDownMasteryQuiz } from "./TopDownMasteryQuiz";
import { BottomUpQuiz } from "./BottomUpQuiz";
import { MasteryModeQuiz } from "./MasteryModeQuiz";
import { StepOrderingQuiz } from "./StepOrderingQuiz";
import { cn } from "@/lib/utils";
import { InfoTooltip, tooltipCopy } from "@/components/InfoTooltip";
import { useT } from "@/lib/i18n";

const BLOOM_LEVELS: BloomLevel[] = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"];
const QUESTION_COUNTS = [5, 10, 15, 20] as const;

const modeTooltip: Record<QuizMode, string> = {
  bottom: tooltipCopy.bottomUp,
  top: tooltipCopy.topDown,
  mastery: tooltipCopy.masteryMode,
};

export type QuizMode = "bottom" | "top" | "mastery";
export type FeedbackMode = "immediate" | "end";

interface Props {
  lecture: Lecture;
  initialCard?: Flashcard | null;
  onConsumedInitial?: () => void;
}

const FeedbackModeToggle = ({
  mode,
  onChange,
}: {
  mode: FeedbackMode;
  onChange: (m: FeedbackMode) => void;
}) => {
  const { t } = useT();
  return (
    <div className="inline-flex items-center gap-1.5">
      <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-background p-1 text-xs">
        <span className="px-2 text-muted-foreground">{t("Feedback:")}</span>
        {(["immediate", "end"] as FeedbackMode[]).map((m) => (
          <button
            key={m}
            onClick={() => onChange(m)}
            className={cn(
              "rounded-md px-3 py-1 font-medium transition-colors",
              mode === m
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {m === "immediate" ? t("Immediate") : t("End of Quiz")}
          </button>
        ))}
      </div>
      <InfoTooltip content={tooltipCopy.feedbackMode} label={t("About feedback timing")} />
    </div>
  );
};

const pickHardest = (lecture: Lecture): Flashcard | null => {
  if (!lecture.flashcards.length) return null;
  const order = ["Evaluate", "Analyze", "Apply", "Understand", "Remember", "Create"];
  return [...lecture.flashcards].sort(
    (a, b) => order.indexOf(a.bloom) - order.indexOf(b.bloom),
  )[0];
};

const pickRandom = (lecture: Lecture, exclude?: Flashcard): Flashcard | null => {
  const pool = lecture.flashcards.filter((f) => f !== exclude);
  if (!pool.length) return lecture.flashcards[0] ?? null;
  return pool[Math.floor(Math.random() * pool.length)];
};

/** Rewrite a flashcard's question using one of three formula-specific patterns. */
const buildFormulaCard = (card: Flashcard, idx: number): Flashcard => {
  const formula = card.formula?.trim();
  if (!formula) return card;
  const concept = card.question.replace(/[?.!]+$/, "").trim();
  const vars = Array.from(
    new Set((formula.match(/\b[a-zA-Zα-ωΑ-Ω]\b/g) ?? []).filter((v) => !/^[ivx]$/i.test(v))),
  );
  const patterns: Array<() => { question: string; answer: string } | null> = [
    () => ({ question: `Write the formula for ${concept}.`, answer: formula }),
    () =>
      vars.length
        ? {
            question: `In the formula  ${formula}  — what does "${vars[idx % vars.length]}" represent?`,
            answer: card.answer,
          }
        : null,
    () => ({
      question: `Which formula would you use to solve: ${concept}?`,
      answer: formula,
    }),
  ];
  const order = [idx % 3, (idx + 1) % 3, (idx + 2) % 3];
  for (const p of order) {
    const r = patterns[p]();
    if (r) return { ...card, question: r.question, answer: r.answer };
  }
  return card;
};

export const QuizTab = ({ lecture, initialCard, onConsumedInitial }: Props) => {
  const { t } = useT();
  const [mode, setMode] = useState<QuizMode>("bottom");
  const [feedbackMode, setFeedbackMode] = useState<FeedbackMode>("immediate");
  const [card, setCard] = useState<Flashcard | null>(null);
  const [sessionKey, setSessionKey] = useState(0);
  const [masteryActive, setMasteryActive] = useState(false);

  // ----- Advanced Customization state -----
  const [customOpen, setCustomOpen] = useState(false);
  const [customCount, setCustomCount] = useState<number>(10);
  const [customLevels, setCustomLevels] = useState<Set<BloomLevel>>(
    () => new Set<BloomLevel>(BLOOM_LEVELS),
  );
  const [selectedCardKeys, setSelectedCardKeys] = useState<Set<string>>(() => new Set());
  const [customLecture, setCustomLecture] = useState<Lecture | null>(null);
  const [customAnswered, setCustomAnswered] = useState(0);
  const [formulaMode, setFormulaMode] = useState(false);
  const [stepOrderingMode, setStepOrderingMode] = useState(false);
  const [stepOrderingCards, setStepOrderingCards] = useState<Flashcard[] | null>(null);
  const [proofMode, setProofMode] = useState(false);
  const [proofCards, setProofCards] = useState<Flashcard[] | null>(null);

  const formulaCount = useMemo(
    () => lecture.flashcards.filter((c) => !!c.formula?.trim()).length,
    [lecture.flashcards],
  );
  const stepCardCount = useMemo(
    () => lecture.flashcards.filter((c) => (c.steps?.length ?? 0) >= 2).length,
    [lecture.flashcards],
  );
  const proofCardCount = useMemo(
    () => lecture.flashcards.filter((c) => c.bloom === "Analyze" || c.bloom === "Evaluate").length,
    [lecture.flashcards],
  );
  const proofEligible = proofCardCount > 0;

  // Stable keys for flashcards (question text is the natural id here)
  const cardKey = (c: Flashcard, i: number) => `${i}::${c.question}`;

  // Initialize selected cards on first render / when the lecture changes.
  useEffect(() => {
    setSelectedCardKeys(new Set(lecture.flashcards.map((c, i) => cardKey(c, i))));
  }, [lecture.title]);

  const filteredCardCount = useMemo(() => {
    return lecture.flashcards.filter((c, i) =>
      selectedCardKeys.has(cardKey(c, i)) &&
      customLevels.has(c.bloom) &&
      (!formulaMode || !!c.formula?.trim()) &&
      (!stepOrderingMode || (c.steps?.length ?? 0) >= 2) &&
      (!proofMode || c.bloom === "Analyze" || c.bloom === "Evaluate"),
    ).length;
  }, [lecture.flashcards, selectedCardKeys, customLevels, formulaMode, stepOrderingMode, proofMode]);

  const toggleCard = (key: string) => {
    setSelectedCardKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleLevel = (lvl: BloomLevel) => {
    setCustomLevels((prev) => {
      const next = new Set(prev);
      if (next.has(lvl)) next.delete(lvl);
      else next.add(lvl);
      return next;
    });
  };

  const startCustomQuiz = () => {
    const basePool = lecture.flashcards
      .filter(
        (c, i) =>
          selectedCardKeys.has(cardKey(c, i)) &&
          customLevels.has(c.bloom) &&
          (!formulaMode || !!c.formula?.trim()) &&
          (!stepOrderingMode || (c.steps?.length ?? 0) >= 2) &&
          (!proofMode || c.bloom === "Analyze" || c.bloom === "Evaluate"),
      )
      .slice(0, customCount);
    if (!basePool.length) return;
    if (proofMode) {
      setProofCards(basePool);
      setSessionKey((k) => k + 1);
      return;
    }
    if (stepOrderingMode) {
      setStepOrderingCards(basePool);
      setSessionKey((k) => k + 1);
      return;
    }
    const pool = formulaMode
      ? basePool.map((c, idx) => buildFormulaCard(c, idx))
      : basePool;
    const customL: Lecture = { ...lecture, flashcards: pool };
    setCustomLecture(customL);
    setCustomAnswered(1);
    setCard(pool[0]);
    setSessionKey((k) => k + 1);
  };

  useEffect(() => {
    if (initialCard) {
      setCard(initialCard);
      setSessionKey((k) => k + 1);
      onConsumedInitial?.();
    }
  }, [initialCard, onConsumedInitial]);

  const start = (c?: Flashcard | null) => {
    if (mode === "mastery") {
      setMasteryActive(true);
      setSessionKey((k) => k + 1);
      return;
    }
    const next = c ?? pickRandom(lecture);
    if (!next) return;
    setCard(next);
    setSessionKey((k) => k + 1);
  };

  const next = () => {
    if (customLecture) {
      // Custom quiz: walk through pool, exit when count reached.
      if (customAnswered >= customLecture.flashcards.length) {
        setCustomLecture(null);
        setCustomAnswered(0);
        setCard(null);
        return;
      }
      const idx = customAnswered % customLecture.flashcards.length;
      setCard(customLecture.flashcards[idx]);
      setCustomAnswered((n) => n + 1);
      setSessionKey((k) => k + 1);
      return;
    }
    const n = pickRandom(lecture, card ?? undefined);
    if (!n) return;
    setCard(n);
    setSessionKey((k) => k + 1);
  };

  const launchSpecific = (c: Flashcard) => {
    setCard(c);
    setSessionKey((k) => k + 1);
  };

  const exit = () => {
    setCard(null);
    setMasteryActive(false);
    setCustomLecture(null);
    setCustomAnswered(0);
    setStepOrderingCards(null);
    setProofCards(null);
  };

  const ModePill = ({
    value,
    icon: Icon,
    title,
    desc,
  }: {
    value: QuizMode;
    icon: typeof ArrowDown;
    title: string;
    desc: string;
  }) => {
    const active = mode === value;
    return (
      <button
        onClick={() => setMode(value)}
        className={cn(
          "flex flex-1 items-start gap-3 rounded-xl border p-4 text-left transition-all",
          active
            ? "border-primary/50 bg-primary/5 shadow-sm"
            : "border-border bg-card hover:border-primary/30",
        )}
      >
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="space-y-0.5 flex-1 min-w-0">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            {title}
            <InfoTooltip content={modeTooltip[value]} label={`About ${title}`} />
          </span>
          <span className="block text-xs text-muted-foreground">{desc}</span>
        </span>
      </button>
    );
  };

  if (!lecture.flashcards.length) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center">
        <p className="text-sm text-muted-foreground">
          No questions available for this lecture yet.
        </p>
      </div>
    );
  }

  // Active proof-mode session
  if (proofCards) {
    return (
      <ProofModeQuiz
        key={`proof-${sessionKey}`}
        lecture={lecture}
        cards={proofCards}
        onExit={exit}
      />
    );
  }

  // Active step-ordering session
  if (stepOrderingCards) {
    return (
      <StepOrderingQuiz key={`steps-${sessionKey}`} cards={stepOrderingCards} onExit={exit} />
    );
  }

  // Active mastery session
  if (masteryActive) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="inline-flex rounded-lg border border-border bg-card p-1 text-xs">
            <span className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground">
              <Gauge className="mr-1 inline h-3 w-3" />
              {t("Mastery Mode")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FeedbackModeToggle mode={feedbackMode} onChange={setFeedbackMode} />
            <Button variant="ghost" size="sm" onClick={exit}>
              <X className="h-4 w-4" />
              {t("Exit")}
            </Button>
          </div>
        </div>
        <MasteryModeQuiz
          key={`mastery-${sessionKey}`}
          lecture={lecture}
          onExit={exit}
          feedbackMode={feedbackMode}
        />
      </div>
    );
  }

  if (!card) {
    const hardest = pickHardest(lecture);
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-card/60 p-6 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-primary">
            {t("Quiz mode")}
          </p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground inline-flex items-center gap-1.5">
            {t("How do you want to learn today?")}
            <InfoTooltip content={tooltipCopy.bloomTaxonomyQuiz} label="About Bloom's Taxonomy" iconClassName="h-4 w-4" />
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <ModePill
              value="bottom"
              icon={ArrowUp}
              title={t("Bottom Up")}
              desc={t("Build up — earn each Bloom's level in turn.")}
            />
            <ModePill
              value="top"
              icon={ArrowDown}
              title={t("Top Down (Productive Failure)")}
              desc={t("Productive failure — start at Evaluate, scaffold down.")}
            />
            <ModePill
              value="mastery"
              icon={Gauge}
              title={t("Mastery Mode")}
              desc={t("Adaptive stream — difficulty rises with your accuracy.")}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground shadow-glow">
            <Sparkles className="h-5 w-5" />
          </div>
          <h4 className="text-base font-semibold text-foreground">{t("Ready when you are")}</h4>
          <div className="flex justify-center">
            <FeedbackModeToggle mode={feedbackMode} onChange={setFeedbackMode} />
          </div>
          <p className="text-sm text-muted-foreground">
            {mode === "mastery"
              ? t("Mastery Mode adapts to you — start at Remember and climb.")
              : t("We'll pull a question from your flashcards and launch instantly.")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <Button onClick={() => start()} className="bg-gradient-primary">
              <Play className="h-4 w-4" />
              {t("Start Quiz")}
            </Button>
            {mode !== "mastery" && hardest && (
              <Button variant="secondary" onClick={() => start(hardest)}>
                {t("Try the hardest one")}
              </Button>
            )}
          </div>
        </div>

        {/* Advanced Customization */}
        <Collapsible open={customOpen} onOpenChange={setCustomOpen}>
          <div className="rounded-2xl border border-border bg-card shadow-sm">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left"
                aria-expanded={customOpen}
              >
                <div className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">
                    {t("Advanced Customization")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("— pick cards, count, and Bloom's levels")}
                  </span>
                </div>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform",
                    customOpen && "rotate-180",
                  )}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t border-border px-5 py-5 space-y-5">
                {/* Formula Mode */}
                <div
                  className={cn(
                    "flex items-start justify-between gap-3 rounded-xl border p-3 transition-colors",
                    formulaMode
                      ? "border-bloom-apply/50 bg-bloom-apply/5"
                      : "border-border bg-background",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                        formulaMode
                          ? "bg-bloom-apply text-background"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      <FunctionSquare className="h-4 w-4" />
                    </span>
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-foreground">{t("Formula Mode")}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("Quiz only on flashcards with a formula, using formula-specific question patterns (write the formula, identify a variable, pick the right one for a scenario).")}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {t(formulaCount === 1 ? "{n} formula card in this deck." : "{n} formula cards in this deck.").replace("{n}", String(formulaCount))}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={formulaMode}
                    onClick={() =>
                      setFormulaMode((v) => {
                        const next = !v;
                        if (next) { setStepOrderingMode(false); setProofMode(false); }
                        return next;
                      })
                    }
                    className={cn(
                      "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                      formulaMode ? "bg-bloom-apply" : "bg-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform",
                        formulaMode ? "translate-x-5" : "translate-x-0.5",
                      )}
                    />
                  </button>
                </div>

                {/* Step Ordering Mode */}
                <div
                  className={cn(
                    "flex items-start justify-between gap-3 rounded-xl border p-3 transition-colors",
                    stepOrderingMode
                      ? "border-bloom-analyze/50 bg-bloom-analyze/5"
                      : "border-border bg-background",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                        stepOrderingMode
                          ? "bg-bloom-analyze text-background"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      <ListOrdered className="h-4 w-4" />
                    </span>
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-foreground">{t("Step Ordering Mode")}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("Show shuffled steps for a procedure. Drag them into the correct order, then submit to see what you got right and the reasoning behind each step.")}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {t(stepCardCount === 1 ? "{n} step-sequence card in this deck." : "{n} step-sequence cards in this deck.").replace("{n}", String(stepCardCount))}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={stepOrderingMode}
                    onClick={() =>
                      setStepOrderingMode((v) => {
                        const next = !v;
                        if (next) { setFormulaMode(false); setProofMode(false); }
                        return next;
                      })
                    }
                    className={cn(
                      "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                      stepOrderingMode ? "bg-bloom-analyze" : "bg-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform",
                        stepOrderingMode ? "translate-x-5" : "translate-x-0.5",
                      )}
                    />
                  </button>
                </div>

                {/* Proof Mode */}
                {proofEligible ? (
                  <div
                    className={cn(
                      "flex items-start justify-between gap-3 rounded-xl border p-3 transition-colors",
                      proofMode
                        ? "border-bloom-evaluate/50 bg-bloom-evaluate/5"
                        : "border-border bg-background",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                          proofMode
                            ? "bg-bloom-evaluate text-background"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        <ScrollText className="h-4 w-4" />
                      </span>
                      <div className="space-y-0.5">
                        <p className="text-sm font-semibold text-foreground">{t("Proof Mode")}</p>
                        <p className="text-xs text-muted-foreground">
                          {t("Multiple-choice proof drills: justify a step, predict the next line, spot the flaw, or pick the right strategy. Always shows the full explanation, plus the annotated proof at the end.")}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {t(proofCardCount === 1 ? "{n} Analyze/Evaluate card in this deck." : "{n} Analyze/Evaluate cards in this deck.").replace("{n}", String(proofCardCount))}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={proofMode}
                      onClick={() =>
                        setProofMode((v) => {
                          const next = !v;
                          if (next) {
                            setFormulaMode(false);
                            setStepOrderingMode(false);
                          }
                          return next;
                        })
                      }
                      className={cn(
                        "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                        proofMode ? "bg-bloom-evaluate" : "bg-muted",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform",
                          proofMode ? "translate-x-5" : "translate-x-0.5",
                        )}
                      />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 rounded-xl border border-dashed border-border bg-background/40 p-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <ScrollText className="h-4 w-4" />
                    </span>
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-foreground">{t("Proof Mode")}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("This lecture does not contain proof-based content.")}
                      </p>
                    </div>
                  </div>
                )}

                {/* Question count */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {t("Question amount")}
                    </p>
                    <span className="text-sm font-semibold text-foreground">{customCount}</span>
                  </div>
                  <Slider
                    min={0}
                    max={QUESTION_COUNTS.length - 1}
                    step={1}
                    value={[QUESTION_COUNTS.indexOf(customCount as 5 | 10 | 15 | 20)]}
                    onValueChange={(v) => setCustomCount(QUESTION_COUNTS[v[0] ?? 1])}
                  />
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    {QUESTION_COUNTS.map((n) => (
                      <span key={n}>{n}</span>
                    ))}
                  </div>
                </div>

                {/* Bloom level filter */}
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t("Bloom's levels to include")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {BLOOM_LEVELS.map((lvl) => {
                      const checked = customLevels.has(lvl);
                      return (
                        <label
                          key={lvl}
                          className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors",
                            checked
                              ? "border-primary/40 bg-primary/5"
                              : "border-border bg-background hover:border-primary/30",
                          )}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleLevel(lvl)}
                          />
                          <BloomBadge level={lvl} withInfo={false} dotsPosition="after" className="border-0 px-1 py-0" />
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Flashcard selector */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {t("Flashcards ({selected}/{total} selected)")
                        .replace("{selected}", String(selectedCardKeys.size))
                        .replace("{total}", String(lecture.flashcards.length))}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedCardKeys(
                            new Set(lecture.flashcards.map((c, i) => cardKey(c, i))),
                          )
                        }
                        className="text-xs text-primary hover:underline"
                      >
                        {t("Select all")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedCardKeys(new Set())}
                        className="text-xs text-muted-foreground hover:underline"
                      >
                        {t("Clear")}
                      </button>
                    </div>
                  </div>
                  <div className="max-h-56 overflow-y-auto rounded-md border border-border divide-y divide-border">
                    {lecture.flashcards.map((c, i) => {
                      const key = cardKey(c, i);
                      const checked = selectedCardKeys.has(key);
                      return (
                        <label
                          key={key}
                          className="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-muted/40"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleCard(key)}
                            className="mt-0.5"
                          />
                          <span className="flex-1 text-sm text-foreground/90 line-clamp-2">
                            {c.question}
                          </span>
                          <BloomBadge level={c.bloom} withInfo={false} className="shrink-0" />
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <p className="text-xs text-muted-foreground">
                    {(() => {
                      if (filteredCardCount === 0) {
                        if (proofMode) return t("No Analyze/Evaluate flashcards match the current filters.");
                        if (stepOrderingMode) return t("No step-sequence flashcards match the current filters. Create one in the Flashcards tab.");
                        if (formulaMode) return t("No formula flashcards match the current filters. Add a formula in the Flashcards tab.");
                        return t("No cards match the current filters.");
                      }
                      const n = Math.min(customCount, filteredCardCount);
                      const prefix = proofMode
                        ? t("Proof Mode — ")
                        : stepOrderingMode
                        ? t("Step Ordering — ")
                        : formulaMode
                        ? t("Formula Mode — ")
                        : "";
                      const tail = stepOrderingMode
                        ? t(n === 1 ? "Quiz will run on up to {n} problem." : "Quiz will run on up to {n} problems.")
                        : t(n === 1 ? "Quiz will run on up to {n} question." : "Quiz will run on up to {n} questions.");
                      return prefix + tail.replace("{n}", String(n));
                    })()}
                  </p>
                  <Button
                    onClick={startCustomQuiz}
                    disabled={filteredCardCount === 0}
                    className="bg-gradient-primary"
                  >
                    {proofMode ? (
                      <ScrollText className="h-4 w-4" />
                    ) : stepOrderingMode ? (
                      <ListOrdered className="h-4 w-4" />
                    ) : formulaMode ? (
                      <FunctionSquare className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    {proofMode
                      ? t("Start Proof Mode")
                      : stepOrderingMode
                      ? t("Start Step Ordering")
                      : formulaMode
                      ? t("Start Formula Quiz")
                      : t("Generate Custom Quiz")}
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-lg border border-border bg-card p-1 text-xs">
          <button
            onClick={() => setMode("bottom")}
            className={cn(
              "rounded-md px-3 py-1.5 font-medium transition-colors",
              mode === "bottom" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <ArrowUp className="mr-1 inline h-3 w-3" />
            {t("Bottom Up")}
          </button>
          <button
            onClick={() => setMode("top")}
            className={cn(
              "rounded-md px-3 py-1.5 font-medium transition-colors",
              mode === "top" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <ArrowDown className="mr-1 inline h-3 w-3" />
            {t("Top Down")}
          </button>
          <button
            onClick={() => {
              setMode("mastery");
              setMasteryActive(true);
              setSessionKey((k) => k + 1);
            }}
            className={cn(
              "rounded-md px-3 py-1.5 font-medium transition-colors",
              mode === "mastery" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Gauge className="mr-1 inline h-3 w-3" />
            {t("Mastery")}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <FeedbackModeToggle mode={feedbackMode} onChange={setFeedbackMode} />
          <Button variant="ghost" size="sm" onClick={exit}>
            <X className="h-4 w-4" />
            {t("Exit")}
          </Button>
        </div>
      </div>

      {mode === "top" ? (
        <TopDownMasteryQuiz
          key={`top-${sessionKey}`}
          lecture={lecture}
          card={card}
          onNext={next}
          onExit={exit}
          onSelectFollowUp={launchSpecific}
          feedbackMode={feedbackMode}
        />
      ) : (
        <BottomUpQuiz
          key={`bottom-${sessionKey}`}
          lecture={lecture}
          card={card}
          onNext={next}
          onExit={exit}
          onSelectFollowUp={launchSpecific}
          feedbackMode={feedbackMode}
        />
      )}
    </div>
  );
};

export default QuizTab;
