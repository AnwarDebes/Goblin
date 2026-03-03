"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSystemHealth } from "@/lib/api";
import type { SystemHealth } from "@/types";

/* ── Dependency map ──────────────────────────────────────────────── */

const DEPENDENCIES: Record<string, string[]> = {
  "market-data": ["redis", "timescaledb"],
  "feature-store": ["redis", "timescaledb", "market-data"],
  prediction: ["redis", "feature-store"],
  signal: ["redis", "prediction", "sentiment-analysis", "trend-analysis"],
  risk: ["redis", "position"],
  "portfolio-optimizer": ["redis", "position", "risk"],
  executor: ["redis", "portfolio-optimizer", "signal"],
  position: ["redis", "timescaledb"],
  "sentiment-analysis": ["redis", "timescaledb"],
  "trend-analysis": ["redis", "timescaledb", "market-data"],
  backtesting: ["redis", "timescaledb", "prediction"],
  "api-gateway": [
    "market-data", "feature-store", "prediction", "signal", "risk",
    "portfolio-optimizer", "executor", "position", "sentiment-analysis",
    "trend-analysis", "backtesting", "redis", "timescaledb",
  ],
  dashboard: ["api-gateway"],
};

/* ── Layer colors ─────────────────────────────────────────────────── */

type Layer = "infra" | "data" | "intelligence" | "execution" | "interface";

const LAYER_MAP: Record<string, Layer> = {
  redis: "infra",
  timescaledb: "infra",
  "market-data": "data",
  "feature-store": "data",
  prediction: "intelligence",
  "sentiment-analysis": "intelligence",
  "trend-analysis": "intelligence",
  signal: "execution",
  risk: "execution",
  "portfolio-optimizer": "execution",
  executor: "execution",
  position: "execution",
  backtesting: "intelligence",
  "api-gateway": "interface",
  dashboard: "interface",
};

const LAYER_COLORS: Record<Layer, { fill: string; stroke: string; text: string }> = {
  infra: { fill: "#78350f", stroke: "#f59e0b", text: "#fbbf24" },
  data: { fill: "#1e3a5f", stroke: "#3b82f6", text: "#60a5fa" },
  intelligence: { fill: "#3b1f6e", stroke: "#8b5cf6", text: "#a78bfa" },
  execution: { fill: "#14532d", stroke: "#22c55e", text: "#4ade80" },
  interface: { fill: "#1f2937", stroke: "#9ca3af", text: "#d1d5db" },
};

const LAYER_LABELS: Record<Layer, string> = {
  infra: "Infrastructure",
  data: "Data Layer",
  intelligence: "Intelligence",
  execution: "Execution",
  interface: "Interface",
};

/* ── Layout positions (manually arranged for clarity) ────────────── */

const NODE_POSITIONS: Record<string, { x: number; y: number }> = {
  // Infrastructure
  redis: { x: 200, y: 50 },
  timescaledb: { x: 420, y: 50 },
  // Data layer
  "market-data": { x: 100, y: 160 },
  "feature-store": { x: 340, y: 160 },
  // Intelligence
  prediction: { x: 230, y: 260 },
  "sentiment-analysis": { x: 480, y: 260 },
  "trend-analysis": { x: 60, y: 260 },
  backtesting: { x: 580, y: 160 },
  // Execution
  signal: { x: 320, y: 360 },
  risk: { x: 120, y: 360 },
  "portfolio-optimizer": { x: 160, y: 450 },
  executor: { x: 360, y: 450 },
  position: { x: 520, y: 360 },
  // Interface
  "api-gateway": { x: 300, y: 540 },
  dashboard: { x: 300, y: 620 },
};

const NODE_WIDTH = 130;
const NODE_HEIGHT = 36;

/* ── Component ────────────────────────────────────────────────────── */

