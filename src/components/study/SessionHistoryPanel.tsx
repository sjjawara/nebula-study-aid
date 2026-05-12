import { History, X, Trash2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import type { StoredSession } from "@/lib/sessionHistory";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessions: StoredSession[];
  onLoad: (s: StoredSession) => void;
  onRemove: (id: string) => void;
}

const formatDate = (ts: number) => {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return `Today, ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
};

export const SessionHistoryPanel = ({
  open,
  onOpenChange,
  sessions,
  onLoad,
  onRemove,
}: Props) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[360px] sm:w-[420px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            Recent sessions
          </SheetTitle>
          <SheetDescription>
            Your last {sessions.length || 10} processed lectures, saved on this device.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex-1 overflow-y-auto pr-1 space-y-2">
          {sessions.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
              No saved sessions yet. Process a lecture to see it here.
            </div>
          )}
          {sessions.map((s) => (
            <div
              key={s.id}
              className="group rounded-xl border border-border bg-card p-3 shadow-sm transition-colors hover:border-primary/40"
            >
              <button
                onClick={() => onLoad(s)}
                className="flex w-full items-start gap-3 text-left"
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Play className="h-3.5 w-3.5" />
                </span>
                <span className="flex-1 space-y-1">
                  <span className="line-clamp-2 block text-sm font-medium text-foreground">
                    {s.title}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {formatDate(s.savedAt)}
                  </span>
                </span>
              </button>
              <div className="mt-2 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => onRemove(s.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-end border-t border-border pt-4">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SessionHistoryPanel;
