"use client";

import { useGoblinShopStore } from "../GoblinShopStore";
import { INGREDIENTS, computeCraftedIndicator, RARITY_CONFIG } from "@/lib/shop-utils";
import IndicatorPotionCard from "../cards/IndicatorPotionCard";
import RarityBadge from "../shared/RarityBadge";
import PriceTag from "../shared/PriceTag";
import { useState, useCallback } from "react";
import type { CraftedIndicator } from "@/types/shop";

export default function AlchemistWorkshop() {
  const {
    craftingIngredients,
    addIngredient,
    removeIngredient,
    clearIngredients,
    addCraftedIndicator,
    craftedIndicators,
  } = useGoblinShopStore();

  const [isBrewing, setIsBrewing] = useState(false);
  const [brewResult, setBrewResult] = useState<CraftedIndicator | null>(null);

  const handleBrew = useCallback(() => {
    if (craftingIngredients.length < 2) return;
    setIsBrewing(true);
    setBrewResult(null);

    setTimeout(() => {
      const result = computeCraftedIndicator(craftingIngredients);
      setBrewResult(result);
      addCraftedIndicator(result);
      setIsBrewing(false);
    }, 1500);
  }, [craftingIngredients, addCraftedIndicator]);

  const handleToggle = useCallback(
    (id: string) => {
      if (craftingIngredients.includes(id)) {
        removeIngredient(id);
      } else {
        addIngredient(id);
      }
    },
    [craftingIngredients, addIngredient, removeIngredient]
  );

  const selectedIngredients = craftingIngredients
    .map((id) => INGREDIENTS.find((i) => i.id === id))
    .filter(Boolean);

  return (
    <div className="p-4">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-xl font-bold text-white">The Alchemist&apos;s Workshop</h2>
        <p className="text-sm text-gray-500">Combine indicators to brew powerful custom potions</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Cauldron (3 cols) */}
        <div className="lg:col-span-3">
          {/* Cauldron visual */}
          <div className="relative flex flex-col items-center py-8">
            {/* Cauldron */}
            <div
              className={`relative w-48 h-48 rounded-full flex items-center justify-center ${
                isBrewing ? "animate-pulse" : ""
              }`}
              style={{
                background: `radial-gradient(circle, ${
                  isBrewing ? "rgba(34,197,94,0.4)" : "rgba(34,197,94,0.15)"
                } 0%, rgba(168,85,247,0.1) 50%, transparent 70%)`,
              }}
            >
              <div
                className="w-32 h-32 rounded-full flex items-center justify-center"
                style={{
                  background: `radial-gradient(circle, ${
                    isBrewing ? "rgba(34,197,94,0.6)" : "rgba(34,197,94,0.25)"
                  } 0%, transparent 70%)`,
                }}
              >
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center text-3xl"
                  style={{
                    background: `radial-gradient(circle, rgba(34,197,94,0.4) 0%, transparent 70%)`,
                  }}
                >
                  {isBrewing ? "✨" : "⚗"}
                </div>
              </div>
              {/* Brewing animation rings */}
              {isBrewing && (
                <>
                  <div className="absolute inset-0 rounded-full border-2 border-goblin-500/30 animate-ping" />
                  <div className="absolute inset-4 rounded-full border border-purple-500/20 animate-ping" style={{ animationDelay: "0.3s" }} />
                </>
              )}
            </div>

            {/* Ingredient slots */}
            <div className="flex gap-4 mt-4">
              {[0, 1, 2].map((slot) => {
                const ingredient = selectedIngredients[slot];
                return (
                  <div
                    key={slot}
                    className={`w-14 h-14 rounded-full border-2 flex items-center justify-center text-xl transition-all ${
                      ingredient
                        ? "border-goblin-400 bg-goblin-500/10"
                        : "border-gray-700 border-dashed bg-gray-800/50"
                    }`}
                    style={
                      ingredient ? { borderColor: ingredient.color, boxShadow: `0 0 8px ${ingredient.color}40` } : undefined
                    }
                  >
                    {ingredient ? ingredient.icon : <span className="text-gray-600 text-sm">+</span>}
                  </div>
                );
              })}
            </div>

            {/* Brew button */}
            <button
              onClick={handleBrew}
              disabled={craftingIngredients.length < 2 || isBrewing}
              className={`mt-4 px-6 py-2 rounded-lg font-bold text-sm transition-all ${
                craftingIngredients.length >= 2 && !isBrewing
                  ? "bg-goblin-500/20 text-goblin-400 border border-goblin-500/30 hover:bg-goblin-500/30"
                  : "bg-gray-800 text-gray-600 border border-gray-700 cursor-not-allowed"
              }`}
            >
              {isBrewing ? "Brewing..." : `Brew (${craftingIngredients.length}/2-3)`}
            </button>

            {craftingIngredients.length > 0 && !isBrewing && (
              <button
                onClick={clearIngredients}
                className="mt-2 text-xs text-gray-500 hover:text-gray-400"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Brew result */}
          {brewResult && (
            <div className="mt-4 p-4 rounded-lg border border-goblin-500/30 bg-gray-900/80 animate-fade-in">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🧪</span>
                <h3 className="text-sm font-bold text-white">{brewResult.name}</h3>
                <RarityBadge rarity={brewResult.rarity} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-gray-400">
                  Effectiveness: <span className="text-goblin-400 font-medium">{brewResult.effectiveness}%</span>
                </div>
                <div className="text-gray-400">
                  Value: <PriceTag price={brewResult.priceTier} size="sm" />
                </div>
              </div>
              <div className="flex gap-1 mt-2">
                {brewResult.ingredients.map((id) => {
                  const ing = INGREDIENTS.find((i) => i.id === id);
                  return ing ? (
                    <span key={id} className="text-sm" title={ing.name}>
                      {ing.icon}
                    </span>
                  ) : null;
                })}
              </div>
            </div>
          )}

          {/* Previously crafted */}
          {craftedIndicators.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-bold text-gray-400 mb-2">Previously Crafted ({craftedIndicators.length})</h3>
              <div className="space-y-2">
                {craftedIndicators.map((ci) => (
                  <div key={ci.id} className="flex items-center gap-2 text-xs p-2 bg-gray-800/50 rounded-lg">
                    <span>🧪</span>
                    <span className="text-white font-medium">{ci.name}</span>
                    <RarityBadge rarity={ci.rarity} />
                    <span className="text-gray-500 ml-auto">{ci.effectiveness}% eff.</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Ingredient Shelf (2 cols) */}
        <div className="lg:col-span-2">
          <h3 className="text-sm font-bold text-gray-400 mb-3">Ingredient Shelf</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2">
            {INGREDIENTS.map((ingredient) => (
              <IndicatorPotionCard
                key={ingredient.id}
                ingredient={ingredient}
                isSelected={craftingIngredients.includes(ingredient.id)}
                onToggle={() => handleToggle(ingredient.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
