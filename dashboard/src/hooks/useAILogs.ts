"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, useCallback } from "react";
import { getAILogs, getAIStats, getAITimeline, API_BASE } from "@/lib/api";
import type { AILogEntry, AIStats, AIDecisionChain } from "@/types";

export function useAILogs(filters: {
  category?: string;
  level?: string;
  symbol?: string;
  limit?: number;
}) {
  const [liveEntries, setLiveEntries] = useState<AILogEntry[]>([]);
  const [isLive, setIsLive] = useState(true);
  const eventSourceRef = useRef<EventSource | null>(null);

  const query = useQuery({
    queryKey: ["ai-logs", filters],
    queryFn: () =>
      getAILogs({
        category: filters.category,
        level: filters.level,
        symbol: filters.symbol,
        limit: filters.limit || 100,
      }),
    refetchInterval: isLive ? false : 15000,
  });

  // SSE for live updates
  useEffect(() => {
    if (!isLive) {
      eventSourceRef.current?.close();
      return;
    }

    const es = new EventSource(`${API_BASE}/api/v2/ai/logs/stream`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const entry = JSON.parse(event.data) as AILogEntry;
        if (entry.id) {
          // Apply filters
          if (filters.category && entry.category !== filters.category) return;
          if (filters.level && entry.level !== filters.level) return;
          if (filters.symbol && entry.symbol !== filters.symbol) return;
          setLiveEntries((prev) => [entry, ...prev].slice(0, 200));
        }
      } catch {}
    };

    es.onerror = () => {
      es.close();
      // Reconnect after 5s
      setTimeout(() => {
        if (isLive) setIsLive(true);
      }, 5000);
    };

    return () => es.close();
  }, [isLive, filters.category, filters.level, filters.symbol]);

  const allEntries = isLive && liveEntries.length > 0
    ? [...liveEntries, ...(query.data || [])].reduce((acc, entry) => {
        if (!acc.find((e: AILogEntry) => e.id === entry.id)) acc.push(entry);
        return acc;
      }, [] as AILogEntry[])
    : query.data || [];

  const toggleLive = useCallback(() => {
    setIsLive((prev) => !prev);
    if (!isLive) setLiveEntries([]);
  }, [isLive]);

  return {
    entries: allEntries,
    isLoading: query.isLoading,
    isLive,
    toggleLive,
    liveCount: liveEntries.length,
    refetch: query.refetch,
  };
}

export function useAIStats() {
  return useQuery({
    queryKey: ["ai-stats"],
    queryFn: getAIStats,
    refetchInterval: 30000,
  });
}

export function useAITimeline() {
  return useQuery({
    queryKey: ["ai-timeline"],
    queryFn: getAITimeline,
    refetchInterval: 30000,
  });
}
