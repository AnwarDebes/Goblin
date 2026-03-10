"use client";

import type { SignalPack } from "@/types/shop";
import { RARITY_CONFIG } from "@/lib/shop-utils";
import { cn } from "@/lib/utils";

const CHANNEL_ICONS: Record<SignalPack["channelType"], string> = {
  sniper: "🎯",
  swing: "🌊",
  scalp: "⚡",
  whale: "🐋",
};

interface SignalGalaxyCardProps {
  pack: SignalPack;
  isSelected: boolean;
  isHovered: boolean;
  isSubscribed: boolean;
}

export default function SignalGalaxyCard({
  pack,
  isSelected,
  isHovered,
  isSubscribed,
}: SignalGalaxyCardProps) {
  const config = RARITY_CONFIG[pack.rarity];

  return (
    <div
      className={cn(
        "rounded-lg overflow-hidden transition-all duration-200",
        isSelected
          ? "ring-1 ring-amber-400/50"
          : isHovered
          ? "ring-1 ring-white/20"
          : ""
      )}
      style={{
        background: `linear-gradient(135deg, rgba(20,10,5,0.95), rgba(15,15,30,0.9))`,
        boxShadow: isSelected
          ? `0 0 20px ${config.glowColor}`
          : isHovered
          ? `0 0 10px ${config.glowColor}`
          : "none",
      }}
    >
      {/* Rarity top bar */}
      <div
        className="h-[2px] w-full"
        style={{ background: `linear-gradient(90deg, #92400e, ${config.glowColor})` }}
      />

      <div className="p-2.5">
        {/* Channel + Name */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-base">{CHANNEL_ICONS[pack.channelType]}</span>
          <div className="flex-1 min-w-0">
            <h3 className="text-[10px] font-bold text-white truncate leading-tight">
              {pack.name}
            </h3>
            <span className={cn("text-[8px] font-medium", config.color)}>
              {config.icon} {config.label}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="space-y-0.5 text-[8px]">
          <div className="flex justify-between">
            <span className="text-gray-500">Accuracy</span>
            <span className="text-green-400">{pack.accuracy7d.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">24h Signals</span>
            <span className="text-gray-300">{pack.signalCount24h}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Confidence</span>
            <span className="text-gray-300">{pack.avgConfidence.toFixed(0)}%</span>
          </div>
        </div>

        {/* Latest signal */}
        {pack.latestSignal && (
          <div className={cn(
            "mt-1.5 p-1.5 rounded text-[8px] border",
            pack.latestSignal.action === "BUY"
              ? "bg-green-500/10 border-green-500/20 text-green-400"
              : pack.latestSignal.action === "SELL"
              ? "bg-red-500/10 border-red-500/20 text-red-400"
              : "bg-gray-500/10 border-gray-500/20 text-gray-400"
          )}>
            <span className="font-bold">
              {pack.latestSignal.action === "BUY" ? "🟢" : "🔴"} {pack.latestSignal.action}
            </span>
            <span className="text-gray-500 ml-1">{pack.latestSignal.confidence.toFixed(0)}%</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-amber-900/30">
          <span className="text-[8px] text-gold-400 font-bold">
            💰 {pack.subscriptionCost}/mo
          </span>
          {isSubscribed ? (
            <span className="text-[7px] text-goblin-400 font-medium">Active ✓</span>
          ) : (
            <span className="text-[7px] text-gray-500">Click to view</span>
          )}
        </div>
      </div>
    </div>
  );
}
