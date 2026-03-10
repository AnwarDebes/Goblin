"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  ENCHANTMENTS,
  ENCHANTMENT_SETS,
  getEnchantmentsBySet,
  getEnchantmentById,
  computeSetBonus,
  computePowerLevel,
  SLOT_CONFIG,
  SLOT_UNLOCK_COSTS,
} from "@/lib/enchantment-utils";
import type { Enchantment, EnchantmentSlot, EnchantedStrategy } from "@/types/enchantment";
import type { StrategyArtifact } from "@/types/shop";
import { RARITY_CONFIG } from "@/lib/shop-utils";
import RarityBadge from "../shared/RarityBadge";
import PriceTag from "../shared/PriceTag";
import GBLNIcon from "../shared/GBLNIcon";

interface EnchantmentWorkshopProps {
  strategies: StrategyArtifact[];
  balance: number;
  onSpendGBLN: (amount: number) => void;
}

export default function EnchantmentWorkshop({
  strategies,
  balance,
  onSpendGBLN,
}: EnchantmentWorkshopProps) {
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(
    strategies[0]?.id ?? null
  );
  const [enchantedStrategies, setEnchantedStrategies] = useState<
    Record<string, Partial<Record<EnchantmentSlot, string>>>
  >({});
  const [unlockedSlots, setUnlockedSlots] = useState<Record<string, EnchantmentSlot[]>>({});
  const [ownedEnchantments, setOwnedEnchantments] = useState<string[]>([]);
  const [activeSetFilter, setActiveSetFilter] = useState<string | null>(null);
  const [draggedEnchantment, setDraggedEnchantment] = useState<string | null>(null);
  const [showApplyAnimation, setShowApplyAnimation] = useState<EnchantmentSlot | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<EnchantmentSlot | null>(null);

  const selectedStrategy = strategies.find((s) => s.id === selectedStrategyId);
  const equipped = enchantedStrategies[selectedStrategyId ?? ""] ?? {};
  const strategySlots = unlockedSlots[selectedStrategyId ?? ""] ?? ["primary"];

  const powerLevel = computePowerLevel(equipped);
  const activeSetBonusId = computeSetBonus(equipped);
  const activeSet = activeSetBonusId
    ? ENCHANTMENT_SETS.find((s) => s.id === activeSetBonusId)
    : null;

  const filteredEnchantments = activeSetFilter
    ? getEnchantmentsBySet(activeSetFilter)
    : ENCHANTMENTS;

  const handleBuyEnchantment = useCallback(
    (enchantment: Enchantment) => {
      if (balance < enchantment.cost) return;
      if (ownedEnchantments.includes(enchantment.id)) return;
      setOwnedEnchantments((prev) => [...prev, enchantment.id]);
      onSpendGBLN(enchantment.cost);
    },
    [balance, ownedEnchantments, onSpendGBLN]
  );

  const handleUnlockSlot = useCallback(
    (slot: EnchantmentSlot) => {
      const cost = SLOT_UNLOCK_COSTS[slot];
      if (balance < cost) return;
      if (!selectedStrategyId) return;
      setUnlockedSlots((prev) => ({
        ...prev,
        [selectedStrategyId]: [...(prev[selectedStrategyId] ?? ["primary"]), slot],
      }));
      onSpendGBLN(cost);
    },
    [balance, selectedStrategyId, onSpendGBLN]
  );

  const handleEquip = useCallback(
    (enchantmentId: string, slot: EnchantmentSlot) => {
      if (!selectedStrategyId) return;
      if (!ownedEnchantments.includes(enchantmentId)) return;
      setShowApplyAnimation(slot);
      setTimeout(() => setShowApplyAnimation(null), 1200);
      setEnchantedStrategies((prev) => ({
        ...prev,
        [selectedStrategyId]: {
          ...(prev[selectedStrategyId] ?? {}),
          [slot]: enchantmentId,
        },
      }));
    },
    [selectedStrategyId, ownedEnchantments]
  );

  const handleUnequip = useCallback(
    (slot: EnchantmentSlot) => {
      if (!selectedStrategyId) return;
      setEnchantedStrategies((prev) => {
        const current = { ...(prev[selectedStrategyId] ?? {}) };
        delete current[slot];
        return { ...prev, [selectedStrategyId]: current };
      });
    },
    [selectedStrategyId]
  );

  const handleDrop = useCallback(
    (slot: EnchantmentSlot) => {
      if (!draggedEnchantment) return;
      handleEquip(draggedEnchantment, slot);
      setDraggedEnchantment(null);
      setHoveredSlot(null);
    },
    [draggedEnchantment, handleEquip]
  );

  return (
    <div className="space-y-4 p-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            ✨ Enchantment Workshop
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Socket enchantments into strategies. Collect sets for powerful bonuses.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-400">Power Level:</span>
          <PowerMeter level={powerLevel} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* LEFT: Strategy Selector + Socket Board */}
        <div className="xl:col-span-2 space-y-4">
          {/* Strategy selector */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {strategies.map((s) => {
              const stEquipped = enchantedStrategies[s.id] ?? {};
              const stPower = computePowerLevel(stEquipped);
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedStrategyId(s.id)}
                  className={cn(
                    "flex-shrink-0 px-3 py-2 rounded-lg text-xs font-medium border transition-all",
                    selectedStrategyId === s.id
                      ? "bg-goblin-500/20 border-goblin-500/40 text-goblin-400"
                      : "bg-gray-800/50 border-gray-700/50 text-gray-400 hover:text-white"
                  )}
                >
                  <span className="block text-left">{s.name}</span>
                  {stPower > 0 && (
                    <span className="text-[10px] text-amber-400 mt-0.5 block">
                      ⚡ {stPower}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Socket Board */}
          {selectedStrategy && (
            <div className="relative p-6 rounded-xl bg-gray-900/50 border border-gray-800">
              {/* Strategy name */}
              <div className="text-center mb-6">
                <h3 className="text-white font-bold">{selectedStrategy.name}</h3>
                <RarityBadge rarity={selectedStrategy.rarity} className="mt-1" />
              </div>

              {/* Socket Slots - Diamond layout */}
              <div className="relative flex flex-col items-center gap-4">
                {/* Top: Primary */}
                <div className="flex justify-center">
                  <SocketSlot
                    slot="primary"
                    equipped={equipped.primary ? getEnchantmentById(equipped.primary) : undefined}
                    isUnlocked={strategySlots.includes("primary")}
                    unlockCost={SLOT_UNLOCK_COSTS.primary}
                    onUnlock={() => handleUnlockSlot("primary")}
                    onUnequip={() => handleUnequip("primary")}
                    onDrop={() => handleDrop("primary")}
                    isAnimating={showApplyAnimation === "primary"}
                    isHovered={hoveredSlot === "primary"}
                    onDragOver={() => setHoveredSlot("primary")}
                    onDragLeave={() => setHoveredSlot(null)}
                    balance={balance}
                  />
                </div>

                {/* Middle row: Secondary + Tertiary */}
                <div className="flex gap-8">
                  <SocketSlot
                    slot="secondary"
                    equipped={equipped.secondary ? getEnchantmentById(equipped.secondary) : undefined}
                    isUnlocked={strategySlots.includes("secondary")}
                    unlockCost={SLOT_UNLOCK_COSTS.secondary}
                    onUnlock={() => handleUnlockSlot("secondary")}
                    onUnequip={() => handleUnequip("secondary")}
                    onDrop={() => handleDrop("secondary")}
                    isAnimating={showApplyAnimation === "secondary"}
                    isHovered={hoveredSlot === "secondary"}
                    onDragOver={() => setHoveredSlot("secondary")}
                    onDragLeave={() => setHoveredSlot(null)}
                    balance={balance}
                  />
                  <SocketSlot
                    slot="tertiary"
                    equipped={equipped.tertiary ? getEnchantmentById(equipped.tertiary) : undefined}
                    isUnlocked={strategySlots.includes("tertiary")}
                    unlockCost={SLOT_UNLOCK_COSTS.tertiary}
                    onUnlock={() => handleUnlockSlot("tertiary")}
                    onUnequip={() => handleUnequip("tertiary")}
                    onDrop={() => handleDrop("tertiary")}
                    isAnimating={showApplyAnimation === "tertiary"}
                    isHovered={hoveredSlot === "tertiary"}
                    onDragOver={() => setHoveredSlot("tertiary")}
                    onDragLeave={() => setHoveredSlot(null)}
                    balance={balance}
                  />
                </div>

                {/* Bottom: Mythic */}
                <div className="flex justify-center">
                  <SocketSlot
                    slot="mythic"
                    equipped={equipped.mythic ? getEnchantmentById(equipped.mythic) : undefined}
                    isUnlocked={strategySlots.includes("mythic")}
                    unlockCost={SLOT_UNLOCK_COSTS.mythic}
                    onUnlock={() => handleUnlockSlot("mythic")}
                    onUnequip={() => handleUnequip("mythic")}
                    onDrop={() => handleDrop("mythic")}
                    isAnimating={showApplyAnimation === "mythic"}
                    isHovered={hoveredSlot === "mythic"}
                    onDragOver={() => setHoveredSlot("mythic")}
                    onDragLeave={() => setHoveredSlot(null)}
                    balance={balance}
                  />
                </div>

                {/* Connecting lines */}
                <svg className="absolute inset-0 pointer-events-none" viewBox="0 0 400 300">
                  <line x1="200" y1="60" x2="140" y2="140" stroke="rgba(34,197,94,0.15)" strokeWidth="1" />
                  <line x1="200" y1="60" x2="260" y2="140" stroke="rgba(34,197,94,0.15)" strokeWidth="1" />
                  <line x1="140" y1="140" x2="200" y2="220" stroke="rgba(34,197,94,0.15)" strokeWidth="1" />
                  <line x1="260" y1="140" x2="200" y2="220" stroke="rgba(34,197,94,0.15)" strokeWidth="1" />
                </svg>
              </div>

              {/* Active Set Bonus */}
              {activeSet && (
                <div className="mt-6 p-3 rounded-lg bg-gradient-to-r from-amber-500/10 to-purple-500/10 border border-amber-500/30 animate-pulse">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-lg">{activeSet.icon}</span>
                    <span className={cn("font-bold", activeSet.color)}>
                      {activeSet.name} Set Bonus Active!
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{activeSet.bonusDescription}</p>
                </div>
              )}

              {/* Strategy Modifiers Summary */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                {(Object.entries(equipped) as [EnchantmentSlot, string][]).map(
                  ([slot, enchId]) => {
                    const ench = getEnchantmentById(enchId);
                    if (!ench) return null;
                    return (
                      <div key={slot} className="flex items-center gap-2 text-xs p-2 rounded bg-gray-800/50">
                        <span>{ench.icon}</span>
                        <span className="text-gray-400">{ench.modifier.type.replace(/_/g, " ")}:</span>
                        <span className={ench.modifier.direction === "increase" || ench.modifier.direction === "wider" ? "text-green-400" : "text-blue-400"}>
                          {ench.modifier.direction === "increase" || ench.modifier.direction === "wider" ? "+" : "-"}
                          {ench.modifier.value}
                          {ench.modifier.unit === "percent" ? "%" : ench.modifier.unit === "multiplier" ? "x" : ""}
                        </span>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          )}

          {/* Set Collection Progress */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ENCHANTMENT_SETS.map((set) => {
              const setEnchantments = getEnchantmentsBySet(set.id);
              const ownedCount = setEnchantments.filter((e) =>
                ownedEnchantments.includes(e.id)
              ).length;
              const isComplete = ownedCount >= set.requiredPieces;
              return (
                <button
                  key={set.id}
                  onClick={() =>
                    setActiveSetFilter(activeSetFilter === set.id ? null : set.id)
                  }
                  className={cn(
                    "p-3 rounded-lg border text-left transition-all",
                    activeSetFilter === set.id
                      ? "bg-gray-800/80 border-goblin-500/40"
                      : "bg-gray-800/30 border-gray-800/50 hover:border-gray-700",
                    isComplete && "ring-1 ring-amber-500/30"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{set.icon}</span>
                    <div className="flex-1">
                      <div className={cn("text-sm font-bold", set.color)}>
                        {set.name}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {set.description}
                      </div>
                    </div>
                    <div className="text-xs font-mono">
                      <span className={ownedCount >= set.requiredPieces ? "text-amber-400" : "text-gray-500"}>
                        {ownedCount}/{set.requiredPieces}
                      </span>
                    </div>
                  </div>
                  {/* Collection dots */}
                  <div className="flex gap-1 mt-2">
                    {setEnchantments.map((e) => (
                      <div
                        key={e.id}
                        className={cn(
                          "w-2 h-2 rounded-full transition-all",
                          ownedEnchantments.includes(e.id)
                            ? "bg-goblin-400"
                            : "bg-gray-700"
                        )}
                        title={e.name}
                      />
                    ))}
                  </div>
                  {isComplete && (
                    <div className="text-[10px] text-amber-400 mt-1.5 font-medium">
                      ✨ {set.bonusDescription}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT: Enchantment Catalog */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-white">Enchantment Catalog</h3>
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1 scrollbar-hide">
            {filteredEnchantments.map((ench) => {
              const isOwned = ownedEnchantments.includes(ench.id);
              const config = RARITY_CONFIG[ench.rarity];
              const slotConfig = SLOT_CONFIG[ench.slot];
              const isEquippedAnywhere = Object.values(equipped).includes(ench.id);
              return (
                <div
                  key={ench.id}
                  draggable={isOwned && !isEquippedAnywhere}
                  onDragStart={() => setDraggedEnchantment(ench.id)}
                  onDragEnd={() => {
                    setDraggedEnchantment(null);
                    setHoveredSlot(null);
                  }}
                  className={cn(
                    "p-3 rounded-lg border transition-all",
                    isOwned
                      ? "bg-gray-800/60 border-gray-700/50 cursor-grab active:cursor-grabbing"
                      : "bg-gray-900/50 border-gray-800/30",
                    isEquippedAnywhere && "ring-1 ring-goblin-500/30 opacity-60",
                    draggedEnchantment === ench.id && "opacity-50 scale-95"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xl flex-shrink-0">{ench.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("text-xs font-bold", config.color)}>
                          {ench.name}
                        </span>
                        <span className={cn("text-[9px] px-1 rounded", slotConfig.color, "bg-gray-800")}>
                          {slotConfig.label}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">
                        {ench.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <RarityBadge rarity={ench.rarity} />
                        <span className="text-[10px] text-gray-600">
                          {ench.modifier.direction === "increase" || ench.modifier.direction === "wider" ? "+" : "-"}
                          {ench.modifier.value}
                          {ench.modifier.unit === "percent" ? "%" : ""} {ench.modifier.type.replace(/_/g, " ")}
                        </span>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {isOwned ? (
                        <span className="text-[10px] text-goblin-400 font-medium px-2 py-1 rounded bg-goblin-500/10">
                          Owned
                        </span>
                      ) : (
                        <button
                          onClick={() => handleBuyEnchantment(ench)}
                          disabled={balance < ench.cost}
                          className={cn(
                            "flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded transition-all",
                            balance >= ench.cost
                              ? "bg-goblin-500/20 text-goblin-400 hover:bg-goblin-500/30"
                              : "bg-gray-800 text-gray-600 cursor-not-allowed"
                          )}
                        >
                          <GBLNIcon size={10} />
                          {ench.cost}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Socket Slot Component ──────────────────────────────────────── */

function SocketSlot({
  slot,
  equipped,
  isUnlocked,
  unlockCost,
  onUnlock,
  onUnequip,
  onDrop,
  isAnimating,
  isHovered,
  onDragOver,
  onDragLeave,
  balance,
}: {
  slot: EnchantmentSlot;
  equipped?: Enchantment;
  isUnlocked: boolean;
  unlockCost: number;
  onUnlock: () => void;
  onUnequip: () => void;
  onDrop: () => void;
  isAnimating: boolean;
  isHovered: boolean;
  onDragOver: () => void;
  onDragLeave: () => void;
  balance: number;
}) {
  const config = SLOT_CONFIG[slot];

  if (!isUnlocked) {
    return (
      <button
        onClick={onUnlock}
        disabled={balance < unlockCost}
        className={cn(
          "w-20 h-20 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-all",
          balance >= unlockCost
            ? "border-gray-600 hover:border-gray-500 text-gray-500 hover:text-gray-400 cursor-pointer"
            : "border-gray-800 text-gray-700 cursor-not-allowed"
        )}
      >
        <span className="text-xs">🔒</span>
        <span className="text-[9px]">{config.label}</span>
        {unlockCost > 0 && (
          <span className="text-[8px] flex items-center gap-0.5">
            <GBLNIcon size={8} /> {unlockCost}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver();
      }}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      className={cn(
        "relative w-20 h-20 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all",
        equipped
          ? cn("border-solid", RARITY_CONFIG[equipped.rarity].borderColor, "bg-gray-800/50")
          : "border-dashed border-gray-600 bg-gray-800/20",
        isHovered && "border-goblin-400 bg-goblin-500/10 scale-105",
        isAnimating && "animate-bounce ring-2 ring-amber-400/50"
      )}
    >
      {equipped ? (
        <>
          <span className="text-xl">{equipped.icon}</span>
          <span className={cn("text-[8px] font-medium", RARITY_CONFIG[equipped.rarity].color)}>
            {equipped.name.split(" ")[0]}
          </span>
          <button
            onClick={onUnequip}
            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500/80 text-white text-[8px] flex items-center justify-center hover:bg-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Remove"
          >
            ×
          </button>
        </>
      ) : (
        <>
          <span className="text-sm">{config.icon}</span>
          <span className="text-[9px] text-gray-500">{config.label}</span>
        </>
      )}
    </div>
  );
}

/* ── Power Meter ────────────────────────────────────────────────── */

function PowerMeter({ level }: { level: number }) {
  const maxPower = 500;
  const pct = Math.min(100, (level / maxPower) * 100);
  const color =
    pct > 80 ? "from-amber-500 to-red-500" :
    pct > 50 ? "from-purple-500 to-amber-500" :
    pct > 20 ? "from-blue-500 to-purple-500" :
    "from-gray-500 to-blue-500";

  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-3 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-1000", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn(
        "text-xs font-bold font-mono",
        pct > 80 ? "text-amber-400" : pct > 50 ? "text-purple-400" : "text-blue-400"
      )}>
        ⚡{level}
      </span>
    </div>
  );
}
