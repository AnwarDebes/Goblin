"use client";

import { useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { useSSE } from "@/hooks/useSSE";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export default function Header() {
  const { isConnected } = useSSE(`${API_BASE}/api/stream`);
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    const update = () =>
      setCurrentTime(
        new Date().toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="relative flex h-16 items-center justify-between border-b border-gray-800/50 bg-gray-950/95 backdrop-blur-sm px-6">
      {/* Subtle bottom accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-goblin-500/20 to-transparent" />

      <div className="lg:hidden w-10" />

      <div className="flex items-center gap-4 ml-auto">
        {/* Live market indicator */}
        <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500">
          <div className="h-1 w-1 rounded-full bg-goblin-500 animate-pulse" />
          <span>Markets Open</span>
        </div>

        <div className="h-4 w-px bg-gray-800 hidden sm:block" />

        <span className="text-sm font-mono text-gray-400">{currentTime}</span>

        <div className="h-4 w-px bg-gray-800" />

        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <div className="status-healthy" />
              <Wifi size={16} className="text-goblin-500" />
            </>
          ) : (
            <>
              <div className="status-down" />
              <WifiOff size={16} className="text-red-500" />
            </>
          )}
          <span className="text-xs text-gray-400">
            {isConnected ? "Live" : "Disconnected"}
          </span>
        </div>
      </div>
    </header>
  );
}
