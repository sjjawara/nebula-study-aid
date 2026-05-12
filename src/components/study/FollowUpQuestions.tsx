import { useMemo } from "react";
import { ArrowUpRight, Sparkles } from "lucide-react";
import type { Lecture, Flashcard, BloomLevel } from "@/lib/mockData";
import { BloomBadge } from "@/components/BloomBadge";

const ORDER: BloomLevel[] = [
  "Remember",
  "Understand",
  "Apply",
  "Analyze",
  "Evaluate",
  "Create",
];

const nextLevel = (b: BloomLevel): BloomLevel => {
  const i = ORDER.indexOf(b);
  return ORDER[Math.min(ORDER.length - 1, i + 1)];
};

const stems: Record<BloomLevel, (topic: string) => string> = {
  Remember: (t) => `Recall the key fact behind "${t}".`,
  Understand: (t) => `In your own words, explain "${t}".`,
  Apply: (t) => `How would you apply "${t}" to a new scenario?`,
  Analyze: (t) => `Break down the components and relationships in "${t}".`,
  Evaluate: (t) => `Defend or critique a claim about "${t}".`,
  Create: (t) => `Design a novel example or extension of "${t}".`,
};

const dedupe = <T,>(arr: T[], key: (v: T) => string): T[] => {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const v of arr) {
    const k = key(v);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
};

interface Props {
  lecture: Lecture;
  current: Flashcard;
  onSelect: (card: Flashcard) => void;
}

export const FollowUpQuestions = ({ lecture, current, onSelect }: Props) => {
  const target = useMemo(() => nextLevel(current.bloom), [current.bloom]);

  const suggestions = useMemo<Flashcard[]>(() => {
    // 1) prefer real flashcards already at the target level
    const direct = lecture.flashcards.filter(
      (f) => f.bloom === target && f.question !== current.question,
    );

    // 2) synthesize from search index moments (topic / keywords)
    const synth: Flashcard[] = (lecture.searchIndex ?? [])
      .filter((m) => m.topic && m.topic !== current.question)
      .map((m) => {
        const topic = m.topic ?? (m.keywords?.[0] ?? "this concept");
        return {
          question: stems[target](topic),
          answer: m.excerpt || topic,
          bloom: target,
          timestamp: m.timestamp,
        } satisfies Flashcard;
      });

    // 3) synthesize from outline as a last resort
    const fromOutline: Flashcard[] = lecture.outline
      .filter((o) => o.topic)
      .map((o) => ({
        question: stems[target](o.topic),
        answer: o.topic,
        bloom: target,
        timestamp: o.timestamp,
      }));

    const combined = dedupe(
      [...direct, ...synth, ...fromOutline],
      (f) => f.question.toLowerCase(),
    );
    return combined.slice(0, 3);
  }, [lecture, current, target]);

  if (!suggestions.length) return null;

  return (
    <div className="animate-fade-in rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Ready to go deeper?
            </p>
            <p className="text-xs text-muted-foreground">
              Try a follow-up at the next Bloom's level.
            </p>
          </div>
        </div>
        <BloomBadge level={target} />
      </div>
      <ul className="space-y-2">
        {suggestions.map((s, i) => (
          <li key={`${s.timestamp ?? ""}-${i}`}>
            <button
              onClick={() => onSelect(s)}
              className="group flex w-full items-start gap-3 rounded-xl border border-border bg-background p-3 text-left transition-all hover:border-primary/40 hover:bg-primary/5"
            >
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors group-hover:border-primary/40 group-hover:text-primary">
                <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
              <span className="flex-1 text-sm text-foreground">
                {s.question}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default FollowUpQuestions;
