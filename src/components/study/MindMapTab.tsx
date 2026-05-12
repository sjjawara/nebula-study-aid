import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { toPng } from "html-to-image";
import { Pencil, Download, RotateCcw, MousePointer2, ZoomIn, ZoomOut, X, ExternalLink, Sparkles } from "lucide-react";
import type { Lecture, SearchMoment } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Tool = "select" | "relabel";

interface TreeDatum {
  id: string;
  name: string;
  kind: "root" | "branch" | "leaf";
  // Source data for AI explanation lookup
  topic?: string;
  timestamp?: string;
  keyword?: string;
  children?: TreeDatum[];
}

const NODE_PAD_X = 16;
const NODE_PAD_Y = 12;
const FONT_BY_KIND = { root: 15, branch: 13, leaf: 11 } as const;
const MAX_NODE_WIDTH = 220;
const LINE_GAP = 4;

// Estimate text width (chars * avg glyph width)
const estimateLineWidth = (text: string, fontSize: number) =>
  Math.max(40, text.length * (fontSize * 0.58));

// Wrap a label into up to 2 lines that fit within MAX_NODE_WIDTH
const wrapLabel = (text: string, fontSize: number): string[] => {
  const maxLineWidth = MAX_NODE_WIDTH - NODE_PAD_X * 2;
  if (estimateLineWidth(text, fontSize) <= maxLineWidth) return [text];

  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w;
    if (estimateLineWidth(candidate, fontSize) <= maxLineWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = w;
      if (lines.length === 1) break; // start filling 2nd line below
    }
  }
  if (current) lines.push(current);

  // Pack remaining words onto line 2; if overflow, ellipsize line 2.
  if (lines.length === 1) return lines;
  // Re-pack 2nd line including any words we may have skipped
  const usedFirst = lines[0].split(/\s+/).length;
  const rest = words.slice(usedFirst).join(" ");
  let line2 = rest;
  while (line2 && estimateLineWidth(line2 + "…", fontSize) > maxLineWidth) {
    line2 = line2.slice(0, -1);
  }
  if (line2 !== rest) line2 = line2.trimEnd() + "…";
  return [lines[0], line2 || rest];
};

const buildTree = (lecture: Lecture, labelOverrides: Record<string, string>): TreeDatum => {
  const labelOf = (id: string, fallback: string) => labelOverrides[id] ?? fallback;

  const branches: TreeDatum[] = lecture.outline.map((o, i) => {
    const branchId = `b:${o.timestamp}-${i}`;

    const keywordPool = new Set<string>();
    for (const m of lecture.searchIndex) {
      if (m.timestamp === o.timestamp || (m.topic && m.topic === o.topic)) {
        for (const k of m.keywords ?? []) {
          if (k && k.trim()) keywordPool.add(k.trim());
        }
      }
    }

    const leaves: TreeDatum[] = Array.from(keywordPool)
      .filter((k) => k.toLowerCase() !== o.topic.toLowerCase())
      .slice(0, 5)
      .map((k, j) => {
        const id = `${branchId}:l:${j}`;
        return {
          id,
          name: labelOf(id, k),
          kind: "leaf",
          keyword: k,
          topic: o.topic,
          timestamp: o.timestamp,
        };
      });

    return {
      id: branchId,
      name: labelOf(branchId, o.topic),
      kind: "branch",
      topic: o.topic,
      timestamp: o.timestamp,
      children: leaves.length ? leaves : undefined,
    };
  });

  return {
    id: "root",
    name: labelOf("root", lecture.title),
    kind: "root",
    children: branches,
  };
};

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

const buildYoutubeLink = (videoUrl: string | undefined, ts: string | undefined): string | null => {
  if (!videoUrl || !ts) return null;
  const seconds = timestampToSeconds(ts);
  const id = extractVideoId(videoUrl);
  if (id) return `https://www.youtube.com/watch?v=${id}&t=${seconds}s`;
  const sep = videoUrl.includes("?") ? "&" : "?";
  return `${videoUrl}${sep}t=${seconds}s`;
};

