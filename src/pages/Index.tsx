import { useEffect, useState } from "react";
import { Sparkles, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mockLecture } from "@/lib/mockData";
import { OutlineTab } from "@/components/study/OutlineTab";
import { SummariesTab } from "@/components/study/SummariesTab";
import { FlashcardsTab } from "@/components/study/FlashcardsTab";
import { SearchTab } from "@/components/study/SearchTab";

type Stage = "input" | "loading" | "results";

const loadingSteps = [
  "Extracting transcript...",
  "Classifying with Bloom's Taxonomy...",
  "Building your study environment...",
];

const Index = () => {
  const [stage, setStage] = useState<Stage>("input");
  const [url, setUrl] = useState("");
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (stage !== "loading") return;
    setStepIndex(0);
    const timers = [
      setTimeout(() => setStepIndex(1), 1100),
      setTimeout(() => setStepIndex(2), 2300),
      setTimeout(() => setStage("results"), 3600),
    ];
    return () => timers.forEach(clearTimeout);
  }, [stage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setStage("loading");
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
          {stage === "results" && (
            <Button variant="ghost" size="sm" onClick={() => { setStage("input"); setUrl(""); }}>
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
          </section>
        )}

        {stage === "results" && (
          <section className="space-y-8">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-primary font-medium">Lecture loaded</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{mockLecture.title}</h2>
            </div>

            <Tabs defaultValue="outline" className="w-full">
              <TabsList className="grid w-full grid-cols-4 bg-card border border-border h-12 p-1">
                <TabsTrigger value="outline">Outline</TabsTrigger>
                <TabsTrigger value="summaries">Summaries</TabsTrigger>
                <TabsTrigger value="flashcards">Flashcards</TabsTrigger>
                <TabsTrigger value="search">Search</TabsTrigger>
              </TabsList>
              <TabsContent value="outline" className="mt-6 max-h-[600px] overflow-y-auto pr-2">
                <OutlineTab />
              </TabsContent>
              <TabsContent value="summaries" className="mt-6">
                <SummariesTab />
              </TabsContent>
              <TabsContent value="flashcards" className="mt-6">
                <FlashcardsTab />
              </TabsContent>
              <TabsContent value="search" className="mt-6">
                <SearchTab />
              </TabsContent>
            </Tabs>
          </section>
        )}
      </main>
    </div>
  );
};

export default Index;
