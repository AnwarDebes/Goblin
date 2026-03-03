"use client";

import { useState, useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ReferenceDot,
} from "recharts";
import { FlaskConical, Play, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { API_BASE } from "@/lib/api";

interface BacktestResult {
  totalReturn: number;
  sharpe: number;
  maxDrawdown: number;
  winRate: number;
  equityCurve: Array<{ date: string; value: number; benchmark: number }>;
  trades: Array<{
    symbol: string; side: string; entryPrice: number; exitPrice: number;
    pnl: number; pnlPct: number; holdTime: string; exitReason: string; date: string;
  }>;
  monthlyReturns: Array<{ month: string; return: number }>;
}

const QUICK_DATES = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "1Y", days: 365 },
];

export default function BacktestingPage() {
  const [symbols, setSymbols] = useState(["BTC/USDT", "ETH/USDT"]);
  const [strategy, setStrategy] = useState("ml_ensemble");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [initialCapital, setInitialCapital] = useState(10000);
  const [positionSize, setPositionSize] = useState(20);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [sortTradesAsc, setSortTradesAsc] = useState(false);

  const availableSymbols = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "XRP/USDT"];

  const toggleSymbol = (s: string) => {
    setSymbols((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  };

  const setQuickDate = (days: number) => {
    const d = new Date(); d.setDate(d.getDate() - days);
    setStartDate(d.toISOString().split("T")[0]);
    setEndDate(new Date().toISOString().split("T")[0]);
  };

  const [backtestError, setBacktestError] = useState<string | null>(null);

  const runBacktest = async () => {
    setRunning(true);
    setBacktestError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v2/backtest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols, start_date: startDate, end_date: endDate, strategy, initial_capital: initialCapital, position_size_pct: positionSize }),
      });
      if (res.ok) {
        const data = await res.json();
        setResult(data);
      } else {
        const errData = await res.json().catch(() => ({}));
        setBacktestError((errData as Record<string, string>).detail || `Backtest service returned ${res.status}. Ensure the backtesting container is running.`);
      }
    } catch (err) {
      setBacktestError("Could not reach backtesting service. Make sure the container is running.");
    }
    setRunning(false);
  };

  const sortedTrades = useMemo(() => {
    if (!result) return [];
    return [...result.trades].sort((a, b) => sortTradesAsc ? a.pnl - b.pnl : b.pnl - a.pnl);
  }, [result, sortTradesAsc]);

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <FlaskConical size={24} className="text-goblin-500 shrink-0" />
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Backtesting <span className="text-goblin-gradient">Lab</span></h1>
          <p className="text-xs sm:text-sm text-gray-400">Test strategies against historical data</p>
        </div>
      </div>

      {/* Config Panel */}
      <div className="card space-y-4">
        {/* Symbol selector */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Trading Pairs</label>
          <div className="flex flex-wrap gap-1.5">
            {availableSymbols.map((s) => (
              <button key={s} onClick={() => toggleSymbol(s)}
                className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                  symbols.includes(s) ? "bg-goblin-500/20 text-goblin-400 ring-1 ring-goblin-500/30" : "bg-gray-800 text-gray-500 hover:text-gray-300")}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Date range */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="col-span-1">
            <label className="text-xs text-gray-500 mb-1 block">Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none" />
          </div>
          <div className="col-span-1">
            <label className="text-xs text-gray-500 mb-1 block">End Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none" />
          </div>
          <div className="col-span-2 flex items-end gap-1">
            {QUICK_DATES.map((q) => (
              <button key={q.label} onClick={() => setQuickDate(q.days)}
                className="flex-1 rounded-lg bg-gray-800 py-2 text-xs text-gray-400 hover:bg-gray-700 hover:text-white transition-colors">
                {q.label}
              </button>
            ))}
          </div>
        </div>

        {/* Strategy */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Strategy</label>
          <select value={strategy} onChange={(e) => setStrategy(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none">
            <option value="ml_ensemble">ML Ensemble (TCN + XGBoost)</option>
            <option value="technical">Technical Only</option>
            <option value="sentiment">Sentiment Only</option>
          </select>
        </div>

        {/* Advanced Settings */}
        <button onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors">
          {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          Advanced Settings
        </button>
        {showAdvanced && (
          <div className="grid grid-cols-2 gap-3 border-t border-gray-800 pt-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Initial Capital</label>
              <input type="number" value={initialCapital} onChange={(e) => setInitialCapital(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white font-mono outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Position Size: {positionSize}%</label>
              <input type="range" min={5} max={50} value={positionSize} onChange={(e) => setPositionSize(Number(e.target.value))}
                className="w-full accent-goblin-500" />
            </div>
          </div>
        )}

        {/* Run button */}
        <button onClick={runBacktest} disabled={running || symbols.length === 0}
          className="btn-goblin w-full flex items-center justify-center gap-2 disabled:opacity-50">
          {running ? <><Loader2 size={16} className="animate-spin" /> Running Backtest...</> : <><Play size={16} /> Run Backtest</>}
        </button>
      </div>

      {/* Error */}
      {backtestError && (
        <div className="card border-red-500/20 bg-red-500/5">
          <p className="text-sm text-red-400">{backtestError}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
            {[
              { label: "Total Return", value: formatPercent(result.totalReturn), color: result.totalReturn >= 0 ? "text-green-400" : "text-red-400" },
              { label: "Sharpe Ratio", value: result.sharpe.toFixed(2), color: result.sharpe >= 1 ? "text-green-400" : "text-gray-300" },
              { label: "Max Drawdown", value: formatPercent(result.maxDrawdown), color: "text-red-400" },
              { label: "Win Rate", value: `${result.winRate.toFixed(1)}%`, color: result.winRate >= 50 ? "text-green-400" : "text-yellow-400" },
            ].map((s) => (
              <div key={s.label} className="card-hover">
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className={cn("text-2xl font-bold font-mono mt-1", s.color)}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Equity Curve */}
          <div className="card">
            <h3 className="section-title mb-3">Equity Curve</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={result.equityCurve}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 8, fontSize: 11 }}
                  formatter={(v: number, name: string) => [`$${v.toLocaleString()}`, name === "value" ? "Strategy" : "Buy & Hold"]} />
                <Area type="monotone" dataKey="benchmark" stroke="#6b7280" fill="none" strokeDasharray="4 4" strokeWidth={1} />
                <Area type="monotone" dataKey="value" stroke="#22c55e" fill="rgba(34,197,94,0.1)" strokeWidth={2} />
                {result.trades.slice(0, 20).map((t, i) => (
                  <ReferenceDot key={i} x={t.date} y={result.equityCurve.find((e) => e.date === t.date)?.value || 0}
                    r={3} fill={t.side === "LONG" ? "#22c55e" : "#ef4444"} stroke="none" />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Trade Log */}
          <div className="card overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
              <h3 className="font-semibold text-white">Trade Log ({result.trades.length} trades)</h3>
              <button onClick={() => setSortTradesAsc(!sortTradesAsc)} className="text-xs text-gray-400 hover:text-white">
                Sort by PnL {sortTradesAsc ? "↑" : "↓"}
              </button>
            </div>
            <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-900">
                  <tr className="border-b border-gray-800 text-left text-gray-500">
                    <th className="px-5 py-2">Date</th><th className="px-3 py-2">Symbol</th><th className="px-3 py-2">Side</th>
                    <th className="px-3 py-2 text-right">Entry</th><th className="px-3 py-2 text-right">Exit</th>
                    <th className="px-3 py-2 text-right">PnL</th><th className="px-3 py-2 text-right">PnL%</th>
                    <th className="px-3 py-2">Hold</th><th className="px-5 py-2">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTrades.map((t, i) => (
                    <tr key={i} className={cn("border-b border-gray-800/50", t.pnl < 0 && "bg-red-500/5")}>
                      <td className="px-5 py-2 text-gray-400">{t.date}</td>
                      <td className="px-3 py-2 text-white font-medium">{t.symbol}</td>
                      <td className="px-3 py-2"><span className={cn("badge", t.side === "LONG" ? "badge-buy" : "badge-sell")}>{t.side}</span></td>
                      <td className="px-3 py-2 text-right font-mono text-gray-300">${t.entryPrice.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-300">${t.exitPrice.toFixed(2)}</td>
                      <td className={cn("px-3 py-2 text-right font-mono font-medium", t.pnl >= 0 ? "text-green-400" : "text-red-400")}>{formatCurrency(t.pnl)}</td>
                      <td className={cn("px-3 py-2 text-right font-mono", t.pnlPct >= 0 ? "text-green-400" : "text-red-400")}>{formatPercent(t.pnlPct)}</td>
                      <td className="px-3 py-2 text-gray-400">{t.holdTime}</td>
                      <td className="px-5 py-2 text-gray-400">{t.exitReason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
