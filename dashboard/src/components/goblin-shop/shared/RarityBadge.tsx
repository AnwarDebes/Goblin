"use client";

import { RARITY_CONFIG } from "@/lib/shop-utils";
import type { Rarity } from "@/types/shop";
import { cn } from "@/lib/utils";

interface RarityBadgeProps {
  rarity: Rarity;
  className?: string;
}

export default function RarityBadge({ rarity, className }: RarityBadgeProps) {
  const config = RARITY_CONFIG[rarity];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border",
        config.bgColor,
        config.color,
        config.borderColor,
        className
      )}
    >
      {config.icon} {config.label}
    </span>
  );
}
