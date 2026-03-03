"use client";

import { useEffect, useState } from "react";
import { useNotificationStore } from "@/stores/notificationStore";

function CoinRain() {
  const [coins, setCoinArray] = useState<Array<{ id: number; x: number; delay: number; duration: number }>>([]);

  useEffect(() => {
    const c = Array.from({ length: 18 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 1.5 + Math.random() * 1,
    }));
    setCoinArray(c);
    const timer = setTimeout(() => setCoinArray([]), 2500);
    return () => clearTimeout(timer);
  }, []);

  if (coins.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[250] pointer-events-none overflow-hidden">
      {coins.map((coin) => (
        <div
          key={coin.id}
          className="absolute text-yellow-400"
          style={{
            left: `${coin.x}%`,
            top: "-20px",
            animation: `coin-fall ${coin.duration}s ease-in ${coin.delay}s forwards`,
            fontSize: 16 + Math.random() * 12,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20">
            <circle cx="10" cy="10" r="9" fill="#fbbf24" stroke="#d97706" strokeWidth="1" />
            <text x="10" y="14" textAnchor="middle" fontSize="10" fill="#78350f" fontWeight="bold">G</text>
          </svg>
        </div>
      ))}
    </div>
  );
}

function ScreenShake() {
  const [shaking, setShaking] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShaking(false), 300);
    return () => clearTimeout(timer);
  }, []);

  if (!shaking) return null;

  return (
    <div className="fixed inset-0 z-[250] pointer-events-none">
      <div className="absolute inset-0 screen-shake">
        <div className="absolute inset-0 bg-gradient-to-b from-red-500/5 via-transparent to-red-500/5" />
      </div>
    </div>
  );
}

export default function CelebrationEffects() {
  const { notifications } = useNotificationStore();
  const [showCoinRain, setShowCoinRain] = useState(false);
  const [showShake, setShowShake] = useState(false);

  useEffect(() => {
    if (notifications.length === 0) return;
    const latest = notifications[0];
    if (!latest.pnlPercent) return;

    if (latest.pnlPercent > 5 && latest.color === "green") {
      setShowCoinRain(true);
      setTimeout(() => setShowCoinRain(false), 2500);
    }
    if (latest.pnlPercent > 5 && latest.color === "red") {
      setShowShake(true);
      setTimeout(() => setShowShake(false), 400);
    }
  }, [notifications]);

  return (
    <>
      {showCoinRain && <CoinRain />}
      {showShake && <ScreenShake />}
    </>
  );
}
