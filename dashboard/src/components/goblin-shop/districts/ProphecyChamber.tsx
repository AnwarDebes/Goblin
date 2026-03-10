"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { generateProphecies } from "@/lib/arena-utils";
import type { Prophecy } from "@/types/arena";
import GBLNIcon from "../shared/GBLNIcon";

interface ProphecyChamberProps {
  balance: number;
  onSpendGBLN: (amount: number) => void;
}

export default function ProphecyChamber({ balance, onSpendGBLN }: ProphecyChamberProps) {
  const [prophecies, setProphecies] = useState(() => generateProphecies());
  const [filter, setFilter] = useState<"all" | "price" | "volume" | "dominance" | "event">("all");
  const [betAmount, setBetAmount] = useState(50);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const filteredProphecies =
    filter === "all" ? prophecies : prophecies.filter((p) => p.category === filter);

  const handleBet = (prophecyId: string, side: "yes" | "no") => {
    if (balance < betAmount) return;
    onSpendGBLN(betAmount);
    setProphecies((prev) =>
      prev.map((p) =>
        p.id === prophecyId
          ? {
              ...p,
              userBet: { side, amount: betAmount },
              totalPool: p.totalPool + betAmount,
              yesPool: side === "yes" ? p.yesPool + betAmount : p.yesPool,
              noPool: side === "no" ? p.noPool + betAmount : p.noPool,
            }
          : p
      )
    );
  };

  return (
    <div className="space-y-4 p-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            📜 Prophecy Chamber
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Predict market movements. Bet GBLN on outcomes. Earn prophet reputation.
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="text-xs px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 font-medium transition-all"
        >
          + Create Prophecy
        </button>
      </div>

      {/* Create form */}
      {showCreateForm && <CreateProphecyForm onClose={() => setShowCreateForm(false)} />}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["all", "price", "volume", "dominance", "event"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "text-xs px-3 py-1 rounded-full font-medium transition-all capitalize",
              filter === f
                ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                : "text-gray-500 hover:text-gray-300 border border-transparent"
            )}
          >
            {f === "all" ? "🔮 All" : f === "price" ? "💰 Price" : f === "volume" ? "📊 Volume" : f === "dominance" ? "👑 Dominance" : "📅 Events"}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] text-gray-500">Bet:</span>
          {[25, 50, 100, 250].map((amount) => (
            <button
              key={amount}
              onClick={() => setBetAmount(amount)}
              className={cn(
                "text-[10px] px-2 py-0.5 rounded font-medium transition-all",
                betAmount === amount
                  ? "bg-purple-500/20 text-purple-400"
                  : "text-gray-600 hover:text-gray-400"
              )}
            >
              {amount}
            </button>
          ))}
        </div>
      </div>

      {/* Prophecy Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredProphecies.map((prophecy) => (
          <ProphecyCard
            key={prophecy.id}
            prophecy={prophecy}
            betAmount={betAmount}
            balance={balance}
            onBet={handleBet}
          />
        ))}
      </div>
    </div>
  );
}

function ProphecyCard({
  prophecy,
  betAmount,
  balance,
  onBet,
}: {
  prophecy: Prophecy;
  betAmount: number;
  balance: number;
  onBet: (id: string, side: "yes" | "no") => void;
}) {
  const yesPercent =
    prophecy.totalPool > 0
      ? Math.round((prophecy.yesPool / prophecy.totalPool) * 100)
      : 50;
  const noPercent = 100 - yesPercent;
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(prophecy.deadline).getTime() - Date.now()) / 86400000)
  );

  const yesPayout = prophecy.yesPool > 0 ? +(prophecy.totalPool / prophecy.yesPool).toFixed(2) : 0;
  const noPayout = prophecy.noPool > 0 ? +(prophecy.totalPool / prophecy.noPool).toFixed(2) : 0;

  const hasBet = !!prophecy.userBet;

  return (
    <div
      className={cn(
        "p-4 rounded-xl border transition-all",
        hasBet
          ? "bg-purple-500/5 border-purple-500/30"
          : "bg-gray-800/30 border-gray-800/50 hover:border-gray-700"
      )}
    >
      <div className="flex items-start gap-2 mb-3">
        <span className="text-xl mt-0.5">🔮</span>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-white leading-tight">
            {prophecy.question}
          </h3>
          <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-500">
            <span>by {prophecy.author}</span>
            <span>•</span>
            <span>{daysLeft}d left</span>
            <span>•</span>
            <span className="flex items-center gap-0.5">
              <GBLNIcon size={9} /> {prophecy.totalPool.toLocaleString()} pool
            </span>
          </div>
        </div>
      </div>

      {/* Price indicator */}
      <div className="flex items-center gap-2 mb-3 text-xs">
        <span className="text-gray-500">Current:</span>
        <span className="text-white font-mono">${prophecy.currentPrice.toLocaleString()}</span>
        <span className="text-gray-600">→</span>
        <span
          className={cn(
            "font-mono font-bold",
            prophecy.direction === "above" ? "text-green-400" : "text-red-400"
          )}
        >
          {prophecy.direction === "above" ? "↑" : "↓"} $
          {prophecy.targetPrice.toLocaleString()}
        </span>
      </div>

      {/* Sentiment Bar */}
      <div className="mb-3">
        <div className="flex justify-between text-[10px] mb-0.5">
          <span className="text-green-400">YES {yesPercent}% (×{yesPayout})</span>
          <span className="text-red-400">NO {noPercent}% (×{noPayout})</span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-gradient-to-r from-green-600 to-green-500 transition-all"
            style={{ width: `${yesPercent}%` }}
          />
          <div
            className="h-full bg-gradient-to-r from-red-500 to-red-600 transition-all"
            style={{ width: `${noPercent}%` }}
          />
        </div>
      </div>

      {/* Bet Buttons */}
      {hasBet ? (
        <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-center">
          <span className="text-xs text-purple-400 font-medium">
            You bet {prophecy.userBet!.amount} GBLN on{" "}
            <span className={prophecy.userBet!.side === "yes" ? "text-green-400" : "text-red-400"}>
              {prophecy.userBet!.side.toUpperCase()}
            </span>
          </span>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => onBet(prophecy.id, "yes")}
            disabled={balance < betAmount}
            className={cn(
              "flex-1 py-2 rounded-lg text-xs font-bold transition-all",
              balance >= betAmount
                ? "bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30"
                : "bg-gray-800 text-gray-600 cursor-not-allowed border border-transparent"
            )}
          >
            YES ({betAmount} GBLN)
          </button>
          <button
            onClick={() => onBet(prophecy.id, "no")}
            disabled={balance < betAmount}
            className={cn(
              "flex-1 py-2 rounded-lg text-xs font-bold transition-all",
              balance >= betAmount
                ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30"
                : "bg-gray-800 text-gray-600 cursor-not-allowed border border-transparent"
            )}
          >
            NO ({betAmount} GBLN)
          </button>
        </div>
      )}
    </div>
  );
}

