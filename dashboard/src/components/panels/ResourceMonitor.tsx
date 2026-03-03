"use client";

import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { getResourceMetrics } from "@/lib/api";
import type { ResourceMetrics } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Cpu, HardDrive, Wifi, Server } from "lucide-react";

/* ── Circular Progress Gauge ─────────────────────────────────────── */

function CircularGauge({
  value,
  max,
  label,
  subLabel,
  icon: Icon,
  thresholds,
}: {
  value: number;
  max: number;
  label: string;
  subLabel: string;
  icon: React.ElementType;
  thresholds?: { yellow: number; red: number };
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  let color = "#22c55e";
  if (thresholds) {
    if (pct > thresholds.red) color = "#ef4444";
    else if (pct > thresholds.yellow) color = "#f59e0b";
  }

  return (
    <div className="card-hover flex flex-col items-center gap-2 py-4">
      <div className="relative h-24 w-24">
        <svg className="h-24 w-24 -rotate-90" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r={radius} fill="none" stroke="#1f2937" strokeWidth="6" />
          <circle
            cx="48" cy="48" r={radius} fill="none"
            stroke={color} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Icon size={16} className="text-gray-400 mb-0.5" />
          <span className="text-lg font-bold text-white">{pct.toFixed(1)}%</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-gray-500">{subLabel}</p>
      </div>
    </div>
  );
}

/* ── Inline Progress Bar ──────────────────────────────────────────── */

function InlineBar({ value, max, thresholds }: { value: number; max: number; thresholds?: { yellow: number; red: number } }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  let barColor = "bg-goblin-500";
  if (thresholds) {
    if (pct > thresholds.red) barColor = "bg-red-500";
    else if (pct > thresholds.yellow) barColor = "bg-yellow-500";
  }
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-gray-700">
        <div className={cn("h-1.5 rounded-full transition-all", barColor)} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="text-xs font-mono text-gray-400 w-12 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}

/* ── Container Expand Mini-Chart ──────────────────────────────────── */

function MiniChart({ container }: { container: string }) {
  // Generate 30 mock data points for the expanded row
  const data = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => ({
        time: i,
        cpu: 5 + Math.random() * 40 + (container === "prediction" ? 30 : 0),
        memory: 10 + Math.random() * 30 + (container === "prediction" ? 40 : 0),
      })),
    [container]
  );

  return (
    <div className="grid grid-cols-2 gap-4 p-4 bg-gray-950/50 rounded-lg">
      <div>
        <p className="text-xs text-gray-500 mb-2">CPU Usage (last 30 readings)</p>
        <ResponsiveContainer width="100%" height={80}>
          <AreaChart data={data}>
            <Area type="monotone" dataKey="cpu" stroke="#22c55e" fill="rgba(34,197,94,0.1)" strokeWidth={1.5} />
            <XAxis hide />
            <YAxis hide domain={[0, 100]} />
            <Tooltip
              contentStyle={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 8, fontSize: 11 }}
              labelStyle={{ display: "none" }}
              formatter={(v: number) => [`${v.toFixed(1)}%`, "CPU"]}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-2">Memory Usage (last 30 readings)</p>
        <ResponsiveContainer width="100%" height={80}>
          <AreaChart data={data}>
            <Area type="monotone" dataKey="memory" stroke="#f59e0b" fill="rgba(245,158,11,0.1)" strokeWidth={1.5} />
            <XAxis hide />
            <YAxis hide domain={[0, 100]} />
            <Tooltip
              contentStyle={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 8, fontSize: 11 }}
              labelStyle={{ display: "none" }}
              formatter={(v: number) => [`${v.toFixed(1)}%`, "Memory"]}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ── Memory Allocation Bar ────────────────────────────────────────── */

const PALETTE = [
  "#ef4444", "#3b82f6", "#06b6d4", "#8b5cf6", "#a78bfa",
  "#22c55e", "#f97316", "#fbbf24", "#10b981", "#14b8a6",
  "#ec4899", "#6366f1", "#84cc16", "#0ea5e9", "#6b7280",
];

