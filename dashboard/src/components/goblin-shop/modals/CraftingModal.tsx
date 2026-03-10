"use client";

import { useGoblinShopStore } from "../GoblinShopStore";
import AlchemistWorkshop from "../districts/AlchemistWorkshop";

export default function CraftingModal() {
  const { showCrafting, toggleCrafting } = useGoblinShopStore();

  if (!showCrafting) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={toggleCrafting}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-gray-900 rounded-xl border border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-lg font-bold text-white">⚗ Alchemist&apos;s Workshop</h2>
          <button onClick={toggleCrafting} className="text-gray-500 hover:text-white text-xl">×</button>
        </div>
        <AlchemistWorkshop />
      </div>
    </div>
  );
}