function CreateProphecyForm({ onClose }: { onClose: () => void }) {
  return (
    <div className="p-4 rounded-xl bg-gray-800/30 border border-purple-500/20 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-purple-400">Create New Prophecy</h3>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-sm">
          ✕
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-gray-500 block mb-1">Symbol</label>
          <select className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white">
            <option>BTC</option>
            <option>ETH</option>
            <option>SOL</option>
            <option>BNB</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-gray-500 block mb-1">Direction</label>
          <select className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white">
            <option>Above Target</option>
            <option>Below Target</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-gray-500 block mb-1">Target Price ($)</label>
          <input
            type="number"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white"
            placeholder="70000"
          />
        </div>
        <div>
          <label className="text-[10px] text-gray-500 block mb-1">Deadline</label>
          <select className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white">
            <option>1 Day</option>
            <option>3 Days</option>
            <option>7 Days</option>
            <option>14 Days</option>
          </select>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-[10px] text-gray-500">Initial Pool:</label>
        <div className="flex items-center gap-1 text-xs">
          <GBLNIcon size={12} /> 100 GBLN (minimum)
        </div>
      </div>
      <button className="w-full py-2 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 text-xs font-bold transition-all border border-purple-500/30">
        🔮 Create Prophecy (100 GBLN)
      </button>
    </div>
  );
}
