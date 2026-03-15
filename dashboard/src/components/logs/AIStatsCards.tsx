"use client";

import type { AIStats } from "@/types";

const CATEGORY_LABELS: Record<string, { icon: string; label: string }> = {
  prediction: { icon: "🧠", label: "Predictions" },
  signal: { icon: "📡", label: "Signals" },
  trade: { icon: "💰", label: "Trades" },
  sentiment: { icon: "📊", label: "Sentiment" },
  risk: { icon: "⚠️", label: "Risk" },
  system: { icon: "⚡", label: "System" },
  chat: { icon: "💬", label: "Chat" },
  model: { icon: "🤖", label: "Model" },
};

export default function AIStatsCards({ stats, isLoading }: { stats?: AIStats; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card h-20 animate-pulse bg-gray-800/50" />
        ))}
      </div>
    );
  }

  const totalEvents = stats?.total_events_today || 0;
  const categories = stats?.events_by_category || {};
  const errors = (stats?.events_by_level?.error || 0) + (stats?.events_by_level?.critical || 0);

  // Top 4 categories by count
  const topCats = Object.entries(categories)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {/* Total events */}
      <div className="card px-3 py-2">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider">Events Today</div>
        <div className="text-xl font-bold text-white mt-0.5">{totalEvents}</div>
        {errors > 0 && (
          <div className="text-[10px] text-red-400 mt-0.5">{errors} errors</div>
        )}
      </div>

      {/* Top categories */}
      {topCats.map(([cat, count]) => {
        const meta = CATEGORY_LABELS[cat] || { icon: "📋", label: cat };
        const avg = stats?.avg_confidence_by_category?.[cat];
        return (
          <div key={cat} className="card px-3 py-2">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider flex items-center gap-1">
              <span>{meta.icon}</span> {meta.label}
            </div>
            <div className="text-xl font-bold text-white mt-0.5">{count}</div>
            {avg != null && avg > 0 && (
              <div className="text-[10px] text-gray-400 mt-0.5">
                Avg conf: {(avg * 100).toFixed(0)}%
              </div>
            )}
          </div>
        );
      })}

      {/* Fill remaining slots if less than 3 top categories */}
      {topCats.length < 3 &&
        Array.from({ length: 3 - topCats.length }).map((_, i) => (
          <div key={`empty-${i}`} className="card px-3 py-2">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">—</div>
            <div className="text-xl font-bold text-gray-700 mt-0.5">0</div>
          </div>
        ))}
    </div>
  );
}
