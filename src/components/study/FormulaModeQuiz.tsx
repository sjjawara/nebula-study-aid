import { useState, useEffect } from "react";
import { Loader2, Calculator, X, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Flashcard } from "@/lib/mockData";

const API_BASE = "https://nebulalearn-production.up.railway.app";

export const FormulaModeQuiz = ({ cards, onExit }: { cards: Flashcard[]; onExit: () => void }) => {
  const [loading, setLoading] = useState(true);
  const [quizData, setQuizData] = useState<{ questions: Array<{ type?: string; question: string; answer: string }> } | null>(
    null,
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [userScratchpad, setUserScratchpad] = useState("");

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

  const handleNext = () => {
    if (currentIndex < total - 1) {
      setCurrentIndex((prev) => prev + 1);
      setShowAnswer(false);
      setUserScratchpad("");
    } else {
      onExit();
    }
  };

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
            className="min-h-[120px] resize-none"
          />
          <Button className="w-full" onClick={() => setShowAnswer(true)}>
            Reveal Solution
          </Button>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <div className="p-4 bg-muted rounded-xl border-l-4 border-primary">
            <p className="text-sm font-semibold mb-2 text-muted-foreground">Correct Solution:</p>
            <p className="whitespace-pre-wrap">{currentQ.answer}</p>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <Button
              variant="outline"
              className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleNext}
            >
              <XCircle className="w-4 h-4 mr-2" /> Missed It
            </Button>
            <Button
              variant="outline"
              className="flex-1 text-green-600 hover:text-green-600 hover:bg-green-500/10"
              onClick={handleNext}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" /> Got It
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
