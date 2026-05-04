export type BloomLevel = "Remember" | "Understand" | "Apply" | "Analyze" | "Evaluate" | "Create";

export const bloomColor: Record<BloomLevel, string> = {
  Remember: "bg-bloom-remember/15 text-bloom-remember border-bloom-remember/30",
  Understand: "bg-bloom-understand/15 text-bloom-understand border-bloom-understand/30",
  Apply: "bg-bloom-apply/15 text-bloom-apply border-bloom-apply/30",
  Analyze: "bg-bloom-analyze/15 text-bloom-analyze border-bloom-analyze/30",
  Evaluate: "bg-bloom-evaluate/15 text-bloom-evaluate border-bloom-evaluate/30",
  Create: "bg-bloom-create/15 text-bloom-create border-bloom-create/30",
};

export interface OutlineItem {
  timestamp: string;
  topic: string;
  bloom: BloomLevel;
  load: 1 | 2 | 3 | 4 | 5;
}

export interface Flashcard {
  question: string;
  answer: string;
  bloom: BloomLevel;
  timestamp?: string;
}

export interface SearchMoment {
  timestamp: string;
  excerpt: string;
  topic?: string;
  keywords?: string[];
}

export interface Lecture {
  title: string;
  outline: OutlineItem[];
  summaries: { short: string; medium: string; full: string };
  flashcards: Flashcard[];
  searchIndex: SearchMoment[];
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

const clampLoad = (n: unknown): 1 | 2 | 3 | 4 | 5 => {
  const v = Math.round(Number(n) || 1);
  return Math.min(5, Math.max(1, v)) as 1 | 2 | 3 | 4 | 5;
};

export interface ApiResponse {
  title?: string;
  outline?: Array<{ timestamp: string; topic: string; bloom_level: string; cognitive_load: number }>;
  summaries?: { ninety_seconds?: string; five_minutes?: string; full?: string };
  flashcards?: Array<{ question: string; answer: string; bloom_level: string; timestamp?: string }>;
  search_index?: Array<{ timestamp: string; topic?: string; keywords?: string[]; summary?: string }>;
}

export const parseLecture = (data: ApiResponse): Lecture => ({
  title: data.title ?? "Untitled lecture",
  outline: (data.outline ?? []).map((o) => ({
    timestamp: o.timestamp,
    topic: o.topic,
    bloom: normalizeBloom(o.bloom_level),
    load: clampLoad(o.cognitive_load),
  })),
  summaries: {
    short: data.summaries?.ninety_seconds ?? "",
    medium: data.summaries?.five_minutes ?? "",
    full: data.summaries?.full ?? "",
  },
  flashcards: (data.flashcards ?? []).map((f) => ({
    question: f.question,
    answer: f.answer,
    bloom: normalizeBloom(f.bloom_level),
    timestamp: f.timestamp,
  })),
  searchIndex: (data.search_index ?? []).map((s) => ({
    timestamp: s.timestamp,
    excerpt: s.summary ?? s.topic ?? "",
    topic: s.topic,
    keywords: s.keywords,
  })),
});
