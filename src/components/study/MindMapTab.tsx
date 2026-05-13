import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { toPng } from "html-to-image";
import {
  Pencil,
  Download,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  X,
  ExternalLink,
  Sparkles,
  Trash2,
  GripHorizontal,
  Maximize2,
  Minimize2,
  Move,
  Search as SearchIcon,
  ArrowLeft,
  ArrowRight,
  Undo2,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import type { Lecture, SearchMoment } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { buildYoutubeUrl } from "@/lib/timestamp";
import { useT } from "@/lib/i18n";

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
  deletedIds: string[];
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
  deletedIds: Set<string>,
): TreeDatum => {
  const labelOf = (id: string, fallback: string) => labelOverrides[id] ?? fallback;

  const customByParent = new Map<string, CustomNode[]>();
  for (const c of customNodes) {
    if (deletedIds.has(c.id)) continue;
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

  const branches: TreeDatum[] = lecture.outline
    .map((o, i) => {
      const branchId = `b:${o.timestamp}-${i}`;
      if (deletedIds.has(branchId)) return null;
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
          return { id, k, j };
        })
        .filter((x) => !deletedIds.has(x.id))
        .map(({ id, k }) => ({
          id,
          name: labelOf(id, k),
          kind: "leaf" as const,
          keyword: k,
          topic: o.topic,
          timestamp: o.timestamp,
          children: attachCustom(id, o.topic, o.timestamp),
        }));
      const branchCustomChildren = attachCustom(branchId, o.topic, o.timestamp);
      return {
        id: branchId,
        name: labelOf(branchId, o.topic),
        kind: "branch" as const,
        topic: o.topic,
        timestamp: o.timestamp,
        children: [...leaves, ...branchCustomChildren].length
          ? [...leaves, ...branchCustomChildren]
          : undefined,
      } as TreeDatum;
    })
    .filter((b): b is TreeDatum => b !== null);

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

  const [labels, setLabels] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [customNodes, setCustomNodes] = useState<CustomNode[]>([]);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<TreeDatum | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);
  const [pulseId, setPulseId] = useState<string | null>(null);
  const previousTransformRef = useRef<d3.ZoomTransform | null>(null);
  // History for undo (snapshots of full state). Up to 5 entries.
  const historyRef = useRef<PersistedState[]>([]);
  const [historyVersion, setHistoryVersion] = useState(0);

  const snapshot = useCallback((): PersistedState => ({
    labels: { ...labels },
    notes: { ...notes },
    customNodes: customNodes.map((c) => ({ ...c })),
    positions: { ...positions },
    deletedIds: Array.from(deletedIds),
  }), [labels, notes, customNodes, positions, deletedIds]);

  const pushHistory = useCallback(() => {
    historyRef.current = [snapshot(), ...historyRef.current].slice(0, 5);
    setHistoryVersion((v) => v + 1);
  }, [snapshot]);

  const restoreSnapshot = (s: PersistedState) => {
    setLabels(s.labels ?? {});
    setNotes(s.notes ?? {});
    setCustomNodes(s.customNodes ?? []);
    setPositions(s.positions ?? {});
    setDeletedIds(new Set(s.deletedIds ?? []));
  };

  const undoLast = () => {
    const [prev, ...rest] = historyRef.current;
    if (!prev) return;
    historyRef.current = rest;
    setHistoryVersion((v) => v + 1);
    restoreSnapshot(prev);
    toast.success("Undid last action");
  };

  const draggingRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
    moved: boolean;
    descendants: { id: string; dx: number; dy: number }[];
    lerpIds: Set<string>;
  } | null>(null);
  const nodesRef = useRef<d3.HierarchyNode<TreeDatum>[]>([]);

  // Load persisted state on lecture change
  useEffect(() => {
    setSelected(null);
    setQuery("");
    historyRef.current = [];
    try {
      const raw = localStorage.getItem(storageKey(lecture));
      if (raw) {
        const parsed: PersistedState = JSON.parse(raw);
        setLabels(parsed.labels ?? {});
        setNotes(parsed.notes ?? {});
        setCustomNodes(parsed.customNodes ?? []);
        setPositions(parsed.positions ?? {});
        setDeletedIds(new Set(parsed.deletedIds ?? []));
        return;
      }
    } catch {
      /* ignore */
    }
    setLabels({});
    setNotes({});
    setCustomNodes([]);
    setPositions({});
    setDeletedIds(new Set());
  }, [lecture]);

  // Persist state
  useEffect(() => {
    try {
      const data: PersistedState = { labels, notes, customNodes, positions, deletedIds: Array.from(deletedIds) };
      localStorage.setItem(storageKey(lecture), JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }, [lecture, labels, notes, customNodes, positions, deletedIds]);

  const treeData = useMemo(() => buildTree(lecture, labels, customNodes, deletedIds), [lecture, labels, customNodes, deletedIds]);

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

  // Keep latest laid-out nodes available to pointer handlers.
  nodesRef.current = nodes;

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

  const { t } = useT();
  const handleNodeClick = (datum: TreeDatum) => {
    if (draggingRef.current?.moved) return;
    setSelected(datum);
  };

  const handleNodePointerDown = (e: React.PointerEvent<SVGGElement>, datum: TreeDatum, baseX: number, baseY: number) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);

    // Collect all descendants (children + deeper) and their offsets relative to the dragged node
    const descendants: { id: string; dx: number; dy: number }[] = [];
    const lerpIds = new Set<string>();
    const draggedHierNode = nodesRef.current.find((n) => n.data.id === datum.id);
    if (draggedHierNode) {
      const baseDepth = draggedHierNode.depth;
      const sub = draggedHierNode.descendants();
      for (const d of sub) {
        if (d.data.id === datum.id) continue;
        const cx = (d as unknown as { _x: number })._x;
        const cy = (d as unknown as { _y: number })._y;
        descendants.push({ id: d.data.id, dx: cx - baseX, dy: cy - baseY });
        if (d.depth - baseDepth >= 2) lerpIds.add(d.data.id);
      }
    }

    draggingRef.current = {
      id: datum.id,
      startX: e.clientX,
      startY: e.clientY,
      baseX,
      baseY,
      moved: false,
      descendants,
      lerpIds,
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
    const newX = d.baseX + dx / k;
    const newY = d.baseY + dy / k;
    setPositions((prev) => {
      const next = { ...prev, [d.id]: { x: newX, y: newY } };
      for (const child of d.descendants) {
        next[child.id] = { x: newX + child.dx, y: newY + child.dy };
      }
      return next;
    });
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
      setSelected({ id, name: t("New concept"), kind: "custom", isCustom: true });
    }, 0);
  };

  const deleteNode = (id: string) => {
    if (id === "root") {
      toast.error("Can't delete the root node");
      return;
    }
    pushHistory();
    // Find node label for toast
    const target = nodesRef.current.find((n) => n.data.id === id);
    const label = target?.data.name ?? "Node";

    // Collect custom descendants to remove
    const customToRemove = new Set<string>();
    const queue = [id];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const c of customNodes) {
        if (c.parentId === cur && !customToRemove.has(c.id)) {
          customToRemove.add(c.id);
          queue.push(c.id);
        }
      }
    }
    if (id.startsWith("c:")) customToRemove.add(id);

    if (customToRemove.size) {
      setCustomNodes((prev) => prev.filter((c) => !customToRemove.has(c.id)));
    }
    if (!id.startsWith("c:")) {
      setDeletedIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    }
    setSelected(null);

    toast(`${label} deleted`, {
      duration: 10000,
      action: {
        label: "Undo",
        onClick: () => undoLast(),
      },
    });
  };

  const resetPositions = () => { pushHistory(); setPositions({}); };
  const resetNotes = () => { pushHistory(); setNotes({}); };

  const resetCustomNodes = () => {
    pushHistory();
    setCustomNodes([]);
    setPositions((prev) => {
      const next: Record<string, { x: number; y: number }> = {};
      for (const k of Object.keys(prev)) if (!k.startsWith("c:")) next[k] = prev[k];
      return next;
    });
    setNotes((prev) => {
      const next: Record<string, string> = {};
      for (const k of Object.keys(prev)) if (!k.startsWith("c:")) next[k] = prev[k];
      return next;
    });
    setLabels((prev) => {
      const next: Record<string, string> = {};
      for (const k of Object.keys(prev)) if (!k.startsWith("c:")) next[k] = prev[k];
      return next;
    });
    setSelected(null);
  };

  const resetEverything = () => {
    pushHistory();
    setLabels({});
    setNotes({});
    setCustomNodes([]);
    setPositions({});
    setDeletedIds(new Set());
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

  // ---- Search ----
  const normalizedQuery = query.trim().toLowerCase();
  const matchIds = useMemo(() => {
    if (!normalizedQuery) return [] as string[];
    const ids: string[] = [];
    for (const n of nodes) {
      const hay = `${n.data.name} ${notes[n.data.id] ?? ""}`.toLowerCase();
      if (hay.includes(normalizedQuery)) ids.push(n.data.id);
    }
    return ids;
  }, [normalizedQuery, nodes, notes]);
  const matchSet = useMemo(() => new Set(matchIds), [matchIds]);

  const focusNode = useCallback((id: string) => {
    if (!svgRef.current || !zoomRef.current || !containerRef.current) return;
    const node = nodesRef.current.find((n) => n.data.id === id);
    if (!node) return;
    const x = (node as unknown as { _x: number })._x;
    const y = (node as unknown as { _y: number })._y;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    const currentK = transformRef.current.k || 1;
    const targetK = Math.min(2.5, Math.max(0.6, currentK * 1.5));
    const tx = cw / 2 - x * targetK;
    const ty = ch / 2 - y * targetK;
    const target = d3.zoomIdentity.translate(tx, ty).scale(targetK);
    d3.select(svgRef.current).transition().duration(400).ease(d3.easeCubicInOut).call(zoomRef.current.transform, target);
    setPulseId(id);
    window.setTimeout(() => setPulseId((p) => (p === id ? null : p)), 900);
  }, []);

  // When matches change, auto-focus first if exactly one; reset index otherwise.
  useEffect(() => {
    if (!normalizedQuery) {
      // Restore previous viewport when search cleared
      if (previousTransformRef.current && svgRef.current && zoomRef.current) {
        d3.select(svgRef.current).transition().duration(400).ease(d3.easeCubicInOut).call(zoomRef.current.transform, previousTransformRef.current);
        previousTransformRef.current = null;
      }
      setMatchIndex(0);
      return;
    }
    if (!previousTransformRef.current) {
      previousTransformRef.current = transformRef.current;
    }
    setMatchIndex(0);
    if (matchIds.length === 1) {
      focusNode(matchIds[0]);
    }
  }, [normalizedQuery, matchIds, focusNode]);

  const cycleMatch = (delta: number) => {
    if (!matchIds.length) return;
    const next = (matchIndex + delta + matchIds.length) % matchIds.length;
    setMatchIndex(next);
    focusNode(matchIds[next]);
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
        <p className="text-xs font-medium uppercase tracking-wider text-primary">{t("Mind map")}</p>
        <h3 className="mt-1 text-lg font-semibold text-foreground">{t("Concept hierarchy for this lecture")}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("Drag the background to pan, scroll to zoom. Drag nodes to rearrange. Hover a node and click + to add your own.")}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
        <div className="relative flex items-center">
          <SearchIcon className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && matchIds.length) {
                e.preventDefault();
                cycleMatch(1);
              } else if (e.key === "Escape") {
                setQuery("");
              }
            }}
            placeholder={t("Search nodes & notes…")}
            className="h-9 w-56 pl-8 pr-2 text-xs"
          />
        </div>
        {normalizedQuery && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>
              {matchIds.length === 0
                ? t("No matches")
                : matchIds.length === 1
                ? t("1 match")
                : `${matchIndex + 1} / ${matchIds.length} ${t("matches")}`}
            </span>
            {matchIds.length > 1 && (
              <>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => cycleMatch(-1)} aria-label="Previous match">
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => cycleMatch(1)} aria-label="Next match">
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={undoLast}
            disabled={historyRef.current.length === 0}
            aria-label="Undo"
            title={t("Undo last action")}
          >
            <Undo2 className="h-3.5 w-3.5" />
            {t("Undo")}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => zoomBy(0.8)} aria-label="Zoom out"><ZoomOut className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="sm" onClick={() => zoomBy(1.25)} aria-label="Zoom in"><ZoomIn className="h-3.5 w-3.5" /></Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <RotateCcw className="h-3.5 w-3.5" />
                {t("Reset")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={resetPositions}>{t("Reset Positions")}</DropdownMenuItem>
              <DropdownMenuItem onClick={resetNotes}>{t("Reset Notes")}</DropdownMenuItem>
              <DropdownMenuItem onClick={resetCustomNodes}>{t("Reset Custom Nodes")}</DropdownMenuItem>
              <DropdownMenuItem onClick={resetEverything} className="text-destructive focus:text-destructive">
                {t("Reset Everything")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" onClick={exportPng} className="bg-gradient-primary">
            <Download className="h-3.5 w-3.5" />
            {t("Save map")}
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
          style={{ cursor: "grab" }}
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
                const dim = normalizedQuery && !(matchSet.has(s.data.id) && matchSet.has(t.data.id));
                return <path key={i} d={d} strokeDasharray={t.data.isCustom ? "4 3" : undefined} style={{ opacity: dim ? 0.2 : 1, transition: "opacity 200ms" }} />;
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
                const shouldLerp = draggingRef.current?.lerpIds?.has(n.data.id);
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
                    style={{
                      cursor: "grab",
                      touchAction: "none",
                      transition: shouldLerp ? "transform 150ms ease-out" : "opacity 200ms",
                      opacity: normalizedQuery && !matchSet.has(n.data.id) ? 0.2 : 1,
                    }}
                  >
                    {pulseId === n.data.id && (
                      <rect
                        x={-4}
                        y={-4}
                        width={w + 8}
                        height={h + 8}
                        rx={12}
                        ry={12}
                        fill="none"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        style={{ animation: "pulse 1s ease-out 2" }}
                      />
                    )}
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
                    {hoveredId === n.data.id && (
                      <g
                        transform={`translate(${w - 12}, ${h / 2 - 12})`}
                        onClick={(e) => {
                          e.stopPropagation();
                          addChild(n.data.id);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        style={{ cursor: "pointer" }}
                        aria-label="Add child concept"
                      >
                        <circle cx={12} cy={12} r={16} fill="transparent" />
                        <circle
                          cx={12}
                          cy={12}
                          r={12}
                          fill="hsl(var(--primary))"
                          stroke="white"
                          strokeWidth={1.5}
                        />
                        <line x1={6} y1={12} x2={18} y2={12} stroke="white" strokeWidth={2} strokeLinecap="round" />
                        <line x1={12} y1={6} x2={12} y2={18} stroke="white" strokeWidth={2} strokeLinecap="round" />
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
  containerRef: React.RefObject<HTMLDivElement>;
}

// Session-persistent popover size + position (resets on full reload).
const popoverState: {
  width: number;
  height: number;
  position: { x: number; y: number } | null;
} = { width: 320, height: 360, position: null };
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
  containerRef,
}: NodePopoverProps) => {
  const { t } = useT();
  const isCustom = !!node.isCustom;
  const [size, setSize] = useState({ width: popoverState.width, height: popoverState.height });
  const [position, setPosition] = useState<{ x: number; y: number } | null>(popoverState.position);
  const [maximized, setMaximized] = useState(false);
  const resizeState = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);
  const moveState = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const clampPosition = (x: number, y: number, w: number, h: number) => {
    const c = containerRef.current;
    if (!c) return { x, y };
    const maxX = Math.max(0, c.clientWidth - w);
    const maxY = Math.max(0, c.clientHeight - h);
    return {
      x: Math.min(maxX, Math.max(0, x)),
      y: Math.min(maxY, Math.max(0, y)),
    };
  };

  // Initialize default position (top-right) once container size is known.
  useEffect(() => {
    if (position || maximized) return;
    const c = containerRef.current;
    if (!c) return;
    const x = Math.max(0, c.clientWidth - size.width - 16);
    setPosition({ x, y: 16 });
  }, [position, maximized, size.width, containerRef]);

  // ---- Resize ----
  const onResizeDown = (e: React.PointerEvent) => {
    if (maximized) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    resizeState.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: size.width,
      startH: size.height,
    };
  };

  const onResizeMove = (e: React.PointerEvent) => {
    if (!resizeState.current) return;
    const dx = e.clientX - resizeState.current.startX;
    const dy = e.clientY - resizeState.current.startY;
    const width = Math.min(MAX_W, Math.max(MIN_W, resizeState.current.startW + dx));
    const height = Math.min(MAX_H, Math.max(MIN_H, resizeState.current.startH + dy));
    setSize({ width, height });
    popoverState.width = width;
    popoverState.height = height;
    if (position) {
      const clamped = clampPosition(position.x, position.y, width, height);
      if (clamped.x !== position.x || clamped.y !== position.y) {
        setPosition(clamped);
        popoverState.position = clamped;
      }
    }
  };

  const onResizeUp = (e: React.PointerEvent) => {
    resizeState.current = null;
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  // ---- Drag (header) ----
  const onMoveDown = (e: React.PointerEvent) => {
    if (maximized) return;
    if ((e.target as HTMLElement).closest("button, input, textarea")) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    moveState.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseX: position?.x ?? 0,
      baseY: position?.y ?? 0,
    };
  };

  const onMoveMove = (e: React.PointerEvent) => {
    if (!moveState.current) return;
    const dx = e.clientX - moveState.current.startX;
    const dy = e.clientY - moveState.current.startY;
    const next = clampPosition(
      moveState.current.baseX + dx,
      moveState.current.baseY + dy,
      size.width,
      size.height,
    );
    setPosition(next);
    popoverState.position = next;
  };

  const onMoveUp = (e: React.PointerEvent) => {
    moveState.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const toggleMaximize = () => setMaximized((m) => !m);

  const containerStyle: React.CSSProperties = maximized
    ? { left: 8, top: 8, right: 8, bottom: 8, width: "auto", height: "auto" }
    : {
        left: position?.x ?? undefined,
        top: position?.y ?? undefined,
        width: size.width,
        height: size.height,
      };

  return (
    <div
      ref={popoverRef}
      className="absolute z-10 flex flex-col rounded-2xl border border-border bg-card/95 shadow-xl backdrop-blur"
      style={containerStyle}
    >
      {/* Header is the drag handle */}
      <div
        onPointerDown={onMoveDown}
        onPointerMove={onMoveMove}
        onPointerUp={onMoveUp}
        onPointerCancel={onMoveUp}
        className={cn(
          "flex items-start justify-between gap-2 border-b border-border px-4 pt-4 pb-3 select-none",
          maximized ? "cursor-default" : "cursor-grab active:cursor-grabbing",
        )}
        style={{ touchAction: "none" }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
              {isCustom ? t("Your concept") : node.kind === "root" ? t("Lecture") : node.kind === "branch" ? t("Topic") : t("Concept")}
              {!maximized && <Move className="h-2.5 w-2.5 opacity-50" />}
            </p>
            {isCustom ? (
              <Input
                value={currentLabel}
                onChange={(e) => onLabelChange(e.target.value)}
                className="mt-0.5 h-7 text-sm font-semibold"
                placeholder={t("Concept name")}
                onPointerDown={(e) => e.stopPropagation()}
              />
            ) : (
              <h4 className="text-sm font-semibold leading-tight text-foreground truncate">{currentLabel}</h4>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={toggleMaximize}
            aria-label={maximized ? t("Restore") : t("Maximize")}
            title={maximized ? t("Restore") : t("Maximize")}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {maximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 flex-col p-4">
        {!isCustom && explanation && (
          <p className="shrink-0 max-h-[40%] overflow-y-auto text-xs leading-relaxed text-foreground/90 whitespace-pre-line">
            {explanation}
          </p>
        )}

        <div className="mt-3 flex flex-1 min-h-0 flex-col">
          <label className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {t("Your notes")}
          </label>
          <Textarea
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder={t("Add your thoughts, connections, or study notes…")}
            className="mt-1 flex-1 min-h-[80px] resize-none text-xs"
          />
        </div>

        {timestamp && ytLink && (
          <div className="mt-3 flex shrink-0 items-center justify-between border-t border-border pt-3">
            <span className="text-[11px] text-muted-foreground">{t("Jump to Video")}</span>
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
          <div className="mt-3 shrink-0 border-t border-border pt-3">
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3 w-3" />
              {t("Delete concept")}
            </button>
          </div>
        )}
      </div>

      {!maximized && (
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
      )}
    </div>
  );
};

export default MindMapTab;
