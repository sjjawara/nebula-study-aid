import { useState } from "react";
import { mockLecture } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { BloomBadge } from "@/components/BloomBadge";
import { ChevronLeft, ChevronRight, RotateCw } from "lucide-react";

export const FlashcardsTab = () => {
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = mockLecture.flashcards[i];
  const total = mockLecture.flashcards.length;

  const go = (delta: number) => {
    setFlipped(false);
    setI((prev) => (prev + delta + total) % total);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Card {i + 1} of {total}</span>
        <BloomBadge level={card.bloom} />
      </div>

      <button
        onClick={() => setFlipped((f) => !f)}
        className="group relative w-full min-h-[280px] rounded-2xl border border-border bg-card p-8 shadow-card transition-all hover:border-primary/40 hover:shadow-glow text-left"
      >
        <div className="absolute top-4 right-4 text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <RotateCw className="h-3 w-3" />
          {flipped ? "Answer" : "Question"}
        </div>
        <div className="flex h-full min-h-[220px] items-center justify-center">
          <p className="text-xl leading-relaxed text-center text-foreground">
            {flipped ? card.answer : card.question}
          </p>
        </div>
      </button>

      <div className="flex items-center justify-center gap-3">
        <Button variant="secondary" size="icon" onClick={() => go(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="secondary" onClick={() => setFlipped((f) => !f)}>
          Flip card
        </Button>
        <Button variant="secondary" size="icon" onClick={() => go(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
