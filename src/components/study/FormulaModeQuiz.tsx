import { useState, useEffect } from "react";
import { Loader2, FunctionSquare, X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BloomLevel, Lecture, Flashcard } from "@/lib/mockData";
import { BloomBadge } from "@/components/BloomBadge";

const API_BASE = "https://nebulalearn-production.up.railway.app";

type FormulaQuestion = {
  type?: string;
  question: string;
  answer: string;
  bloom_level?: string;
};

interface Props {
  lecture: Lecture;
  cards: Flashcard[];
  onExit: () => void;
}

const toBloomLevel = (raw: string | undefined): BloomLevel => {
  const s = String(raw ?? "")
    .trim()
    .replace(/_/g, " ")
    .toLowerCase();
  const map: Record<string, BloomLevel> = {
    remember: "Remember",
    understand: "Understand",
    apply: "Apply",
    analyze: "Analyze",
    analyse: "Analyze",
    evaluate: "Evaluate",
    create: "Create",
  };
  return map[s] ?? "Understand";
};

export const FormulaModeQuiz = ({ lecture, cards, onExit }: Props) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<FormulaQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const card = cards[0];
  const formula = card?.formula?.trim();

  useEffect(() => {
    if (!card || !formula) {
      setLoading(false);
      setError("No formula on this card.");
      return;
    }
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/generate-formula-quiz`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            formula_name: card.question.replace(/[?.!]+$/, "").trim().slice(0, 200),
            formula,
            topic: lecture.title,
            lecture_context: lecture.summaries.full || lecture.summaries.medium,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        const qs = Array.isArray(data.questions) ? data.questions : [];
        if (cancelled) return;
        setQuestions(qs);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Request failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [card, formula, lecture.summaries.full, lecture.summaries.medium, lecture.title]);

  const q = questions[idx];
  const atEnd = idx >= questions.length - 1;

  const advance = () => {
    setRevealed(false);
    if (atEnd) onExit();
    else setIdx((i) => i + 1);
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-20 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <p className="mt-3 text-sm text-muted-foreground">Loading formula quiz…</p>
      </div>
    );
  }

  if (error || !q) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 space-y-4">
        <div className="flex justify-between">
          <h3 className="font-bold inline-flex items-center gap-2">
            <FunctionSquare className="h-4 w-4" /> Formula mode
          </h3>
          <Button variant="ghost" size="sm" onClick={onExit}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm text-destructive">{error ?? "No questions returned."}</p>
        <Button onClick={onExit}>Exit</Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
      <div className="flex justify-between items-start gap-3">
        <div>
          <h3 className="font-bold inline-flex items-center gap-2">
            <FunctionSquare className="h-4 w-4 text-bloom-apply" /> Formula mode
          </h3>
          <p className="text-xs text-muted-foreground mt-1 font-mono">{formula}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onExit}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>
          Question {idx + 1} / {questions.length}
        </span>
        {q.bloom_level && <BloomBadge level={toBloomLevel(q.bloom_level)} withInfo={false} className="text-[10px]" />}
      </div>

      {q.type && (
        <span className="inline-block rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          {q.type}
        </span>
      )}

      <p className="text-base font-medium text-foreground leading-relaxed">{q.question}</p>

      {revealed ? (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm text-foreground whitespace-pre-wrap">
          {q.answer}
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setRevealed(true)} className="w-full sm:w-auto">
          Reveal answer
        </Button>
      )}

      <div className="flex flex-wrap gap-2 pt-2">
        {revealed && (
          <Button className="bg-gradient-primary" onClick={advance}>
            {atEnd ? "Finish" : "Next"}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};
