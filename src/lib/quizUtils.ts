import type { Flashcard, Lecture, BloomLevel } from "./mockData";

export const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * Pick high-quality MCQ distractors:
 * - Prefer answers from the same Bloom level (similar conceptual depth)
 * - Prefer distractors of similar length to the correct answer
 *   (so the correct answer isn't the "longest / most specific" tell)
 * - Drop near-duplicates of the correct answer
 */
export const pickDistractors = (
  lecture: Lecture,
  card: Flashcard,
  count = 3,
): string[] => {
  const correct = card.answer.trim();
  const correctNorm = correct.toLowerCase();
  const correctLen = correct.length;

  const pool = lecture.flashcards
    .filter((f) => {
      const a = f.answer.trim();
      if (!a) return false;
      const an = a.toLowerCase();
      if (an === correctNorm) return false;
      // Drop trivially-contained duplicates
      if (an.length > 6 && (correctNorm.includes(an) || an.includes(correctNorm))) return false;
      return true;
    })
    .map((f) => ({ text: f.answer.trim(), bloom: f.bloom }));

  const sameBloom = pool.filter((p) => p.bloom === card.bloom);
  const otherBloom = pool.filter((p) => p.bloom !== card.bloom);

  const ranked = [...sameBloom, ...otherBloom].sort(
    (a, b) =>
      Math.abs(a.text.length - correctLen) - Math.abs(b.text.length - correctLen),
  );

  // Take a wider candidate set then randomize within it so it isn't always the
  // exact same three options.
  const candidates = ranked.slice(0, Math.max(count * 3, 6));
  return shuffle(candidates).slice(0, count).map((c) => c.text);
};

/**
 * Build a True/False statement for a card. Randomly returns either the real
 * answer (correctValue=true) or another lecture answer presented as if it
 * answered the same question (correctValue=false). Distractor statements are
 * length-matched so length isn't the giveaway.
 */
export const buildTrueFalseStatement = (
  lecture: Lecture,
  card: Flashcard,
): { statement: string; correctValue: boolean } => {
  const showTrue = Math.random() < 0.5;
  if (showTrue) return { statement: card.answer, correctValue: true };

  const distractors = pickDistractors(lecture, card, 5);
  const fallback = distractors[0];
  if (!fallback) return { statement: card.answer, correctValue: true };
  return { statement: fallback, correctValue: false };
};

export const BLOOM_ORDER: BloomLevel[] = [
  "Remember",
  "Understand",
  "Apply",
  "Analyze",
  "Evaluate",
  "Create",
];

export const pickCardForLevel = (
  lecture: Lecture,
  level: BloomLevel,
  exclude?: Set<string>,
): Flashcard | null => {
  const used = exclude ?? new Set<string>();
  const exact = lecture.flashcards.filter((f) => f.bloom === level && !used.has(f.question));
  if (exact.length) return exact[Math.floor(Math.random() * exact.length)];

  // Fallback to nearest-level card
  const idx = BLOOM_ORDER.indexOf(level);
  for (let r = 1; r < BLOOM_ORDER.length; r++) {
    for (const dir of [-1, 1]) {
      const ni = idx + dir * r;
      if (ni < 0 || ni >= BLOOM_ORDER.length) continue;
      const near = lecture.flashcards.filter(
        (f) => f.bloom === BLOOM_ORDER[ni] && !used.has(f.question),
      );
      if (near.length) return near[Math.floor(Math.random() * near.length)];
    }
  }
  const remaining = lecture.flashcards.filter((f) => !used.has(f.question));
  return remaining[0] ?? lecture.flashcards[0] ?? null;
};
