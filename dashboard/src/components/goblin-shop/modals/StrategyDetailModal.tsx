"use client";

import type { StrategyArtifact } from "@/types/shop";
import type { Trade } from "@/types";
import { RARITY_CONFIG } from "@/lib/shop-utils";
import RarityBadge from "../shared/RarityBadge";
import PriceTag from "../shared/PriceTag";
import { cn } from "@/lib/utils";
import { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

interface StrategyDetailModalProps {
  artifact: StrategyArtifact;
  trades: Trade[];
  onClose: () => void;
  onPurchase: (artifact: StrategyArtifact) => void;
  isOwned: boolean;
}

const ELEMENT_ICONS: Record<StrategyArtifact["element"], string> = {
  fire: "🔥",
  ice: "❄️",
  lightning: "⚡",
  earth: "🌍",
  void: "🌀",
};

export default function StrategyDetailModal({
  artifact,
  trades,
  onClose,
  onPurchase,
  isOwned,
}: StrategyDetailModalProps) {
  const config = RARITY_CONFIG[artifact.rarity];

  const equityCurve = useMemo(() => {
    const relatedTrades = trades.filter(
      (t) => (t.strategy || "ml_ensemble") === artifact.id
    );
    let cumPnl = 0;
    return relatedTrades.map((t, i) => {
      cumPnl += t.realized_pnl;
      return { index: i + 1, pnl: Number(cumPnl.toFixed(2)) };
    });
  }, [trades, artifact.id]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-gray-900 rounded-xl border overflow-hidden max-h-[85vh] overflow-y-auto"
        style={{
          borderColor: config.glowColor,
          boxShadow: `0 0 30px ${config.glowColor}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={cn("h-1.5 w-full", config.bgColor.replace("/10", "/60"))} />
        <div className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="text-4xl">{ELEMENT_ICONS[artifact.element]}</span>
              <div>
                <h2 className="text-lg font-bold text-white">{artifact.name}</h2>
                <p className="text-xs text-gray-500 capitalize">{artifact.element} {artifact.type}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">×</button>
          </div>
          <RarityBadge rarity={artifact.rarity} className="mt-2" />
          <p className="text-sm text-gray-400 mt-2">{artifact.description}</p>
        </div>

        {/* Stats */}
        <div className="px-4 pb-4">
          <div className="grid grid-cols-2 gap-2">
            <StatBox label="Win Rate" value={`${artifact.winRate.toFixed(1)}%`} positive={artifact.winRate > 50} />
            <StatBox label="Avg Return" value={`${artifact.avgReturn >= 0 ? "+" : ""}${artifact.avgReturn.toFixed(2)}%`} positive={artifact.avgReturn >= 0} />
            <StatBox label="Sharpe Ratio" value={artifact.sharpeRatio.toFixed(2)} positive={artifact.sharpeRatio > 0} />
            <StatBox label="Max Drawdown" value={`${artifact.maxDrawdown.toFixed(2)}%`} positive={false} />
            <StatBox label="Total Trades" value={String(artifact.totalTrades)} />
            <StatBox label="Level" value={`Lv.${artifact.level}`} />
          </div>
        </div>

        {/* Equity Curve */}
        {equityCurve.length > 1 && (
          <div className="px-4 pb-4">
            <h3 className="text-xs font-bold text-gray-400 mb-2">Equity Curve</h3>
            <div className="h-32 bg-gray-800/50 rounded-lg p-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={equityCurve}>
                  <defs>
                    <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="index" hide />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, fontSize: 11 }}
                    labelStyle={{ color: "#888" }}
                    formatter={(v: number) => [`$${v.toFixed(2)}`, "P&L"]}
                  />
                  <Area type="monotone" dataKey="pnl" stroke="#22c55e" fill="url(#equityGrad)" strokeWidth={1.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-4 pb-4 flex items-center justify-between border-t border-gray-800 pt-3">
          <PriceTag price={artifact.priceTier} size="lg" />
          {isOwned ? (
            <span className="text-sm text-goblin-400 font-bold">Owned ✓</span>
          ) : (
            <button
              className="px-6 py-2 rounded-lg bg-goblin-500/20 text-goblin-400 border border-goblin-500/30 hover:bg-goblin-500/30 font-bold text-sm transition-colors"
              onClick={() => onPurchase(artifact)}
            >
              Acquire ⚔
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-2">
      <div className="text-[10px] text-gray-500">{label}</div>
      <div className={cn("text-sm font-bold", positive === true && "text-green-400", positive === false && "text-red-400", positive === undefined && "text-gray-300")}>
        {value}
      </div>
    </div>
  );
}
