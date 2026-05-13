import { useState, useEffect } from "react";
import { Loader2, ListOrdered, X, RotateCcw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Flashcard } from "@/lib/mockData";

const API_BASE = "https://nebulalearn-production.up.railway.app";

export const StepOrderingQuiz = ({ cards, onExit }: { cards: Flashcard[]; onExit: () => void }) => {
  const [loading, setLoading] = useState(true);
  const [problemData, setProblemData] = useState<{ problem: string; steps: string[] } | null>(null);
  const [availableSteps, setAvailableSteps] = useState<string[]>([]);
  const [selectedSteps, setSelectedSteps] = useState<string[]>([]);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  useEffect(() => {
    const fetchSteps = async () => {
      const res = await fetch(`${API_BASE}/generate-steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem: cards[0].question,
          lecture_context: cards[0].answer,
          topic: "Current Lecture",
        }),
      });
      const data = await res.json();
      setProblemData(data);
      if (Array.isArray(data.steps)) {
        setAvailableSteps([...data.steps].sort(() => Math.random() - 0.5));
      }
      setLoading(false);
    };
    fetchSteps();
  }, [cards]);

  const handleSelect = (step: string) => {
    setAvailableSteps((prev) => prev.filter((s) => s !== step));
    setSelectedSteps((prev) => [...prev, step]);
  };

  const handleDeselect = (step: string) => {
    setSelectedSteps((prev) => prev.filter((s) => s !== step));
    setAvailableSteps((prev) => [...prev, step]);
  };

  const checkAnswer = () => {
    if (!problemData?.steps) return;
    const correct = JSON.stringify(selectedSteps) === JSON.stringify(problemData.steps);
    setIsCorrect(correct);
  };

  if (loading) {
    return (
      <div className="p-20 text-center">
        <Loader2 className="mx-auto animate-spin" />
      </div>
    );
  }

  if (!problemData) {
    return (
      <div className="p-6 bg-card border rounded-2xl">
        <p className="text-sm text-muted-foreground">Could not load steps.</p>
        <Button className="mt-4" onClick={onExit}>
          Exit
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 bg-card border rounded-2xl">
      <div className="flex justify-between mb-4">
        <h3 className="font-bold inline-flex items-center gap-2">
          <ListOrdered className="h-4 w-4" /> Build the Sequence
        </h3>
        <Button variant="ghost" size="sm" onClick={onExit}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <p className="mb-6 text-lg font-medium">{problemData.problem}</p>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2 p-4 bg-muted/50 rounded-xl border">
          <h4 className="text-sm font-semibold mb-3 text-muted-foreground">Available Steps (Click to add)</h4>
          {availableSteps.map((step, i) => (
            <div
              key={`avail-${i}-${step.slice(0, 24)}`}
              role="button"
              tabIndex={0}
              onClick={() => handleSelect(step)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleSelect(step);
                }
              }}
              className="p-3 bg-background rounded-lg border cursor-pointer hover:border-primary transition-colors text-sm"
            >
              {step}
            </div>
          ))}
          {availableSteps.length === 0 && (
            <p className="text-xs text-center text-muted-foreground py-4">All steps selected</p>
          )}
        </div>

        <div className="space-y-2 p-4 bg-muted/50 rounded-xl border border-primary/20">
          <h4 className="text-sm font-semibold mb-3 text-primary">Your Sequence (Click to remove)</h4>
          {selectedSteps.map((step, i) => (
            <div
              key={`sel-${i}-${step.slice(0, 24)}`}
              role="button"
              tabIndex={0}
              onClick={() => handleDeselect(step)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleDeselect(step);
                }
              }}
              className="p-3 bg-primary/10 rounded-lg border border-primary/30 cursor-pointer hover:bg-destructive/10 hover:border-destructive transition-colors text-sm flex gap-3"
            >
              <span className="font-bold text-primary">{i + 1}.</span> {step}
            </div>
          ))}
        </div>
      </div>

      {isCorrect !== null && (
        <div
          className={`mt-6 p-4 rounded-xl font-medium ${isCorrect ? "bg-green-500/20 text-green-700" : "bg-red-500/20 text-red-700"}`}
        >
          {isCorrect
            ? "Perfect! That is the correct logical sequence."
            : "Not quite. Check your order and try again."}
        </div>
      )}

      <div className="flex gap-3 mt-6">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            setSelectedSteps([]);
            setAvailableSteps([...(problemData.steps ?? [])].sort(() => Math.random() - 0.5));
            setIsCorrect(null);
          }}
        >
          <RotateCcw className="w-4 h-4 mr-2" /> Reset
        </Button>
        <Button className="w-full bg-primary" onClick={checkAnswer} disabled={availableSteps.length > 0}>
          <Check className="w-4 h-4 mr-2" /> Check Order
        </Button>
      </div>
    </div>
  );
};
