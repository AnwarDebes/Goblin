"use client";

import type { Achievement } from "@/types/shop";
import { RARITY_CONFIG } from "@/lib/shop-utils";
import { cn } from "@/lib/utils";
import GBLNIcon from "../shared/GBLNIcon";

interface AchievementBadgeProps {
  achievement: Achievement;
}

export default function AchievementBadge({ achievement }: AchievementBadgeProps) {
  const config = RARITY_CONFIG[achievement.rarity];

  return (
    <div
      className={cn(
        "relative rounded-lg border p-3 transition-all duration-200",
        achievement.isUnlocked
          ? `${config.borderColor} bg-gray-900`
          : "border-gray-800 bg-gray-900/50 opacity-50 grayscale"
      )}
      style={
        achievement.isUnlocked
          ? { boxShadow: `0 0 10px ${config.glowColor}` }
          : undefined
      }
      title={achievement.description}
    >
      {/* Lock overlay */}
      {!achievement.isUnlocked && (
        <div className="absolute top-1.5 right-1.5 text-gray-600 text-xs">🔒</div>
      )}
      {achievement.isUnlocked && (
        <div className="absolute top-1.5 right-1.5 text-goblin-400 text-xs">✓</div>
      )}

      <div className="text-center">
        <span className="text-2xl block mb-1">{achievement.icon}</span>
        <h4 className="text-xs font-bold text-white truncate">{achievement.name}</h4>
        <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">{achievement.description}</p>
      </div>

      {/* Progress bar */}
      {!achievement.isUnlocked && achievement.progress > 0 && (
        <div className="mt-2">
          <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-goblin-600 to-goblin-400 rounded-full transition-all duration-500"
              style={{ width: `${achievement.progress}%` }}
            />
          </div>
          <div className="text-[9px] text-gray-500 text-right mt-0.5">
            {achievement.progress.toFixed(0)}%
          </div>
        </div>
      )}

      {/* Reward */}
      <div className="flex items-center justify-center gap-1 mt-1.5">
        <GBLNIcon size={12} />
        <span className="text-[10px] text-gold-400 font-medium">{achievement.reward}</span>
      </div>
    </div>
  );
}
