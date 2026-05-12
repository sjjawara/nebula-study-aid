/**
 * Master list of every English UI string that should be translated when the
 * user picks a non-English language. The full array is sent to the /translate
 * endpoint once per language and cached. Components call `t("english string")`
 * to render the translated version.
 *
 * Keep entries here in lockstep with what components pass to `t(...)` —
 * unknown keys fall back to the English source, so a missed entry just shows
 * English instead of breaking.
 */
export const UI_STRINGS = [
  // Header / general chrome
  "Turn any lecture into a study environment",
  "Lecture loaded",
  "Process another lecture",
  "New lecture",
  "History",
  "Try another URL",
  "We couldn't process that lecture",
  "Translating to",
  "Generate Study Environment",
  "Paste a YouTube lecture URL...",

  // Tabs
  "Outline",
  "Analysis",
  "Flashcards",
  "Search",
  "Quiz",
  "Mind Map",

  // Bloom's level names
  "Remember",
  "Understand",
  "Apply",
  "Analyze",
  "Evaluate",
  "Create",

  // Bloom's gerunds (used in "Study Tips for ___")
  "Remembering",
  "Understanding",
  "Applying",
  "Analyzing",
  "Evaluating",
  "Creating",

  // Cognitive load (Outline tab)
  "Cognitive load:",
  "Low",
  "Medium",
  "High",
  "Slow down on high-load moments — they need extra processing time.",
  "High load — slow down to process",

  // Search
  "Ask a question or search lecture content...",

  // Quiz mode labels
  "Bottom Up",
  "Top Down",
  "Top Down (Productive Failure)",
  "Mastery",
  "Mastery Mode",
  "Productive Failure",
  "Build Up",
  "Quiz mode",
  "How do you want to learn today?",
  "Build up — earn each Bloom's level in turn.",
  "Productive failure — start at Evaluate, scaffold down.",
  "Adaptive stream — difficulty rises with your accuracy.",
  "Ready when you are",
  "Start Quiz",
  "Try the hardest one",
  "Mastery Mode adapts to you — start at Remember and climb.",
  "We'll pull a question from your flashcards and launch instantly.",
  "Exit",

  // Lecture Profile
  "Lecture Profile",
  "Dominant level:",
  "Bloom's distribution",
  "— click a segment for tailored study tips",
  "Topics at this level",
  "Recommended Tools for This Level",
  "How to study this lecture",
  "Suggested Tools for This Lecture",

  // Key Takeaways
  "Key Takeaways",
] as const;

export type UIString = (typeof UI_STRINGS)[number];
