"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { useFamiliarStore } from "@/stores/familiarStore";
import {
  STAGE_CONFIG,
  PERSONALITY_LABELS,
  MOOD_CONFIG,
  canEvolve,
  EVOLUTION_XP,
  STAGE_ORDER,
  getCosmeticById,
} from "@/lib/familiar-utils";
import FamiliarScene3D from "@/components/familiar/FamiliarScene3D";
import FamiliarAbilitiesPanel from "@/components/familiar/FamiliarAbilitiesPanel";
import FamiliarCustomizer from "@/components/familiar/FamiliarCustomizer";
import FamiliarChat from "@/components/familiar/FamiliarChat";
import { cn } from "@/lib/utils";

interface FamiliarDenProps {
  balance: number;
  onSpendGBLN: (amount: number) => void;
}

export default function FamiliarDen({ balance, onSpendGBLN }: FamiliarDenProps) {
  const { familiar, evolve, unlockAbility, isEvolving } = useFamiliarStore();
  const stageConfig = STAGE_CONFIG[familiar.stage];
  const personalityConfig = PERSONALITY_LABELS[familiar.personality];
  const moodConfig = MOOD_CONFIG[familiar.mood];
  const showEvolve = canEvolve(familiar);

  const equippedAuraCosmetic = familiar.equippedCosmetics.aura
    ? getCosmeticById(familiar.equippedCosmetics.aura)
    : null;
  const equippedColorCosmetic = familiar.equippedCosmetics.color
    ? getCosmeticById(familiar.equippedCosmetics.color)
    : null;

  const handleUnlockAbility = (abilityId: string, cost: number) => {
    if (balance < cost) return;
    unlockAbility(abilityId);
    onSpendGBLN(cost);
  };

  const handlePurchaseCosmetic = (cosmeticId: string, cost: number) => {
    if (balance < cost) return;
    onSpendGBLN(cost);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero - Large 3D familiar display */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 3D Display */}
        <div className="lg:col-span-1">
          <div
            className="relative h-[300px] rounded-xl overflow-hidden border border-gray-800/50"
            style={{ boxShadow: `0 0 40px ${stageConfig.glowColor}` }}
          >
            <Canvas
              camera={{ position: [0, 0.5, 3], fov: 45 }}
              gl={{ antialias: true, alpha: true }}
              style={{ background: "radial-gradient(circle at 50% 50%, #1a1a2e, #0a0a0a)" }}
            >
              <Suspense fallback={null}>
                <FamiliarScene3D
                  stage={familiar.stage}
                  mood={familiar.mood}
                  happiness={familiar.happiness}
                  equippedColor={equippedColorCosmetic?.cssColor}
                  equippedAura={equippedAuraCosmetic?.cssColor}
                  name={familiar.name}
                  isEvolving={isEvolving}
                />
              </Suspense>
            </Canvas>

            {/* Evolve button overlay */}
            {showEvolve && (
              <button
                onClick={evolve}
                disabled={isEvolving}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-gold-500/20 text-gold-400 text-sm font-bold hover:bg-gold-500/30 transition-all animate-pulse border border-gold-500/30 backdrop-blur-sm disabled:opacity-50"
              >
                ✨ EVOLVE ✨
              </button>
            )}
          </div>
        </div>

        {/* Stats & Info */}
        <div className="lg:col-span-2 space-y-3">
          {/* Name & Stage */}
          <div className="flex items-center gap-3">
            <span className="text-3xl">{stageConfig.icon}</span>
            <div>
              <h2 className={cn("text-xl font-bold", stageConfig.color)}>{familiar.name}</h2>
              <span className="text-xs text-gray-400">{stageConfig.label} • {stageConfig.description}</span>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatBox label="Stage" value={stageConfig.label} icon={stageConfig.icon} />
            <StatBox label="Mood" value={moodConfig.label} icon={moodConfig.icon} />
            <StatBox label="Personality" value={personalityConfig.label} icon={personalityConfig.icon} />
            <StatBox label="Bond Level" value={`Lv.${familiar.bondLevel}`} icon="🤝" />
          </div>

          {/* XP Progress */}
          <div className="p-3 rounded-lg bg-gray-800/30 border border-gray-800/50">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Experience: {familiar.xp.toLocaleString()} XP</span>
              <span>
                {familiar.stage !== "elder"
                  ? `Next evolution: ${familiar.xpToEvolve.toLocaleString()} XP`
                  : "MAX STAGE"}
              </span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-goblin-600 to-gold-400 rounded-full transition-all duration-1000"
                style={{
                  width: `${Math.min(100, (familiar.xp / familiar.xpToEvolve) * 100)}%`,
                }}
              />
            </div>

            {/* Evolution stages timeline */}
            <div className="flex items-center justify-between mt-3">
              {STAGE_ORDER.map((stage, i) => {
                const config = STAGE_CONFIG[stage];
                const isCurrent = stage === familiar.stage;
                const isPast = STAGE_ORDER.indexOf(familiar.stage) > i;
                return (
                  <div key={stage} className="flex flex-col items-center gap-1">
                    <span
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 transition-all",
                        isCurrent
                          ? "border-goblin-500 bg-goblin-500/20 scale-110"
                          : isPast
                          ? "border-gray-600 bg-gray-800"
                          : "border-gray-800 bg-gray-900 opacity-40"
                      )}
                    >
                      {config.icon}
                    </span>
                    <span className={cn("text-[9px]", isCurrent ? config.color : "text-gray-600")}>
                      {config.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Happiness & Streak */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 rounded-lg bg-gray-800/30 border border-gray-800/50">
              <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                <span>Happiness</span>
                <span>❤️ {familiar.happiness}%</span>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    familiar.happiness > 70
                      ? "bg-green-500"
                      : familiar.happiness > 30
                      ? "bg-yellow-500"
                      : "bg-red-500"
                  )}
                  style={{ width: `${familiar.happiness}%` }}
                />
              </div>
            </div>
            <div className="p-3 rounded-lg bg-gray-800/30 border border-gray-800/50">
              <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                <span>Trading Streak</span>
                <span>🔥 {familiar.tradingStreak}</span>
              </div>
              <div className="text-lg font-bold text-white">{familiar.tradingStreak} trades</div>
            </div>
          </div>
        </div>
      </div>

      {/* Abilities & Customizer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-gray-800/20 border border-gray-800/50">
          <FamiliarAbilitiesPanel onUnlock={handleUnlockAbility} balance={balance} />
        </div>
        <div className="p-4 rounded-xl bg-gray-800/20 border border-gray-800/50">
          <FamiliarCustomizer
            ownedCosmetics={[]}
            onPurchase={handlePurchaseCosmetic}
            balance={balance}
          />
        </div>
      </div>

      {/* Insights History */}
      <div className="p-4 rounded-xl bg-gray-800/20 border border-gray-800/50">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
          <span>💡</span> Recent Insights
        </h3>
        <FamiliarChat />
      </div>
    </div>
  );
}

function StatBox({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="p-2.5 rounded-lg bg-gray-800/30 border border-gray-800/50 text-center">
      <span className="text-lg">{icon}</span>
      <p className="text-xs font-medium text-white mt-0.5">{value}</p>
      <p className="text-[10px] text-gray-500">{label}</p>
    </div>
  );
}
