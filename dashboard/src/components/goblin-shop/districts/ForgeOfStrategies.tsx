"use client";

import dynamic from "next/dynamic";
import type { StrategyArtifact } from "@/types/shop";
import { useGoblinShopStore } from "../GoblinShopStore";
import StrategyArtifactCard from "../cards/StrategyArtifactCard";
import StrategyGalaxyCard from "../galaxy/StrategyGalaxyCard";
import type { GalaxyCardData, CardGalaxy3DProps } from "../galaxy/CardGalaxy3D";
import { Search } from "lucide-react";
import { useMemo, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { RARITY_CONFIG } from "@/lib/shop-utils";

const CardGalaxy3D = dynamic(() => import("../galaxy/CardGalaxy3D"), { ssr: false });

interface ForgeOfStrategiesProps {
  strategies: StrategyArtifact[];
}

type StrategyGalaxyData = StrategyArtifact & GalaxyCardData;

const RARITY_GLOW: Record<string, string> = {
  common: "#6b7280",
  uncommon: "#22c55e",
  rare: "#3b82f6",
  epic: "#a855f7",
  legendary: "#f59e0b",
};

export default function ForgeOfStrategies({ strategies }: ForgeOfStrategiesProps) {
  const {
    rarityFilter,
    setRarityFilter,
    searchQuery,
    setSearchQuery,
    selectStrategy,
    setPurchase,
    ownedStrategies,
  } = useGoblinShopStore();

  const [viewMode, setViewMode] = useState<"galaxy" | "grid">("galaxy");
  const [galaxySelectedId, setGalaxySelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = strategies;
    if (rarityFilter) {
      result = result.filter((s) => s.rarity === rarityFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q)
      );
    }
    return result;
  }, [strategies, rarityFilter, searchQuery]);

  // Prepare galaxy card data
  const galaxyCards: StrategyGalaxyData[] = useMemo(
    () =>
      filtered.map((s) => ({
        ...s,
        glowColor: RARITY_GLOW[s.rarity] || "#6b7280",
      })),
    [filtered]
  );

  const renderGalaxyCard = useCallback(
    (card: StrategyGalaxyData, opts: { isSelected: boolean; isHovered: boolean }) => (
      <StrategyGalaxyCard
        artifact={card}
        isSelected={opts.isSelected}
        isHovered={opts.isHovered}
        isOwned={ownedStrategies.includes(card.id)}
      />
    ),
    [ownedStrategies]
  );

  const handleGalaxySelect = useCallback(
    (id: string | null) => {
      setGalaxySelectedId(id);
      if (id) selectStrategy(id);
    },
    [selectStrategy]
  );

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-white">The Forge of Strategies</h2>
          <p className="text-sm text-gray-500">Where AI-forged weapons await their wielder</p>
        </div>
        <div className="flex items-center gap-1 bg-gray-800/50 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode("galaxy")}
            className={cn(
              "px-3 py-1 rounded-md text-xs font-medium transition-all",
              viewMode === "galaxy"
                ? "bg-goblin-500/20 text-goblin-400"
                : "text-gray-500 hover:text-gray-300"
            )}
          >
            🌌 Galaxy
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={cn(
              "px-3 py-1 rounded-md text-xs font-medium transition-all",
              viewMode === "grid"
                ? "bg-goblin-500/20 text-goblin-400"
                : "text-gray-500 hover:text-gray-300"
            )}
          >
            📋 Grid
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={rarityFilter || ""}
          onChange={(e) => setRarityFilter(e.target.value || null)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-goblin-500"
        >
          <option value="">All Rarities</option>
          <option value="common">Common</option>
          <option value="uncommon">Uncommon</option>
          <option value="rare">Rare</option>
          <option value="epic">Epic</option>
          <option value="legendary">Legendary</option>
        </select>

        <div className="relative flex-1 min-w-[150px] max-w-[250px]">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500"
          />
          <input
            type="text"
            placeholder="Search strategies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-goblin-500"
          />
        </div>

        {/* Rarity legend for galaxy mode */}
        {viewMode === "galaxy" && (
          <div className="flex items-center gap-2 ml-auto">
            {(["common", "uncommon", "rare", "epic", "legendary"] as const).map((r) => (
              <span
                key={r}
                className="flex items-center gap-1 text-[9px]"
                style={{ color: RARITY_GLOW[r] }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: RARITY_GLOW[r] }}
                />
                {r}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-600">
          <p className="text-4xl mb-2">⚒</p>
          <p className="text-sm">
            No strategies found. Start trading to forge your first artifact!
          </p>
        </div>
      ) : viewMode === "galaxy" ? (
        <CardGalaxy3D
          cards={galaxyCards}
          renderCard={renderGalaxyCard as CardGalaxy3DProps["renderCard"]}
          selectedId={galaxySelectedId}
          onSelectCard={handleGalaxySelect}
          galaxyConfig={{
            nebulaColor: "#22c55e",
            sparkleColor: "#fbbf24",
            arms: Math.max(2, Math.min(5, Math.ceil(filtered.length / 4))),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((artifact, i) => (
            <StrategyArtifactCard
              key={artifact.id}
              artifact={artifact}
              index={i}
              isOwned={ownedStrategies.includes(artifact.id)}
              onSelect={(id) => selectStrategy(id)}
              onPurchase={(a) =>
                setPurchase({
                  type: "strategy",
                  id: a.id,
                  name: a.name,
                  price: a.priceTier,
                })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
