import { useEffect, useState } from "react";
import { Sparkles, ArrowDown, ArrowUp, Play, X, Gauge } from "lucide-react";
import type { Lecture, Flashcard } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { TopDownMasteryQuiz } from "./TopDownMasteryQuiz";
import { BottomUpQuiz } from "./BottomUpQuiz";
import { MasteryModeQuiz } from "./MasteryModeQuiz";
import { cn } from "@/lib/utils";

export type QuizMode = "bottom" | "top" | "mastery";

interface Props {
  lecture: Lecture;
  initialCard?: Flashcard | null;
  onConsumedInitial?: () => void;
}

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
  const [card, setCard] = useState<Flashcard | null>(null);
  const [sessionKey, setSessionKey] = useState(0);
  const [masteryActive, setMasteryActive] = useState(false);

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
        <span className="space-y-0.5">
          <span className="block text-sm font-semibold text-foreground">{title}</span>
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
          <Button variant="ghost" size="sm" onClick={exit}>
            <X className="h-4 w-4" />
            Exit
          </Button>
        </div>
        <MasteryModeQuiz key={`mastery-${sessionKey}`} lecture={lecture} onExit={exit} />
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
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
            How do you want to learn today?
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
              title="Top Down"
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
        <Button variant="ghost" size="sm" onClick={exit}>
          <X className="h-4 w-4" />
          Exit
        </Button>
      </div>

      {mode === "top" ? (
        <TopDownMasteryQuiz
          key={`top-${sessionKey}`}
          lecture={lecture}
          card={card}
          onNext={next}
          onExit={exit}
          onSelectFollowUp={launchSpecific}
        />
      ) : (
        <BottomUpQuiz
          key={`bottom-${sessionKey}`}
          lecture={lecture}
          card={card}
          onNext={next}
          onExit={exit}
          onSelectFollowUp={launchSpecific}
        />
      )}
    </div>
  );
};

export default QuizTab;
