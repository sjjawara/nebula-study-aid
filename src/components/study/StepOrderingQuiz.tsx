import { useState, useEffect } from "react";
import { Loader2, ListOrdered, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Flashcard } from "@/lib/mockData";

const API_BASE = "https://nebulalearn-production.up.railway.app";

export const StepOrderingQuiz = ({ cards, onExit }: { cards: Flashcard[], onExit: () => void }) => {
  const [loading, setLoading] = useState(true);
  const [problemData, setProblemData] = useState<any>(null);

  useEffect(() => {
    const fetchSteps = async () => {
      const res = await fetch(`${API_BASE}/generate-steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem: cards[0].question,
          lecture_context: cards[0].answer,
          topic: "Current Lecture"
        })
      });
      const data = await res.json();
      setProblemData(data);
      setLoading(false);
    };
    fetchSteps();
  }, [cards]);

  if (loading) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto" /></div>;

  return (
    <div className="p-6 bg-card border rounded-2xl">
      <div className="flex justify-between mb-4">
        <h3 className="font-bold inline-flex items-center gap-2"><ListOrdered className="h-4 w-4"/> Step Ordering</h3>
        <Button variant="ghost" size="sm" onClick={onExit}><X /></Button>
      </div>
      <p className="mb-4 text-lg">{problemData.problem}</p>
      <div className="space-y-2">
        {problemData.steps.map((step: string, i: number) => (
          <div key={i} className="p-3 bg-muted rounded-lg border border-dashed border-primary/30">
            {step}
          </div>
        ))}
      </div>
      <Button className="w-full mt-6 bg-gradient-primary" onClick={onExit}>I understand this sequence</Button>
    </div>
  );
};