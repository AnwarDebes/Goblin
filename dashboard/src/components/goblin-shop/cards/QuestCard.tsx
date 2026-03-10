"use client";

import type { Quest } from "@/types/shop";
import { cn } from "@/lib/utils";
import GBLNIcon from "../shared/GBLNIcon";

interface QuestCardProps {
  quest: Quest;
  isClaimed?: boolean;
  onClaim: (id: string) => void;
}

const TYPE_STYLES: Record<Quest["type"], { color: string; bg: string; border: string; label: string }> = {
  daily: { color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30", label: "Daily" },
  weekly: { color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30", label: "Weekly" },
  monthly: { color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", label: "Monthly" },
  legendary: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", label: "Legendary" },
};

export default function QuestCard({ quest, isClaimed = false, onClaim }: QuestCardProps) {
  const style = TYPE_STYLES[quest.type];
  const isComplete = quest.isCompleted;

  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-all",
        isComplete && !isClaimed
          ? "border-gold-500/40 bg-gray-900"
          : `${style.border} bg-gray-900/80`,
        isComplete && !isClaimed && "shadow-[0_0_15px_rgba(251,191,36,0.15)]"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{quest.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={cn("text-[10px] font-bold px-1.5 py-0 rounded-full border", style.bg, style.color, style.border)}>
              {style.label}
            </span>
          </div>
          <h4 className="text-xs font-bold text-white mt-0.5 truncate">{quest.name}</h4>
        </div>
      </div>

      <p className="text-[10px] text-gray-500 mb-2">{quest.description}</p>

      {/* Objectives */}
      {quest.objectives.map((obj, i) => {
        const pct = Math.min(100, (obj.current / obj.target) * 100);
        return (
          <div key={i} className="mb-2">
            <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
              <span>{obj.label}</span>
              <span>{obj.current}/{obj.target}</span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  pct >= 100
                    ? "bg-gradient-to-r from-gold-500 to-gold-400"
                    : "bg-gradient-to-r from-goblin-600 to-goblin-400"
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}

      {/* Reward */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-800">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[10px]">
            <GBLNIcon size={12} />
            <span className="text-gold-400 font-medium">{quest.reward}</span>
          </span>
          <span className="text-[10px] text-goblin-400 font-medium">+{quest.xpReward} XP</span>
        </div>
        {isClaimed ? (
          <span className="text-[10px] text-gray-500 font-medium">Claimed ✓</span>
        ) : isComplete ? (
          <button
            onClick={() => onClaim(quest.id)}
            className="text-[10px] px-2.5 py-1 rounded-lg bg-gold-500/20 text-gold-400 hover:bg-gold-500/30 transition-colors font-bold"
          >
            Claim ✓
          </button>
        ) : (
          <span className="text-[10px] text-gray-600">In Progress</span>
        )}
      </div>
    </div>
  );
}
