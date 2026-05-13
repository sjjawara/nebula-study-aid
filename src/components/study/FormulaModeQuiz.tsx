import { useState, useEffect } from "react";
import { Loader2, Calculator, X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Flashcard } from "@/lib/mockData";

const API_BASE = "https://nebulalearn-production.up.railway.app";

type FormulaQuestion = { type?: string; question: string; answer: string };

type AiFeedback = {
  score?: string;
  feedback?: string;
  what_was_wrong?: string;
};

export const FormulaModeQuiz = ({ cards, onExit }: { cards: Flashcard[]; onExit: () => void }) => {
  const [loading, setLoading] = useState(true);
  const [quizData, setQuizData] = useState<{ questions: FormulaQuestion[] } | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [userScratchpad, setUserScratchpad] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<AiFeedback | null>(null);

  useEffect(() => {
    const card = cards[0];
    if (!card) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const fetchFormula = async () => {
      try {
        const res = await fetch(`${API_BASE}/generate-formula-quiz`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            formula_name: card.question,
            formula: card.formula || "Context formula",
            topic: "Current Module",
            lecture_context: card.answer,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        if (!cancelled) setQuizData(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchFormula();
    return () => {
      cancelled = true;
    };
  }, [cards]);

  if (loading) {
    return (
      <div className="p-20 text-center">
        <Loader2 className="mx-auto animate-spin" />
      </div>
    );
  }

  const questions = quizData?.questions;
  if (!questions?.length) {
    return (
      <div className="p-6 bg-card border rounded-2xl max-w-2xl mx-auto">
        <p className="text-sm text-muted-foreground">No formula questions returned.</p>
        <Button className="mt-4" onClick={onExit}>
          Exit
        </Button>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const total = questions.length;

  const handleEvaluate = async () => {
    if (!userScratchpad.trim()) return;
    setEvaluating(true);
    try {
      const res = await fetch(`${API_BASE}/evaluate-response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: currentQ.question,
          response: userScratchpad,
          topic: "Formula Application",
        }),
      });
      const data = await res.json();
      setAiFeedback(data);
      setShowAnswer(true);
    } catch (e) {
      console.error(e);
      setShowAnswer(true);
    } finally {
      setEvaluating(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < total - 1) {
      setCurrentIndex((prev) => prev + 1);
      setShowAnswer(false);
      setUserScratchpad("");
      setAiFeedback(null);
    } else {
      onExit();
    }
  };

  const scoreLabel = String(aiFeedback?.score ?? "");
  const positiveScore =
    scoreLabel.includes("Strong") || scoreLabel.includes("Proficient");

  return (
    <div className="p-6 bg-card border rounded-2xl max-w-2xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <h3 className="font-bold inline-flex items-center gap-2">
          <Calculator className="h-4 w-4" /> Formula Drill
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            Step {currentIndex + 1} of {total}
          </span>
          <Button variant="ghost" size="sm" onClick={onExit}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mb-6 space-y-4">
        <span className="text-xs font-bold uppercase tracking-wider text-primary">
          {(currentQ.type ?? "Question").toString()} Check
        </span>
        <h2 className="text-xl font-medium">{currentQ.question}</h2>
      </div>

      {!showAnswer ? (
        <div className="space-y-4">
          <Textarea
            placeholder="Work out your answer here..."
            value={userScratchpad}
            onChange={(e) => setUserScratchpad(e.target.value)}
            className="min-h-[120px] resize-none bg-background border-primary/20 focus-visible:ring-primary/50"
          />
          <Button className="w-full" onClick={handleEvaluate} disabled={evaluating}>
            {evaluating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {evaluating ? "AI is reviewing your work..." : "Submit for AI Review"}
          </Button>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          {aiFeedback && (
            <div
              className={`p-4 rounded-xl border ${
                positiveScore ? "bg-green-500/10 border-green-500/30" : "bg-orange-500/10 border-orange-500/30"
              }`}
            >
              <div className="flex justify-between items-center mb-2 gap-2">
                <h4 className="font-bold">AI Feedback</h4>
                <span className="text-xs font-semibold uppercase shrink-0">{aiFeedback.score}</span>
              </div>
              <p className="text-sm mb-3">{aiFeedback.feedback}</p>
              {aiFeedback.what_was_wrong && aiFeedback.what_was_wrong !== "None — fully correct" && (
                <div className="text-sm border-t pt-2 mt-2 border-orange-500/20">
                  <span className="font-semibold text-orange-600 dark:text-orange-400">Correction: </span>
                  {aiFeedback.what_was_wrong}
                </div>
              )}
            </div>
          )}

          <div className="p-4 bg-muted rounded-xl border-l-4 border-primary/50">
            <p className="text-sm font-semibold mb-2 text-muted-foreground">Official Solution:</p>
            <p className="whitespace-pre-wrap text-sm">{currentQ.answer}</p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleNext}>
              Next Step <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
