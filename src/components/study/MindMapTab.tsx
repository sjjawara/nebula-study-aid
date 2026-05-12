import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { toPng } from "html-to-image";
import {
  Pencil,
  Download,
  RotateCcw,
  MousePointer2,
  ZoomIn,
  ZoomOut,
  X,
  ExternalLink,
  Sparkles,
  Plus,
  Trash2,
  GripHorizontal,
  Maximize2,
  Minimize2,
  Move,
} from "lucide-react";
import type { Lecture, SearchMoment } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { buildYoutubeUrl } from "@/lib/timestamp";

type Tool = "select" | "relabel";

interface CustomNode {
  id: string;
  parentId: string;
  label: string;
}

interface PersistedState {
  labels: Record<string, string>;
  notes: Record<string, string>;
  customNodes: CustomNode[];
  positions: Record<string, { x: number; y: number }>;
}

interface TreeDatum {
  id: string;
  name: string;
  kind: "root" | "branch" | "leaf" | "custom";
  topic?: string;
  timestamp?: string;
  keyword?: string;
  isCustom?: boolean;
  children?: TreeDatum[];
}

const NODE_PAD_X = 16;
const NODE_PAD_Y = 12;
const FONT_BY_KIND = { root: 15, branch: 13, leaf: 11, custom: 12 } as const;
const MAX_NODE_WIDTH = 220;
const LINE_GAP = 4;

const estimateLineWidth = (text: string, fontSize: number) =>
  Math.max(40, text.length * (fontSize * 0.58));

const wrapLabel = (text: string, fontSize: number): string[] => {
  const maxLineWidth = MAX_NODE_WIDTH - NODE_PAD_X * 2;
  if (estimateLineWidth(text, fontSize) <= maxLineWidth) return [text];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w;
    if (estimateLineWidth(candidate, fontSize) <= maxLineWidth) current = candidate;
    else {
      if (current) lines.push(current);
      current = w;
      if (lines.length === 1) break;
    }
  }
  if (current) lines.push(current);
  if (lines.length === 1) return lines;
  const usedFirst = lines[0].split(/\s+/).length;
  const rest = words.slice(usedFirst).join(" ");
  let line2 = rest;
  while (line2 && estimateLineWidth(line2 + "…", fontSize) > maxLineWidth) line2 = line2.slice(0, -1);
  if (line2 !== rest) line2 = line2.trimEnd() + "…";
  return [lines[0], line2 || rest];
};

const buildTree = (
  lecture: Lecture,
  labelOverrides: Record<string, string>,
  customNodes: CustomNode[],
): TreeDatum => {
  const labelOf = (id: string, fallback: string) => labelOverrides[id] ?? fallback;

  const customByParent = new Map<string, CustomNode[]>();
  for (const c of customNodes) {
    const arr = customByParent.get(c.parentId) ?? [];
    arr.push(c);
    customByParent.set(c.parentId, arr);
  }

  const attachCustom = (parentId: string, parentTopic?: string, parentTs?: string): TreeDatum[] => {
    const list = customByParent.get(parentId) ?? [];
    return list.map((c) => ({
      id: c.id,
      name: labelOf(c.id, c.label),
      kind: "custom",
      isCustom: true,
      topic: parentTopic,
      timestamp: parentTs,
      children: attachCustom(c.id, parentTopic, parentTs),
    }));
  };

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
          children: attachCustom(id, o.topic, o.timestamp),
        };
      });
    const branchCustomChildren = attachCustom(branchId, o.topic, o.timestamp);
    return {
      id: branchId,
      name: labelOf(branchId, o.topic),
      kind: "branch",
      topic: o.topic,
      timestamp: o.timestamp,
      children: [...leaves, ...branchCustomChildren].length
        ? [...leaves, ...branchCustomChildren]
        : undefined,
    };
  });

  const rootCustom = attachCustom("root");
  return {
    id: "root",
    name: labelOf("root", lecture.title),
    kind: "root",
    children: [...branches, ...rootCustom],
  };
};

const buildYoutubeLink = (videoUrl: string | undefined, ts: string | undefined): string | null =>
  buildYoutubeUrl(videoUrl, ts);



const tokenize = (s: string): string[] =>
  s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2);

