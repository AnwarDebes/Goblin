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
import { getResourceData } from "@/lib/api";
import type { ResourceMetrics, ResourceData } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Cpu, HardDrive, Wifi, Server, Zap } from "lucide-react";

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
      <span className="text-xs font-mono text-gray-400 w-12 text-right">{pct.toFixed(1)}%</span>
    </div>
  );
}

/* ── GPU Card ─────────────────────────────────────────────────────── */

function GpuCard({ gpu }: { gpu: NonNullable<ResourceData["system"]["gpu"]> }) {
  const vramPct = gpu.gpu_memory_total_mb > 0
    ? (gpu.gpu_memory_used_mb / gpu.gpu_memory_total_mb) * 100
    : 0;

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-3">
        <Zap size={16} className="text-goblin-500" />
        <h3 className="section-title mb-0">GPU</h3>
      </div>
      <p className="text-xs text-gray-500 mb-3">{gpu.gpu_name}</p>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-lg font-bold text-white">{gpu.gpu_utilization_percent}%</p>
          <p className="text-xs text-gray-500">Compute</p>
        </div>
        <div>
          <p className="text-lg font-bold text-white">{(gpu.gpu_memory_used_mb / 1024).toFixed(1)} GB</p>
          <p className="text-xs text-gray-500">VRAM ({vramPct.toFixed(0)}%)</p>
        </div>
        <div>
          <p className="text-lg font-bold text-white">{gpu.gpu_temperature_c}&deg;C</p>
          <p className="text-xs text-gray-500">{gpu.gpu_power_watts.toFixed(0)}W</p>
        </div>
      </div>
      <div className="mt-3">
        <InlineBar value={gpu.gpu_memory_used_mb} max={gpu.gpu_memory_total_mb} thresholds={{ yellow: 70, red: 90 }} />
        <span className="text-[10px] text-gray-500 mt-1 block">
          VRAM: {(gpu.gpu_memory_used_mb / 1024).toFixed(1)} / {(gpu.gpu_memory_total_mb / 1024).toFixed(0)} GB
        </span>
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

function MemoryAllocationBar({ metrics, totalMemoryMb }: { metrics: ResourceMetrics[]; totalMemoryMb: number }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const totalGB = (totalMemoryMb / 1024).toFixed(0);

  return (
    <div className="card">
      <h3 className="section-title mb-3">Memory Allocation ({totalGB} GB Total)</h3>
      <div className="relative h-8 rounded-full bg-gray-800 overflow-hidden flex">
        {metrics.map((m, i) => {
          const width = (m.memory_used_mb / totalMemoryMb) * 100;
          if (width < 0.05) return null;
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
                  {m.container}: {m.memory_used_mb >= 1024
                    ? `${(m.memory_used_mb / 1024).toFixed(1)} GB`
                    : `${m.memory_used_mb.toFixed(0)} MB`
                  } ({((m.memory_used_mb / totalMemoryMb) * 100).toFixed(1)}%)
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        {metrics
          .filter((m) => m.memory_used_mb > 10)
          .map((m, i) => (
            <div key={m.container} className="flex items-center gap-1 text-[10px] text-gray-400">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: PALETTE[metrics.indexOf(m) % PALETTE.length] }} />
              {m.container} ({m.memory_used_mb >= 1024 ? `${(m.memory_used_mb / 1024).toFixed(1)}G` : `${m.memory_used_mb.toFixed(0)}M`})
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

function formatMemory(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(0)} MB`;
}

export default function ResourceMonitor() {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<keyof ResourceMetrics>("memory_used_mb");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data } = useQuery({
    queryKey: ["resource-data"],
    queryFn: getResourceData,
    refetchInterval: 10000,
  });

  const metrics = data?.services ?? [];
  const sys = data?.system;

  const totalCpuMax = (sys?.cpu_count ?? 96) * 100;
  const totalCpu = metrics.reduce((sum, m) => sum + m.cpu_percent, 0);
  const totalMemMb = sys?.memory_total_mb ?? 24 * 1024;
  const usedMemMb = sys?.memory_used_mb ?? metrics.reduce((sum, m) => sum + m.memory_used_mb, 0);
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
    else { setSortBy(col); setSortDir("desc"); }
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className={cn("grid gap-2 sm:gap-4", sys?.gpu ? "grid-cols-2 lg:grid-cols-5" : "grid-cols-2 lg:grid-cols-4")}>
        <CircularGauge
          value={sys?.cpu_percent_total ?? totalCpu / (sys?.cpu_count ?? 1)}
          max={100}
          label="Total CPU"
          subLabel={`${sys?.cpu_count ?? 96} cores`}
          icon={Cpu} thresholds={{ yellow: 70, red: 85 }}
        />
        <CircularGauge
          value={usedMemMb} max={totalMemMb}
          label="Total Memory"
          subLabel={`${formatMemory(usedMemMb)} / ${formatMemory(totalMemMb)}`}
          icon={HardDrive} thresholds={{ yellow: 70, red: 85 }}
        />
        {sys?.gpu && (
          <CircularGauge
            value={sys.gpu.gpu_memory_used_mb} max={sys.gpu.gpu_memory_total_mb}
            label="GPU VRAM"
            subLabel={`${(sys.gpu.gpu_memory_used_mb / 1024).toFixed(1)} / ${(sys.gpu.gpu_memory_total_mb / 1024).toFixed(0)} GB`}
            icon={Zap} thresholds={{ yellow: 70, red: 90 }}
          />
        )}
        <div className="card-hover flex flex-col items-center justify-center gap-2 py-4">
          <Wifi size={20} className="text-goblin-500" />
          <p className="text-lg font-bold text-white">
            {sys?.network_rx_total_mb
              ? `${((sys.network_rx_total_mb + (sys.network_tx_total_mb ?? 0)) / 1024).toFixed(0)} GB`
              : "0 MB"}
          </p>
          <p className="text-sm font-medium text-white">Network I/O</p>
          <p className="text-xs text-gray-500">
            RX: {sys?.network_rx_total_mb ? formatMemory(sys.network_rx_total_mb) : "0"} / TX: {sys?.network_tx_total_mb ? formatMemory(sys.network_tx_total_mb) : "0"}
          </p>
        </div>
        <div className="card-hover flex flex-col items-center justify-center gap-2 py-4">
          <Server size={20} className="text-goblin-500" />
          <p className="text-lg font-bold text-white">{runningCount} / {metrics.length}</p>
          <p className="text-sm font-medium text-white">Active Services</p>
          <p className="text-xs text-gray-500">{metrics.length - runningCount} stopped</p>
        </div>
      </div>

      {/* GPU Card */}
      {sys?.gpu && <GpuCard gpu={sys.gpu} />}

      {/* Service Resource Table */}
      <div className="card overflow-x-auto -mx-3 sm:mx-0 rounded-none sm:rounded-xl border-x-0 sm:border-x">
        <h3 className="section-title mb-3">Service Resources</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left text-xs text-gray-500">
              {[
                { key: "container", label: "Service" },
                { key: "status", label: "Status" },
                { key: "cpu_percent", label: "CPU %" },
                { key: "memory_used_mb", label: "Memory" },
                { key: "disk_read_mb", label: "Disk I/O" },
                { key: "uptime_seconds", label: "Uptime" },
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
                    <span className="text-xs text-gray-300 font-mono">{formatMemory(m.memory_used_mb)}</span>
                  </td>
                  <td className="py-2 pr-4 text-gray-400 font-mono text-xs">
                    R: {formatMemory(m.disk_read_mb)} / W: {formatMemory(m.disk_write_mb)}
                  </td>
                  <td className="py-2 pr-4 text-gray-400">{formatUptime(m.uptime_seconds || 0)}</td>
                </tr>
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Memory Allocation Bar */}
      <MemoryAllocationBar metrics={metrics} totalMemoryMb={totalMemMb} />
    </div>
  );
}
