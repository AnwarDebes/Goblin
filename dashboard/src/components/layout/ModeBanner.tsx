"use client";

import { useQuery } from "@tanstack/react-query";
import { getTradingMode } from "@/lib/api";

export default function ModeBanner() {
  const { data: mode } = useQuery({
    queryKey: ["trading-mode"],
    queryFn: getTradingMode,
    refetchInterval: 10_000,
  });

  if (mode === "live") {
    return (
      <div className="bg-red-600/20 border-b border-red-500/40 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-red-400 flex items-center justify-center gap-2">
        <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
        LIVE - REAL MONEY
        <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
      </div>
    );
  }

  if (mode === "paper") {
    return (
      <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-amber-400 flex items-center justify-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        PAPER TRADING - SIMULATED FUNDS
      </div>
    );
  }

  return (
    <div className="bg-zinc-500/10 border-b border-zinc-500/20 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-zinc-400 flex items-center justify-center gap-2">
      TRADING MODE UNKNOWN - CHECK EXECUTOR
    </div>
  );
}