const explainNode = (
  node: TreeDatum,
  lecture: Lecture,
): { explanation: string; timestamp?: string; matched?: SearchMoment } => {
  if (node.isCustom) {
    return { explanation: "", timestamp: node.timestamp };
  }
  if (node.kind === "root") {
    return {
      explanation: `${lecture.title}:\n\nThis mind map breaks the lecture into its main topics (branches) and the supporting keywords (leaves) covered in each one. Click any topic or keyword to see what it means and jump to the moment it's discussed in the video.`,
    };
  }
  const idx = lecture.searchIndex;
  if (node.kind === "branch") {
    const m =
      idx.find((s) => s.timestamp === node.timestamp) ??
      idx.find((s) => s.topic && node.topic && s.topic === node.topic);
    if (m && m.excerpt)
      return {
        explanation: `Topic — "${node.name}":\n\n${m.excerpt}`,
        timestamp: m.timestamp ?? node.timestamp,
        matched: m,
      };
    return {
      explanation: `Topic — "${node.name}":\n\nOne of the main topics covered in this lecture. Open the timestamp below to hear how the instructor introduces and develops this idea in context.`,
      timestamp: node.timestamp,
    };
  }
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
      explanation: `In "${node.topic ?? "this section"}" — "${node.name}":\n\n${best.excerpt}`,
      timestamp: best.timestamp ?? node.timestamp,
      matched: best,
    };
  }
  return {
    explanation: `Under "${node.topic ?? "this topic"}" — "${node.name}":\n\nA supporting concept. Jump to the timestamp below to hear it explained in the lecture.`,
    timestamp: node.timestamp,
  };
};

const storageKey = (lecture: Lecture) => `mindmap:${lecture.title}`;

interface MindMapTabProps {
  lecture: Lecture;
  videoUrl?: string;
}

