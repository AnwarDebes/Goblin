"use client";

import type { IndicatorIngredient } from "@/types/shop";
import { cn } from "@/lib/utils";

interface IndicatorPotionCardProps {
  ingredient: IndicatorIngredient;
  isSelected: boolean;
  onToggle: () => void;
}

const CATEGORY_COLORS: Record<IndicatorIngredient["category"], string> = {
  momentum: "text-green-400 bg-green-500/10 border-green-500/30",
  trend: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  volatility: "text-purple-400 bg-purple-500/10 border-purple-500/30",
  volume: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
};

export default function IndicatorPotionCard({ ingredient, isSelected, onToggle }: IndicatorPotionCardProps) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "w-full text-left rounded-lg p-2.5 border transition-all duration-200",
        isSelected
          ? "border-opacity-100 scale-[1.02] bg-gray-800"
          : "border-gray-800 bg-gray-900/50 hover:bg-gray-800/50"
      )}
      style={
        isSelected
          ? {
              borderColor: ingredient.color,
              boxShadow: `0 0 12px ${ingredient.color}40, 0 0 4px ${ingredient.color}20`,
            }
          : undefined
      }
    >
      <div className="flex items-center gap-2">
        <span className="text-lg">{ingredient.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-white truncate">{ingredient.name}</div>
          <span className={cn("inline-block text-[9px] px-1.5 py-0 rounded-full border mt-0.5 font-medium", CATEGORY_COLORS[ingredient.category])}>
            {ingredient.category}
          </span>
        </div>
        {isSelected && (
          <span className="text-goblin-400 text-sm">✓</span>
        )}
      </div>
      <p className="text-[10px] text-gray-500 mt-1.5 line-clamp-2">{ingredient.description}</p>
    </button>
  );
}
