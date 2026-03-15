"use client";

import { cn } from "@/lib/utils";

const CATEGORIES = [
  "prediction", "signal", "trade", "sentiment", "risk",
  "model", "market", "portfolio", "system", "chat",
];

const LEVELS = ["info", "warning", "error", "critical", "debug"];

interface FilterProps {
  category: string;
  level: string;
  symbol: string;
  search: string;
  onCategoryChange: (v: string) => void;
  onLevelChange: (v: string) => void;
  onSymbolChange: (v: string) => void;
  onSearchChange: (v: string) => void;
  isLive: boolean;
  onToggleLive: () => void;
  liveCount: number;
}

export default function AILogFilters({
  category, level, symbol, search,
  onCategoryChange, onLevelChange, onSymbolChange, onSearchChange,
  isLive, onToggleLive, liveCount,
}: FilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Live toggle */}
      <button
        onClick={onToggleLive}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
          isLive
            ? "bg-green-500/20 text-green-400 border border-green-500/30"
            : "bg-gray-800 text-gray-400 border border-gray-700"
        )}
      >
        <span className={cn("w-2 h-2 rounded-full", isLive ? "bg-green-500 animate-pulse" : "bg-gray-600")} />
        {isLive ? "LIVE" : "Paused"}
        {isLive && liveCount > 0 && (
          <span className="bg-green-500/30 text-green-300 px-1 rounded text-[10px]">
            +{liveCount}
          </span>
        )}
      </button>

      {/* Category filter */}
      <select
        value={category}
        onChange={(e) => onCategoryChange(e.target.value)}
        className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-goblin-500"
      >
        <option value="">All Categories</option>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      {/* Level filter */}
      <select
        value={level}
        onChange={(e) => onLevelChange(e.target.value)}
        className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-goblin-500"
      >
        <option value="">All Levels</option>
        {LEVELS.map((l) => (
          <option key={l} value={l}>{l}</option>
        ))}
      </select>

      {/* Symbol filter */}
      <input
        type="text"
        value={symbol}
        onChange={(e) => onSymbolChange(e.target.value.toUpperCase())}
        placeholder="Symbol..."
        className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-300 w-24 focus:outline-none focus:border-goblin-500"
      />

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search logs..."
        className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-300 flex-1 min-w-[120px] focus:outline-none focus:border-goblin-500"
      />
    </div>
  );
}
