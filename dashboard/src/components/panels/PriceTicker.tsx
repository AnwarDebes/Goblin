"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAllTickers } from "@/lib/api";
import { cn } from "@/lib/utils";

interface TickerSymbol {
  symbol: string;
  price: number;
  change24h: number;
}

function formatSymbol(raw: string): string {
  // BTCUSDT → BTC/USDT
  if (raw.endsWith("USDT")) return raw.replace("USDT", "/USDT");
  return raw;
}

export default function PriceTicker() {
  const [paused, setPaused] = useState(false);

  const { data: tickers = [] } = useQuery({
    queryKey: ["all-tickers"],
    queryFn: getAllTickers,
    refetchInterval: 5000,
  });

  const symbols: TickerSymbol[] = tickers.map((t) => ({
    symbol: formatSymbol(t.symbol),
    price: parseFloat(t.lastPrice || t.price) || 0,
    change24h: parseFloat(t.priceChangePercent) || 0,
  }));

  // Show nothing if no data yet
  if (symbols.length === 0) {
    return (
      <div className="relative h-7 overflow-hidden border-b border-gray-800/50 bg-gray-950/80">
        <div className="flex items-center h-full px-4 text-[11px] text-gray-600">
          Loading market data...
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative h-7 overflow-hidden border-b border-gray-800/50 bg-gray-950/80"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="flex items-center h-full whitespace-nowrap"
        style={{
          animation: paused ? "none" : "ticker-scroll 40s linear infinite",
        }}
      >
        {/* Duplicate for seamless loop */}
        {[...symbols, ...symbols].map((s, i) => (
          <div key={`${s.symbol}-${i}`} className="flex items-center gap-2 px-4 text-[11px]">
            <span className="font-medium text-gray-300">{s.symbol}</span>
            <span className="font-mono text-white">
              ${s.price < 1 ? s.price.toFixed(4) : s.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
            <span className={cn("font-mono", s.change24h >= 0 ? "text-green-400" : "text-red-400")}>
              {s.change24h >= 0 ? "+" : ""}{s.change24h.toFixed(2)}%
            </span>
            <div className="h-3 w-px bg-gray-800 mx-1" />
          </div>
        ))}
      </div>
    </div>
  );
}
