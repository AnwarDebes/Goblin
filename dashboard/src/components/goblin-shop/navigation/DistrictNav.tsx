"use client";

import { useGoblinShopStore, type District } from "../GoblinShopStore";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface DistrictItem {
  id: District;
  label: string;
  icon: string;
  isNew?: boolean;
  isHot?: boolean;
}

const MARKETPLACE_DISTRICTS: DistrictItem[] = [
  { id: "forge", label: "Forge", icon: "⚒" },
  { id: "oracle", label: "Oracle", icon: "🔮" },
  { id: "alchemist", label: "Alchemist", icon: "⚗" },
  { id: "enchantment", label: "Enchantments", icon: "✨", isNew: true },
  { id: "skins", label: "Skins", icon: "🎨", isNew: true },
  { id: "prophecy", label: "Prophecy", icon: "📜", isNew: true },
];

const ADVENTURE_DISTRICTS: DistrictItem[] = [
  { id: "arena", label: "Arena", icon: "⚔️", isHot: true },
  { id: "treasure", label: "Treasure Maps", icon: "🗺️", isNew: true },
  { id: "guild", label: "Guild Hall", icon: "🏰", isNew: true },
  { id: "champions", label: "Champions", icon: "🏆" },
  { id: "vault", label: "Vault", icon: "🏦" },
  { id: "familiar", label: "Familiar Den", icon: "🐉" },
];

const REWARDS_DISTRICTS: DistrictItem[] = [
  { id: "chests", label: "Mystery Chests", icon: "📦", isHot: true },
  { id: "wheel", label: "Wheel of Fortune", icon: "🎰", isNew: true },
  { id: "battlepass", label: "Battle Pass", icon: "👑", isHot: true },
];

type Category = "marketplace" | "adventures" | "rewards";

const ALL_DISTRICTS = [...MARKETPLACE_DISTRICTS, ...ADVENTURE_DISTRICTS, ...REWARDS_DISTRICTS];

export default function DistrictNav() {
  const { activeDistrict, setDistrict } = useGoblinShopStore();
  const [activeCategory, setActiveCategory] = useState<Category>(() => {
    if (REWARDS_DISTRICTS.some((d) => d.id === activeDistrict)) return "rewards";
    if (ADVENTURE_DISTRICTS.some((d) => d.id === activeDistrict)) return "adventures";
    return "marketplace";
  });

  const districts =
    activeCategory === "marketplace"
      ? MARKETPLACE_DISTRICTS
      : activeCategory === "adventures"
      ? ADVENTURE_DISTRICTS
      : REWARDS_DISTRICTS;

  return (
    <div className="border-b border-gray-800">
      {/* Category pills */}
      <div className="flex items-center gap-2 px-4 pt-2">
        <button
          onClick={() => setActiveCategory("marketplace")}
          className={cn(
            "text-xs px-3 py-1 rounded-full font-medium transition-all",
            activeCategory === "marketplace"
              ? "bg-goblin-500/20 text-goblin-400 border border-goblin-500/30"
              : "text-gray-500 hover:text-gray-300 border border-transparent"
          )}
        >
          🏪 Marketplace
        </button>
        <button
          onClick={() => setActiveCategory("adventures")}
          className={cn(
            "text-xs px-3 py-1 rounded-full font-medium transition-all",
            activeCategory === "adventures"
              ? "bg-gold-500/20 text-gold-400 border border-gold-500/30"
              : "text-gray-500 hover:text-gray-300 border border-transparent"
          )}
        >
          ⚔️ Adventures
        </button>
        <button
          onClick={() => setActiveCategory("rewards")}
          className={cn(
            "text-xs px-3 py-1 rounded-full font-medium transition-all",
            activeCategory === "rewards"
              ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
              : "text-gray-500 hover:text-gray-300 border border-transparent"
          )}
        >
          🎁 Rewards
        </button>
      </div>

      {/* District tabs */}
      <div className="w-full overflow-x-auto scrollbar-hide">
        <div className="flex min-w-max">
          {districts.map((d) => {
            const isActive = activeDistrict === d.id;
            return (
              <button
                key={d.id}
                onClick={() => setDistrict(d.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-all whitespace-nowrap relative",
                  isActive
                    ? "bg-goblin-500/10 border-b-2 border-goblin-400 text-goblin-400"
                    : "text-gray-500 hover:text-gray-300 border-b-2 border-transparent"
                )}
              >
                <span>{d.icon}</span>
                <span>{d.label}</span>
                {d.isNew && (
                  <span className="text-[8px] font-bold bg-gold-500/20 text-gold-400 px-1 py-0.5 rounded-full leading-none">
                    NEW
                  </span>
                )}
                {d.isHot && (
                  <span className="text-[8px] font-bold bg-red-500/20 text-red-400 px-1 py-0.5 rounded-full leading-none animate-pulse">
                    HOT
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
