"use client";

import { Suspense, useCallback } from "react";
import dynamic from "next/dynamic";
import { Canvas } from "@react-three/fiber";
import { useFamiliarStore } from "@/stores/familiarStore";
import { STAGE_CONFIG, MOOD_CONFIG, canEvolve, getCosmeticById } from "@/lib/familiar-utils";
import { cn } from "@/lib/utils";
import FamiliarChat from "./FamiliarChat";
import FamiliarEvolutionAnimation from "./FamiliarEvolutionAnimation";

const FamiliarScene3D = dynamic(() => import("./FamiliarScene3D"), { ssr: false });

export default function FamiliarOverlay() {
  const {
    familiar,
    isExpanded,
    isEvolving,
    toggleExpanded,
    evolve,
  } = useFamiliarStore();

  const stageConfig = STAGE_CONFIG[familiar.stage];
  const moodConfig = MOOD_CONFIG[familiar.mood];
  const showEvolveButton = canEvolve(familiar);

  const equippedAuraCosmetic = familiar.equippedCosmetics.aura
    ? getCosmeticById(familiar.equippedCosmetics.aura)
    : null;
  const equippedColorCosmetic = familiar.equippedCosmetics.color
    ? getCosmeticById(familiar.equippedCosmetics.color)
    : null;

  return (
    <>
      <FamiliarEvolutionAnimation />

      {/* Floating familiar bubble — offset on mobile to avoid GoblinChat button */}
      <div className="fixed bottom-20 right-4 z-50 flex flex-col items-end gap-2">
        {/* Expanded panel */}
        {isExpanded && (
          <div className="w-[calc(100vw-2rem)] sm:w-80 max-w-80 bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 rounded-xl shadow-2xl animate-slide-up overflow-hidden max-h-[60vh] sm:max-h-none overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800/50">
              <div className="flex items-center gap-2">
                <span className={cn("text-sm font-bold", stageConfig.color)}>
                  {stageConfig.icon} {familiar.name}
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400">
                  {stageConfig.label}
                </span>
              </div>
              <button
                onClick={toggleExpanded}
                className="text-gray-500 hover:text-white transition-colors text-lg leading-none"
              >
                ×
              </button>
            </div>

            {/* XP bar */}
            <div className="px-3 py-2 border-b border-gray-800/50">
              <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
                <span>XP: {familiar.xp.toLocaleString()}</span>
                <span>
                  {familiar.stage !== "elder"
                    ? `Next: ${familiar.xpToEvolve.toLocaleString()}`
                    : "MAX LEVEL"}
                </span>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-goblin-600 to-goblin-400 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, (familiar.xp / familiar.xpToEvolve) * 100)}%`,
                  }}
                />
              </div>
              {showEvolveButton && (
                <button
                  onClick={evolve}
                  disabled={isEvolving}
                  className="mt-2 w-full text-xs py-1.5 rounded-lg bg-gold-500/20 text-gold-400 hover:bg-gold-500/30 font-bold transition-all animate-pulse disabled:opacity-50"
                >
                  {isEvolving ? "Evolving..." : "✨ EVOLVE NOW ✨"}
                </button>
              )}
            </div>

            {/* Stats row */}
            <div className="px-3 py-2 border-b border-gray-800/50 flex items-center gap-3 text-[10px]">
              <span className="text-gray-500">
                🔥 Streak: <span className="text-white">{familiar.tradingStreak}</span>
              </span>
              <span className="text-gray-500">
                🤝 Bond: <span className="text-white">Lv.{familiar.bondLevel}</span>
              </span>
              <span className="text-gray-500">
                💡 Insights: <span className="text-white">{familiar.totalInsightsGiven}</span>
              </span>
            </div>

            {/* Chat / Insights feed */}
            <div className="p-3">
              <FamiliarChat />
            </div>
          </div>
        )}

        {/* The familiar bubble */}
        <button
          onClick={toggleExpanded}
          className={cn(
            "relative w-11 h-11 sm:w-14 sm:h-14 rounded-full border-2 transition-all duration-300 group",
            "bg-gray-900/90 backdrop-blur-xl shadow-lg hover:shadow-xl hover:scale-110",
            isEvolving
              ? "border-gold-400 shadow-gold-500/50"
              : `border-gray-700 hover:border-goblin-500/50`
          )}
          style={{
            boxShadow: isEvolving
              ? "0 0 20px rgba(251,191,36,0.5)"
              : `0 0 15px ${stageConfig.glowColor}`,
          }}
        >
          {/* 3D familiar in mini canvas */}
          <div className="w-full h-full rounded-full overflow-hidden pointer-events-none">
            <Canvas
              camera={{ position: [0, 0.3, 2], fov: 40 }}
              gl={{ antialias: false, alpha: true }}
              style={{ background: "transparent" }}
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
          </div>

          {/* Mood indicator */}
          <span
            className={cn(
              "absolute -top-1 -right-1 text-xs w-5 h-5 flex items-center justify-center rounded-full bg-gray-900 border border-gray-700",
              moodConfig.animation
            )}
          >
            {moodConfig.icon}
          </span>

          {/* Notification dot for new insights */}
          {familiar.insights.length > 0 && (
            <span className="absolute -top-1 -left-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
          )}
        </button>
      </div>
    </>
  );
}
