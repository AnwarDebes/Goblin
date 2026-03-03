"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, AlertTriangle, Info, Trash2 } from "lucide-react";
import { getContainerLogs } from "@/lib/api";
import { cn } from "@/lib/utils";

interface SystemAlert {
  id: string;
  severity: "critical" | "warning" | "info";
  message: string;
  service: string;
  timestamp: string;
}

const SEVERITY_CONFIG = {
  critical: { icon: AlertCircle, color: "text-red-400", bg: "bg-red-500/20", line: "bg-red-500" },
  warning: { icon: AlertTriangle, color: "text-yellow-400", bg: "bg-yellow-500/20", line: "bg-yellow-500" },
  info: { icon: Info, color: "text-blue-400", bg: "bg-blue-500/20", line: "bg-blue-500" },
};

function formatAlertTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function logToSeverity(level: string): "critical" | "warning" | "info" {
  if (level === "error") return "critical";
  if (level === "warn") return "warning";
  return "info";
}

export default function AlertHistory() {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Fetch real logs filtered to warn/error for alerts
  const { data: logs = [] } = useQuery({
    queryKey: ["alert-logs"],
    queryFn: async () => {
      const allLogs = await getContainerLogs(undefined, 100);
      return allLogs.filter((l) => l.level === "error" || l.level === "warn");
    },
    refetchInterval: 15000,
  });

  const alerts: SystemAlert[] = logs
    .map((log, i) => ({
      id: `${log.timestamp}-${log.container}-${i}`,
      severity: logToSeverity(log.level),
      message: log.message,
      service: log.container,
      timestamp: log.timestamp,
    }))
    .filter((a) => !dismissed.has(a.id))
    .slice(0, 30);

  const clearAll = () => {
    setDismissed(new Set(alerts.map((a) => a.id)));
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="section-title">Alert History</h3>
        {alerts.length > 0 && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-400 transition-colors"
          >
            <Trash2 size={12} />
            Clear All
          </button>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="text-center text-sm text-gray-500 py-8">No alerts</div>
      ) : (
        <div className="relative max-h-[400px] overflow-y-auto space-y-0">
          {/* Timeline line */}
          <div className="absolute left-[15px] top-0 bottom-0 w-px bg-gray-800" />

          {alerts.map((alert) => {
            const config = SEVERITY_CONFIG[alert.severity];
            const Icon = config.icon;
            return (
              <div key={alert.id} className="relative flex gap-3 py-2 pl-1">
                <div className={cn("relative z-10 mt-1 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full", config.bg)}>
                  <Icon size={14} className={config.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={cn("badge text-[10px]", config.bg, config.color)}>
                      {alert.severity}
                    </span>
                    <span className="text-[10px] text-gray-600 font-mono">{alert.service}</span>
                    <span className="text-[10px] text-gray-600 ml-auto">{formatAlertTime(alert.timestamp)}</span>
                  </div>
                  <p className="text-xs text-gray-300 leading-relaxed truncate">{alert.message}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
