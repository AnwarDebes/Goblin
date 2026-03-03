"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, CandlestickChart, BarChart3, Brain, Server, Coins, ScrollText, FlaskConical,
  Search, ShieldAlert, XCircle, Volume2, Maximize, ToggleRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotificationStore } from "@/stores/notificationStore";
import { API_BASE } from "@/lib/api";

interface Command {
  id: string;
  label: string;
  group: string;
  icon: React.ElementType;
  action: () => void;
  keywords?: string;
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [confirmAction, setConfirmAction] = useState<{ label: string; action: () => void } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { toggleSound, soundEnabled } = useNotificationStore();

  const commands: Command[] = useMemo(() => [
    // Pages
    { id: "nav-dashboard", label: "Go to Dashboard", group: "Pages", icon: LayoutDashboard, action: () => { router.push("/"); setOpen(false); }, keywords: "home" },
    { id: "nav-trading", label: "Go to Trading", group: "Pages", icon: CandlestickChart, action: () => { router.push("/trading"); setOpen(false); }, keywords: "chart" },
    { id: "nav-analytics", label: "Go to Analytics", group: "Pages", icon: BarChart3, action: () => { router.push("/analytics"); setOpen(false); } },
    { id: "nav-sentiment", label: "Go to Sentiment", group: "Pages", icon: Brain, action: () => { router.push("/sentiment"); setOpen(false); } },
    { id: "nav-coin", label: "Go to GBLN Coin", group: "Pages", icon: Coins, action: () => { router.push("/goblin-coin"); setOpen(false); }, keywords: "token" },
    { id: "nav-system", label: "Go to System", group: "Pages", icon: Server, action: () => { router.push("/system"); setOpen(false); } },
    { id: "nav-logs", label: "Go to Logs", group: "Pages", icon: ScrollText, action: () => { router.push("/logs"); setOpen(false); } },
    { id: "nav-backtest", label: "Go to Backtesting", group: "Pages", icon: FlaskConical, action: () => { router.push("/backtesting"); setOpen(false); } },
    // Actions
    {
      id: "emergency-stop", label: "Emergency Stop Trading", group: "Actions", icon: ShieldAlert,
      action: () => {
        setConfirmAction({
          label: "STOP ALL TRADING?",
          action: async () => {
            try { await fetch(`${API_BASE}/api/emergency/stop`, { method: "POST" }); } catch {}
            setConfirmAction(null);
            setOpen(false);
          },
        });
      },
      keywords: "halt danger",
    },
    {
      id: "close-all", label: "Close All Positions", group: "Actions", icon: XCircle,
      action: () => {
        setConfirmAction({
          label: "CLOSE ALL POSITIONS?",
          action: async () => {
            try { await fetch(`${API_BASE}/api/emergency/close-all`, { method: "POST" }); } catch {}
            setConfirmAction(null);
            setOpen(false);
          },
        });
      },
      keywords: "exit liquidate",
    },
    {
      id: "toggle-sound", label: `Toggle Sound (${soundEnabled ? "ON" : "OFF"})`, group: "Actions", icon: Volume2,
      action: () => { toggleSound(); setOpen(false); },
    },
    {
      id: "fullscreen", label: "Toggle Fullscreen", group: "Actions", icon: Maximize,
      action: () => { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {}); setOpen(false); },
    },
  ], [router, soundEnabled, toggleSound]);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter((c) =>
      c.label.toLowerCase().includes(q) ||
      c.group.toLowerCase().includes(q) ||
      (c.keywords || "").toLowerCase().includes(q)
    );
  }, [query, commands]);

  // Reset selection when results change
  useEffect(() => setSelectedIndex(0), [filtered]);

  // Open on Cmd+K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        setQuery("");
      }
      if (e.key === "Escape") {
        setOpen(false);
        setConfirmAction(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      filtered[selectedIndex].action();
    }
  }, [filtered, selectedIndex]);

  if (!open) return null;

  // Group commands
  const groups = new Map<string, Command[]>();
  for (const cmd of filtered) {
    if (!groups.has(cmd.group)) groups.set(cmd.group, []);
    groups.get(cmd.group)!.push(cmd);
  }

  let flatIndex = 0;

  return (
    <div className="fixed inset-0 z-[300] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div className="w-full max-w-lg rounded-xl border border-gray-700 bg-gray-900/95 backdrop-blur-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}>

        {confirmAction ? (
          <div className="p-6 text-center space-y-4">
            <p className="text-lg font-bold text-red-400">{confirmAction.label}</p>
            <p className="text-sm text-gray-400">This action cannot be undone.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setConfirmAction(null)} className="rounded-lg bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700">Cancel</button>
              <button onClick={confirmAction.action} className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-500">Confirm</button>
            </div>
          </div>
        ) : (
          <>
            {/* Search input */}
            <div className="flex items-center gap-3 border-b border-gray-800 px-4 py-3">
              <Search size={18} className="text-gray-500" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a command or search..."
                className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none text-sm"
              />
              <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-gray-700 bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-400">ESC</kbd>
            </div>

            {/* Results */}
            <div className="max-h-[50vh] overflow-y-auto py-2">
              {filtered.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-gray-500">No results found</p>
              ) : (
                Array.from(groups.entries()).map(([group, cmds]) => (
                  <div key={group}>
                    <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">{group}</p>
                    {cmds.map((cmd) => {
                      const idx = flatIndex++;
                      return (
                        <button
                          key={cmd.id}
                          onClick={cmd.action}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={cn(
                            "flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                            idx === selectedIndex ? "bg-goblin-500/10 text-goblin-400" : "text-gray-300 hover:bg-gray-800/50"
                          )}
                        >
                          <cmd.icon size={16} className={idx === selectedIndex ? "text-goblin-400" : "text-gray-500"} />
                          {cmd.label}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-4 border-t border-gray-800 px-4 py-2 text-[10px] text-gray-500">
              <span><kbd className="text-gray-400">↑↓</kbd> Navigate</span>
              <span><kbd className="text-gray-400">↵</kbd> Select</span>
              <span><kbd className="text-gray-400">esc</kbd> Close</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
