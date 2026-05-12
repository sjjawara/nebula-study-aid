import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { toPng } from "html-to-image";
import {
  Link2,
  Scale,
  Pencil,
  ShieldCheck,
  Download,
  RotateCcw,
  MousePointer2,
} from "lucide-react";
import type { Lecture, BloomLevel } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Tool = "select" | "connect" | "weight" | "relabel";

interface NodeDatum extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  bloom: BloomLevel;
  type: "core" | "sub";
  isolated?: boolean;
}

interface LinkDatum extends d3.SimulationLinkDatum<NodeDatum> {
  id: string;
  weight: 1 | 2 | 3;
}

const CORE_BLOOMS: BloomLevel[] = ["Analyze", "Evaluate", "Create"];

const bloomDot: Record<BloomLevel, string> = {
  Remember: "bg-bloom-remember",
  Understand: "bg-bloom-understand",
  Apply: "bg-bloom-apply",
  Analyze: "bg-bloom-analyze",
  Evaluate: "bg-bloom-evaluate",
  Create: "bg-bloom-create",
};

const weightToStroke = (w: number) => (w === 1 ? 1.5 : w === 2 ? 3.5 : 6);

export const MindMapTab = ({ lecture }: { lecture: Lecture }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const simRef = useRef<d3.Simulation<NodeDatum, LinkDatum> | null>(null);

  const [tool, setTool] = useState<Tool>("select");
  const [pendingNodeId, setPendingNodeId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [checked, setChecked] = useState(false);

  const initialNodes = useMemo<NodeDatum[]>(() => {
    const seen = new Set<string>();
    const nodes: NodeDatum[] = [];
    for (const o of lecture.outline) {
      const id = `${o.timestamp}-${o.topic}`;
      if (seen.has(id)) continue;
      seen.add(id);
      nodes.push({
        id,
        label: o.topic,
        bloom: o.bloom,
        type: CORE_BLOOMS.includes(o.bloom) ? "core" : "sub",
      });
    }
    return nodes;
  }, [lecture]);

  const nodesRef = useRef<NodeDatum[]>([]);
  const linksRef = useRef<LinkDatum[]>([]);

  // Initialize state once per lecture
  useEffect(() => {
    nodesRef.current = initialNodes.map((n) => ({ ...n }));
    linksRef.current = [];
    setPendingNodeId(null);
    setChecked(false);
    setVersion((v) => v + 1);
  }, [initialNodes]);

  // D3 setup + redraw on version change
  useEffect(() => {
    if (!svgRef.current || !gRef.current || !containerRef.current) return;
    const width = containerRef.current.clientWidth;
    const height = 520;

    const svg = d3.select(svgRef.current);
    const g = d3.select(gRef.current);

    // Zoom / pan
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 2.5])
      .on("zoom", (event) => {
        g.attr("transform", event.transform.toString());
      });
    svg.call(zoom);

    // Stop any prior sim
    simRef.current?.stop();

    const sim = d3
      .forceSimulation<NodeDatum>(nodesRef.current)
      .force(
        "link",
        d3
          .forceLink<NodeDatum, LinkDatum>(linksRef.current)
          .id((d) => d.id)
          .distance(140)
          .strength(0.4),
      )
      .force("charge", d3.forceManyBody().strength(-260))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide<NodeDatum>().radius(54));
    simRef.current = sim;

    // Links
    const linkSel = g
      .select<SVGGElement>(".links")
      .selectAll<SVGLineElement, LinkDatum>("line")
      .data(linksRef.current, (d) => d.id)
      .join(
        (enter) =>
          enter
            .append("line")
            .attr("stroke", "hsl(var(--muted-foreground))")
            .attr("stroke-opacity", 0.55)
            .attr("stroke-linecap", "round")
            .style("cursor", "pointer"),
        (update) => update,
        (exit) => exit.remove(),
      )
      .attr("stroke-width", (d) => weightToStroke(d.weight))
      .on("click", (event, d) => {
        event.stopPropagation();
        if (tool !== "weight") return;
        const next = ((d.weight % 3) + 1) as 1 | 2 | 3;
        d.weight = next;
        d3.select(event.currentTarget as SVGLineElement).attr(
          "stroke-width",
          weightToStroke(next),
        );
      });

    // Nodes
    const nodeG = g
      .select<SVGGElement>(".nodes")
      .selectAll<SVGGElement, NodeDatum>("g.node")
      .data(nodesRef.current, (d) => d.id)
      .join(
        (enter) => {
          const grp = enter.append("g").attr("class", "node").style("cursor", "pointer");
          grp
            .append("circle")
            .attr("r", (d) => (d.type === "core" ? 30 : 22))
            .attr("stroke-width", 2);
          grp
            .append("text")
            .attr("text-anchor", "middle")
            .attr("dy", (d) => (d.type === "core" ? 46 : 38))
            .attr("font-size", 11)
            .attr("font-weight", 500)
            .attr("fill", "hsl(var(--foreground))")
            .style("pointer-events", "none");
          grp
            .append("text")
            .attr("class", "bloom-tag")
            .attr("text-anchor", "middle")
            .attr("dy", 4)
            .attr("font-size", 9)
            .attr("font-weight", 600)
            .attr("fill", "hsl(var(--background))")
            .style("pointer-events", "none");
          return grp;
        },
        (update) => update,
        (exit) => exit.remove(),
      );

    nodeG
      .select("circle")
      .attr("fill", (d) =>
        d.isolated
          ? "hsl(38 92% 60%)"
          : d.type === "core"
          ? "hsl(238 75% 60%)"
          : "hsl(215 20% 50%)",
      )
      .attr("stroke", (d) =>
        d.id === pendingNodeId ? "hsl(238 90% 70%)" : "hsl(var(--background))",
      )
      .attr("stroke-dasharray", (d) => (d.id === pendingNodeId ? "4 3" : "0"));

    nodeG.select("text:not(.bloom-tag)").text((d) => {
      const max = d.type === "core" ? 28 : 22;
      return d.label.length > max ? d.label.slice(0, max - 1) + "…" : d.label;
    });
    nodeG.select("text.bloom-tag").text((d) => d.bloom.slice(0, 4).toUpperCase());

    nodeG.on("click", (event, d) => {
      event.stopPropagation();
      if (tool === "connect") {
        if (!pendingNodeId) {
          setPendingNodeId(d.id);
          return;
        }
        if (pendingNodeId === d.id) {
          setPendingNodeId(null);
          return;
        }
        const exists = linksRef.current.some(
          (l) =>
            ((l.source as NodeDatum).id === pendingNodeId &&
              (l.target as NodeDatum).id === d.id) ||
            ((l.source as NodeDatum).id === d.id &&
              (l.target as NodeDatum).id === pendingNodeId),
        );
        if (!exists) {
          linksRef.current.push({
            id: `${pendingNodeId}->${d.id}-${Date.now()}`,
            source: pendingNodeId,
            target: d.id,
            weight: 1,
          });
        }
        setPendingNodeId(null);
        setChecked(false);
        setVersion((v) => v + 1);
      } else if (tool === "relabel") {
        const next = window.prompt("Rename this concept", d.label);
        if (next && next.trim()) {
          d.label = next.trim();
          setVersion((v) => v + 1);
        }
      }
    });

    // Drag
    const drag = d3
      .drag<SVGGElement, NodeDatum>()
      .on("start", (event, d) => {
        if (!event.active) sim.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) sim.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });
    nodeG.call(drag);

    sim.on("tick", () => {
      linkSel
        .attr("x1", (d) => (d.source as NodeDatum).x ?? 0)
        .attr("y1", (d) => (d.source as NodeDatum).y ?? 0)
        .attr("x2", (d) => (d.target as NodeDatum).x ?? 0)
        .attr("y2", (d) => (d.target as NodeDatum).y ?? 0);
      nodeG.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => {
      sim.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, tool, pendingNodeId]);

  const checkStructure = () => {
    const connected = new Set<string>();
    for (const l of linksRef.current) {
      connected.add((l.source as NodeDatum).id ?? (l.source as unknown as string));
      connected.add((l.target as NodeDatum).id ?? (l.target as unknown as string));
    }
    nodesRef.current.forEach((n) => {
      n.isolated = !connected.has(n.id);
    });
    setChecked(true);
    setVersion((v) => v + 1);
  };

  const reset = () => {
    nodesRef.current = initialNodes.map((n) => ({ ...n }));
    linksRef.current = [];
    setPendingNodeId(null);
    setChecked(false);
    setVersion((v) => v + 1);
  };

  const exportPng = async () => {
    if (!containerRef.current) return;
    try {
      const dataUrl = await toPng(containerRef.current, {
        backgroundColor: "#f8fafc",
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

  const isolatedCount = checked
    ? nodesRef.current.filter((n) => n.isolated).length
    : 0;

  if (!initialNodes.length) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center">
        <p className="text-sm text-muted-foreground">
          No outline topics available to build a map.
        </p>
      </div>
    );
  }

  const ToolButton = ({
    value,
    icon: Icon,
    label,
    bloom,
  }: {
    value: Tool;
    icon: typeof Link2;
    label: string;
    bloom?: string;
  }) => {
    const active = tool === value;
    return (
      <button
        onClick={() => {
          setTool(value);
          setPendingNodeId(null);
        }}
        className={cn(
          "group flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
          active
            ? "border-primary/50 bg-primary/10 text-primary shadow-sm"
            : "border-border bg-card text-foreground hover:border-primary/30",
        )}
      >
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
        {bloom && (
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wider",
              active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground",
            )}
          >
            {bloom}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-card/60 p-5 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wider text-primary">
          Mind map builder
        </p>
        <h3 className="mt-1 text-lg font-semibold text-foreground">
          Connect, weight, and rename concepts
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Nothing is linked yet. Build the structure yourself — the act of grouping is
          where the learning happens.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
        <ToolButton value="select" icon={MousePointer2} label="Move" />
        <ToolButton value="connect" icon={Link2} label="Connect" bloom="Analyze" />
        <ToolButton value="weight" icon={Scale} label="Weight" bloom="Evaluate" />
        <ToolButton value="relabel" icon={Pencil} label="Relabel" bloom="Create" />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={checkStructure}>
            <ShieldCheck className="h-3.5 w-3.5" />
            Check structure
          </Button>
          <Button variant="ghost" size="sm" onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
          <Button size="sm" onClick={exportPng} className="bg-gradient-primary">
            <Download className="h-3.5 w-3.5" />
            Save map
          </Button>
        </div>
      </div>

      {/* Hint line */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
        <span>
          {tool === "connect" &&
            (pendingNodeId
              ? "Now click a second node to draw the connection."
              : "Click any two nodes to connect them.")}
          {tool === "weight" && "Click a line to cycle thin → medium → thick."}
          {tool === "relabel" && "Click a node to rename it."}
          {tool === "select" && "Drag nodes to arrange. Scroll to zoom."}
        </span>
        {checked && (
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11px] font-medium",
              isolatedCount > 0
                ? "border-amber-400/40 bg-amber-400/10 text-amber-700"
                : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700",
            )}
          >
            {isolatedCount > 0
              ? `${isolatedCount} isolated concept${isolatedCount === 1 ? "" : "s"}`
              : "All concepts are connected"}
          </span>
        )}
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-2xl border border-border bg-slate-50 shadow-sm"
        style={{ height: 520 }}
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          className="block"
          style={{
            backgroundImage:
              "radial-gradient(hsl(215 20% 85%) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        >
          <g ref={gRef}>
            <g className="links" />
            <g className="nodes" />
          </g>
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card px-4 py-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: "hsl(238 75% 60%)" }} />
          <span className="text-foreground">Core (Analyze / Evaluate / Create)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: "hsl(215 20% 50%)" }} />
          <span className="text-foreground">Sub (Remember / Understand / Apply)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: "hsl(38 92% 60%)" }} />
          <span className="text-muted-foreground">Isolated (after check)</span>
        </div>
        <div className="ml-auto flex items-center gap-3 text-muted-foreground">
          {(["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"] as BloomLevel[]).map(
            (b) => (
              <span key={b} className="flex items-center gap-1">
                <span className={cn("h-2 w-2 rounded-full", bloomDot[b])} />
                {b}
              </span>
            ),
          )}
        </div>
      </div>
    </div>
  );
};

export default MindMapTab;
