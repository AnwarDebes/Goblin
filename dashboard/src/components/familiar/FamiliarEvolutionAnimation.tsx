"use client";

import { useEffect, useState } from "react";
import { useFamiliarStore } from "@/stores/familiarStore";
import { STAGE_CONFIG } from "@/lib/familiar-utils";
import { cn } from "@/lib/utils";

export default function FamiliarEvolutionAnimation() {
  const { showEvolutionAnimation, clearEvolutionAnimation, familiar } = useFamiliarStore();
  const [phase, setPhase] = useState<"burst" | "reveal" | "done">("burst");

  useEffect(() => {
    if (!showEvolutionAnimation) {
      setPhase("burst");
      return;
    }

    const timer1 = setTimeout(() => setPhase("reveal"), 1500);
    const timer2 = setTimeout(() => {
      setPhase("done");
      clearEvolutionAnimation();
    }, 4000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [showEvolutionAnimation, clearEvolutionAnimation]);

  if (!showEvolutionAnimation) return null;

  const stageConfig = STAGE_CONFIG[familiar.stage];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 animate-fade-in" />

      {/* Particle burst */}
      <div className="relative">
        {phase === "burst" && (
          <>
            {Array.from({ length: 24 }).map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 rounded-full bg-gold-400"
                style={{
                  left: "50%",
                  top: "50%",
                  transform: `translate(-50%, -50%) rotate(${i * 15}deg)`,
                  animation: `particle-burst 1.5s ease-out forwards`,
                  animationDelay: `${i * 0.03}s`,
                  boxShadow: "0 0 10px rgba(251,191,36,0.8)",
                }}
              />
            ))}
            {/* Central glow */}
            <div
              className="w-32 h-32 rounded-full"
              style={{
                background: "radial-gradient(circle, rgba(251,191,36,0.6) 0%, transparent 70%)",
                animation: "pulse 0.5s ease-in-out infinite",
              }}
            />
          </>
        )}

        {phase === "reveal" && (
          <div className="text-center animate-slide-up">
            <div className="text-6xl mb-4 animate-bounce">{stageConfig.icon}</div>
            <h2 className={cn("text-2xl font-bold", stageConfig.color)}>
              Evolution Complete!
            </h2>
            <p className="text-gray-400 text-sm mt-2">
              {familiar.name} evolved into {stageConfig.label}!
            </p>
            <p className="text-gray-500 text-xs mt-1">{stageConfig.description}</p>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes particle-burst {
          0% {
            transform: translate(-50%, -50%) rotate(var(--rotation)) translateX(0);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) rotate(var(--rotation)) translateX(150px);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
