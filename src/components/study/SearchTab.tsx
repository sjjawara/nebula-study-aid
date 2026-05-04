import { useMemo, useState } from "react";
import type { Lecture } from "@/lib/mockData";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export const SearchTab = ({ lecture }: { lecture: Lecture }) => {
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    if (!q.trim()) return lecture.searchIndex;
    const needle = q.toLowerCase();
    return lecture.searchIndex.filter((m) =>
      [m.excerpt, m.topic, ...(m.keywords ?? [])]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(needle))
    );
  }, [q, lecture.searchIndex]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask a question or search lecture content..."
          className="pl-10 h-12 bg-card"
        />
      </div>
      <div className="space-y-2">
        {results.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No matching moments found.</p>
        )}
        {results.map((m, idx) => (
          <div key={idx} className="flex gap-4 rounded-xl border border-border bg-card p-4 shadow-card hover:border-primary/40 transition-colors cursor-pointer">
            <span className="font-mono text-sm text-primary tabular-nums shrink-0">{m.timestamp}</span>
            <div className="space-y-1">
              {m.topic && <p className="text-sm font-medium text-foreground">{m.topic}</p>}
              <p className="text-sm text-foreground/80 leading-relaxed">{m.excerpt}</p>
              {m.keywords && m.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {m.keywords.map((k) => (
                    <span key={k} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{k}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
