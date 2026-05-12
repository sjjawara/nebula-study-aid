import { useState } from "react";
import type { Lecture, Flashcard } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { BloomBadge } from "@/components/BloomBadge";
import { ChevronLeft, ChevronRight, RotateCw, Sparkles } from "lucide-react";

interface FlashcardsTabProps {
  lecture: Lecture;
  onQuizCard?: (card: Flashcard) => void;
}

export const FlashcardsTab = ({ lecture, onQuizCard }: FlashcardsTabProps) => {
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const total = lecture.flashcards.length;

  if (total === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No flashcards available.</p>;
  }

  const card = lecture.flashcards[i % total];

  const go = (delta: number) => {
    setFlipped(false);
    setI((prev) => (prev + delta + total) % total);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>Card {i + 1} of {total}{card.timestamp ? ` · ${card.timestamp}` : ""}</span>
        <div className="flex items-center gap-2">
          {onQuizCard && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onQuizCard(card)}
              className="h-7 gap-1 text-xs"
            >
              <Sparkles className="h-3 w-3" />
              Quiz me on this
            </Button>
          )}
          <BloomBadge level={card.bloom} />
        </div>
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
