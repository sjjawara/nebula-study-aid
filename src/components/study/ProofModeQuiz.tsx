import { useState, useEffect } from "react";
import { Loader2, ScrollText, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Lecture, Flashcard } from "@/lib/mockData";

export const ProofModeQuiz = ({ lecture, cards, onExit }: { lecture: Lecture, cards: Flashcard[], onExit: () => void }) => {
  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState<any>(null);

  useEffect(() => {
    const fetchProof = async () => {
      const res = await fetch("https://nebulalearn-production.up.railway.app/generate-proof-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theorem: cards[0].question,
          proof_context: cards[0].answer,
          topic: lecture.title,
          lecture_context: lecture.summaries.full
        })
      });
      const data = await res.json();
      setQuiz(data);
      setLoading(false);
    };
    fetchProof();
  }, [cards, lecture]);

  if (loading) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto" /></div>;

  return (
    <div className="p-6 bg-card border rounded-2xl space-y-4">
       <div className="flex justify-between">
        <h3 className="font-bold inline-flex items-center gap-2"><ScrollText className="h-4 w-4"/> Proof Analysis</h3>
        <Button variant="ghost" size="sm" onClick={onExit}><X /></Button>
      </div>
      <div className="p-4 bg-muted rounded-xl italic border-l-4 border-primary">{quiz.theorem}</div>
      {quiz.questions.map((q: any, i: number) => (
        <div key={i} className="space-y-2 border-t pt-4">
          <p className="font-semibold text-sm">{q.question}</p>
          <div className="grid gap-2">
            {q.options.map((opt: any, j: number) => (
              <Button key={j} variant="outline" className="justify-start text-left h-auto py-3 px-4">
                {opt.text}
              </Button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};