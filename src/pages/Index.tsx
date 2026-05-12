import { useEffect, useRef, useState } from "react";
import { Sparkles, Youtube, AlertCircle, Globe, Loader2, History, RotateCcw } from "lucide-react";
import { SessionHistoryPanel } from "@/components/study/SessionHistoryPanel";
import {
  loadSessions,
  saveSession,
  removeSession,
  type StoredSession,
} from "@/lib/sessionHistory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parseLecture, type Lecture, type ApiResponse } from "@/lib/mockData";
import { OutlineTab } from "@/components/study/OutlineTab";
import { SummariesTab } from "@/components/study/SummariesTab";
import { FlashcardsTab } from "@/components/study/FlashcardsTab";
import { SearchTab } from "@/components/study/SearchTab";
import { QuizTab } from "@/components/study/QuizTab";
import { MindMapTab } from "@/components/study/MindMapTab";
import type { Flashcard } from "@/lib/mockData";
import { loadFlashcards, saveFlashcards } from "@/lib/flashcardStore";

const LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "Mandarin",
  "Arabic",
  "Portuguese",
  "Hindi",
] as const;
type Language = (typeof LANGUAGES)[number];

const TRANSLATE_URL = "https://nebulalearn-production.up.railway.app/translate";


type Stage = "input" | "loading" | "results" | "error";

const loadingSteps = [
  "Extracting transcript...",
  "Classifying with Bloom's Taxonomy...",
  "Building your study environment...",
];

const API_URL = "https://nebulalearn-production.up.railway.app/process";
const API_WITH_TRANSCRIPT_URL = "https://nebulalearn-production.up.railway.app/process-with-transcript";
const SUPADATA_URL = "https://api.supadata.ai/v1/youtube/transcript";
// TODO: move to environment variable / edge function before production
const SUPADATA_API_KEY = "sd_edec8f6fedd695966f25f6c5283ca21e";

type TranscriptItem = { text: string; offset: number; duration: number };

const formatTranscript = (items: TranscriptItem[]): string =>
  items
    .map((item) => {
      const minutes = Math.floor(item.offset / 60000);
      const seconds = Math.floor((item.offset % 60000) / 1000);
      return `[${minutes}:${seconds.toString().padStart(2, "0")}] ${item.text}`;
    })
    .join("\n");

