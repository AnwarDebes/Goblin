"use client";

import { useGoblinShopStore } from "../GoblinShopStore";
import GBLNIcon from "../shared/GBLNIcon";
import { cn } from "@/lib/utils";
import { useState } from "react";

const POOLS: Record<string, { name: string; apy: number; lockPeriod: string }> = {
  bronze: { name: "Bronze Pool", apy: 5.2, lockPeriod: "Flexible" },
  silver: { name: "Silver Pool", apy: 12, lockPeriod: "30 days" },
  gold: { name: "Gold Pool", apy: 25, lockPeriod: "90 days" },
  diamond: { name: "Diamond Pool", apy: 50, lockPeriod: "365 days" },
};

interface StakingModalProps {
  balance: number;
}

export default function StakingModal({ balance }: StakingModalProps) {
  const { showStaking, toggleStaking, stakingPoolId } = useGoblinShopStore();
  const [amount, setAmount] = useState(0);

  if (!showStaking || !stakingPoolId) return null;

  const pool = POOLS[stakingPoolId];
  if (!pool) return null;

  const projected30 = (amount * pool.apy) / 100 / 12;
  const projected90 = (amount * pool.apy) / 100 / 4;
  const projected365 = (amount * pool.apy) / 100;

  const quickSet = (pct: number) => setAmount(Math.floor(balance * pct));

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={toggleStaking}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm bg-gray-900 rounded-xl border border-gray-700 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-white mb-1">Stake in {pool.name}</h2>
        <p className="text-xs text-gray-500 mb-4">Lock Period: {pool.lockPeriod} | APY: {pool.apy}%</p>

        {/* Amount input */}
        <div className="mb-3">
          <label className="text-xs text-gray-400 mb-1 block">Amount (GBLN)</label>
          <div className="relative">
            <GBLNIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="number"
              min={0}
              max={balance}
              value={amount || ""}
              onChange={(e) => setAmount(Math.min(balance, Number(e.target.value) || 0))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-3 py-2 text-sm text-white focus:outline-none focus:border-goblin-500"
              placeholder="0"
            />
          </div>
        </div>

        {/* Quick set buttons */}
        <div className="flex gap-2 mb-4">
          {[0.25, 0.5, 0.75, 1].map((pct) => (
            <button
              key={pct}
              onClick={() => quickSet(pct)}
              className="flex-1 py-1 rounded-lg text-xs font-medium bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700 hover:text-gray-300 transition-colors"
            >
              {pct === 1 ? "Max" : `${pct * 100}%`}
            </button>
          ))}
        </div>

        {/* Projected earnings */}
        {amount > 0 && (
          <div className="bg-gray-800/50 rounded-lg p-3 mb-4 space-y-1.5 text-xs">
            <div className="text-gray-400 font-medium mb-1">Projected Earnings</div>
            <div className="flex justify-between">
              <span className="text-gray-500">30 days</span>
              <span className="text-goblin-400 font-medium">+{projected30.toFixed(1)} GBLN</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">90 days</span>
              <span className="text-goblin-400 font-medium">+{projected90.toFixed(1)} GBLN</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">1 year</span>
              <span className="text-gold-400 font-bold">+{projected365.toFixed(1)} GBLN</span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={toggleStaking}
            className="flex-1 py-2 rounded-lg bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={amount <= 0 || amount > balance}
            className={cn(
              "flex-1 py-2 rounded-lg text-sm font-bold transition-all",
              amount > 0 && amount <= balance
                ? "bg-goblin-500/20 text-goblin-400 border border-goblin-500/30 hover:bg-goblin-500/30"
                : "bg-gray-800 text-gray-600 border border-gray-700 cursor-not-allowed"
            )}
          >
            Stake 🔒
          </button>
        </div>
      </div>
    </div>
  );
}
