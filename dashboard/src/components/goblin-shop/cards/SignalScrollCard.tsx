"use client";

import type { SignalPack } from "@/types/shop";
import RarityGlow from "../effects/RarityGlow";
import RarityBadge from "../shared/RarityBadge";
import PriceTag from "../shared/PriceTag";
import { cn } from "@/lib/utils";

interface SignalScrollCardProps {
  pack: SignalPack;
  index?: number;
  isSubscribed?: boolean;
  onSubscribe: (pack: SignalPack) => void;
}

const CHANNEL_ICONS: Record<SignalPack["channelType"], string> = {
  sniper: "🎯",
  swing: "🌊",
  scalp: "⚡",
  whale: "🐋",
};

const CHANNEL_LABELS: Record<SignalPack["channelType"], string> = {
  sniper: "Sniper",
  swing: "Swing",
  scalp: "Scalp",
  whale: "Whale",
};

export default function SignalScrollCard({ pack, index = 0, isSubscribed = false, onSubscribe }: SignalScrollCardProps) {
  const isRecent =
    pack.latestSignal &&
    Date.now() - new Date(pack.latestSignal.timestamp).getTime() < 5 * 60 * 1000;

  return (
    <RarityGlow rarity={pack.rarity} className="h-full">
      <div
        className="relative overflow-hidden rounded-xl h-full flex flex-col bg-gradient-to-b from-amber-950/20 to-gray-900 border border-amber-900/20"
        style={{ animationDelay: `${index * 0.05}s` }}
      >
        {/* Channel type badge */}
        <div className="px-3 pt-3 flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
            {CHANNEL_ICONS[pack.channelType]} {CHANNEL_LABELS[pack.channelType]}
          </span>
          <RarityBadge rarity={pack.rarity} />
        </div>

        {/* Title */}
        <div className="px-3 pt-2 pb-1">
          <h3 className="text-sm font-bold text-white">{pack.name}</h3>
          <div className="h-px bg-amber-800/30 mt-2" />
        </div>

        {/* Stats */}
        <div className="px-3 py-2 space-y-1.5 text-xs flex-1">
          <div className="flex justify-between">
            <span className="text-gray-400">📊 Accuracy</span>
            <span className="text-green-400 font-medium">{pack.accuracy7d.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">📡 24h Signals</span>
            <span className="text-gray-300 font-medium">{pack.signalCount24h}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">🎯 Avg Confidence</span>
            <span className="text-gray-300 font-medium">{pack.avgConfidence.toFixed(0)}%</span>
          </div>
        </div>

        {/* Latest Signal */}
        {pack.latestSignal && (
          <div className="px-3 pb-2">
            <div
              className={cn(
                "rounded-lg p-2 text-xs border",
                pack.latestSignal.action === "BUY"
                  ? "bg-green-500/10 border-green-500/30"
                  : pack.latestSignal.action === "SELL"
                    ? "bg-red-500/10 border-red-500/30"
                    : "bg-gray-500/10 border-gray-500/30",
                isRecent && "animate-pulse"
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn("font-bold", pack.latestSignal.action === "BUY" ? "text-green-400" : pack.latestSignal.action === "SELL" ? "text-red-400" : "text-gray-400")}>
                  {pack.latestSignal.action === "BUY" ? "🟢" : pack.latestSignal.action === "SELL" ? "🔴" : "🟡"} {pack.latestSignal.action}
                </span>
                <span className="text-gray-500">
                  {pack.latestSignal.confidence.toFixed(0)}% conf
                </span>
              </div>
              <div className="text-gray-500 mt-0.5">
                {getTimeSince(pack.latestSignal.timestamp)}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-3 pb-3 pt-1 flex items-center justify-between border-t border-amber-900/20">
          <PriceTag price={pack.subscriptionCost} size="sm" suffix="/mo" />
          {isSubscribed ? (
            <span className="text-xs text-goblin-400 font-medium">Subscribed ✓</span>
          ) : (
            <button
              className="text-xs px-3 py-1 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors font-medium"
              onClick={() => onSubscribe(pack)}
            >
              Subscribe 📜
            </button>
          )}
        </div>
      </div>
    </RarityGlow>
  );
}

function getTimeSince(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
