"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSignals } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Signal } from "@/types";
import SignalExplainer from "@/components/modals/SignalExplainer";

export default function AITimeline() {
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);

  const { data: signals = [] } = useQuery({
    queryKey: ["signals"],
    queryFn: getSignals,
    refetchInterval: 5000,
  });

  const recent = signals.slice(0, 20);

  return (
    <>
      <div className="card p-0">
        <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-3">
          <div className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
          <h3 className="font-semibold text-white">AI Decision Timeline</h3>
          <span className="text-xs text-gray-500 ml-auto">{recent.length} recent decisions</span>
        </div>

        <div className="overflow-x-auto">
          <div className="flex items-center gap-0 p-4 min-w-max">
            {recent.map((signal, i) => {
              const nextSignal = recent[i + 1];
              const dotColor = signal.action === "BUY" ? "bg-green-500" : signal.action === "SELL" ? "bg-red-500" : "bg-gray-500";
              const lineColor = i < recent.length - 1 ? (signal.action === "BUY" ? "bg-green-500/30" : signal.action === "SELL" ? "bg-red-500/30" : "bg-gray-700") : "";

              return (
                <div key={signal.signal_id} className="flex items-center">
                  {/* Decision card */}
                  <button
                    onClick={() => setSelectedSignal(signal)}
                    className="flex flex-col items-center gap-1 rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2 hover:border-goblin-500/30 hover:bg-gray-800/50 transition-all min-w-[90px]"
                  >
                    <div className={cn("h-3 w-3 rounded-full", dotColor)} />
                    <span className="text-[10px] font-medium text-white">{signal.symbol.replace("/USDT", "")}</span>
                    <span className={cn("text-[10px] font-bold",
                      signal.action === "BUY" ? "text-green-400" : signal.action === "SELL" ? "text-red-400" : "text-gray-400"
                    )}>{signal.action}</span>
                    <div className="h-1 w-12 rounded-full bg-gray-700">
                      <div className={cn("h-1 rounded-full",
                        signal.confidence >= 0.7 ? "bg-green-500" : signal.confidence >= 0.4 ? "bg-yellow-500" : "bg-red-500"
                      )} style={{ width: `${signal.confidence * 100}%` }} />
                    </div>
                    <span className="text-[9px] text-gray-500">{(signal.confidence * 100).toFixed(0)}%</span>
                  </button>

                  {/* Connecting line */}
                  {i < recent.length - 1 && (
                    <div className={cn("h-0.5 w-6", lineColor)} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selectedSignal && (
        <SignalExplainer
          signalId={selectedSignal.signal_id}
          symbol={selectedSignal.symbol}
          onClose={() => setSelectedSignal(null)}
        />
      )}
    </>
  );
}
