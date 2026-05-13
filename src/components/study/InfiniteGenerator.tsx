import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { BloomLevel, Flashcard } from "@/lib/mockData";

interface Props {
  topic: string;
  bloomLevel: string;
  lectureContext: string;
  onCardsGenerated: (newCards: Flashcard[]) => void;
}

const normalizeBloom = (v: unknown): BloomLevel => {
  const s = String(v ?? "").trim().toLowerCase();
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

const parseFlashcards = (raw: unknown): Flashcard[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const o = item as Record<string, unknown>;
      const bloomRaw = o.bloom_level ?? o.bloom;
      return {
        question: String(o.question ?? ""),
        answer: String(o.answer ?? ""),
        bloom: normalizeBloom(bloomRaw),
        formula: typeof o.formula === "string" ? o.formula : undefined,
        timestamp: typeof o.timestamp === "string" ? o.timestamp : undefined,
      };
    })
    .filter((c) => c.question && c.answer);
};

export const InfiniteGenerator = ({ topic, bloomLevel, lectureContext, onCardsGenerated }: Props) => {
  const [loading, setLoading] = useState(false);

  const generateMore = async () => {
    setLoading(true);
    try {
      const response = await fetch("https://nebulalearn-production.up.railway.app/generate-flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          bloom_level: bloomLevel,
          lecture_context: lectureContext,
          count: 5,
        }),
      });

      if (!response.ok) throw new Error("Failed to generate");
      const data = await response.json();
      const cards = parseFlashcards(data.flashcards);
      if (!cards.length) throw new Error("Empty response");

      onCardsGenerated(cards);
      toast.success(`Generated 5 new ${bloomLevel} cards!`);
    } catch {
      toast.error("Failed to generate more cards. Check backend logs.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={generateMore}
      disabled={loading || !lectureContext.trim()}
      variant="outline"
      className="w-full border-dashed border-primary/50 hover:border-primary hover:bg-primary/5 gap-2 h-12"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Sparkles className="h-4 w-4 text-primary" />
      )}
      {loading ? "Vibecoding New Cards..." : `Generate More ${bloomLevel} Cards`}
    </Button>
  );
};
