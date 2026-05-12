import type { Flashcard, Lecture, BloomLevel } from "./mockData";

const STOP_WORDS = new Set([
  "the","a","an","is","are","was","were","of","to","in","on","for","and","or",
  "by","with","as","at","be","that","this","these","those","it","its","from",
  "which","what","who","how","why","when","where","do","does","did","can","will",
  "would","should","could","than","then","into","about","over","under","between",
  "you","your","we","they","i","not","no","but","so","if","also","other","such",
]);

const tokenize = (s: string): string[] =>
  s.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter(Boolean);

const contentTokens = (s: string): string[] =>
  tokenize(s).filter((t) => t.length > 2 && !STOP_WORDS.has(t));

/** True if the question stem leaks the answer (contains it, or shares most of its content tokens). */
export const questionLeaksAnswer = (question: string, answer: string): boolean => {
  const q = question.toLowerCase();
  const a = answer.trim().toLowerCase();
  if (!a) return false;
  if (a.length >= 6 && q.includes(a)) return true;
  const ansTokens = contentTokens(answer);
  if (ansTokens.length === 0) return false;
  const qTokens = new Set(contentTokens(question));
  const overlap = ansTokens.filter((t) => qTokens.has(t)).length;
  // If most of the answer's keywords already appear in the stem, it's a giveaway.
  return ansTokens.length >= 3 && overlap / ansTokens.length >= 0.7;
};

/** True if a string reads as a single, atomic claim (good for True/False). */
export const isSingleClaim = (text: string): boolean => {
  const t = text.trim();
  if (!t) return false;
  if (t.length > 220) return false;
  if (/[;:]|\b(and also|as well as|whereas|however)\b/i.test(t)) return false;
  // More than two sentences = compound
  const sentences = t.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length > 2) return false;
  // Multiple coordinating " and " clauses → likely compound
  const ands = (t.match(/\b and \b/gi) || []).length;
  if (ands >= 2) return false;
  return true;
};

/** A flashcard is "clean" if the stem doesn't leak the answer and both sides are non-trivial. */
export const isCleanFlashcard = (card: Flashcard): boolean => {
  const q = card.question?.trim() ?? "";
  const a = card.answer?.trim() ?? "";
  if (q.length < 8 || a.length < 2) return false;
  if (questionLeaksAnswer(q, a)) return false;
  return true;
};

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
  const correctTokens = new Set(contentTokens(correct));
  const questionTokens = new Set(contentTokens(card.question));

  const pool = lecture.flashcards
    .filter((f) => {
      const a = f.answer.trim();
      if (!a) return false;
      const an = a.toLowerCase();
      if (an === correctNorm) return false;
      // Drop trivially-contained duplicates
      if (an.length > 6 && (correctNorm.includes(an) || an.includes(correctNorm))) return false;
      // Drop wildly off-topic distractors — must share at least one
      // content keyword with the question OR the correct answer to feel plausible.
      const aTokens = contentTokens(a);
      const sharesContext =
        aTokens.some((t) => questionTokens.has(t) || correctTokens.has(t));
      if (!sharesContext) return false;
      // Length sanity: discard distractors more than 2.5x or less than 0.4x correct length
      if (a.length > correctLen * 2.5 + 20) return false;
      if (correctLen > 20 && a.length < correctLen * 0.4) return false;
      return true;
    })
    .map((f) => ({ text: f.answer.trim(), bloom: f.bloom }));

  const sameBloom = pool.filter((p) => p.bloom === card.bloom);
  const otherBloom = pool.filter((p) => p.bloom !== card.bloom);

  const ranked = [...sameBloom, ...otherBloom].sort(
    (a, b) =>
      Math.abs(a.text.length - correctLen) - Math.abs(b.text.length - correctLen),
  );

  const candidates = ranked.slice(0, Math.max(count * 3, 6));
  return shuffle(candidates).slice(0, count).map((c) => c.text);
};

/**
 * Build a True/False statement for a card. The statement is presented as a
 * proposed answer to the card's actual question (which the caller should also
 * render) so the claim is self-contained and unambiguous.
 *
 * Only single-claim answers are used — compound or multi-sentence answers are
 * skipped so the True/False question tests one clear assertion.
 */
export const buildTrueFalseStatement = (
  lecture: Lecture,
  card: Flashcard,
): { question: string; statement: string; correctValue: boolean } => {
  const correctIsAtomic = isSingleClaim(card.answer);

  // Try to source a single-claim distractor that contextually fits the question.
  const distractors = pickDistractors(lecture, card, 6).filter(isSingleClaim);

  const showTrue = correctIsAtomic ? Math.random() < 0.5 : false;

  if (showTrue) {
    return { question: card.question, statement: card.answer, correctValue: true };
  }

  const fallback = distractors[0];
  if (fallback) {
    return { question: card.question, statement: fallback, correctValue: false };
  }
  // No good false statement available — fall back to truthful presentation.
  return { question: card.question, statement: card.answer, correctValue: true };
};

export const BLOOM_ORDER: BloomLevel[] = [
  "Remember",
  "Understand",
  "Apply",
  "Analyze",
  "Evaluate",
  "Create",
];

/**
 * Pick a flashcard for a given Bloom level, silently skipping cards that fail
 * quality validation (stem leaks the answer, etc.).
 */
export const pickCardForLevel = (
  lecture: Lecture,
  level: BloomLevel,
  exclude?: Set<string>,
): Flashcard | null => {
  const used = exclude ?? new Set<string>();
  const isUsable = (f: Flashcard) => !used.has(f.question) && isCleanFlashcard(f);

  const exact = lecture.flashcards.filter((f) => f.bloom === level && isUsable(f));
  if (exact.length) return exact[Math.floor(Math.random() * exact.length)];

  // Fallback to nearest-level card (still validated)
  const idx = BLOOM_ORDER.indexOf(level);
  for (let r = 1; r < BLOOM_ORDER.length; r++) {
    for (const dir of [-1, 1]) {
      const ni = idx + dir * r;
      if (ni < 0 || ni >= BLOOM_ORDER.length) continue;
      const near = lecture.flashcards.filter(
        (f) => f.bloom === BLOOM_ORDER[ni] && isUsable(f),
      );
      if (near.length) return near[Math.floor(Math.random() * near.length)];
    }
  }

  // Last resort: any clean unused card; if none, allow a leaky one rather than crash.
  const cleanRemaining = lecture.flashcards.filter(isUsable);
  if (cleanRemaining.length) return cleanRemaining[0];
  const remaining = lecture.flashcards.filter((f) => !used.has(f.question));
  return remaining[0] ?? lecture.flashcards[0] ?? null;
};

