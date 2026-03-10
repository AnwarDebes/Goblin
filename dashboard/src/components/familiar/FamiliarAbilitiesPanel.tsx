"use client";

import { useFamiliarStore } from "@/stores/familiarStore";
import {
  FAMILIAR_ABILITIES,
  STAGE_ORDER,
  STAGE_CONFIG,
  getAbilityForStage,
} from "@/lib/familiar-utils";
import { cn } from "@/lib/utils";
import GBLNIcon from "@/components/goblin-shop/shared/GBLNIcon";

interface FamiliarAbilitiesPanelProps {
  onUnlock: (abilityId: string, cost: number) => void;
  balance: number;
}

export default function FamiliarAbilitiesPanel({ onUnlock, balance }: FamiliarAbilitiesPanelProps) {
  const { familiar } = useFamiliarStore();
  const availableAbilities = getAbilityForStage(familiar.stage);

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold text-white flex items-center gap-2">
        <span>🧬</span> Familiar Abilities
      </h3>
      <div className="grid grid-cols-1 gap-2">
        {FAMILIAR_ABILITIES.map((ability) => {
          const isUnlocked = familiar.unlockedAbilities.includes(ability.id);
          const isAvailable = availableAbilities.includes(ability);
          const canAfford = balance >= ability.unlockCost;
          const stageConfig = STAGE_CONFIG[ability.unlockStage];

          return (
            <div
              key={ability.id}
              className={cn(
                "p-3 rounded-lg border transition-all",
                isUnlocked
                  ? "border-goblin-500/30 bg-goblin-500/5"
                  : isAvailable
                  ? "border-gray-700/50 bg-gray-800/50 hover:border-gray-600"
                  : "border-gray-800/30 bg-gray-900/50 opacity-50"
              )}
            >
              <div className="flex items-start gap-3">
                <span className="text-xl">{ability.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{ability.name}</span>
                    {isUnlocked && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-goblin-500/20 text-goblin-400 font-bold">
                        ACTIVE
                      </span>
                    )}
                    {!isAvailable && (
                      <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full", stageConfig.color)} style={{ background: `${stageConfig.glowColor}` }}>
                        🔒 {stageConfig.label}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                    {ability.description}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-gray-500">
                      Cooldown: {ability.cooldownSeconds}s
                    </span>
                    {!isUnlocked && isAvailable && (
                      <button
                        className={cn(
                          "flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium transition-all",
                          canAfford
                            ? "bg-goblin-500/20 text-goblin-400 hover:bg-goblin-500/30"
                            : "bg-gray-800 text-gray-500 cursor-not-allowed"
                        )}
                        disabled={!canAfford}
                        onClick={() => onUnlock(ability.id, ability.unlockCost)}
                      >
                        <GBLNIcon size={12} />
                        {ability.unlockCost}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
