"use client";

import { useFamiliarStore } from "@/stores/familiarStore";
import { COSMETIC_CATALOG, getCosmeticsBySlot } from "@/lib/familiar-utils";
import { RARITY_CONFIG } from "@/lib/shop-utils";
import type { CosmeticSlot } from "@/types/familiar";
import { cn } from "@/lib/utils";
import GBLNIcon from "@/components/goblin-shop/shared/GBLNIcon";
import { useState } from "react";

const SLOT_TABS: { slot: CosmeticSlot; label: string; icon: string }[] = [
  { slot: "hat", label: "Hats", icon: "🎩" },
  { slot: "accessory", label: "Accessories", icon: "⚔️" },
  { slot: "aura", label: "Auras", icon: "✨" },
  { slot: "color", label: "Skins", icon: "🎨" },
];

interface FamiliarCustomizerProps {
  ownedCosmetics: string[];
  onPurchase: (cosmeticId: string, cost: number) => void;
  balance: number;
}

export default function FamiliarCustomizer({
  ownedCosmetics,
  onPurchase,
  balance,
}: FamiliarCustomizerProps) {
  const { familiar, equipCosmetic } = useFamiliarStore();
  const [activeSlot, setActiveSlot] = useState<CosmeticSlot>("hat");

  const items = getCosmeticsBySlot(activeSlot);
  const equippedId = familiar.equippedCosmetics[activeSlot];

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-white flex items-center gap-2">
        <span>🎨</span> Customize {familiar.name}
      </h3>

      {/* Slot tabs */}
      <div className="flex gap-1">
        {SLOT_TABS.map((tab) => (
          <button
            key={tab.slot}
            onClick={() => setActiveSlot(tab.slot)}
            className={cn(
              "flex-1 text-xs py-1.5 rounded-lg font-medium transition-all",
              activeSlot === tab.slot
                ? "bg-goblin-500/20 text-goblin-400 border border-goblin-500/30"
                : "text-gray-400 hover:text-white hover:bg-gray-800/50 border border-transparent"
            )}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Items grid */}
      <div className="grid grid-cols-2 gap-2">
        {items.map((cosmetic) => {
          const isOwned = ownedCosmetics.includes(cosmetic.id);
          const isEquipped = equippedId === cosmetic.id;
          const canAfford = balance >= cosmetic.cost;
          const rarityConfig = RARITY_CONFIG[cosmetic.rarity];

          return (
            <div
              key={cosmetic.id}
              className={cn(
                "p-2.5 rounded-lg border transition-all cursor-pointer",
                isEquipped
                  ? "border-goblin-500/50 bg-goblin-500/10 ring-1 ring-goblin-500/20"
                  : isOwned
                  ? "border-gray-700/50 bg-gray-800/50 hover:border-gray-600"
                  : "border-gray-800/30 bg-gray-900/50 hover:border-gray-700"
              )}
              onClick={() => {
                if (isOwned) {
                  equipCosmetic(activeSlot, isEquipped ? null : cosmetic.id);
                }
              }}
            >
              <div className="text-center">
                <span className="text-2xl">{cosmetic.preview}</span>
                <p className="text-xs font-medium text-white mt-1">{cosmetic.name}</p>
                <span
                  className={cn(
                    "inline-block text-[9px] px-1.5 py-0.5 rounded-full mt-1",
                    rarityConfig.bgColor,
                    rarityConfig.color
                  )}
                >
                  {rarityConfig.icon} {rarityConfig.label}
                </span>
              </div>

              <div className="mt-2 text-center">
                {isEquipped ? (
                  <span className="text-[10px] text-goblin-400 font-bold">EQUIPPED</span>
                ) : isOwned ? (
                  <button className="text-[10px] text-gray-400 hover:text-white">
                    Equip
                  </button>
                ) : (
                  <button
                    className={cn(
                      "flex items-center gap-1 text-[10px] mx-auto px-2 py-0.5 rounded font-medium",
                      canAfford
                        ? "bg-gold-500/20 text-gold-400 hover:bg-gold-500/30"
                        : "bg-gray-800 text-gray-600 cursor-not-allowed"
                    )}
                    disabled={!canAfford}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPurchase(cosmetic.id, cosmetic.cost);
                    }}
                  >
                    <GBLNIcon size={10} />
                    {cosmetic.cost}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
