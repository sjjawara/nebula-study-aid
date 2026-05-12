import { useEffect, useMemo, useState } from "react";
import type { Lecture, Flashcard, BloomLevel } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BloomBadge } from "@/components/BloomBadge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, RotateCw, Sparkles, Play, Pencil, Plus, Trash2 } from "lucide-react";

interface FlashcardsTabProps {
  lecture: Lecture;
  videoUrl?: string;
  onQuizCard?: (card: Flashcard) => void;
  onUpdateFlashcards?: (updater: (current: Flashcard[]) => Flashcard[]) => void;
}

const BLOOM_LEVELS: BloomLevel[] = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"];

const timestampToSeconds = (ts: string): number => {
  const parts = ts.split(":").map((p) => parseInt(p, 10) || 0);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
};

const extractVideoId = (videoUrl: string): string | null => {
  try {
    const u = new URL(videoUrl);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1) || null;
    const v = u.searchParams.get("v");
    if (v) return v;
    const m = u.pathname.match(/\/(?:embed|shorts|v)\/([^/?#]+)/);
    if (m) return m[1];
    return null;
  } catch {
    return null;
  }
};

const openTimestamp = (videoId: string, seconds: number) => {
  const url = `https://www.youtube.com/watch?v=${videoId}&t=${seconds}s`;
  window.open(url, "_blank", "noopener,noreferrer");
};

export const TimestampBadge = ({
  videoId,
  timestamp,
}: {
  videoId: string | null;
  timestamp?: string;
}) => {
  if (!timestamp) return null;
  if (!videoId) {
    return (
      <span className="font-mono text-xs text-muted-foreground tabular-nums">{timestamp}</span>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        openTimestamp(videoId, timestampToSeconds(timestamp));
      }}
      className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 font-mono text-xs text-primary tabular-nums hover:bg-primary/20 transition-colors"
      aria-label={`Open YouTube at ${timestamp}`}
    >
      <Play className="h-3 w-3 fill-current" />
      {timestamp}
    </button>
  );
};

interface EditorState {
  open: boolean;
  index: number | null; // null = creating
  question: string;
  answer: string;
  bloom: BloomLevel;
  timestamp: string;
  formula: string;
}

const emptyEditor: EditorState = {
  open: false,
  index: null,
  question: "",
  answer: "",
  bloom: "Understand",
  timestamp: "",
  formula: "",
};

export const FormulaBadge = () => (
  <span className="inline-flex items-center rounded-md border border-bloom-apply/40 bg-bloom-apply/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-bloom-apply">
    Formula
  </span>
);

export const FlashcardsTab = ({ lecture, videoUrl, onQuizCard, onUpdateFlashcards }: FlashcardsTabProps) => {
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [editor, setEditor] = useState<EditorState>(emptyEditor);
  const total = lecture.flashcards.length;
  const videoId = videoUrl ? extractVideoId(videoUrl) : null;
  const canEdit = !!onUpdateFlashcards;

  // Keep cursor in range when cards are added/removed
  useEffect(() => {
    if (total === 0) {
      setI(0);
    } else if (i >= total) {
      setI(total - 1);
    }
  }, [total, i]);

  const card = total > 0 ? lecture.flashcards[Math.min(i, total - 1)] : null;

  const go = (delta: number) => {
    if (!total) return;
    setFlipped(false);
    setI((prev) => (prev + delta + total) % total);
  };

  const openCreate = () => {
    setEditor({ ...emptyEditor, open: true });
  };

  const openEdit = (idx: number) => {
    const c = lecture.flashcards[idx];
    if (!c) return;
    setEditor({
      open: true,
      index: idx,
      question: c.question,
      answer: c.answer,
      bloom: c.bloom,
      timestamp: c.timestamp ?? "",
      formula: c.formula ?? "",
    });
  };

  const closeEditor = () => setEditor((e) => ({ ...e, open: false }));

  const saveEditor = () => {
    if (!onUpdateFlashcards) return;
    const q = editor.question.trim();
    const a = editor.answer.trim();
    if (!q || !a) return;
    const updated: Flashcard = {
      question: q,
      answer: a,
      bloom: editor.bloom,
      timestamp: editor.timestamp.trim() || undefined,
      formula: editor.formula.trim() || undefined,
    };
    onUpdateFlashcards((cards) => {
      if (editor.index === null) {
        const next = [...cards, updated];
        // Jump to the new card
        setTimeout(() => setI(next.length - 1), 0);
        return next;
      }
      const next = [...cards];
      next[editor.index] = updated;
      return next;
    });
    closeEditor();
  };

  const deleteCurrent = () => {
    if (!onUpdateFlashcards || editor.index === null) return;
    const idxToRemove = editor.index;
    onUpdateFlashcards((cards) => cards.filter((_, idx) => idx !== idxToRemove));
    closeEditor();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          {total > 0 ? `${total} card${total === 1 ? "" : "s"} in this deck` : "No flashcards yet"}
        </div>
        {canEdit && (
          <Button size="sm" onClick={openCreate} className="bg-gradient-primary">
            <Plus className="h-4 w-4" />
            Create Flashcard
          </Button>
        )}
      </div>

      {total === 0 || !card ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {canEdit ? "Create your first flashcard to start studying." : "No flashcards available."}
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Card {Math.min(i, total - 1) + 1} of {total}</span>
              {card.timestamp && <TimestampBadge videoId={videoId} timestamp={card.timestamp} />}
            </div>
            <div className="flex items-center gap-2">
              {onQuizCard && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onQuizCard(card)}
                  className="h-7 gap-1 text-xs"
                >
                  <Sparkles className="h-3 w-3" />
                  Quiz me on this
                </Button>
              )}
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openEdit(Math.min(i, total - 1))}
                  className="h-7 w-7"
                  aria-label="Edit flashcard"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
              {card.formula && <FormulaBadge />}
              <BloomBadge level={card.bloom} />
            </div>
          </div>

          <button
            onClick={() => setFlipped((f) => !f)}
            className="group relative w-full min-h-[280px] rounded-2xl border border-border bg-card p-8 shadow-card transition-all hover:border-primary/40 hover:shadow-glow text-left"
          >
            <div className="absolute top-4 right-4 text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <RotateCw className="h-3 w-3" />
              {flipped ? "Answer" : "Question"}
            </div>
            {card.timestamp && (
              <div className="absolute top-4 left-4">
                <TimestampBadge videoId={videoId} timestamp={card.timestamp} />
              </div>
            )}
            <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-4">
              <p className="text-xl leading-relaxed text-center text-foreground">
                {flipped ? card.answer : card.question}
              </p>
              {card.formula && (
                <pre className="max-w-full overflow-x-auto rounded-lg border border-border bg-muted/40 px-4 py-3 font-mono text-lg text-foreground whitespace-pre-wrap text-center">
                  {card.formula}
                </pre>
              )}
            </div>
          </button>

          <div className="flex items-center justify-center gap-3">
            <Button variant="secondary" size="icon" onClick={() => go(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="secondary" onClick={() => setFlipped((f) => !f)}>
              Flip card
            </Button>
            <Button variant="secondary" size="icon" onClick={() => go(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}

      <Dialog open={editor.open} onOpenChange={(o) => (o ? null : closeEditor())}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>
              {editor.index === null ? "Create Flashcard" : "Edit Flashcard"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Question
              </label>
              <Textarea
                value={editor.question}
                onChange={(e) => setEditor((s) => ({ ...s, question: e.target.value }))}
                placeholder="What's the question?"
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Answer
              </label>
              <Textarea
                value={editor.answer}
                onChange={(e) => setEditor((s) => ({ ...s, answer: e.target.value }))}
                placeholder="The correct answer"
                rows={4}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                Formula (optional)
                <FormulaBadge />
              </label>
              <Textarea
                value={editor.formula}
                onChange={(e) => setEditor((s) => ({ ...s, formula: e.target.value }))}
                placeholder="e.g. F = m·a"
                rows={2}
                className="font-mono text-base"
              />
              <p className="text-[11px] text-muted-foreground">
                Cards with a formula appear in Formula Mode quizzes.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Bloom's level
                </label>
                <select
                  value={editor.bloom}
                  onChange={(e) => setEditor((s) => ({ ...s, bloom: e.target.value as BloomLevel }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {BLOOM_LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>{lvl}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Timestamp (optional)
                </label>
                <Input
                  value={editor.timestamp}
                  onChange={(e) => setEditor((s) => ({ ...s, timestamp: e.target.value }))}
                  placeholder="e.g. 3:24"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <div>
              {editor.index !== null && (
                <Button variant="ghost" onClick={deleteCurrent} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={closeEditor}>Cancel</Button>
              <Button
                onClick={saveEditor}
                disabled={!editor.question.trim() || !editor.answer.trim()}
                className="bg-gradient-primary"
              >
                {editor.index === null ? "Create" : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