const tokenize = (s: string): string[] =>
  s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2);

// Find best matching SearchMoment for a node and produce a 2-3 sentence plain explanation.
const explainNode = (
  node: TreeDatum,
  lecture: Lecture,
): { explanation: string; timestamp?: string; matched?: SearchMoment } => {
  if (node.kind === "root") {
    return {
      explanation: `${lecture.title} — this mind map breaks the lecture into its main topics (branches) and the supporting keywords (leaves) covered in each one. Click any topic or keyword to see what it means and jump to the moment it's discussed in the video.`,
    };
  }

  const idx = lecture.searchIndex;

  // Branch: match by timestamp/topic exactly
  if (node.kind === "branch") {
    const m =
      idx.find((s) => s.timestamp === node.timestamp) ??
      idx.find((s) => s.topic && node.topic && s.topic === node.topic);
    if (m && m.excerpt) {
      return { explanation: m.excerpt, timestamp: m.timestamp ?? node.timestamp, matched: m };
    }
    return {
      explanation: `"${node.name}" is one of the main topics covered in this lecture. Open the timestamp below to hear how the instructor introduces and develops this idea in context.`,
      timestamp: node.timestamp,
    };
  }

  // Leaf: try keyword match within the parent topic's moments first
  const kw = (node.keyword ?? node.name).toLowerCase();
  const tokens = tokenize(kw);

  const candidates = idx.filter((s) => {
    if (node.timestamp && s.timestamp === node.timestamp) return true;
    if (node.topic && s.topic === node.topic) return true;
    return false;
  });

  const pool = candidates.length ? candidates : idx;

  let best: SearchMoment | undefined;
  let bestScore = -1;
  for (const s of pool) {
    const hay = `${s.excerpt ?? ""} ${(s.keywords ?? []).join(" ")}`.toLowerCase();
    let score = 0;
    if ((s.keywords ?? []).some((k) => k.toLowerCase() === kw)) score += 5;
    for (const t of tokens) if (hay.includes(t)) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }

  if (best && best.excerpt) {
    return {
      explanation: `In the context of "${node.topic ?? "this section"}", "${node.name}" comes up here: ${best.excerpt}`,
      timestamp: best.timestamp ?? node.timestamp,
      matched: best,
    };
  }

  return {
    explanation: `"${node.name}" is a supporting concept under "${node.topic ?? "this topic"}". Jump to the timestamp below to hear it explained in the lecture.`,
    timestamp: node.timestamp,
  };
};

interface MindMapTabProps {
  lecture: Lecture;
  videoUrl?: string;
}

