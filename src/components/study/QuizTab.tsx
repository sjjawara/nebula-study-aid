import { useEffect, useMemo, useState } from "react";
import { Sparkles, ArrowDown, ArrowUp, Play, X, Gauge, Settings2, ChevronDown } from "lucide-react";
import type { Lecture, Flashcard, BloomLevel } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BloomBadge } from "@/components/BloomBadge";
import { TopDownMasteryQuiz } from "./TopDownMasteryQuiz";
import { BottomUpQuiz } from "./BottomUpQuiz";
import { MasteryModeQuiz } from "./MasteryModeQuiz";
import { cn } from "@/lib/utils";
import { InfoTooltip, tooltipCopy } from "@/components/InfoTooltip";

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
}) => (
  <div className="inline-flex items-center gap-1.5">
    <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-background p-1 text-xs">
      <span className="px-2 text-muted-foreground">Feedback:</span>
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
          {m === "immediate" ? "Immediate" : "End of Quiz"}
        </button>
      ))}
    </div>
    <InfoTooltip content={tooltipCopy.feedbackMode} label="About feedback timing" />
  </div>
);

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

export const QuizTab = ({ lecture, initialCard, onConsumedInitial }: Props) => {
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

  // Stable keys for flashcards (question text is the natural id here)
  const cardKey = (c: Flashcard, i: number) => `${i}::${c.question}`;

  // Initialize selected cards on first render / when the lecture changes.
  useEffect(() => {
    setSelectedCardKeys(new Set(lecture.flashcards.map((c, i) => cardKey(c, i))));
  }, [lecture.title]);

  const filteredCardCount = useMemo(() => {
    return lecture.flashcards.filter((c, i) =>
      selectedCardKeys.has(cardKey(c, i)) && customLevels.has(c.bloom),
    ).length;
  }, [lecture.flashcards, selectedCardKeys, customLevels]);

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
    const pool = lecture.flashcards
      .filter((c, i) => selectedCardKeys.has(cardKey(c, i)) && customLevels.has(c.bloom))
      .slice(0, customCount);
    if (!pool.length) return;
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

  // Active mastery session
  if (masteryActive) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="inline-flex rounded-lg border border-border bg-card p-1 text-xs">
            <span className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground">
              <Gauge className="mr-1 inline h-3 w-3" />
              Mastery Mode
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FeedbackModeToggle mode={feedbackMode} onChange={setFeedbackMode} />
            <Button variant="ghost" size="sm" onClick={exit}>
              <X className="h-4 w-4" />
              Exit
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
            Quiz mode
          </p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground inline-flex items-center gap-1.5">
            How do you want to learn today?
            <InfoTooltip content={tooltipCopy.bloomTaxonomyQuiz} label="About Bloom's Taxonomy" iconClassName="h-4 w-4" />
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <ModePill
              value="bottom"
              icon={ArrowUp}
              title="Bottom Up"
              desc="Build up — earn each Bloom's level in turn."
            />
            <ModePill
              value="top"
              icon={ArrowDown}
              title="Top Down (Productive Failure)"
              desc="Productive failure — start at Evaluate, scaffold down."
            />
            <ModePill
              value="mastery"
              icon={Gauge}
              title="Mastery Mode"
              desc="Adaptive stream — difficulty rises with your accuracy."
            />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground shadow-glow">
            <Sparkles className="h-5 w-5" />
          </div>
          <h4 className="text-base font-semibold text-foreground">Ready when you are</h4>
          <div className="flex justify-center">
            <FeedbackModeToggle mode={feedbackMode} onChange={setFeedbackMode} />
          </div>
          <p className="text-sm text-muted-foreground">
            {mode === "mastery"
              ? "Mastery Mode adapts to you — start at Remember and climb."
              : "We'll pull a question from your flashcards and launch instantly."}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <Button onClick={() => start()} className="bg-gradient-primary">
              <Play className="h-4 w-4" />
              Start Quiz
            </Button>
            {mode !== "mastery" && hardest && (
              <Button variant="secondary" onClick={() => start(hardest)}>
                Try the hardest one
              </Button>
            )}
          </div>
        </div>
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
            Bottom Up
          </button>
          <button
            onClick={() => setMode("top")}
            className={cn(
              "rounded-md px-3 py-1.5 font-medium transition-colors",
              mode === "top" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <ArrowDown className="mr-1 inline h-3 w-3" />
            Top Down
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
            Mastery
          </button>
        </div>
        <div className="flex items-center gap-2">
          <FeedbackModeToggle mode={feedbackMode} onChange={setFeedbackMode} />
          <Button variant="ghost" size="sm" onClick={exit}>
            <X className="h-4 w-4" />
            Exit
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
