"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { generateSkins } from "@/lib/arena-utils";
import { RARITY_CONFIG } from "@/lib/shop-utils";
import type { DashboardSkin } from "@/types/arena";
import GBLNIcon from "../shared/GBLNIcon";
import RarityBadge from "../shared/RarityBadge";

const SkinShowcase3D = dynamic(() => import("../galaxy/SkinShowcase3D"), { ssr: false });

interface SkinWorkshopProps {
  balance: number;
  onSpendGBLN: (amount: number) => void;
}

export default function SkinWorkshop({ balance, onSpendGBLN }: SkinWorkshopProps) {
  const [skins, setSkins] = useState(() => generateSkins());
  const [category, setCategory] = useState<"all" | DashboardSkin["category"]>("all");
  const [previewSkin, setPreviewSkin] = useState<DashboardSkin | null>(null);
  const [viewMode, setViewMode] = useState<"showcase" | "grid">("showcase");

  const categories: Array<{ id: typeof category; label: string; icon: string }> = [
    { id: "all", label: "All", icon: "🎨" },
    { id: "theme", label: "Themes", icon: "🖥️" },
    { id: "chart", label: "Charts", icon: "📊" },
    { id: "cursor", label: "Cursors", icon: "🖱️" },
    { id: "sound", label: "Sounds", icon: "🔊" },
    { id: "frame", label: "Frames", icon: "🖼️" },
  ];

  const filteredSkins =
    category === "all" ? skins : skins.filter((s) => s.category === category);

  const handlePurchase = (skin: DashboardSkin) => {
    if (balance < skin.cost || skin.isOwned) return;
    onSpendGBLN(skin.cost);
    setSkins((prev) =>
      prev.map((s) => (s.id === skin.id ? { ...s, isOwned: true } : s))
    );
  };

  const handleEquip = (skin: DashboardSkin) => {
    setSkins((prev) =>
      prev.map((s) =>
        s.category === skin.category
          ? { ...s, isEquipped: s.id === skin.id }
          : s
      )
    );
  };

  return (
    <div className="space-y-4 p-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            🎨 Skin Workshop
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Customize your dashboard with themes, charts, cursors, sounds, and profile frames.
          </p>
        </div>
        <div className="flex items-center gap-1 bg-gray-800/50 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode("showcase")}
            className={cn(
              "px-3 py-1 rounded-md text-xs font-medium transition-all",
              viewMode === "showcase"
                ? "bg-purple-500/20 text-purple-400"
                : "text-gray-500 hover:text-gray-300"
            )}
          >
            🌌 3D Showcase
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

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className={cn(
              "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium transition-all whitespace-nowrap",
              category === cat.id
                ? "bg-goblin-500/20 text-goblin-400 border border-goblin-500/30"
                : "text-gray-500 hover:text-gray-300 border border-transparent"
            )}
          >
            <span>{cat.icon}</span> {cat.label}
          </button>
        ))}
      </div>

      {/* 3D Showcase */}
      {viewMode === "showcase" ? (
        <>
          <SkinShowcase3D
            skins={filteredSkins}
            selectedSkin={previewSkin}
            onSelectSkin={setPreviewSkin}
          />

          {/* Selected skin action bar */}
          {previewSkin && (
            <div className="p-4 rounded-xl border bg-gray-900/80 backdrop-blur"
              style={{ borderColor: RARITY_CONFIG[previewSkin.rarity].glowColor }}
            >
              <div className="flex items-center gap-4 flex-wrap">
                <div
                  className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `radial-gradient(circle, ${RARITY_CONFIG[previewSkin.rarity].glowColor}, transparent)` }}
                >
                  <span className="text-4xl">{previewSkin.preview}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className={cn("text-base font-bold", RARITY_CONFIG[previewSkin.rarity].color)}>{previewSkin.name}</h3>
                  <p className="text-xs text-gray-400">{previewSkin.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <RarityBadge rarity={previewSkin.rarity} />
                    <span className="text-[10px] text-gray-500 capitalize">{previewSkin.category}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {previewSkin.isOwned ? (
                    <button
                      onClick={() => handleEquip(previewSkin)}
                      className={cn(
                        "px-4 py-2 rounded-lg text-xs font-bold transition-all",
                        previewSkin.isEquipped
                          ? "bg-gray-800 text-gray-500"
                          : "bg-goblin-500/20 text-goblin-400 hover:bg-goblin-500/30"
                      )}
                    >
                      {previewSkin.isEquipped ? "Currently Active" : "Equip Skin"}
                    </button>
                  ) : (
                    <button
                      onClick={() => handlePurchase(previewSkin)}
                      disabled={balance < previewSkin.cost}
                      className={cn(
                        "flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all",
                        balance >= previewSkin.cost
                          ? "bg-goblin-500/20 text-goblin-400 hover:bg-goblin-500/30"
                          : "bg-gray-800 text-gray-600 cursor-not-allowed"
                      )}
                    >
                      <GBLNIcon size={12} /> Purchase for {previewSkin.cost} GBLN
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Grid View */
        <>
          {previewSkin && (
            <SkinPreview
              skin={previewSkin}
              balance={balance}
              onPurchase={handlePurchase}
              onEquip={handleEquip}
              onClose={() => setPreviewSkin(null)}
            />
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredSkins.map((skin) => {
              const config = RARITY_CONFIG[skin.rarity];
              return (
                <button
                  key={skin.id}
                  onClick={() => setPreviewSkin(skin)}
                  className={cn(
                    "relative p-3 rounded-xl border text-left transition-all hover:scale-[1.03]",
                    skin.isEquipped
                      ? "bg-goblin-500/10 border-goblin-500/30 ring-1 ring-goblin-500/20"
                      : skin.isOwned
                      ? "bg-gray-800/40 border-gray-700/50"
                      : "bg-gray-900/50 border-gray-800/30 hover:border-gray-700"
                  )}
                >
                  <div
                    className="w-full aspect-square rounded-lg flex items-center justify-center mb-2"
                    style={{ background: `radial-gradient(circle, ${config.glowColor}, transparent)` }}
                  >
                    <span className="text-4xl">{skin.preview}</span>
                  </div>
                  <h4 className="text-xs font-bold text-white truncate">{skin.name}</h4>
                  <div className="flex items-center justify-between mt-1">
                    <RarityBadge rarity={skin.rarity} />
                    {skin.isEquipped ? (
                      <span className="text-[9px] text-goblin-400 font-medium">Active</span>
                    ) : skin.isOwned ? (
                      <span className="text-[9px] text-gray-500">Owned</span>
                    ) : (
                      <span className="flex items-center gap-0.5 text-[10px] text-gold-400">
                        <GBLNIcon size={9} /> {skin.cost}
                      </span>
                    )}
                  </div>
                  {skin.isEquipped && (
                    <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-goblin-500 animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function SkinPreview({
  skin,
  balance,
  onPurchase,
  onEquip,
  onClose,
}: {
  skin: DashboardSkin;
  balance: number;
  onPurchase: (s: DashboardSkin) => void;
  onEquip: (s: DashboardSkin) => void;
  onClose: () => void;
}) {
  const config = RARITY_CONFIG[skin.rarity];
  return (
    <div className="p-4 rounded-xl border bg-gray-900/80 backdrop-blur" style={{ borderColor: config.glowColor }}>
      <div className="flex items-start gap-4">
        <div
          className="w-24 h-24 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `radial-gradient(circle, ${config.glowColor}, transparent)` }}
        >
          <span className="text-5xl">{skin.preview}</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className={cn("text-lg font-bold", config.color)}>{skin.name}</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-300">✕</button>
          </div>
          <p className="text-xs text-gray-400 mt-1">{skin.description}</p>
          <div className="flex items-center gap-2 mt-2">
            <RarityBadge rarity={skin.rarity} />
            <span className="text-[10px] text-gray-500 capitalize">{skin.category}</span>
          </div>
          <div className="flex items-center gap-2 mt-3">
            {skin.isOwned ? (
              <button
                onClick={() => { onEquip(skin); onClose(); }}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                  skin.isEquipped
                    ? "bg-gray-800 text-gray-500 cursor-default"
                    : "bg-goblin-500/20 text-goblin-400 hover:bg-goblin-500/30"
                )}
              >
                {skin.isEquipped ? "Currently Active" : "Equip Skin"}
              </button>
            ) : (
              <button
                onClick={() => { onPurchase(skin); onClose(); }}
                disabled={balance < skin.cost}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                  balance >= skin.cost
                    ? "bg-goblin-500/20 text-goblin-400 hover:bg-goblin-500/30"
                    : "bg-gray-800 text-gray-600 cursor-not-allowed"
                )}
              >
                <GBLNIcon size={12} /> Purchase for {skin.cost} GBLN
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