export default function DependencyGraph() {
  const [dragNode, setDragNode] = useState<string | null>(null);
  const [positions, setPositions] = useState(NODE_POSITIONS);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  const { data: healthData } = useQuery({
    queryKey: ["health"],
    queryFn: getSystemHealth,
    refetchInterval: 15000,
  });

  const healthMap = useMemo(() => {
    const map: Record<string, SystemHealth["status"]> = {};
    if (healthData) {
      for (const h of healthData) {
        map[h.service_name] = h.status;
      }
    }
    return map;
  }, [healthData]);

  const onMouseDown = useCallback((e: React.MouseEvent, node: string) => {
    e.preventDefault();
    const pos = positions[node];
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    setDragNode(node);
  }, [positions]);

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragNode) return;
      setPositions((prev) => ({
        ...prev,
        [dragNode]: {
          x: e.clientX - dragOffset.current.x,
          y: e.clientY - dragOffset.current.y,
        },
      }));
    },
    [dragNode]
  );

  const onMouseUp = useCallback(() => {
    setDragNode(null);
  }, []);

  // Build edges
  const edges: { from: string; to: string }[] = [];
  for (const [service, deps] of Object.entries(DEPENDENCIES)) {
    for (const dep of deps) {
      if (service === "api-gateway") continue; // too many edges, skip
      edges.push({ from: service, to: dep });
    }
  }
  // Add api-gateway -> dashboard
  edges.push({ from: "dashboard", to: "api-gateway" });

  return (
    <div className="card">
      <h3 className="section-title mb-3">Service Dependency Graph</h3>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-3">
        {(Object.keys(LAYER_COLORS) as Layer[]).map((layer) => (
          <div key={layer} className="flex items-center gap-1.5 text-xs">
            <div
              className="h-3 w-3 rounded"
              style={{ backgroundColor: LAYER_COLORS[layer].stroke }}
            />
            <span className="text-gray-400">{LAYER_LABELS[layer]}</span>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-800 bg-gray-950/80">
        <svg
          ref={svgRef}
          width="680"
          height="680"
          viewBox="0 0 680 680"
          className="w-full"
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#4b5563" />
            </marker>
          </defs>

          {/* Edges */}
          {edges.map(({ from, to }, i) => {
            const fromPos = positions[from];
            const toPos = positions[to];
            if (!fromPos || !toPos) return null;

            const fx = fromPos.x + NODE_WIDTH / 2;
            const fy = fromPos.y + NODE_HEIGHT / 2;
            const tx = toPos.x + NODE_WIDTH / 2;
            const ty = toPos.y + NODE_HEIGHT / 2;

            const mx = (fx + tx) / 2;
            const my = (fy + ty) / 2 - 15;

            const isHighlighted = hoveredNode === from || hoveredNode === to;

            return (
              <path
                key={`${from}-${to}-${i}`}
                d={`M ${fx} ${fy} Q ${mx} ${my} ${tx} ${ty}`}
                fill="none"
                stroke={isHighlighted ? "#22c55e" : "#374151"}
                strokeWidth={isHighlighted ? 1.5 : 0.8}
                opacity={isHighlighted ? 0.8 : 0.3}
                markerEnd="url(#arrowhead)"
                className="transition-all"
              />
            );
          })}

          {/* Nodes */}
          {Object.entries(positions).map(([name, pos]) => {
            const layer = LAYER_MAP[name] || "interface";
            const colors = LAYER_COLORS[layer];
            const status = healthMap[name] || "down";
            const isDown = status === "down";

            return (
              <g
                key={name}
                onMouseDown={(e) => onMouseDown(e, name)}
                onMouseEnter={() => setHoveredNode(name)}
                onMouseLeave={() => setHoveredNode(null)}
                className="cursor-grab active:cursor-grabbing"
              >
                <rect
                  x={pos.x}
                  y={pos.y}
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx={8}
                  fill={colors.fill}
                  stroke={isDown ? "#ef4444" : colors.stroke}
                  strokeWidth={1.5}
                  opacity={0.9}
                  className={isDown ? "animate-pulse" : ""}
                />
                {/* Status dot */}
                <circle
                  cx={pos.x + 14}
                  cy={pos.y + NODE_HEIGHT / 2}
                  r={4}
                  fill={
                    status === "healthy"
                      ? "#22c55e"
                      : status === "degraded"
                      ? "#f59e0b"
                      : "#ef4444"
                  }
                />
                <text
                  x={pos.x + 24}
                  y={pos.y + NODE_HEIGHT / 2 + 4}
                  fill={colors.text}
                  fontSize={11}
                  fontWeight={500}
                  fontFamily="monospace"
                >
                  {name.length > 15 ? name.slice(0, 14) + "..." : name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="text-[10px] text-gray-600 mt-2">Drag nodes to rearrange. Api-gateway edges hidden for clarity.</p>
    </div>
  );
}
