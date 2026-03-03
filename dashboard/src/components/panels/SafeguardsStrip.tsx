"use client";

import { useQuery } from "@tanstack/react-query";
import { getSystemHealth } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function SafeguardsStrip() {
  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: getSystemHealth,
    refetchInterval: 10000,
  });

  if (!health) return null;

  const downServices = health.filter((s) => s.status === "down");
  const degradedServices = health.filter((s) => s.status === "degraded");

  // Determine state
  if (downServices.length > 2) {
    return (
      <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-1.5 text-xs text-red-400 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
        Trading halted — {downServices.length} services down ({downServices.map((s) => s.service_name).join(", ")})
      </div>
    );
  }

  if (degradedServices.length > 0 || downServices.length > 0) {
    const names = [...degradedServices, ...downServices].map((s) => s.service_name).join(", ");
    return (
      <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-1.5 text-xs text-yellow-400 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-yellow-500 animate-pulse" />
        Degraded: {names}
      </div>
    );
  }

  // Normal — thin green line
  return (
    <div className="h-px bg-gradient-to-r from-transparent via-goblin-500/20 to-transparent" />
  );
}
