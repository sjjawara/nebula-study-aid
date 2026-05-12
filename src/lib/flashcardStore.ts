import type { Flashcard } from "./mockData";

const KEY_PREFIX = "nebula.flashcards.v1::";

const keyFor = (lectureTitle: string) => `${KEY_PREFIX}${lectureTitle}`;

/** Returns a stored flashcard list for this lecture, or null if user hasn't customized. */
export const loadFlashcards = (lectureTitle: string): Flashcard[] | null => {
  if (!lectureTitle) return null;
  try {
    const raw = localStorage.getItem(keyFor(lectureTitle));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Flashcard[]) : null;
  } catch {
    return null;
  }
};

export const saveFlashcards = (lectureTitle: string, cards: Flashcard[]) => {
  if (!lectureTitle) return;
  try {
    localStorage.setItem(keyFor(lectureTitle), JSON.stringify(cards));
  } catch {
    // ignore quota
  }
};
