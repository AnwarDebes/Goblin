"use client";

import { useGoblinShopStore } from "../GoblinShopStore";
import GBLNIcon from "../shared/GBLNIcon";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface PurchaseModalProps {
  balance: number;
}

export default function PurchaseModal({ balance }: PurchaseModalProps) {
  const { showPurchase, setPurchase, purchaseItem } = useGoblinShopStore();
  const [success, setSuccess] = useState(false);

  if (!showPurchase) return null;

  const canAfford = balance >= showPurchase.price;
  const afterBalance = balance - showPurchase.price;

  const handlePurchase = () => {
    if (!canAfford) return;
    setSuccess(true);
    setTimeout(() => {
      purchaseItem(showPurchase.type, showPurchase.id, showPurchase.price);
      setSuccess(false);
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={() => setPurchase(null)}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className={cn(
          "relative w-full max-w-sm bg-gray-900 rounded-xl border border-gray-700 p-6 transition-all",
          success && "scale-105 border-gold-500/50"
        )}
        style={success ? { boxShadow: "0 0 40px rgba(251,191,36,0.3)" } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-white text-center mb-4">Purchase Confirmation</h2>

        <div className="bg-gray-800/50 rounded-lg p-3 mb-4 text-center">
          <h3 className="text-sm font-bold text-white">{showPurchase.name}</h3>
          <p className="text-xs text-gray-500 capitalize mt-0.5">{showPurchase.type}</p>
        </div>

        <div className="space-y-2 text-sm mb-6">
          <div className="flex justify-between">
            <span className="text-gray-400">Price</span>
            <span className="inline-flex items-center gap-1 text-gold-400 font-bold">
              <GBLNIcon size={14} /> {showPurchase.price.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Your Balance</span>
            <span className="inline-flex items-center gap-1 text-gray-300">
              <GBLNIcon size={14} /> {balance.toLocaleString()}
            </span>
          </div>
          <div className="h-px bg-gray-800" />
          <div className="flex justify-between">
            <span className="text-gray-400">After Purchase</span>
            <span className={cn("inline-flex items-center gap-1 font-bold", canAfford ? "text-gray-300" : "text-red-400")}>
              <GBLNIcon size={14} /> {canAfford ? afterBalance.toLocaleString() : "Insufficient"}
            </span>
          </div>
        </div>

        {!canAfford && (
          <p className="text-xs text-red-400 text-center mb-3">Insufficient GBLN balance</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => setPurchase(null)}
            className="flex-1 py-2 rounded-lg bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handlePurchase}
            disabled={!canAfford || success}
            className={cn(
              "flex-1 py-2 rounded-lg text-sm font-bold transition-all inline-flex items-center justify-center gap-1",
              canAfford && !success
                ? "bg-goblin-500/20 text-goblin-400 border border-goblin-500/30 hover:bg-goblin-500/30"
                : "bg-gray-800 text-gray-600 border border-gray-700 cursor-not-allowed"
            )}
          >
            {success ? "✓ Purchased!" : <><GBLNIcon size={14} /> Purchase</>}
          </button>
        </div>
      </div>
    </div>
  );
}