export const MindMapTab = ({ lecture, videoUrl }: MindMapTabProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const [tool, setTool] = useState<Tool>("select");
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<TreeDatum | null>(null);

  useEffect(() => {
    setLabels({});
    setSelected(null);
  }, [lecture]);

  const treeData = useMemo(() => buildTree(lecture, labels), [lecture, labels]);

  // Pre-wrap labels per node id
  const wrappedById = useMemo(() => {
    const map = new Map<string, string[]>();
    const walk = (n: TreeDatum) => {
      map.set(n.id, wrapLabel(n.name, FONT_BY_KIND[n.kind]));
      n.children?.forEach(walk);
    };
    walk(treeData);
    return map;
  }, [treeData]);

  const rectFor = (n: d3.HierarchyNode<TreeDatum>) => {
    const fs = FONT_BY_KIND[n.data.kind];
    const lines = wrappedById.get(n.data.id) ?? [n.data.name];
    const widest = Math.max(...lines.map((l) => estimateLineWidth(l, fs)));
    const w = Math.min(MAX_NODE_WIDTH, widest + NODE_PAD_X * 2);
    const textHeight = lines.length * fs + (lines.length - 1) * LINE_GAP;
    const h = textHeight + NODE_PAD_Y * 2;
    return { w, h, fs, lines };
  };

  const { nodes, links, width, height } = useMemo(() => {
    const root = d3.hierarchy<TreeDatum>(treeData);

    const layout = d3
      .tree<TreeDatum>()
      .nodeSize([56, 280])
      .separation((a, b) => (a.parent === b.parent ? 1 : 1.4));

    layout(root);

    const allNodes = root.descendants();
    const allLinks = root.links();

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of allNodes) {
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
    }
    const padX = 80;
    const padY = 60;
    for (const n of allNodes) {
      const ox = n.y - minY + padX;
      const oy = n.x - minX + padY;
      (n as unknown as { _x: number })._x = ox;
      (n as unknown as { _y: number })._y = oy;
    }

    return {
      nodes: allNodes,
      links: allLinks,
      width: Math.max(800, maxY - minY + padX * 2 + 260),
      height: Math.max(420, maxX - minX + padY * 2 + 60),
    };
  }, [treeData]);

  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;
    const svg = d3.select(svgRef.current);
    const g = d3.select(gRef.current);

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.4, 2.5])
      .on("zoom", (event) => {
        g.attr("transform", event.transform.toString());
      });
    zoomRef.current = zoom;
    svg.call(zoom);

    if (containerRef.current) {
      const cw = containerRef.current.clientWidth;
      const initialX = Math.max(20, (cw - width) / 2);
      svg.call(zoom.transform, d3.zoomIdentity.translate(initialX > 0 ? initialX : 20, 20).scale(0.9));
    }

    return () => {
      svg.on(".zoom", null);
    };
  }, [width, height]);

  const handleNodeClick = (datum: TreeDatum) => {
    if (tool === "relabel") {
      const next = window.prompt("Rename this concept", datum.name);
      if (next && next.trim()) {
        setLabels((prev) => ({ ...prev, [datum.id]: next.trim() }));
      }
      return;
    }
    setSelected(datum);
  };

  const reset = () => setLabels({});

  const exportPng = async () => {
    if (!containerRef.current) return;
    try {
      const dataUrl = await toPng(containerRef.current, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${lecture.title.replace(/\s+/g, "-").toLowerCase()}-mindmap.png`;
      a.click();
    } catch (err) {
      console.error("Export failed", err);
    }
  };

  const zoomBy = (factor: number) => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(150).call(zoomRef.current.scaleBy, factor);
  };

  if (!lecture.outline.length) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center">
        <p className="text-sm text-muted-foreground">
          No outline topics available to build a map.
        </p>
      </div>
    );
  }

  const explanation = selected ? explainNode(selected, lecture) : null;
  const ytLink = explanation ? buildYoutubeLink(videoUrl, explanation.timestamp) : null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-card/60 p-5 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wider text-primary">
          Mind map
        </p>
        <h3 className="mt-1 text-lg font-semibold text-foreground">
          Concept hierarchy for this lecture
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Drag to pan, scroll to zoom. Click any node for a plain-language explanation and a jump-to link in the video.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
        <button
          onClick={() => setTool("select")}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
            tool === "select"
              ? "border-primary/50 bg-primary/10 text-primary shadow-sm"
              : "border-border bg-card text-foreground hover:border-primary/30",
          )}
        >
          <MousePointer2 className="h-3.5 w-3.5" />
          Explore
        </button>
        <button
          onClick={() => setTool("relabel")}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
            tool === "relabel"
              ? "border-primary/50 bg-primary/10 text-primary shadow-sm"
              : "border-border bg-card text-foreground hover:border-primary/30",
          )}
        >
          <Pencil className="h-3.5 w-3.5" />
          Relabel
        </button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => zoomBy(0.8)}>
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => zoomBy(1.25)}>
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5" />
            Reset labels
          </Button>
          <Button size="sm" onClick={exportPng} className="bg-gradient-primary">
            <Download className="h-3.5 w-3.5" />
            Save map
          </Button>
        </div>
      </div>

      <div className="px-1 text-xs text-muted-foreground">
        {tool === "relabel"
          ? "Click any node to rename it to your own term."
          : "Click any node for an AI explanation. Drag the canvas to pan."}
      </div>

      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-2xl border border-border bg-white shadow-sm"
        style={{ height: 560 }}
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          className="block bg-white"
          style={{ cursor: tool === "relabel" ? "pointer" : "grab" }}
        >
          <g ref={gRef}>
            <g className="links" fill="none" stroke="#cbd5e1" strokeWidth={1.4}>
              {links.map((l, i) => {
                const s = l.source as d3.HierarchyPointNode<TreeDatum>;
                const t = l.target as d3.HierarchyPointNode<TreeDatum>;
                const sx = (s as unknown as { _x: number })._x;
                const sy = (s as unknown as { _y: number })._y;
                const tx = (t as unknown as { _x: number })._x;
                const ty = (t as unknown as { _y: number })._y;
                const sRect = rectFor(s);
                const tRect = rectFor(t);
                const x0 = sx + sRect.w / 2;
                const x1 = tx - tRect.w / 2;
                const midX = (x0 + x1) / 2;
                const d = `M${x0},${sy} C${midX},${sy} ${midX},${ty} ${x1},${ty}`;
                return <path key={i} d={d} />;
              })}
            </g>

            <g className="nodes">
              {nodes.map((n) => {
                const x = (n as unknown as { _x: number })._x;
                const y = (n as unknown as { _y: number })._y;
                const { w, h, fs, lines } = rectFor(n);
                const isSelected = selected?.id === n.data.id;
                const fill =
                  n.data.kind === "root"
                    ? "#f1f5f9"
                    : n.data.kind === "branch"
                    ? "#f8fafc"
                    : "#ffffff";
                const stroke = isSelected
                  ? "hsl(var(--primary))"
                  : n.data.kind === "root"
                  ? "#94a3b8"
                  : "#cbd5e1";
                const strokeWidth = isSelected ? 2 : n.data.kind === "root" ? 1.5 : 1;
                const totalTextHeight = lines.length * fs + (lines.length - 1) * LINE_GAP;
                const firstBaselineY = (h - totalTextHeight) / 2 + fs * 0.82;
                return (
                  <g
                    key={n.data.id}
                    transform={`translate(${x - w / 2},${y - h / 2})`}
                    onClick={() => handleNodeClick(n.data)}
                    style={{ cursor: "pointer" }}
                  >
                    <rect
                      width={w}
                      height={h}
                      rx={10}
                      ry={10}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                    />
                    <text
                      x={w / 2}
                      textAnchor="middle"
                      fontSize={fs}
                      fontWeight={n.data.kind === "root" ? 700 : n.data.kind === "branch" ? 600 : 500}
                      fill="#0f172a"
                      style={{ pointerEvents: "none", fontFamily: "inherit" }}
                    >
                      {lines.map((line, i) => (
                        <tspan
                          key={i}
                          x={w / 2}
                          y={firstBaselineY + i * (fs + LINE_GAP)}
                        >
                          {line}
                        </tspan>
                      ))}
                    </text>
                  </g>
                );
              })}
            </g>
          </g>
        </svg>

        {selected && explanation && (
          <div className="absolute right-4 top-4 z-10 w-80 max-w-[calc(100%-2rem)] rounded-2xl border border-border bg-card/95 p-4 shadow-xl backdrop-blur">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {selected.kind === "root" ? "Lecture" : selected.kind === "branch" ? "Topic" : "Concept"}
                  </p>
                  <h4 className="text-sm font-semibold leading-tight text-foreground">
                    {selected.name}
                  </h4>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Close"
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-foreground/90">
              {explanation.explanation}
            </p>
            {explanation.timestamp && (
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                <span className="text-[11px] text-muted-foreground">Jump to in video</span>
                {ytLink ? (
                  <a
                    href={ytLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/20"
                  >
                    {explanation.timestamp}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-xs font-medium text-foreground">{explanation.timestamp}</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MindMapTab;
