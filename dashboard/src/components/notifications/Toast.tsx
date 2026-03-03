"use client";

import { useEffect, useState, useCallback } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/stores/notificationStore";

interface ToastProps {
  notification: AppNotification;
  onDismiss: (id: string) => void;
}

const BORDER_COLORS: Record<string, string> = {
  green: "border-l-green-500",
  red: "border-l-red-500",
  gold: "border-l-yellow-500",
  blue: "border-l-blue-500",
  gray: "border-l-gray-500",
};

const ICON_MAP: Record<string, string> = {
  trade: "chart",
  position: "activity",
  price: "zap",
  sentiment: "brain",
  system: "server",
  info: "info",
};

function Toast({ notification, onDismiss }: ToastProps) {
  const [progress, setProgress] = useState(100);
  const [exiting, setExiting] = useState(false);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onDismiss(notification.id), 300);
  }, [notification.id, onDismiss]);

  useEffect(() => {
    const duration = 6000;
    const interval = 50;
    const step = (interval / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= 0) {
          clearInterval(timer);
          dismiss();
          return 0;
        }
        return prev - step;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [dismiss]);

  const isProfitCelebration = notification.pnlPercent && notification.pnlPercent > 5;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border-l-4 bg-gray-900/95 backdrop-blur-sm shadow-xl transition-all duration-300",
        BORDER_COLORS[notification.color] || "border-l-gray-500",
        exiting ? "translate-x-full opacity-0" : "translate-x-0 opacity-100",
        isProfitCelebration && "ring-1 ring-yellow-500/30"
      )}
      style={{ animation: exiting ? undefined : "toast-slide-in 0.3s ease-out" }}
    >
      <div className="flex items-start gap-3 p-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-200 leading-relaxed">{notification.message}</p>
          <p className="text-[10px] text-gray-500 mt-1">
            {new Date(notification.timestamp).toLocaleTimeString("en-US", { hour12: false })}
          </p>
        </div>
        <button
          onClick={dismiss}
          className="shrink-0 text-gray-500 hover:text-white transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-gray-800">
        <div
          className={cn(
            "h-full transition-all duration-50",
            notification.color === "green" ? "bg-green-500" :
            notification.color === "red" ? "bg-red-500" :
            notification.color === "gold" ? "bg-yellow-500" : "bg-blue-500"
          )}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Profit particle burst */}
      {isProfitCelebration && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-yellow-400"
              style={{
                left: "50%",
                top: "50%",
                animation: `particle-burst 0.6s ease-out ${i * 0.05}s forwards`,
                ["--angle" as string]: `${i * 60}deg`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ToastContainerProps {
  toasts: AppNotification[];
  onDismiss: (id: string) => void;
}

export default function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  const visible = toasts.slice(0, 4);

  return (
    <div className="fixed top-20 right-4 z-[100] flex flex-col gap-2 w-80 pointer-events-none">
      {visible.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast notification={toast} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}