export const MindMapTab = ({ lecture, videoUrl }: MindMapTabProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const transformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);

  const [tool, setTool] = useState<Tool>("select");
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [customNodes, setCustomNodes] = useState<CustomNode[]>([]);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [selected, setSelected] = useState<TreeDatum | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const draggingRef = useRef<{ id: string; startX: number; startY: number; baseX: number; baseY: number; moved: boolean } | null>(null);

  // Load persisted state on lecture change
  useEffect(() => {
    setSelected(null);
    try {
      const raw = localStorage.getItem(storageKey(lecture));
      if (raw) {
        const parsed: PersistedState = JSON.parse(raw);
        setLabels(parsed.labels ?? {});
        setNotes(parsed.notes ?? {});
        setCustomNodes(parsed.customNodes ?? []);
        setPositions(parsed.positions ?? {});
        return;
      }
    } catch {
      /* ignore */
    }
    setLabels({});
    setNotes({});
    setCustomNodes([]);
    setPositions({});
  }, [lecture]);

  // Persist state
  useEffect(() => {
    try {
      const data: PersistedState = { labels, notes, customNodes, positions };
      localStorage.setItem(storageKey(lecture), JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }, [lecture, labels, notes, customNodes, positions]);

  const treeData = useMemo(() => buildTree(lecture, labels, customNodes), [lecture, labels, customNodes]);

  const wrappedById = useMemo(() => {
    const map = new Map<string, string[]>();
    const walk = (n: TreeDatum) => {
      map.set(n.id, wrapLabel(n.name, FONT_BY_KIND[n.kind]));
      n.children?.forEach(walk);
    };
    walk(treeData);
    return map;
  }, [treeData]);

  const rectFor = (n: { data: TreeDatum }) => {
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
    const layout = d3.tree<TreeDatum>().nodeSize([56, 280]).separation((a, b) => (a.parent === b.parent ? 1 : 1.4));
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
      const override = positions[n.data.id];
      (n as unknown as { _x: number })._x = override ? override.x : ox;
      (n as unknown as { _y: number })._y = override ? override.y : oy;
    }
    return {
      nodes: allNodes,
      links: allLinks,
      width: Math.max(800, maxY - minY + padX * 2 + 260),
      height: Math.max(420, maxX - minX + padY * 2 + 60),
    };
  }, [treeData, positions]);

  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;
    const svg = d3.select(svgRef.current);
    const g = d3.select(gRef.current);
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 2.5])
      .filter((event) => {
        // Allow wheel always; allow drag only on background (not nodes)
        if (event.type === "wheel") return true;
        const target = event.target as Element | null;
        if (target && target.closest("[data-node]")) return false;
        return !event.button;
      })
      .on("zoom", (event) => {
        transformRef.current = event.transform;
        g.attr("transform", event.transform.toString());
      });
    zoomRef.current = zoom;
    svg.call(zoom);
    if (containerRef.current) {
      const cw = containerRef.current.clientWidth;
      const initialX = Math.max(20, (cw - width) / 2);
      const t = d3.zoomIdentity.translate(initialX > 0 ? initialX : 20, 20).scale(0.9);
      svg.call(zoom.transform, t);
      transformRef.current = t;
    }
    return () => {
      svg.on(".zoom", null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lecture]);

  const handleNodeClick = (datum: TreeDatum) => {
    if (draggingRef.current?.moved) return;
    if (tool === "relabel" && !datum.isCustom) {
      const next = window.prompt("Rename this concept", datum.name);
      if (next && next.trim()) setLabels((prev) => ({ ...prev, [datum.id]: next.trim() }));
      return;
    }
    setSelected(datum);
  };

  const handleNodePointerDown = (e: React.PointerEvent<SVGGElement>, datum: TreeDatum, baseX: number, baseY: number) => {
    if (tool !== "select") return;
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    draggingRef.current = {
      id: datum.id,
      startX: e.clientX,
      startY: e.clientY,
      baseX,
      baseY,
      moved: false,
    };
  };

  const handleNodePointerMove = (e: React.PointerEvent<SVGGElement>) => {
    const d = draggingRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    d.moved = true;
    const k = transformRef.current.k || 1;
    setPositions((prev) => ({ ...prev, [d.id]: { x: d.baseX + dx / k, y: d.baseY + dy / k } }));
  };

  const handleNodePointerUp = (e: React.PointerEvent<SVGGElement>) => {
    const d = draggingRef.current;
    if (d) {
      try { (e.currentTarget as Element).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    // Keep moved flag briefly so click handler can read it, then clear
    setTimeout(() => { draggingRef.current = null; }, 0);
  };

  const addChild = (parentId: string) => {
    const id = `c:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`;
    const newNode: CustomNode = { id, parentId, label: "New concept" };
    setCustomNodes((prev) => [...prev, newNode]);
    // Open popover for editing after a tick (need tree to rebuild)
    setTimeout(() => {
      setSelected({ id, name: "New concept", kind: "custom", isCustom: true });
    }, 0);
  };

  const deleteCustomNode = (id: string) => {
    // Recursively delete this node and any custom descendants
    const toDelete = new Set<string>([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const c of customNodes) {
        if (toDelete.has(c.parentId) && !toDelete.has(c.id)) {
          toDelete.add(c.id);
          changed = true;
        }
      }
    }
    setCustomNodes((prev) => prev.filter((c) => !toDelete.has(c.id)));
    setNotes((prev) => {
      const next = { ...prev };
      for (const idd of toDelete) delete next[idd];
      return next;
    });
    setLabels((prev) => {
      const next = { ...prev };
      for (const idd of toDelete) delete next[idd];
      return next;
    });
    setPositions((prev) => {
      const next = { ...prev };
      for (const idd of toDelete) delete next[idd];
      return next;
    });
    setSelected(null);
  };

  const reset = () => {
    setLabels({});
    setNotes({});
    setCustomNodes([]);
    setPositions({});
    setSelected(null);
  };

  const exportPng = async () => {
    if (!containerRef.current) return;
    try {
      const dataUrl = await toPng(containerRef.current, { backgroundColor: "#ffffff", pixelRatio: 2 });
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
        <p className="text-sm text-muted-foreground">No outline topics available to build a map.</p>
      </div>
    );
  }

  const explanation = selected && !selected.isCustom ? explainNode(selected, lecture) : null;
  const popoverTimestamp = explanation?.timestamp ?? selected?.timestamp;
  const ytLink = buildYoutubeLink(videoUrl, popoverTimestamp);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-card/60 p-5 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wider text-primary">Mind map</p>
        <h3 className="mt-1 text-lg font-semibold text-foreground">Concept hierarchy for this lecture</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Drag the background to pan, scroll to zoom. Drag nodes to rearrange. Hover a node and click + to add your own.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
        <button
          onClick={() => setTool("select")}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
            tool === "select" ? "border-primary/50 bg-primary/10 text-primary shadow-sm" : "border-border bg-card text-foreground hover:border-primary/30",
          )}
        >
          <MousePointer2 className="h-3.5 w-3.5" />
          Explore
        </button>
        <button
          onClick={() => setTool("relabel")}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
            tool === "relabel" ? "border-primary/50 bg-primary/10 text-primary shadow-sm" : "border-border bg-card text-foreground hover:border-primary/30",
          )}
        >
          <Pencil className="h-3.5 w-3.5" />
          Relabel
        </button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => zoomBy(0.8)}><ZoomOut className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="sm" onClick={() => zoomBy(1.25)}><ZoomIn className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="sm" onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5" />
            Reset map
          </Button>
          <Button size="sm" onClick={exportPng} className="bg-gradient-primary">
            <Download className="h-3.5 w-3.5" />
            Save map
          </Button>
        </div>
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
                return <path key={i} d={d} strokeDasharray={t.data.isCustom ? "4 3" : undefined} />;
              })}
            </g>

            <g className="nodes">
              {nodes.map((n) => {
                const x = (n as unknown as { _x: number })._x;
                const y = (n as unknown as { _y: number })._y;
                const { w, h, fs, lines } = rectFor(n);
                const isSelected = selected?.id === n.data.id;
                const isCustom = n.data.isCustom;
                const fill = isCustom
                  ? "hsl(var(--primary) / 0.08)"
                  : n.data.kind === "root"
                  ? "#f1f5f9"
                  : n.data.kind === "branch"
                  ? "#f8fafc"
                  : "#ffffff";
                const stroke = isSelected
                  ? "hsl(var(--primary))"
                  : isCustom
                  ? "hsl(var(--primary))"
                  : n.data.kind === "root"
                  ? "#94a3b8"
                  : "#cbd5e1";
                const strokeWidth = isSelected ? 2 : isCustom ? 1.4 : n.data.kind === "root" ? 1.5 : 1;
                const totalTextHeight = lines.length * fs + (lines.length - 1) * LINE_GAP;
                const firstBaselineY = (h - totalTextHeight) / 2 + fs * 0.82;
                const hasNote = !!notes[n.data.id]?.trim();
                return (
                  <g
                    key={n.data.id}
                    data-node
                    transform={`translate(${x - w / 2},${y - h / 2})`}
                    onClick={() => handleNodeClick(n.data)}
                    onPointerDown={(e) => handleNodePointerDown(e, n.data, x, y)}
                    onPointerMove={handleNodePointerMove}
                    onPointerUp={handleNodePointerUp}
                    onMouseEnter={() => setHoveredId(n.data.id)}
                    onMouseLeave={() => setHoveredId((cur) => (cur === n.data.id ? null : cur))}
                    style={{ cursor: tool === "relabel" ? "pointer" : "grab", touchAction: "none" }}
                  >
                    <rect
                      width={w}
                      height={h}
                      rx={10}
                      ry={10}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      strokeDasharray={isCustom ? "4 3" : undefined}
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
                        <tspan key={i} x={w / 2} y={firstBaselineY + i * (fs + LINE_GAP)}>
                          {line}
                        </tspan>
                      ))}
                    </text>
                    {hasNote && (
                      <circle cx={w - 6} cy={6} r={4} fill="hsl(var(--primary))" style={{ pointerEvents: "none" }} />
                    )}
                    {hoveredId === n.data.id && tool === "select" && (
                      <g
                        transform={`translate(${w + 4}, ${h / 2 - 11})`}
                        onClick={(e) => {
                          e.stopPropagation();
                          addChild(n.data.id);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        style={{ cursor: "pointer" }}
                      >
                        <circle cx={11} cy={11} r={11} fill="hsl(var(--primary))" />
                        <line x1={6} y1={11} x2={16} y2={11} stroke="white" strokeWidth={2} strokeLinecap="round" />
                        <line x1={11} y1={6} x2={11} y2={16} stroke="white" strokeWidth={2} strokeLinecap="round" />
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
          </g>
        </svg>

        {selected && (
          <NodePopover
            key={selected.id}
            node={selected}
            explanation={explanation?.explanation ?? ""}
            timestamp={popoverTimestamp}
            ytLink={ytLink}
            note={notes[selected.id] ?? ""}
            currentLabel={labels[selected.id] ?? selected.name}
            onClose={() => setSelected(null)}
            onNoteChange={(v) => setNotes((prev) => ({ ...prev, [selected.id]: v }))}
            onLabelChange={(v) => setLabels((prev) => ({ ...prev, [selected.id]: v }))}
            onDelete={selected.isCustom ? () => deleteCustomNode(selected.id) : undefined}
            containerRef={containerRef}
          />
        )}
      </div>
    </div>
  );
};

interface NodePopoverProps {
  node: TreeDatum;
  explanation: string;
  timestamp?: string;
  ytLink: string | null;
  note: string;
  currentLabel: string;
  onClose: () => void;
  onNoteChange: (v: string) => void;
  onLabelChange: (v: string) => void;
  onDelete?: () => void;
}

// Session-persistent popover size (resets on full reload, persists across opens).
const popoverSize = { width: 320, height: 360 };
const MIN_W = 250;
const MIN_H = 150;
const MAX_W = 600;
const MAX_H = 400;

const NodePopover = ({
  node,
  explanation,
  timestamp,
  ytLink,
  note,
  currentLabel,
  onClose,
  onNoteChange,
  onLabelChange,
  onDelete,
}: NodePopoverProps) => {
  const isCustom = !!node.isCustom;
  const [size, setSize] = useState({ width: popoverSize.width, height: popoverSize.height });
  const dragState = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);

  const onResizeDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: size.width,
      startH: size.height,
    };
  };

  const onResizeMove = (e: React.PointerEvent) => {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    const width = Math.min(MAX_W, Math.max(MIN_W, dragState.current.startW + dx));
    const height = Math.min(MAX_H, Math.max(MIN_H, dragState.current.startH + dy));
    setSize({ width, height });
    popoverSize.width = width;
    popoverSize.height = height;
  };

  const onResizeUp = (e: React.PointerEvent) => {
    dragState.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className="absolute right-4 top-4 z-10 max-w-[calc(100%-2rem)] flex flex-col rounded-2xl border border-border bg-card/95 shadow-xl backdrop-blur"
      style={{ width: size.width, height: size.height }}
    >
     <div className="flex-1 overflow-y-auto p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {isCustom ? "Your concept" : node.kind === "root" ? "Lecture" : node.kind === "branch" ? "Topic" : "Concept"}
            </p>
            {isCustom ? (
              <Input
                value={currentLabel}
                onChange={(e) => onLabelChange(e.target.value)}
                className="mt-0.5 h-7 text-sm font-semibold"
                placeholder="Concept name"
              />
            ) : (
              <h4 className="text-sm font-semibold leading-tight text-foreground truncate">{currentLabel}</h4>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {!isCustom && explanation && (
        <p className="mt-3 text-xs leading-relaxed text-foreground/90">{explanation}</p>
      )}

      <div className="mt-3">
        <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Your notes
        </label>
        <Textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="Add your thoughts, connections, or study notes…"
          className="mt-1 min-h-[80px] text-xs"
        />
      </div>

      {timestamp && ytLink && (
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <span className="text-[11px] text-muted-foreground">Jump to in video</span>
          <button
            type="button"
            onClick={() => window.open(ytLink, "_blank", "noopener,noreferrer")}
            className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/20"
          >
            {timestamp}
            <ExternalLink className="h-3 w-3" />
          </button>
        </div>
      )}

      {onDelete && (
        <div className="mt-3 border-t border-border pt-3">
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3 w-3" />
            Delete concept
          </button>
        </div>
      )}
      </div>
      <div
        role="slider"
        aria-label="Resize popover"
        onPointerDown={onResizeDown}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeUp}
        onPointerCancel={onResizeUp}
        className="absolute bottom-1 right-1 flex h-5 w-5 cursor-nwse-resize items-center justify-center rounded-md text-muted-foreground/60 hover:bg-muted hover:text-foreground"
        style={{ touchAction: "none" }}
      >
        <GripHorizontal className="h-3.5 w-3.5 -rotate-45" />
      </div>
    </div>
  );
};

export default MindMapTab;
