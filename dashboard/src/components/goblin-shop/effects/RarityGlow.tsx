"use client";

import { RARITY_CONFIG } from "@/lib/shop-utils";
import type { Rarity } from "@/types/shop";
import { cn } from "@/lib/utils";

interface RarityGlowProps {
  rarity: Rarity;
  children: React.ReactNode;
  className?: string;
  pulse?: boolean;
}

export default function RarityGlow({ rarity, children, className, pulse = false }: RarityGlowProps) {
  const config = RARITY_CONFIG[rarity];

  return (
    <div
      className={cn(
        "relative rounded-xl border",
        config.borderColor,
        pulse && "animate-pulse",
        rarity === "legendary" && "legendary-border",
        className
      )}
      style={{
        boxShadow: `0 0 15px ${config.glowColor}, 0 0 30px ${config.glowColor}`,
      }}
    >
      {children}
    </div>
  );
}
