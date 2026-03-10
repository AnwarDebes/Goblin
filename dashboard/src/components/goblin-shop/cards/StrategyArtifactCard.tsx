"use client";

import type { StrategyArtifact } from "@/types/shop";
import { RARITY_CONFIG } from "@/lib/shop-utils";
import CardTiltEffect from "../effects/CardTiltEffect";
import RarityGlow from "../effects/RarityGlow";
import RarityBadge from "../shared/RarityBadge";
import PriceTag from "../shared/PriceTag";
import { cn } from "@/lib/utils";

interface StrategyArtifactCardProps {
  artifact: StrategyArtifact;
  index?: number;
  isOwned?: boolean;
  onSelect: (id: string) => void;
  onPurchase: (artifact: StrategyArtifact) => void;
}

const ELEMENT_ICONS: Record<StrategyArtifact["element"], string> = {
  fire: "🔥",
  ice: "❄️",
  lightning: "⚡",
  earth: "🌍",
  void: "🌀",
};

const ELEMENT_LABELS: Record<StrategyArtifact["element"], string> = {
  fire: "Fire",
  ice: "Ice",
  lightning: "Lightning",
  earth: "Earth",
  void: "Void",
};

export default function StrategyArtifactCard({
  artifact,
  index = 0,
  isOwned = false,
  onSelect,
  onPurchase,
}: StrategyArtifactCardProps) {
  const config = RARITY_CONFIG[artifact.rarity];

  return (
    <div className="animate-fade-in" style={{ animationDelay: `${index * 0.05}s` }}>
    <CardTiltEffect
      className="group h-full"
      intensity={4}
      glare
    >
      <RarityGlow rarity={artifact.rarity} className="h-full">
        <div
          className="relative overflow-hidden rounded-xl bg-gray-900 h-full flex flex-col cursor-pointer transition-transform duration-200 hover:scale-[1.02]"
          onClick={() => onSelect(artifact.id)}
        >
          {/* Rarity banner */}
          <div className={cn("h-1 w-full", config.bgColor.replace("/10", "/60"))} />

          {/* Element + Name */}
          <div className="flex flex-col items-center pt-4 pb-2 px-3">
            <span className="text-3xl mb-1 animate-pulse">{ELEMENT_ICONS[artifact.element]}</span>
            <h3 className="text-sm font-bold text-white text-center">{artifact.name}</h3>
            <span className="text-[10px] text-gray-500 mt-0.5">
              {ELEMENT_LABELS[artifact.element]} {artifact.type}
            </span>
            <RarityBadge rarity={artifact.rarity} className="mt-1.5" />
          </div>

          {/* Stats */}
          <div className="px-3 pb-2 flex-1">
            <div className="space-y-1 text-xs bg-gray-800/50 rounded-lg p-2">
              <StatRow label="Win Rate" value={`${artifact.winRate.toFixed(1)}%`} positive={artifact.winRate > 50} />
              <StatRow label="Avg Return" value={`${artifact.avgReturn >= 0 ? "+" : ""}${artifact.avgReturn.toFixed(2)}%`} positive={artifact.avgReturn >= 0} />
              <StatRow label="Sharpe" value={artifact.sharpeRatio.toFixed(2)} positive={artifact.sharpeRatio > 0} />
              <StatRow label="Total Trades" value={String(artifact.totalTrades)} />
              <StatRow label="Max DD" value={`${artifact.maxDrawdown.toFixed(2)}%`} positive={false} />
            </div>
          </div>

          {/* Level bar */}
          <div className="px-3 pb-2">
            <div className="flex items-center justify-between text-[10px] text-gray-500 mb-0.5">
              <span>Level</span>
              <span>Lv.{artifact.level}</span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-goblin-600 to-goblin-400 rounded-full transition-all duration-1000"
                style={{ width: `${artifact.level}%` }}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-3 pb-3 pt-1 flex items-center justify-between border-t border-gray-800">
            <PriceTag price={artifact.priceTier} size="sm" />
            {isOwned ? (
              <span className="text-xs text-goblin-400 font-medium">Owned ✓</span>
            ) : (
              <button
                className="text-xs px-3 py-1 rounded-lg bg-goblin-500/20 text-goblin-400 hover:bg-goblin-500/30 transition-colors font-medium"
                onClick={(e) => {
                  e.stopPropagation();
                  onPurchase(artifact);
                }}
              >
                Acquire ⚔
              </button>
            )}
          </div>
        </div>
      </RarityGlow>
    </CardTiltEffect>
    </div>
  );
}

function StatRow({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-400">{label}</span>
      <span className={cn("font-medium", positive === true && "text-green-400", positive === false && "text-red-400", positive === undefined && "text-gray-300")}>
        {value}
      </span>
    </div>
  );
}
