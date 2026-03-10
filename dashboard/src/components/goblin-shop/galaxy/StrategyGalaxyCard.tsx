"use client";

import type { StrategyArtifact } from "@/types/shop";
import { RARITY_CONFIG } from "@/lib/shop-utils";
import { cn } from "@/lib/utils";

const ELEMENT_ICONS: Record<StrategyArtifact["element"], string> = {
  fire: "🔥",
  ice: "❄️",
  lightning: "⚡",
  earth: "🌍",
  void: "🌀",
};

interface StrategyGalaxyCardProps {
  artifact: StrategyArtifact;
  isSelected: boolean;
  isHovered: boolean;
  isOwned: boolean;
}

export default function StrategyGalaxyCard({
  artifact,
  isSelected,
  isHovered,
  isOwned,
}: StrategyGalaxyCardProps) {
  const config = RARITY_CONFIG[artifact.rarity];

  return (
    <div
      className={cn(
        "rounded-lg overflow-hidden transition-all duration-200",
        isSelected
          ? "ring-1 ring-goblin-400/50"
          : isHovered
          ? "ring-1 ring-white/20"
          : ""
      )}
      style={{
        background: `linear-gradient(135deg, rgba(10,10,26,0.95), rgba(15,15,30,0.9))`,
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
        style={{ background: config.glowColor }}
      />

      <div className="p-2.5">
        {/* Element + Name */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-base">{ELEMENT_ICONS[artifact.element]}</span>
          <div className="flex-1 min-w-0">
            <h3 className="text-[10px] font-bold text-white truncate leading-tight">
              {artifact.name}
            </h3>
            <span className={cn("text-[8px] font-medium", config.color)}>
              {config.icon} {config.label}
            </span>
          </div>
        </div>

        {/* Key Stats */}
        <div className="space-y-0.5 text-[8px]">
          <div className="flex justify-between">
            <span className="text-gray-500">Win Rate</span>
            <span className={artifact.winRate > 50 ? "text-green-400" : "text-red-400"}>
              {artifact.winRate.toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Sharpe</span>
            <span className={artifact.sharpeRatio > 0 ? "text-green-400" : "text-red-400"}>
              {artifact.sharpeRatio.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Return</span>
            <span className={artifact.avgReturn >= 0 ? "text-green-400" : "text-red-400"}>
              {artifact.avgReturn >= 0 ? "+" : ""}{artifact.avgReturn.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Level bar */}
        <div className="mt-1.5">
          <div className="h-[3px] bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${artifact.level}%`,
                background: `linear-gradient(90deg, ${config.glowColor}, #22c55e)`,
              }}
            />
          </div>
          <div className="flex justify-between mt-0.5 text-[7px] text-gray-600">
            <span>Lv.{artifact.level}</span>
            <span>{artifact.totalTrades} trades</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-gray-800/50">
          <span className="text-[8px] text-gold-400 font-bold">
            💰 {artifact.priceTier}
          </span>
          {isOwned ? (
            <span className="text-[7px] text-goblin-400 font-medium">Owned ✓</span>
          ) : (
            <span className="text-[7px] text-gray-500">Click to view</span>
          )}
        </div>
      </div>
    </div>
  );
}
