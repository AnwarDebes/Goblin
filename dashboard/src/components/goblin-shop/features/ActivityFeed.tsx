"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { generateActivityFeed } from "@/lib/arena-utils";
import { RARITY_CONFIG } from "@/lib/shop-utils";
import type { ActivityFeedItem } from "@/types/arena";

export default function ActivityFeed() {
  const [items, setItems] = useState<ActivityFeedItem[]>(() => generateActivityFeed(20));
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  // Simulate new activity items appearing
  useEffect(() => {
    const interval = setInterval(() => {
      if (isPaused) return;
      const [newItem] = generateActivityFeed(1);
      if (newItem) {
        setItems((prev) => [{ ...newItem, id: `live-${Date.now()}` }, ...prev].slice(0, 30));
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [isPaused]);

  return (
    <div
      className="bg-gray-900/50 border-t border-gray-800/50 py-1.5"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-3 overflow-hidden">
          <span className="text-[10px] text-gray-600 whitespace-nowrap flex-shrink-0 font-medium">
            🔴 LIVE
          </span>
          <div
            ref={scrollRef}
            className="flex-1 overflow-hidden"
          >
            <div
              className={cn(
                "flex gap-4 whitespace-nowrap",
                !isPaused && "animate-marquee"
              )}
            >
              {items.map((item) => {
                const rarityConfig = item.rarity ? RARITY_CONFIG[item.rarity] : null;
                return (
                  <span
                    key={item.id}
                    className="inline-flex items-center gap-1.5 text-[11px] flex-shrink-0"
                  >
                    <span>{item.icon}</span>
                    <span className="text-gray-400 font-medium">{item.playerName}</span>
                    <span className={cn("text-gray-500", rarityConfig && rarityConfig.color)}>
                      {item.message}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
