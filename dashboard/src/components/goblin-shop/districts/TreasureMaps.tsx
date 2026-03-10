"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { RARITY_CONFIG } from "@/lib/shop-utils";
import type { TreasureMap, TreasureWaypoint } from "@/types/arena";
import GBLNIcon from "../shared/GBLNIcon";
import RarityBadge from "../shared/RarityBadge";

interface TreasureMapsProps {
  maps: TreasureMap[];
}

export default function TreasureMaps({ maps }: TreasureMapsProps) {
  const [selectedMap, setSelectedMap] = useState<TreasureMap | null>(null);

  return (
    <div className="space-y-4 p-4 animate-fade-in">
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          🗺️ Treasure Maps
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Complete trading challenges along each map to claim legendary rewards.
        </p>
      </div>

      {selectedMap ? (
        <MapDetail map={selectedMap} onBack={() => setSelectedMap(null)} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {maps.map((map) => {
            const config = RARITY_CONFIG[map.rarity];
            const completedWaypoints = map.waypoints.filter((w) => w.isCompleted).length;
            const progress = (completedWaypoints / map.waypoints.length) * 100;
            const daysLeft = Math.max(
              0,
              Math.ceil((new Date(map.expiresAt).getTime() - Date.now()) / 86400000)
            );

            return (
              <button
                key={map.id}
                onClick={() => setSelectedMap(map)}
                className={cn(
                  "relative p-4 rounded-xl border text-left transition-all hover:scale-[1.02]",
                  "bg-gradient-to-br from-gray-900 to-gray-950",
                  config.borderColor,
                  map.isCompleted && "opacity-60"
                )}
                style={{ boxShadow: `0 0 20px ${config.glowColor}` }}
              >
                {/* Map icon & title */}
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">{map.icon}</span>
                  <div>
                    <h3 className={cn("text-sm font-bold", config.color)}>{map.name}</h3>
                    <RarityBadge rarity={map.rarity} />
                  </div>
                </div>

                <p className="text-[10px] text-gray-500 mb-3">{map.description}</p>

                {/* Progress */}
                <div className="mb-2">
                  <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                    <span>
                      {completedWaypoints}/{map.waypoints.length} waypoints
                    </span>
                    <span>{daysLeft}d left</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-goblin-600 to-gold-400 rounded-full transition-all duration-1000"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Waypoint dots */}
                <div className="flex items-center gap-1">
                  {map.waypoints.map((wp, i) => (
                    <div key={wp.id} className="flex items-center">
                      <div
                        className={cn(
                          "w-3 h-3 rounded-full border transition-all",
                          wp.isCompleted
                            ? "bg-goblin-500 border-goblin-400"
                            : i === map.currentWaypoint
                            ? "bg-gold-500/30 border-gold-400 animate-pulse"
                            : "bg-gray-800 border-gray-700"
                        )}
                      />
                      {i < map.waypoints.length - 1 && (
                        <div
                          className={cn(
                            "w-4 h-0.5",
                            wp.isCompleted ? "bg-goblin-500/50" : "bg-gray-800"
                          )}
                        />
                      )}
                    </div>
                  ))}
                </div>

                {/* Reward preview */}
                <div className="mt-3 pt-2 border-t border-gray-800/50 flex items-center justify-between">
                  <span className="text-[10px] text-gray-500">Treasure:</span>
                  <div className="flex items-center gap-1 text-[10px]">
                    <GBLNIcon size={10} />
                    <span className="text-gold-400 font-bold">{map.reward.gbln}</span>
                    <span className="text-gray-600">+</span>
                    <span className="text-purple-400">{map.reward.xp} XP</span>
                  </div>
                </div>

                {map.isCompleted && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-xl">
                    <span className="text-2xl">✅ Completed</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MapDetail({ map, onBack }: { map: TreasureMap; onBack: () => void }) {
  const config = RARITY_CONFIG[map.rarity];

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
      >
        ← Back to Maps
      </button>

      <div className="flex items-center gap-4">
        <span className="text-4xl">{map.icon}</span>
        <div>
          <h3 className={cn("text-xl font-bold", config.color)}>{map.name}</h3>
          <p className="text-xs text-gray-400">{map.description}</p>
          <RarityBadge rarity={map.rarity} className="mt-1" />
        </div>
      </div>

      {/* Journey Path */}
      <div className="relative">
        {map.waypoints.map((wp, i) => (
          <div key={wp.id} className="flex gap-4 mb-1">
            {/* Path line */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 transition-all z-10",
                  wp.isCompleted
                    ? "bg-goblin-500/20 border-goblin-500 text-goblin-400"
                    : i === map.currentWaypoint
                    ? "bg-gold-500/20 border-gold-400 text-gold-400 animate-pulse"
                    : "bg-gray-900 border-gray-700 text-gray-600"
                )}
              >
                {wp.isCompleted ? "✓" : wp.icon}
              </div>
              {i < map.waypoints.length - 1 && (
                <div
                  className={cn(
                    "w-0.5 h-16",
                    wp.isCompleted ? "bg-goblin-500/40" : "bg-gray-800"
                  )}
                />
              )}
            </div>

            {/* Waypoint Card */}
            <div
              className={cn(
                "flex-1 p-3 rounded-lg border mb-4 transition-all",
                wp.isCompleted
                  ? "bg-goblin-500/5 border-goblin-500/20"
                  : i === map.currentWaypoint
                  ? "bg-gray-800/50 border-gold-500/30"
                  : "bg-gray-900/30 border-gray-800/30 opacity-50"
              )}
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white">{wp.name}</h4>
                <div className="flex items-center gap-1 text-[10px]">
                  <GBLNIcon size={9} />
                  <span className="text-gold-400">{wp.reward.gbln}</span>
                  <span className="text-gray-600">|</span>
                  <span className="text-purple-400">{wp.reward.xp} XP</span>
                </div>
              </div>
              <p className="text-[10px] text-gray-500 mt-1">{wp.challenge.description}</p>

              {/* Challenge Progress */}
              <div className="mt-2">
                <div className="flex justify-between text-[10px] mb-0.5">
                  <span className="text-gray-500">
                    {wp.challenge.current} / {wp.challenge.target} {wp.challenge.unit}
                  </span>
                  <span className={wp.isCompleted ? "text-goblin-400" : "text-gray-500"}>
                    {Math.min(100, Math.round((wp.challenge.current / wp.challenge.target) * 100))}%
                  </span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-1000",
                      wp.isCompleted
                        ? "bg-goblin-500"
                        : "bg-gradient-to-r from-gold-600 to-gold-400"
                    )}
                    style={{
                      width: `${Math.min(100, (wp.challenge.current / wp.challenge.target) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Final Treasure */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-purple-500/10 border border-amber-500/30 text-center">
        <div className="text-2xl mb-1">🏴‍☠️</div>
        <h4 className="text-sm font-bold text-amber-400">Final Treasure</h4>
        <div className="flex items-center justify-center gap-3 mt-2">
          <div className="flex items-center gap-1 text-sm">
            <GBLNIcon size={14} />
            <span className="text-gold-400 font-bold">{map.reward.gbln}</span>
          </div>
          <span className="text-gray-600">+</span>
          <span className="text-sm text-purple-400 font-bold">{map.reward.xp} XP</span>
          {map.reward.item && (
            <>
              <span className="text-gray-600">+</span>
              <RarityBadge rarity={map.reward.item.rarity} />
              <span className="text-xs text-white">{map.reward.item.name}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
