"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, AlertTriangle, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { API_BASE, getTicker } from "@/lib/api";
import { useNotificationStore } from "@/stores/notificationStore";

interface Props {
  onClose: () => void;
}

const SYMBOLS = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "XRP/USDT"];

export default function ManualTradePanel({ onClose }: Props) {
  const [symbol, setSymbol] = useState("BTC/USDT");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addNotification } = useNotificationStore();

  // Fetch real price for the selected symbol
  const { data: tickerData } = useQuery({
    queryKey: ["ticker", symbol],
    queryFn: () => getTicker(symbol),
    refetchInterval: 3000,
  });

  const livePrice = (() => {
    if (tickerData && typeof tickerData === "object") {
      const t = tickerData as Record<string, string>;
      const p = parseFloat(t.lastPrice || t.price || "0");
      if (p > 0) return p;
    }
    return 0;
  })();

  const numAmount = parseFloat(amount) || 0;
  const estimatedCost = numAmount * livePrice;
  const fee = estimatedCost * 0.001;

  const handleSubmit = async () => {
    if (numAmount <= 0 || livePrice === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/manual-trade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, action: side, amount: numAmount }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as Record<string, string>).detail || `Request failed (${res.status})`);
      }
      setSuccess(true);
      addNotification({
        type: "trade",
        message: `Manual ${side}: ${numAmount} ${symbol} at $${livePrice.toLocaleString()}`,
        color: side === "BUY" ? "green" : "red",
      });
      setTimeout(() => { setSuccess(false); onClose(); }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit order");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[150] bg-black/40 lg:bg-transparent" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 z-[160] h-full w-full sm:w-80 border-l border-gray-700 bg-gray-900/98 backdrop-blur-xl shadow-2xl overflow-y-auto"
        style={{ animation: "slide-in-right 0.3s ease-out" }}>
        <div className="p-5 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Manual Trade</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
          </div>

          {/* Symbol */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Symbol</label>
            <select value={symbol} onChange={(e) => setSymbol(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-goblin-500/50">
              {SYMBOLS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Side Toggle */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Side</label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setSide("BUY")}
                className={cn("rounded-lg py-2 text-sm font-semibold transition-all",
                  side === "BUY" ? "bg-green-500 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700")}>
                BUY
              </button>
              <button onClick={() => setSide("SELL")}
                className={cn("rounded-lg py-2 text-sm font-semibold transition-all",
                  side === "SELL" ? "bg-red-500 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700")}>
                SELL
              </button>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Amount</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} step="0.001" min="0"
              placeholder="0.00"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white font-mono outline-none focus:border-goblin-500/50" />
            <div className="flex gap-1 mt-2">
              {[25, 50, 75, 100].map((pct) => (
                <button key={pct} onClick={() => setAmount((pct / 100 * 1).toFixed(4))}
                  className="flex-1 rounded bg-gray-800 py-1 text-[10px] text-gray-400 hover:bg-gray-700 hover:text-white transition-colors">
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          {/* Current Price */}
          <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-3">
            <p className="text-xs text-gray-500">Current Price</p>
            {livePrice > 0 ? (
              <p className="text-xl font-bold font-mono text-white">
                ${livePrice < 1 ? livePrice.toFixed(4) : livePrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
            ) : (
              <p className="text-sm text-gray-500">Loading...</p>
            )}
          </div>

          {/* Order Summary */}
          {livePrice > 0 && numAmount > 0 && (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-gray-500">Estimated Cost</span><span className="text-white font-mono">${estimatedCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Fee (0.1%)</span><span className="text-white font-mono">${fee.toFixed(4)}</span></div>
              <div className="flex justify-between border-t border-gray-700 pt-2"><span className="text-gray-400 font-medium">Total</span><span className="text-white font-mono font-medium">${(estimatedCost + fee).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-2 text-xs text-red-400">
              {error}
            </div>
          )}

          {/* Submit */}
          <button onClick={handleSubmit} disabled={submitting || numAmount <= 0 || livePrice === 0 || success}
            className={cn("w-full rounded-lg py-3 text-sm font-semibold transition-all disabled:opacity-50",
              success ? "bg-green-500 text-white" : side === "BUY" ? "btn-goblin" : "bg-red-500 text-white hover:bg-red-400")}>
            {success ? <span className="flex items-center justify-center gap-2"><Check size={16} /> Order Placed</span> :
             submitting ? <span className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" /> Submitting...</span> :
             `Submit ${side} Order`}
          </button>

          {/* Risk Warning */}
          <div className="flex items-start gap-2 rounded-lg bg-yellow-500/5 border border-yellow-500/10 p-2">
            <AlertTriangle size={14} className="text-yellow-500 shrink-0 mt-0.5" />
            <p className="text-[10px] text-yellow-500/80 leading-relaxed">
              Manual trades bypass the AI risk engine. Proceed with caution.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
