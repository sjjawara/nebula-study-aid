import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { toPng } from "html-to-image";
import { Pencil, Download, RotateCcw, MousePointer2, ZoomIn, ZoomOut } from "lucide-react";
import type { Lecture } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Tool = "select" | "relabel";

interface TreeDatum {
  id: string;
  name: string;
  kind: "root" | "branch" | "leaf";
  children?: TreeDatum[];
}

const NODE_PAD_X = 14;
const NODE_PAD_Y = 8;
const FONT_BY_KIND = { root: 15, branch: 13, leaf: 11 } as const;

// Estimate text width without measuring DOM (good enough for layout)
const estimateWidth = (text: string, fontSize: number) =>
  Math.min(260, Math.max(60, text.length * (fontSize * 0.58)));

const buildTree = (lecture: Lecture, labelOverrides: Record<string, string>): TreeDatum => {
  const labelOf = (id: string, fallback: string) => labelOverrides[id] ?? fallback;

  const branches: TreeDatum[] = lecture.outline.map((o, i) => {
    const branchId = `b:${o.timestamp}-${i}`;

    // Pull keywords from search index entries that share the timestamp/topic
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
        return { id, name: labelOf(id, k), kind: "leaf" };
      });

    return {
      id: branchId,
      name: labelOf(branchId, o.topic),
      kind: "branch",
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

export const MindMapTab = ({ lecture }: { lecture: Lecture }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const [tool, setTool] = useState<Tool>("select");
  const [labels, setLabels] = useState<Record<string, string>>({});

  // Reset overrides when lecture changes
  useEffect(() => {
    setLabels({});
  }, [lecture]);

  const treeData = useMemo(() => buildTree(lecture, labels), [lecture, labels]);

  // Compute layout
  const { nodes, links, width, height } = useMemo(() => {
    const root = d3.hierarchy<TreeDatum>(treeData);
    const depthCount = root.height + 1; // 3 typical (root/branch/leaf)
    const leafCount = Math.max(root.leaves().length, 4);

    // Horizontal layout: x = depth, y = vertical
    const layout = d3
      .tree<TreeDatum>()
      .nodeSize([42, 240])
      .separation((a, b) => (a.parent === b.parent ? 1 : 1.4));

    layout(root);

    const allNodes = root.descendants();
    const allLinks = root.links();

    // Normalize coords (d3.tree gives x = vertical, y = horizontal)
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
      // swap so tree grows left → right
      const ox = n.y - minY + padX;
      const oy = n.x - minX + padY;
      // store in custom fields
      (n as unknown as { _x: number })._x = ox;
      (n as unknown as { _y: number })._y = oy;
    }

    return {
      nodes: allNodes,
      links: allLinks,
      width: Math.max(800, maxY - minY + padX * 2 + 260),
      height: Math.max(420, maxX - minX + padY * 2 + 60),
      depthCount,
      leafCount,
    };
  }, [treeData]);

  // Setup zoom/pan
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

    // Center initially
    if (containerRef.current) {
      const cw = containerRef.current.clientWidth;
      const initialX = Math.max(20, (cw - width) / 2);
      svg.call(zoom.transform, d3.zoomIdentity.translate(initialX > 0 ? initialX : 20, 20).scale(0.9));
    }

    return () => {
      svg.on(".zoom", null);
    };
  }, [width, height]);

  const handleNodeClick = (id: string, current: string) => {
    if (tool !== "relabel") return;
    const next = window.prompt("Rename this concept", current);
    if (next && next.trim()) {
      setLabels((prev) => ({ ...prev, [id]: next.trim() }));
    }
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

  // Pre-compute rect dimensions per node
  const rectFor = (n: d3.HierarchyPointNode<TreeDatum> | d3.HierarchyNode<TreeDatum>) => {
    const fs = FONT_BY_KIND[n.data.kind];
    const w = estimateWidth(n.data.name, fs) + NODE_PAD_X * 2;
    const h = fs + NODE_PAD_Y * 2 + 4;
    return { w, h, fs };
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-card/60 p-5 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wider text-primary">
          Mind map
        </p>
        <h3 className="mt-1 text-lg font-semibold text-foreground">
          Concept hierarchy for this lecture
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          The lecture title is the root, major topics branch out, and supporting keywords sit at the leaves.
          Drag to pan, scroll to zoom, and rename any node to wording that clicks for you.
        </p>
      </div>

      {/* Toolbar */}
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
          Move
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

      {/* Hint */}
      <div className="px-1 text-xs text-muted-foreground">
        {tool === "relabel"
          ? "Click any node to rename it to your own term."
          : "Drag the canvas to pan. Scroll or use the zoom buttons to scale."}
      </div>

      {/* Canvas */}
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
            {/* Links */}
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

            {/* Nodes */}
            <g className="nodes">
              {nodes.map((n) => {
                const x = (n as unknown as { _x: number })._x;
                const y = (n as unknown as { _y: number })._y;
                const { w, h, fs } = rectFor(n);
                const fill =
                  n.data.kind === "root"
                    ? "#f1f5f9"
                    : n.data.kind === "branch"
                    ? "#f8fafc"
                    : "#ffffff";
                const stroke = n.data.kind === "root" ? "#94a3b8" : "#cbd5e1";
                const strokeWidth = n.data.kind === "root" ? 1.5 : 1;
                return (
                  <g
                    key={n.data.id}
                    transform={`translate(${x - w / 2},${y - h / 2})`}
                    onClick={() => handleNodeClick(n.data.id, n.data.name)}
                    style={{ cursor: tool === "relabel" ? "pointer" : "default" }}
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
                      y={h / 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={fs}
                      fontWeight={n.data.kind === "root" ? 700 : n.data.kind === "branch" ? 600 : 500}
                      fill="#0f172a"
                      style={{ pointerEvents: "none", fontFamily: "inherit" }}
                    >
                      {n.data.name.length > 38 ? n.data.name.slice(0, 37) + "…" : n.data.name}
                    </text>
                  </g>
                );
              })}
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
};

export default MindMapTab;