const Index = () => {
  const [stage, setStage] = useState<Stage>("input");
  const [url, setUrl] = useState("");
  const [stepIndex, setStepIndex] = useState(0);
  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [error, setError] = useState<string | null>(null);
  const elapsedRef = useRef<number>(0);
  const [elapsed, setElapsed] = useState(0);
  const [activeTab, setActiveTab] = useState("outline");
  const [quizSeed, setQuizSeed] = useState<Flashcard | null>(null);
  const [language, setLanguage] = useState<Language>("English");
  const [translations, setTranslations] = useState<Record<string, Lecture>>({});
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<StoredSession[]>(() => loadSessions());
  const [historyOpen, setHistoryOpen] = useState(false);

  const baseLecture: Lecture | null =
    language === "English"
      ? lecture
      : translations[language] ?? lecture;

  // Per-lecture user-customized flashcards (persisted to localStorage by lecture title)
  const [customFlashcards, setCustomFlashcards] = useState<Flashcard[] | null>(null);

  useEffect(() => {
    if (!baseLecture) {
      setCustomFlashcards(null);
      return;
    }
    setCustomFlashcards(loadFlashcards(baseLecture.title));
  }, [baseLecture?.title]);

  const displayLecture: Lecture | null = baseLecture
    ? { ...baseLecture, flashcards: customFlashcards ?? baseLecture.flashcards }
    : null;

  const updateFlashcards = (updater: (current: Flashcard[]) => Flashcard[]) => {
    if (!baseLecture) return;
    const current = customFlashcards ?? baseLecture.flashcards;
    const next = updater(current);
    setCustomFlashcards(next);
    saveFlashcards(baseLecture.title, next);
  };

  const handleLanguageChange = async (next: Language) => {
    setLanguage(next);
    setTranslateError(null);
    if (next === "English" || !lecture || translations[next]) return;
    setTranslating(true);
    try {
      const res = await fetch(TRANSLATE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: JSON.stringify(lecture),
          language: next,
        }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const payload = await res.json();
      const raw = payload?.translated ?? payload?.data ?? payload;
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      const translated: Lecture = {
        ...lecture,
        ...parsed,
        title: parsed.title ?? lecture.title,
        outline: parsed.outline ?? lecture.outline,
        summaries: parsed.summaries ?? lecture.summaries,
        flashcards: parsed.flashcards ?? lecture.flashcards,
        searchIndex: parsed.searchIndex ?? parsed.search_index ?? lecture.searchIndex,
      };
      setTranslations((prev) => ({ ...prev, [next]: translated }));
    } catch (err) {
      setTranslateError(err instanceof Error ? err.message : "Translation failed.");
      setLanguage("English");
    } finally {
      setTranslating(false);
    }
  };

  useEffect(() => {
    if (stage !== "loading") return;
    setStepIndex(0);
    elapsedRef.current = 0;
    setElapsed(0);
    // Slowly progress through visual steps over the expected 30-60s window
    const stepTimers = [
      setTimeout(() => setStepIndex(1), 8000),
      setTimeout(() => setStepIndex(2), 22000),
    ];
    const tick = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
    }, 1000);
    return () => {
      stepTimers.forEach(clearTimeout);
      clearInterval(tick);
    };
  }, [stage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setError(null);
    setLecture(null);
    setStage("loading");

    try {
      const trimmedUrl = url.trim();

      // 1. Fetch raw transcript array from Supadata
      if (!SUPADATA_API_KEY) {
        throw new Error(
          "Missing VITE_SUPADATA_API_KEY. Add it as an environment variable so the x-api-key header can be sent."
        );
      }
      const supaHeaders: Record<string, string> = {
        "x-api-key": SUPADATA_API_KEY,
        Accept: "application/json",
      };
      console.log("[Supadata] Request headers:", {
        ...supaHeaders,
        "x-api-key": `${SUPADATA_API_KEY.slice(0, 4)}…${SUPADATA_API_KEY.slice(-4)} (len ${SUPADATA_API_KEY.length})`,
      });
      const supaUrl = `${SUPADATA_URL}?url=${encodeURIComponent(trimmedUrl)}&text=false`;
      console.log("[Supadata] GET", supaUrl);
      const supaRes = await fetch(supaUrl, { method: "GET", headers: supaHeaders });
      if (!supaRes.ok) {
        const body = await supaRes.text().catch(() => "");
        console.error("[Supadata] Error response:", supaRes.status, body);
        throw new Error(`Transcript fetch failed (${supaRes.status}): ${body || supaRes.statusText}`);
      }
      const supaPayload = await supaRes.json();
      const rawItems: TranscriptItem[] = Array.isArray(supaPayload)
        ? supaPayload
        : supaPayload?.content ?? supaPayload?.transcript ?? [];
      if (!Array.isArray(rawItems) || rawItems.length === 0) {
        throw new Error("No transcript returned for this video.");
      }
      const formattedTranscript = formatTranscript(rawItems);

      // 2. Send formatted transcript string (not raw array) to backend
      const res = await fetch(API_WITH_TRANSCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmedUrl, transcript: formattedTranscript }),
      });

      if (!res.ok) {
        throw new Error(`Request failed (${res.status})`);
      }

      const payload = await res.json();

      if (payload?.error) {
        throw new Error(String(payload.error));
      }

      const raw = payload?.data;
      if (!raw) throw new Error("Malformed response: missing 'data' field.");

      const parsed: ApiResponse = typeof raw === "string" ? JSON.parse(raw) : raw;
      const parsedLecture = parseLecture(parsed);
      setLecture(parsedLecture);
      setSessions(saveSession(parsedLecture, trimmedUrl));
      setStage("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStage("error");
    }
  };

  const reset = () => {
    setStage("input");
    setUrl("");
    setLecture(null);
    setError(null);
    setLanguage("English");
    setTranslations({});
    setTranslateError(null);
  };

  // Save current session (if any) and return to input screen
  const processAnother = () => {
    if (lecture && url) setSessions(saveSession(lecture, url));
    reset();
  };

  const loadStored = (s: StoredSession) => {
    setLecture(s.lecture);
    setUrl(s.url);
    setLanguage("English");
    setTranslations({});
    setTranslateError(null);
    setActiveTab("outline");
    setStage("results");
    setHistoryOpen(false);
  };

  const removeStored = (id: string) => {
    setSessions(removeSession(id));
  };

  return (
    <div className="relative min-h-screen bg-background">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[600px] bg-gradient-glow" />

      <header className="relative border-b border-border/60 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">NebulaLearn</h1>
              <p className="text-xs text-muted-foreground -mt-0.5">Turn any lecture into a study environment</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setHistoryOpen(true)}
              title="Recent sessions"
            >
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">History</span>
              {sessions.length > 0 && (
                <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary">
                  {sessions.length}
                </span>
              )}
            </Button>
            {(stage === "results" || stage === "error") && (
              <Button variant="ghost" size="sm" onClick={reset}>
                New lecture
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-[900px] px-6 py-12 md:py-20">
        {stage === "input" && (
          <section className="text-center space-y-10">
            <div className="space-y-4">
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.15]">
                Study smarter from any{" "}
                <span className="text-primary">YouTube lecture</span>
              </h2>
              <p className="text-muted-foreground text-lg max-w-xl mx-auto">
                Paste a link and we'll generate an outline, summaries, flashcards, quizzes, mind maps, and a searchable transcript with timestamps — all classified by cognitive depth.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 max-w-2xl mx-auto">
              <div className="relative">
                <Youtube className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste a YouTube lecture URL..."
                  className="h-16 pl-12 pr-4 text-base bg-card border-border shadow-card focus-visible:ring-primary/40"
                />
              </div>
              <Button
                type="submit"
                className="h-12 w-full text-base bg-gradient-primary hover:opacity-90 shadow-glow"
              >
                Generate Study Environment
              </Button>
            </form>
          </section>
        )}

        {stage === "loading" && (
          <section className="py-20 flex flex-col items-center gap-8">
            <div className="relative h-16 w-16">
              <div className="absolute inset-0 rounded-full bg-gradient-primary opacity-30 animate-ping" />
              <div className="relative h-16 w-16 rounded-full bg-gradient-primary flex items-center justify-center shadow-glow">
                <Sparkles className="h-7 w-7 text-primary-foreground animate-pulse" />
              </div>
            </div>
            <ul className="space-y-3 w-full max-w-sm">
              {loadingSteps.map((s, i) => {
                const state = i < stepIndex ? "done" : i === stepIndex ? "active" : "pending";
                return (
                  <li
                    key={s}
                    className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-all ${
                      state === "active"
                        ? "border-primary/40 bg-card shadow-glow"
                        : state === "done"
                        ? "border-border bg-card/50 opacity-60"
                        : "border-border/40 bg-transparent opacity-30"
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${
                      state === "active" ? "bg-primary animate-pulse" : state === "done" ? "bg-bloom-apply" : "bg-muted"
                    }`} />
                    <span className="text-sm">{s}</span>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-muted-foreground">
              This usually takes 60–120 seconds · {elapsed}s elapsed
            </p>
          </section>
        )}

        {stage === "error" && (
          <section className="py-20 flex flex-col items-center gap-6 text-center">
            <div className="h-14 w-14 rounded-full bg-destructive/15 flex items-center justify-center">
              <AlertCircle className="h-7 w-7 text-destructive" />
            </div>
            <div className="space-y-2 max-w-md">
              <h3 className="text-xl font-semibold">We couldn't process that lecture</h3>
              <p className="text-sm text-muted-foreground">{error ?? "Unknown error."}</p>
            </div>
            <Button onClick={reset} className="bg-gradient-primary">Try another URL</Button>
          </section>
        )}

        {stage === "results" && lecture && displayLecture && (
          <section className="space-y-8">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wider text-primary font-medium">Lecture loaded</p>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{displayLecture.title}</h2>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={processAnother}>
                  <RotateCcw className="h-4 w-4" />
                  Process another lecture
                </Button>
                <Globe className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={language}
                  onValueChange={(v) => handleLanguageChange(v as Language)}
                  disabled={translating}
                >
                  <SelectTrigger className="h-9 w-[140px] bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {translating && (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                )}
              </div>
            </div>

            {translateError && (
              <p className="text-xs text-destructive">{translateError}</p>
            )}

            {translating && (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card py-20">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Translating to {language}...
                </p>
              </div>
            )}

            {!translating && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-6 bg-card border border-border h-12 p-1">
                <TabsTrigger value="outline">Outline</TabsTrigger>
                <TabsTrigger value="summaries">Summaries</TabsTrigger>
                <TabsTrigger value="flashcards">Flashcards</TabsTrigger>
                <TabsTrigger value="search">Search</TabsTrigger>
                <TabsTrigger value="quiz">Quiz</TabsTrigger>
                <TabsTrigger value="mindmap">Mind Map</TabsTrigger>
              </TabsList>
              <TabsContent value="outline" className="mt-6 max-h-[600px] overflow-y-auto pr-2">
                <OutlineTab lecture={displayLecture} videoUrl={url} />
              </TabsContent>
              <TabsContent value="summaries" className="mt-6">
                <SummariesTab lecture={displayLecture} onNavigate={setActiveTab} />
              </TabsContent>
              <TabsContent value="flashcards" className="mt-6">
                <FlashcardsTab
                  lecture={displayLecture}
                  videoUrl={url}
                  onQuizCard={(card) => {
                    setQuizSeed(card);
                    setActiveTab("quiz");
                  }}
                  onUpdateFlashcards={updateFlashcards}
                />
              </TabsContent>
              <TabsContent value="search" className="mt-6">
                <SearchTab
                  lecture={displayLecture}
                  videoUrl={url}
                  onSaveFlashcard={(card) =>
                    updateFlashcards((cards) => [...cards, card])
                  }
                />
              </TabsContent>
              <TabsContent value="quiz" className="mt-6">
                <QuizTab
                  lecture={displayLecture}
                  initialCard={quizSeed}
                  onConsumedInitial={() => setQuizSeed(null)}
                />
              </TabsContent>
              <TabsContent value="mindmap" className="mt-6">
                <MindMapTab lecture={displayLecture} videoUrl={url} />
              </TabsContent>
            </Tabs>
            )}
          </section>
        )}
      </main>

      <SessionHistoryPanel
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        sessions={sessions}
        onLoad={loadStored}
        onRemove={removeStored}
      />
    </div>
  );
};

export default Index;
