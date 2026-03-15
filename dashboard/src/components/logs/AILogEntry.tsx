"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { AILogEntry as AILogEntryType } from "@/types";

const CATEGORY_ICONS: Record<string, string> = {
  prediction: "🧠",
  signal: "📡",
  trade: "💰",
  sentiment: "📊",
  risk: "⚠️",
  model: "🤖",
  market: "📈",
  portfolio: "💼",
  whale: "🐋",
  system: "⚡",
  chat: "💬",
  strategy: "🎯",
};

const LEVEL_COLORS: Record<string, string> = {
  debug: "border-l-gray-500 bg-gray-500/5",
  info: "border-l-green-500 bg-green-500/5",
  warning: "border-l-amber-500 bg-amber-500/5",
  error: "border-l-red-500 bg-red-500/5",
  critical: "border-l-red-700 bg-red-700/10",
};

const LEVEL_BADGE_COLORS: Record<string, string> = {
  debug: "bg-gray-500/20 text-gray-400",
  info: "bg-green-500/20 text-green-400",
  warning: "bg-amber-500/20 text-amber-400",
  error: "bg-red-500/20 text-red-400",
  critical: "bg-red-700/20 text-red-300",
};

export default function AILogEntry({ entry }: { entry: AILogEntryType }) {
  const [expanded, setExpanded] = useState(false);

  const time = new Date(entry.timestamp);
  const timeStr = time.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div
      className={cn(
        "border-l-2 rounded-r-lg px-3 py-2 cursor-pointer transition-all duration-200 hover:bg-white/5",
        LEVEL_COLORS[entry.level] || LEVEL_COLORS.info,
        expanded && "bg-white/5"
      )}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-2 flex-wrap">
        {/* Timestamp */}
        <span className="font-mono text-xs text-gray-500 shrink-0">
          {timeStr}
        </span>

        {/* Category icon */}
        <span className="text-sm shrink-0">
          {CATEGORY_ICONS[entry.category] || "📋"}
        </span>

        {/* Service badge */}
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700/50 text-gray-400 shrink-0">
          {entry.service}
        </span>

        {/* Message */}
        <span className="text-sm text-gray-200 truncate flex-1 min-w-0">
          {entry.message}
        </span>

        {/* Symbol badge */}
        {entry.symbol && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-goblin-500/20 text-goblin-400 font-mono shrink-0">
            {entry.symbol}
          </span>
        )}

        {/* Confidence bar */}
        {entry.confidence != null && entry.confidence > 0 && (
          <div className="flex items-center gap-1 shrink-0">
            <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  entry.confidence >= 0.7
                    ? "bg-green-500"
                    : entry.confidence >= 0.4
                    ? "bg-amber-500"
                    : "bg-red-500"
                )}
                style={{ width: `${Math.min(entry.confidence * 100, 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-gray-500 font-mono">
              {(entry.confidence * 100).toFixed(0)}%
            </span>
          </div>
        )}

        {/* Level badge */}
        <span
          className={cn(
            "text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0",
            LEVEL_BADGE_COLORS[entry.level] || LEVEL_BADGE_COLORS.info
          )}
        >
          {entry.level}
        </span>
      </div>

      {/* Expanded details */}
      {expanded && entry.details && Object.keys(entry.details).length > 0 && (
        <div className="mt-2 pl-6">
          <pre className="text-xs text-gray-400 bg-gray-900/50 rounded p-2 overflow-x-auto max-h-40">
            {JSON.stringify(entry.details, null, 2)}
          </pre>
          {entry.chain_id && (
            <div className="mt-1 text-[10px] text-gray-500">
              Chain: <span className="font-mono text-gray-400">{entry.chain_id}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
