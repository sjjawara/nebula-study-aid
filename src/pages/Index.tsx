import { useEffect, useRef, useState } from "react";
import { Sparkles, Youtube, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parseLecture, type Lecture, type ApiResponse } from "@/lib/mockData";
import { OutlineTab } from "@/components/study/OutlineTab";
import { SummariesTab } from "@/components/study/SummariesTab";
import { FlashcardsTab } from "@/components/study/FlashcardsTab";
import { SearchTab } from "@/components/study/SearchTab";

type Stage = "input" | "loading" | "results" | "error";

const loadingSteps = [
  "Extracting transcript...",
  "Classifying with Bloom's Taxonomy...",
  "Building your study environment...",
];

const API_URL_WITH_TRANSCRIPT = "https://nebulalearn-production.up.railway.app/process-with-transcript";
const TRANSCRIPT_URL = "https://api.supadata.ai/v1/youtube/transcript";

const TRANSCRIPT_ERROR = "Could not retrieve transcript. Please ensure the video has closed captions enabled.";

const fetchTranscript = async (youtubeUrl: string): Promise<string> => {
  let res: Response;
  try {
    res = await fetch(`${TRANSCRIPT_URL}?url=${encodeURIComponent(youtubeUrl)}&text=true`);
  } catch {
    throw new Error(TRANSCRIPT_ERROR);
  }
  if (!res.ok) throw new Error(TRANSCRIPT_ERROR);
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new Error(TRANSCRIPT_ERROR);
  }
  const d = data as Record<string, unknown> | string;
  const text =
    typeof d === "string"
      ? d
      : (d?.content as string) ?? (d?.text as string) ?? (d?.transcript as string);
  if (typeof text !== "string" || text.trim().length === 0) {
    throw new Error(TRANSCRIPT_ERROR);
  }
  return text;
};

const Index = () => {
  const [stage, setStage] = useState<Stage>("input");
  const [url, setUrl] = useState("");
  const [stepIndex, setStepIndex] = useState(0);
  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [error, setError] = useState<string | null>(null);
  const elapsedRef = useRef<number>(0);
  const [elapsed, setElapsed] = useState(0);

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
      const transcript = await fetchTranscript(trimmedUrl);

      const res = await fetch(API_URL_WITH_TRANSCRIPT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmedUrl, transcript }),
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
      setLecture(parseLecture(parsed));
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
          {(stage === "results" || stage === "error") && (
            <Button variant="ghost" size="sm" onClick={reset}>
              New lecture
            </Button>
          )}
        </div>
      </header>

      <main className="relative mx-auto max-w-[900px] px-6 py-12 md:py-20">
        {stage === "input" && (
          <section className="text-center space-y-10">
            <div className="space-y-4">
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
                Study smarter from any{" "}
                <span className="bg-gradient-primary bg-clip-text text-transparent">YouTube lecture</span>
              </h2>
              <p className="text-muted-foreground text-lg max-w-xl mx-auto">
                Paste a link and we'll generate an outline, summaries, flashcards, and a searchable transcript — all classified by cognitive depth.
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
              This usually takes 30–60 seconds · {elapsed}s elapsed
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

        {stage === "results" && lecture && (
          <section className="space-y-8">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-primary font-medium">Lecture loaded</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{lecture.title}</h2>
            </div>

            <Tabs defaultValue="outline" className="w-full">
              <TabsList className="grid w-full grid-cols-4 bg-card border border-border h-12 p-1">
                <TabsTrigger value="outline">Outline</TabsTrigger>
                <TabsTrigger value="summaries">Summaries</TabsTrigger>
                <TabsTrigger value="flashcards">Flashcards</TabsTrigger>
                <TabsTrigger value="search">Search</TabsTrigger>
              </TabsList>
              <TabsContent value="outline" className="mt-6 max-h-[600px] overflow-y-auto pr-2">
                <OutlineTab lecture={lecture} />
              </TabsContent>
              <TabsContent value="summaries" className="mt-6">
                <SummariesTab lecture={lecture} />
              </TabsContent>
              <TabsContent value="flashcards" className="mt-6">
                <FlashcardsTab lecture={lecture} />
              </TabsContent>
              <TabsContent value="search" className="mt-6">
                <SearchTab lecture={lecture} />
              </TabsContent>
            </Tabs>
          </section>
        )}
      </main>
    </div>
  );
};

export default Index;
