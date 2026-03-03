"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, ShieldAlert, Octagon, Play } from "lucide-react";
import { getSystemHealth } from "@/lib/api";
import { API_BASE } from "@/lib/api";
import { usePositions } from "@/hooks/usePortfolio";
import { cn } from "@/lib/utils";

interface EmergencyPanelProps {
  onClose: () => void;
}

export default function EmergencyPanel({ onClose }: EmergencyPanelProps) {
  const [stopConfirm, setStopConfirm] = useState(false);
  const [closeConfirm, setCloseConfirm] = useState(false);
  const [halted, setHalted] = useState(false);

  const { data: health = [] } = useQuery({
    queryKey: ["health"],
    queryFn: getSystemHealth,
    refetchInterval: 10000,
  });

  const { data: positions = [] } = usePositions();

  const keyServices = ["prediction", "signal", "executor", "risk"];
  const serviceHealth = keyServices.map((name) => {
    const h = health.find((s) => s.service_name === name);
    return { name, status: h?.status || "down" };
  });

  useEffect(() => {
    if (stopConfirm) {
      const timer = setTimeout(() => setStopConfirm(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [stopConfirm]);

  useEffect(() => {
    if (closeConfirm) {
      const timer = setTimeout(() => setCloseConfirm(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [closeConfirm]);

  const handleStop = async () => {
    if (!stopConfirm) { setStopConfirm(true); return; }
    try { await fetch(`${API_BASE}/api/emergency/stop`, { method: "POST" }); } catch {}
    setStopConfirm(false);
    setHalted(true);
  };

  const handleCloseAll = async () => {
    if (!closeConfirm) { setCloseConfirm(true); return; }
    try { await fetch(`${API_BASE}/api/emergency/close-all`, { method: "POST" }); } catch {}
    setCloseConfirm(false);
  };

  const handleResume = async () => {
    try { await fetch(`${API_BASE}/api/emergency/stop`, { method: "POST", body: JSON.stringify({ resume: true }) }); } catch {}
    setHalted(false);
  };

  return (
    <div className="absolute top-full right-0 mt-2 w-72 rounded-xl border border-gray-700 bg-gray-900/95 backdrop-blur-xl shadow-2xl z-50 overflow-hidden"
      onClick={(e) => e.stopPropagation()}>
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-goblin-500" />
          <h3 className="text-sm font-semibold text-white">Emergency Controls</h3>
        </div>

        {/* Service Status */}
        <div className="flex gap-2">
          {serviceHealth.map((s) => (
            <div key={s.name} className="flex flex-col items-center gap-1">
              <div className={cn("h-2 w-2 rounded-full",
                s.status === "healthy" ? "bg-green-500" : s.status === "degraded" ? "bg-yellow-500" : "bg-red-500"
              )} />
              <span className="text-[9px] text-gray-500">{s.name.slice(0, 4)}</span>
            </div>
          ))}
        </div>

        {/* Stop Button */}
        <button
          onClick={handleStop}
          className={cn(
            "w-full rounded-lg py-2 text-sm font-semibold transition-all",
            stopConfirm ? "bg-red-600 text-white animate-pulse" : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
          )}
        >
          <div className="flex items-center justify-center gap-2">
            <Octagon size={14} />
            {stopConfirm ? "Confirm Stop" : "Stop Trading"}
          </div>
        </button>

        {/* Close All */}
        <button
          onClick={handleCloseAll}
          className={cn(
            "w-full rounded-lg py-2 text-sm font-semibold transition-all",
            closeConfirm ? "bg-orange-600 text-white animate-pulse" : "bg-orange-500/20 text-orange-400 hover:bg-orange-500/30"
          )}
        >
          <div className="flex items-center justify-center gap-2">
            <ShieldAlert size={14} />
            {closeConfirm ? "Confirm Close All" : `Close All Positions (${positions.length})`}
          </div>
        </button>

        {/* Resume */}
        {halted && (
          <button
            onClick={handleResume}
            className="w-full rounded-lg py-2 text-sm font-semibold bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-all"
          >
            <div className="flex items-center justify-center gap-2">
              <Play size={14} />
              Resume Trading
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
