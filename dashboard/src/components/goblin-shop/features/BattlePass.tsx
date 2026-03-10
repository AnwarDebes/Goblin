"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { generateBattlePass } from "@/lib/arena-utils";
import { RARITY_CONFIG } from "@/lib/shop-utils";
import type { BattlePassSeason, BattlePassTier } from "@/types/arena";
import GBLNIcon from "../shared/GBLNIcon";

interface BattlePassProps {
  playerXP: number;
  balance: number;
  onSpendGBLN: (amount: number) => void;
}

export default function BattlePass({ playerXP, balance, onSpendGBLN }: BattlePassProps) {
  const [season, setSeason] = useState<BattlePassSeason>(() => ({
    ...generateBattlePass(),
    currentXP: playerXP,
  }));

  const currentTierIdx = season.tiers.findIndex(
    (t) => playerXP < t.xpRequired * t.level
  );
  const currentLevel = currentTierIdx === -1 ? 30 : currentTierIdx + 1;

  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(season.endDate).getTime() - Date.now()) / 86400000)
  );

  const handleUpgradePremium = () => {
    if (balance < season.premiumCost || season.isPremium) return;
    onSpendGBLN(season.premiumCost);
    setSeason((prev) => ({ ...prev, isPremium: true }));
  };

  return (
    <div className="space-y-4">
      {/* Season Header */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-amber-500/10 border border-purple-500/20">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{season.icon}</span>
            <div>
              <h3 className="text-sm font-bold text-white">{season.name}</h3>
              <p className="text-[10px] text-gray-500">
                Season {season.number} • {daysLeft} days remaining
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="text-lg font-bold text-white">Lv.{currentLevel}</div>
              <div className="text-[10px] text-gray-500">{playerXP.toLocaleString()} XP</div>
            </div>
            {!season.isPremium && (
              <button
                onClick={handleUpgradePremium}
                disabled={balance < season.premiumCost}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-bold transition-all",
                  balance >= season.premiumCost
                    ? "bg-gradient-to-r from-amber-600 to-purple-600 text-white hover:scale-105 shadow-lg"
                    : "bg-gray-800 text-gray-600 cursor-not-allowed"
                )}
              >
                👑 Upgrade Premium ({season.premiumCost} GBLN)
              </button>
            )}
            {season.isPremium && (
              <span className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-bold border border-amber-500/30">
                👑 Premium Active
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tier Track */}
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex gap-2 min-w-max pb-2">
          {season.tiers.map((tier, i) => {
            const isUnlocked = playerXP >= tier.xpRequired * tier.level * 0.5;
            const isCurrent = i + 1 === currentLevel;
            return (
              <TierCard
                key={tier.level}
                tier={tier}
                isUnlocked={isUnlocked}
                isCurrent={isCurrent}
                isPremium={season.isPremium}
              />
            );
          })}
        </div>
      </div>

      {/* Progress Bar */}
      <div>
        <div className="flex justify-between text-[10px] text-gray-500 mb-1">
          <span>Level {currentLevel} / 30</span>
          <span>{playerXP.toLocaleString()} XP</span>
        </div>
        <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-600 via-goblin-500 to-amber-500 rounded-full transition-all duration-1000"
            style={{ width: `${(currentLevel / 30) * 100}%` }}
          />
        </div>
      </div>

      {/* Reward Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <RewardSummary
          label="GBLN Earned"
          value={season.tiers
            .filter((t, i) => i < currentLevel && t.freeReward?.type === "gbln")
            .reduce((s, t) => s + (t.freeReward?.value ?? 0), 0)}
          icon="💰"
        />
        <RewardSummary
          label="Items Unlocked"
          value={season.tiers.filter((t, i) => i < currentLevel && t.freeReward).length}
          icon="🎁"
        />
        <RewardSummary
          label="Premium Rewards"
          value={
            season.isPremium
              ? season.tiers.filter((t, i) => i < currentLevel && t.premiumReward).length
              : 0
          }
          icon="👑"
          locked={!season.isPremium}
        />
        <RewardSummary
          label="Days Left"
          value={daysLeft}
          icon="⏰"
        />
      </div>
    </div>
  );
}

function TierCard({
  tier,
  isUnlocked,
  isCurrent,
  isPremium,
}: {
  tier: BattlePassTier;
  isUnlocked: boolean;
  isCurrent: boolean;
  isPremium: boolean;
}) {
  return (
    <div
      className={cn(
        "relative w-24 flex-shrink-0 rounded-xl border transition-all",
        isCurrent
          ? "border-goblin-500/50 bg-goblin-500/10 scale-105"
          : isUnlocked
          ? "border-gray-700/50 bg-gray-800/30"
          : "border-gray-800/30 bg-gray-900/30 opacity-40"
      )}
    >
      {/* Level header */}
      <div
        className={cn(
          "text-center py-1 rounded-t-xl text-[10px] font-bold",
          isCurrent
            ? "bg-goblin-500/20 text-goblin-400"
            : isUnlocked
            ? "bg-gray-800/50 text-gray-400"
            : "bg-gray-900/50 text-gray-600"
        )}
      >
        Lv.{tier.level}
      </div>

      {/* Free reward */}
      <div className="p-2 text-center border-b border-gray-800/30">
        {tier.freeReward ? (
          <>
            <span className="text-lg block">{tier.freeReward.icon}</span>
            <span className="text-[9px] text-gray-400 block truncate">{tier.freeReward.name}</span>
          </>
        ) : (
          <span className="text-lg block text-gray-700">·</span>
        )}
      </div>

      {/* Premium reward */}
      <div
        className={cn(
          "p-2 text-center rounded-b-xl",
          isPremium ? "bg-amber-500/5" : "bg-gray-900/50"
        )}
      >
        {tier.premiumReward ? (
          <>
            <span className="text-lg block">{tier.premiumReward.icon}</span>
            <span
              className={cn(
                "text-[9px] block truncate",
                isPremium ? RARITY_CONFIG[tier.premiumReward.rarity].color : "text-gray-600"
              )}
            >
              {tier.premiumReward.name}
            </span>
            {!isPremium && (
              <span className="text-[8px] text-gray-600">🔒</span>
            )}
          </>
        ) : (
          <span className="text-lg block text-gray-700">·</span>
        )}
      </div>
    </div>
  );
}

function RewardSummary({
  label,
  value,
  icon,
  locked,
}: {
  label: string;
  value: number;
  icon: string;
  locked?: boolean;
}) {
  return (
    <div className={cn("p-3 rounded-lg bg-gray-800/30 border border-gray-800/50 text-center", locked && "opacity-50")}>
      <span className="text-lg">{locked ? "🔒" : icon}</span>
      <div className="text-sm font-bold text-white mt-1">{value}</div>
      <div className="text-[10px] text-gray-500">{label}</div>
    </div>
  );
}
