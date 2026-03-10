"use client";

import dynamic from "next/dynamic";
import type { SignalPack } from "@/types/shop";
import { useGoblinShopStore } from "../GoblinShopStore";
import SignalScrollCard from "../cards/SignalScrollCard";
import SignalGalaxyCard from "../galaxy/SignalGalaxyCard";
import type { GalaxyCardData, CardGalaxy3DProps } from "../galaxy/CardGalaxy3D";
import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";

const CardGalaxy3D = dynamic(() => import("../galaxy/CardGalaxy3D"), { ssr: false });

interface OracleEmporiumProps {
  signalPacks: SignalPack[];
}

type SignalGalaxyData = SignalPack & GalaxyCardData;

const RARITY_GLOW: Record<string, string> = {
  common: "#6b7280",
  uncommon: "#22c55e",
  rare: "#3b82f6",
  epic: "#a855f7",
  legendary: "#f59e0b",
};

export default function OracleEmporium({ signalPacks }: OracleEmporiumProps) {
  const { setPurchase, subscribedSignals } = useGoblinShopStore();
  const [channelFilter, setChannelFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"galaxy" | "grid">("galaxy");
  const [galaxySelectedId, setGalaxySelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!channelFilter) return signalPacks;
    return signalPacks.filter((p) => p.channelType === channelFilter);
  }, [signalPacks, channelFilter]);

  const galaxyCards: SignalGalaxyData[] = useMemo(
    () =>
      filtered.map((p) => ({
        ...p,
        glowColor: RARITY_GLOW[p.rarity] || "#6b7280",
      })),
    [filtered]
  );

  const renderGalaxyCard = useCallback(
    (card: SignalGalaxyData, opts: { isSelected: boolean; isHovered: boolean }) => (
      <SignalGalaxyCard
        pack={card}
        isSelected={opts.isSelected}
        isHovered={opts.isHovered}
        isSubscribed={subscribedSignals.includes(card.id)}
      />
    ),
    [subscribedSignals]
  );

  const handleGalaxySelect = useCallback(
    (id: string | null) => {
      setGalaxySelectedId(id);
    },
    []
  );

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-white">The Oracle&apos;s Emporium</h2>
          <p className="text-sm text-gray-500">Whispers from the all-seeing AI</p>
        </div>
        <div className="flex items-center gap-1 bg-gray-800/50 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode("galaxy")}
            className={cn(
              "px-3 py-1 rounded-md text-xs font-medium transition-all",
              viewMode === "galaxy"
                ? "bg-purple-500/20 text-purple-400"
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
                ? "bg-purple-500/20 text-purple-400"
                : "text-gray-500 hover:text-gray-300"
            )}
          >
            📋 Grid
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
        {[null, "sniper", "swing", "scalp", "whale"].map((type) => (
          <button
            key={type ?? "all"}
            onClick={() => setChannelFilter(type)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
              channelFilter === type
                ? "bg-goblin-500/20 text-goblin-400 border border-goblin-500/30"
                : "bg-gray-800 text-gray-400 border border-gray-700 hover:text-gray-300"
            )}
          >
            {type === null
              ? "All"
              : type === "sniper"
              ? "🎯 Sniper"
              : type === "swing"
              ? "🌊 Swing"
              : type === "scalp"
              ? "⚡ Scalp"
              : "🐋 Whale"}
          </button>
        ))}
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-600">
          <p className="text-4xl mb-2">🔮</p>
          <p className="text-sm">
            No signal channels available yet. Signals will appear as the AI
            generates them.
          </p>
        </div>
      ) : viewMode === "galaxy" ? (
        <CardGalaxy3D
          cards={galaxyCards}
          renderCard={renderGalaxyCard as CardGalaxy3DProps["renderCard"]}
          selectedId={galaxySelectedId}
          onSelectCard={handleGalaxySelect}
          galaxyConfig={{
            nebulaColor: "#a855f7",
            sparkleColor: "#c084fc",
            arms: 2,
            spread: 10,
            autoRotateSpeed: 0.2,
          }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((pack, i) => (
            <SignalScrollCard
              key={pack.id}
              pack={pack}
              index={i}
              isSubscribed={subscribedSignals.includes(pack.id)}
              onSubscribe={(p) =>
                setPurchase({
                  type: "signal",
                  id: p.id,
                  name: p.name,
                  price: p.subscriptionCost,
                })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
