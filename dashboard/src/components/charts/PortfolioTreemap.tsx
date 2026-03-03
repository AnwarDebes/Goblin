"use client";

import { useState } from "react";
import { usePortfolio, usePositions } from "@/hooks/usePortfolio";
import { cn } from "@/lib/utils";
import { formatCurrency, formatPercent, getTimeSince } from "@/lib/utils";

interface TreemapItem {
  symbol: string;
  value: number;
  pnlPct: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  openedAt: string;
  isCash: boolean;
}

export default function PortfolioTreemap() {
  const { data: portfolio } = usePortfolio();
  const { data: positions = [] } = usePositions();
  const [hovered, setHovered] = useState<string | null>(null);

  const items: TreemapItem[] = positions.map((p) => ({
    symbol: p.symbol,
    value: p.current_price * p.amount,
    pnlPct: p.entry_price > 0 ? ((p.current_price - p.entry_price) / p.entry_price) * 100 : 0,
    entryPrice: p.entry_price,
    currentPrice: p.current_price,
    unrealizedPnl: p.unrealized_pnl,
    openedAt: p.opened_at,
    isCash: false,
  }));

  if (portfolio && portfolio.cash_balance > 0) {
    items.push({
      symbol: "Cash",
      value: portfolio.cash_balance,
      pnlPct: 0,
      entryPrice: 0,
      currentPrice: 0,
      unrealizedPnl: 0,
      openedAt: "",
      isCash: true,
    });
  }

  const totalValue = items.reduce((sum, i) => sum + i.value, 0);
  if (totalValue === 0) {
    return (
      <div className="card text-center text-sm text-gray-500 py-8">
        No portfolio data to display
      </div>
    );
  }

  return (
    <div className="card p-4">
      <h3 className="section-title mb-3">Portfolio Allocation</h3>
      <div className="relative flex gap-1 h-32 sm:h-40 rounded-lg overflow-hidden">
        {items.map((item) => {
          const widthPct = (item.value / totalValue) * 100;
          if (widthPct < 0.5) return null;

          const intensity = Math.min(Math.abs(item.pnlPct) / 10, 1);
          const bgColor = item.isCash
            ? "rgba(107,114,128,0.3)"
            : item.pnlPct >= 0
            ? `rgba(34,197,94,${0.15 + intensity * 0.4})`
            : `rgba(239,68,68,${0.15 + intensity * 0.4})`;

          const borderColor = item.isCash
            ? "border-gray-600"
            : item.pnlPct >= 0
            ? "border-green-500/30"
            : "border-red-500/30";

          return (
            <div
              key={item.symbol}
              className={cn("relative flex flex-col items-center justify-center rounded border transition-all cursor-pointer", borderColor)}
              style={{
                flex: `${widthPct} 0 0%`,
                minWidth: 48,
                height: "100%",
                backgroundColor: bgColor,
              }}
              onMouseEnter={() => setHovered(item.symbol)}
              onMouseLeave={() => setHovered(null)}
            >
              <span className="text-xs font-bold text-white">{item.symbol.replace("/USDT", "")}</span>
              <span className="text-[10px] text-gray-300">{formatCurrency(item.value)}</span>
              {!item.isCash && (
                <span className={cn("text-[10px] font-mono", item.pnlPct >= 0 ? "text-green-400" : "text-red-400")}>
                  {formatPercent(item.pnlPct)}
                </span>
              )}

              {/* Hover tooltip */}
              {hovered === item.symbol && !item.isCash && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 rounded-lg bg-gray-800 border border-gray-700 p-3 text-[11px] space-y-1 whitespace-nowrap shadow-xl">
                  <p className="font-semibold text-white">{item.symbol}</p>
                  <p className="text-gray-400">Entry: <span className="text-white font-mono">${item.entryPrice.toLocaleString()}</span></p>
                  <p className="text-gray-400">Current: <span className="text-white font-mono">${item.currentPrice.toLocaleString()}</span></p>
                  <p className="text-gray-400">Unrealized: <span className={cn("font-mono", item.unrealizedPnl >= 0 ? "text-green-400" : "text-red-400")}>{formatCurrency(item.unrealizedPnl)}</span></p>
                  <p className="text-gray-400">Open: {getTimeSince(item.openedAt)}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
