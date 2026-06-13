"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePortfolio, usePositions } from "@/hooks/usePortfolio";
import { cn } from "@/lib/utils";
import { formatCurrency, formatPercent, getTimeSince } from "@/lib/utils";
import { closePosition } from "@/lib/api";
import type { Position, PortfolioState } from "@/types";

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

interface PortfolioTreemapProps {
  portfolio?: PortfolioState;
  positions?: Position[];
}

export default function PortfolioTreemap({ portfolio: propPortfolio, positions: propPositions }: PortfolioTreemapProps) {
  // Use props if provided, otherwise fetch own data (backwards compatible)
  const { data: hookPortfolio } = usePortfolio();
  const { data: hookPositions = [] } = usePositions();
  const portfolio = propPortfolio ?? hookPortfolio;
  const positions = propPositions ?? hookPositions;
  const [hovered, setHovered] = useState<string | null>(null);
  const [closing, setClosing] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const handleClose = async (symbol: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // No confirmation — instant close. Exits are time-critical.
    setClosing(symbol);
    try {
      await closePosition(symbol);
      // backend routes the sell through signal->risk->executor; refetch shortly
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["positions"] });
        queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      }, 1500);
    } catch (err) {
      window.alert(`Failed to close ${symbol}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setTimeout(() => setClosing(null), 2000);
    }
  };

  const items: TreemapItem[] = positions.map((p) => {
    // Account for position side in PnL calculation
    const rawPnlPct = p.entry_price > 0
      ? ((p.current_price - p.entry_price) / p.entry_price) * 100
      : 0;
    const pnlPct = p.side === "long" ? rawPnlPct : -rawPnlPct;

    return {
      symbol: p.symbol,
      value: p.current_price * p.amount,
      pnlPct,
      entryPrice: p.entry_price,
      currentPrice: p.current_price,
      unrealizedPnl: p.unrealized_pnl,
      openedAt: p.opened_at,
      isCash: false,
    };
  });

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
              {/* Manual close (−): user-triggered market exit */}
              {!item.isCash && (
                <button
                  onClick={(e) => handleClose(item.symbol, e)}
                  disabled={closing === item.symbol}
                  title={`Close ${item.symbol} at market`}
                  className="absolute top-0.5 right-0.5 z-30 flex h-4 w-4 items-center justify-center rounded-full bg-red-600/80 text-white text-[11px] font-bold leading-none hover:bg-red-500 disabled:opacity-50"
                >
                  {closing === item.symbol ? "…" : "−"}
                </button>
              )}
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
                  <p className="text-gray-400">Entry: <span className="text-white font-mono">{item.entryPrice > 0 ? `$${item.entryPrice.toLocaleString()}` : "N/A"}</span></p>
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