function MemoryAllocationBar({ metrics }: { metrics: ResourceMetrics[] }) {
  const totalMemory = 24 * 1024; // 24GB in MB
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className="card">
      <h3 className="section-title mb-3">Memory Allocation (24 GB Total)</h3>
      <div className="relative h-8 rounded-full bg-gray-800 overflow-hidden flex">
        {metrics.map((m, i) => {
          const width = (m.memory_used_mb / totalMemory) * 100;
          if (width < 0.1) return null;
          return (
            <div
              key={m.container}
              className="relative h-full transition-all cursor-pointer"
              style={{ width: `${width}%`, backgroundColor: PALETTE[i % PALETTE.length] }}
              onMouseEnter={() => setHovered(m.container)}
              onMouseLeave={() => setHovered(null)}
            >
              {hovered === m.container && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap rounded bg-gray-900 border border-gray-700 px-2 py-1 text-xs text-white z-10">
                  {m.container}: {m.memory_used_mb.toFixed(0)} MB ({((m.memory_used_mb / totalMemory) * 100).toFixed(1)}%)
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        {metrics.map((m, i) => (
          <div key={m.container} className="flex items-center gap-1 text-[10px] text-gray-400">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
            {m.container}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main ResourceMonitor ─────────────────────────────────────────── */

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return `${h}h ${m}m`;
}

export default function ResourceMonitor() {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<keyof ResourceMetrics>("container");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const { data: metrics = [] } = useQuery({
    queryKey: ["resource-metrics"],
    queryFn: getResourceMetrics,
    refetchInterval: 10000,
  });

  const totalCpu = metrics.reduce((sum, m) => sum + m.cpu_percent, 0);
  const totalMemUsed = metrics.reduce((sum, m) => sum + m.memory_used_mb, 0);
  const totalMemLimit = 24 * 1024; // 24GB
  const totalNetRx = metrics.reduce((sum, m) => sum + m.network_rx_mb, 0);
  const totalNetTx = metrics.reduce((sum, m) => sum + m.network_tx_mb, 0);
  const runningCount = metrics.filter((m) => m.status === "running").length;

  const sorted = useMemo(() => {
    return [...metrics].sort((a, b) => {
      const av = a[sortBy];
      const bv = b[sortBy];
      if (typeof av === "string" && typeof bv === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      if (typeof av === "number" && typeof bv === "number") return sortDir === "asc" ? av - bv : bv - av;
      return 0;
    });
  }, [metrics, sortBy, sortDir]);

  const handleSort = (col: keyof ResourceMetrics) => {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(col); setSortDir("asc"); }
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
        <CircularGauge
          value={totalCpu} max={metrics.length * 100}
          label="Total CPU" subLabel={`${totalCpu.toFixed(1)}% of ${metrics.length * 100}%`}
          icon={Cpu} thresholds={{ yellow: 70, red: 85 }}
        />
        <CircularGauge
          value={totalMemUsed} max={totalMemLimit}
          label="Total Memory" subLabel={`${(totalMemUsed / 1024).toFixed(1)} / ${(totalMemLimit / 1024).toFixed(0)} GB`}
          icon={HardDrive} thresholds={{ yellow: 70, red: 85 }}
        />
        <div className="card-hover flex flex-col items-center justify-center gap-2 py-4">
          <Wifi size={20} className="text-goblin-500" />
          <p className="text-lg font-bold text-white">{(totalNetRx + totalNetTx).toFixed(1)} MB/s</p>
          <p className="text-sm font-medium text-white">Network I/O</p>
          <p className="text-xs text-gray-500">RX: {totalNetRx.toFixed(1)} / TX: {totalNetTx.toFixed(1)}</p>
        </div>
        <div className="card-hover flex flex-col items-center justify-center gap-2 py-4">
          <Server size={20} className="text-goblin-500" />
          <p className="text-lg font-bold text-white">{runningCount} / {metrics.length}</p>
          <p className="text-sm font-medium text-white">Active Containers</p>
          <p className="text-xs text-gray-500">{metrics.length - runningCount} stopped</p>
        </div>
      </div>

      {/* Container Resource Table */}
      <div className="card overflow-x-auto -mx-3 sm:mx-0 rounded-none sm:rounded-xl border-x-0 sm:border-x">
        <h3 className="section-title mb-3">Container Resources</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left text-xs text-gray-500">
              {[
                { key: "container", label: "Container" },
                { key: "status", label: "Status" },
                { key: "cpu_percent", label: "CPU %" },
                { key: "memory_percent", label: "Memory" },
                { key: "network_rx_mb", label: "Network I/O" },
                { key: "uptime_seconds", label: "Uptime" },
                { key: "restart_count", label: "Restarts" },
              ].map(({ key, label }) => (
                <th
                  key={key}
                  className="pb-2 pr-4 font-medium cursor-pointer hover:text-gray-300 transition-colors"
                  onClick={() => handleSort(key as keyof ResourceMetrics)}
                >
                  {label} {sortBy === key && (sortDir === "asc" ? "^" : "v")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => (
              <React.Fragment key={m.container}>
                <tr
                  className={cn(
                    "border-b border-gray-800/50 cursor-pointer transition-colors hover:bg-gray-800/30",
                    expandedRow === m.container && "bg-gray-800/20"
                  )}
                  onClick={() => setExpandedRow(expandedRow === m.container ? null : m.container)}
                >
                  <td className="py-2 pr-4 font-medium text-white">{m.container}</td>
                  <td className="py-2 pr-4">
                    <div className={cn(
                      "h-2 w-2 rounded-full inline-block",
                      m.status === "running" ? "bg-green-500" : m.status === "restarting" ? "bg-yellow-500" : "bg-red-500"
                    )} />
                    <span className="ml-1.5 text-gray-400">{m.status}</span>
                  </td>
                  <td className="py-2 pr-4">
                    <InlineBar value={m.cpu_percent} max={100} thresholds={{ yellow: 60, red: 85 }} />
                  </td>
                  <td className="py-2 pr-4">
                    <InlineBar value={m.memory_used_mb} max={m.memory_limit_mb || 512} thresholds={{ yellow: 70, red: 85 }} />
                    <span className="text-[10px] text-gray-500 mt-0.5 block">
                      {(m.memory_used_mb || 0).toFixed(0)} / {(m.memory_limit_mb || 512).toFixed(0)} MB
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-gray-400 font-mono text-xs">
                    {(m.network_rx_mb || 0).toFixed(1)} / {(m.network_tx_mb || 0).toFixed(1)}
                  </td>
                  <td className="py-2 pr-4 text-gray-400">{formatUptime(m.uptime_seconds || 0)}</td>
                  <td className="py-2 pr-4 text-gray-400">{m.restart_count || 0}</td>
                </tr>
                {expandedRow === m.container && (
                  <tr>
                    <td colSpan={7} className="px-2 py-2">
                      <MiniChart container={m.container} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Memory Allocation Bar */}
      <MemoryAllocationBar metrics={metrics} />
    </div>
  );
}
