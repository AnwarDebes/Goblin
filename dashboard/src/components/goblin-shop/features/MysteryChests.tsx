"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { CHEST_TIERS, openChest } from "@/lib/arena-utils";
import { RARITY_CONFIG } from "@/lib/shop-utils";
import type { MysteryChest, ChestReward } from "@/types/arena";
import GBLNIcon from "../shared/GBLNIcon";
import RarityBadge from "../shared/RarityBadge";

interface MysteryChestsProps {
  balance: number;
  onSpendGBLN: (amount: number) => void;
}

export default function MysteryChests({ balance, onSpendGBLN }: MysteryChestsProps) {
  const [isOpening, setIsOpening] = useState(false);
  const [openingChest, setOpeningChest] = useState<MysteryChest | null>(null);
  const [revealedReward, setRevealedReward] = useState<ChestReward | null>(null);
  const [animPhase, setAnimPhase] = useState<"idle" | "shake" | "glow" | "reveal">("idle");
  const [rewardHistory, setRewardHistory] = useState<
    Array<{ chest: string; reward: ChestReward; timestamp: number }>
  >([]);
  const [freeChestAvailable, setFreeChestAvailable] = useState(true);

  const handleOpenChest = useCallback(
    (chest: MysteryChest, isFree: boolean = false) => {
      if (isOpening) return;
      if (!isFree && balance < chest.cost) return;
      if (!isFree) onSpendGBLN(chest.cost);
      if (isFree) setFreeChestAvailable(false);

      setOpeningChest(chest);
      setRevealedReward(null);
      setIsOpening(true);

      // Phase 1: Shake
      setAnimPhase("shake");
      setTimeout(() => {
        // Phase 2: Glow
        setAnimPhase("glow");
        setTimeout(() => {
          // Phase 3: Reveal
          const reward = openChest(chest);
          setRevealedReward(reward);
          setAnimPhase("reveal");
          setRewardHistory((prev) =>
            [{ chest: chest.tier, reward, timestamp: Date.now() }, ...prev].slice(0, 30)
          );
          setTimeout(() => {
            setIsOpening(false);
            setAnimPhase("idle");
          }, 3000);
        }, 1200);
      }, 1000);
    },
    [isOpening, balance, onSpendGBLN]
  );

  return (
    <div className="space-y-6">
      {/* Free Daily Chest */}
      {freeChestAvailable && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-goblin-500/10 border border-amber-500/30 text-center">
          <div className="text-2xl mb-1 animate-bounce">🎁</div>
          <h3 className="text-sm font-bold text-amber-400">Daily Free Chest!</h3>
          <p className="text-[10px] text-gray-400 mt-0.5">Claim your free wooden chest every day</p>
          <button
            onClick={() => handleOpenChest(CHEST_TIERS[0], true)}
            disabled={isOpening}
            className="mt-2 px-4 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 text-xs font-bold transition-all disabled:opacity-50"
          >
            Open Free Chest
          </button>
        </div>
      )}

      {/* Opening Animation */}
      {openingChest && animPhase !== "idle" && (
        <ChestAnimation
          chest={openingChest}
          phase={animPhase}
          reward={revealedReward}
          onClose={() => {
            setAnimPhase("idle");
            setOpeningChest(null);
            setIsOpening(false);
          }}
        />
      )}

      {/* Chest Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {CHEST_TIERS.map((chest) => {
          const canAfford = balance >= chest.cost;
          return (
            <div
              key={chest.id}
              className={cn(
                "relative p-4 rounded-xl border text-center transition-all",
                canAfford
                  ? "bg-gray-800/30 border-gray-700/50 hover:scale-[1.05] cursor-pointer"
                  : "bg-gray-900/30 border-gray-800/30 opacity-50"
              )}
              style={{ boxShadow: canAfford ? `0 0 20px ${chest.glowColor}` : "none" }}
              onClick={() => !isOpening && canAfford && handleOpenChest(chest)}
            >
              <div className="text-5xl mb-2 hover:animate-bounce transition-all">
                {chest.icon}
              </div>
              <h4 className="text-xs font-bold text-white capitalize">{chest.tier} Chest</h4>
              <div className="flex items-center justify-center gap-1 mt-1">
                <GBLNIcon size={11} />
                <span className="text-xs text-gold-400 font-bold">{chest.cost}</span>
              </div>

              {/* Possible rewards preview */}
              <div className="mt-2 space-y-0.5">
                {chest.possibleRewards.slice(0, 3).map((r, i) => (
                  <div key={i} className="text-[9px] text-gray-500 flex items-center justify-center gap-1">
                    <span>{r.icon}</span>
                    <span>{r.name}</span>
                  </div>
                ))}
                {chest.possibleRewards.length > 3 && (
                  <div className="text-[9px] text-gray-600">
                    +{chest.possibleRewards.length - 3} more...
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Reward History */}
      {rewardHistory.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-white mb-2">Recent Opens</h3>
          <div className="space-y-1.5">
            {rewardHistory.slice(0, 10).map((entry, i) => {
              const rarityConfig = RARITY_CONFIG[entry.reward.rarity];
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 p-2 rounded-lg bg-gray-800/20 animate-fade-in"
                >
                  <span className="text-sm">{entry.reward.icon}</span>
                  <span className={cn("text-xs font-medium flex-1", rarityConfig.color)}>
                    {entry.reward.name}
                  </span>
                  <RarityBadge rarity={entry.reward.rarity} />
                  <span className="text-[10px] text-gray-500 capitalize">
                    from {entry.chest}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ChestAnimation({
  chest,
  phase,
  reward,
  onClose,
}: {
  chest: MysteryChest;
  phase: "shake" | "glow" | "reveal";
  reward: ChestReward | null;
  onClose: () => void;
}) {
  return (
    <div className="relative p-8 rounded-2xl bg-gradient-to-b from-gray-900 to-gray-950 border border-gray-700 text-center overflow-hidden">
      {/* Background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {phase === "glow" &&
          Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 rounded-full animate-ping"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                backgroundColor: chest.glowColor,
                animationDelay: `${Math.random() * 0.5}s`,
                animationDuration: `${0.5 + Math.random() * 1}s`,
              }}
            />
          ))}
      </div>

      {/* Chest */}
      {phase !== "reveal" && (
        <div
          className={cn(
            "text-8xl inline-block transition-all",
            phase === "shake" && "animate-[wiggle_0.2s_ease-in-out_infinite]",
            phase === "glow" && "animate-pulse scale-110"
          )}
          style={
            phase === "glow"
              ? {
                  filter: `drop-shadow(0 0 30px ${chest.glowColor}) drop-shadow(0 0 60px ${chest.glowColor})`,
                }
              : {}
          }
        >
          {chest.icon}
        </div>
      )}

      {/* Reveal */}
      {phase === "reveal" && reward && (
        <div className="animate-fade-in">
          <div
            className="text-7xl mb-4 inline-block animate-bounce"
            style={{
              filter: `drop-shadow(0 0 20px ${RARITY_CONFIG[reward.rarity].glowColor})`,
            }}
          >
            {reward.icon}
          </div>
          <div className={cn("text-lg font-black mb-1", RARITY_CONFIG[reward.rarity].color)}>
            {reward.name}
          </div>
          <RarityBadge rarity={reward.rarity} />
          {reward.type === "gbln" && (
            <div className="flex items-center justify-center gap-1 mt-2 text-lg font-bold text-gold-400">
              <GBLNIcon size={18} /> +{reward.value}
            </div>
          )}
          {reward.type === "xp" && (
            <div className="mt-2 text-lg font-bold text-purple-400">+{reward.value} XP</div>
          )}
          <button
            onClick={onClose}
            className="mt-4 px-6 py-2 rounded-lg bg-goblin-500/20 text-goblin-400 hover:bg-goblin-500/30 text-sm font-bold transition-all"
          >
            Collect!
          </button>
        </div>
      )}

      {/* Phase label */}
      {phase === "shake" && (
        <p className="mt-4 text-sm text-gray-500 animate-pulse">Opening...</p>
      )}
      {phase === "glow" && (
        <p className="mt-4 text-sm text-amber-400 animate-pulse">Something is glowing...</p>
      )}
    </div>
  );
}
