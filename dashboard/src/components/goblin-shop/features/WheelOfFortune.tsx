"use client";

import { useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { WHEEL_SEGMENTS, spinWheel, type WheelSegment } from "@/lib/arena-utils";
import GBLNIcon from "../shared/GBLNIcon";

interface WheelOfFortuneProps {
  balance: number;
  onEarnReward: (segment: WheelSegment) => void;
}

export default function WheelOfFortune({ balance, onEarnReward }: WheelOfFortuneProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<WheelSegment | null>(null);
  const [hasFreeSpin, setHasFreeSpin] = useState(true);
  const [spinHistory, setSpinHistory] = useState<WheelSegment[]>([]);
  const wheelRef = useRef<HTMLDivElement>(null);

  const segmentAngle = 360 / WHEEL_SEGMENTS.length;

  const handleSpin = useCallback(
    (isFree: boolean = false) => {
      if (isSpinning) return;
      if (isFree) setHasFreeSpin(false);

      setIsSpinning(true);
      setResult(null);

      const winner = spinWheel();
      const winnerIndex = WHEEL_SEGMENTS.indexOf(winner);

      // Calculate rotation: multiple full spins + landing on segment
      const targetAngle = 360 - winnerIndex * segmentAngle - segmentAngle / 2;
      const totalRotation = rotation + 1440 + targetAngle; // 4 full spins + target

      setRotation(totalRotation);

      setTimeout(() => {
        setResult(winner);
        setSpinHistory((prev) => [winner, ...prev].slice(0, 15));
        setIsSpinning(false);
        onEarnReward(winner);
      }, 4000);
    },
    [isSpinning, rotation, segmentAngle, onEarnReward]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center">
        {/* Wheel Container */}
        <div className="relative w-72 h-72 sm:w-80 sm:h-80">
          {/* Pointer */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10">
            <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-amber-400 drop-shadow-lg" />
          </div>

          {/* Wheel */}
          <div
            ref={wheelRef}
            className="w-full h-full rounded-full border-4 border-amber-500/30 overflow-hidden relative"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: isSpinning ? "transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none",
              boxShadow: `0 0 30px ${isSpinning ? "rgba(251,191,36,0.4)" : "rgba(251,191,36,0.1)"}`,
            }}
          >
            {WHEEL_SEGMENTS.map((segment, i) => {
              const angle = i * segmentAngle;
              const skew = 90 - segmentAngle;
              return (
                <div
                  key={i}
                  className="absolute w-1/2 h-1/2 origin-bottom-right overflow-hidden"
                  style={{
                    transform: `rotate(${angle}deg) skewY(-${skew}deg)`,
                    top: 0,
                    right: "50%",
                  }}
                >
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{
                      backgroundColor: segment.color,
                      transform: `skewY(${skew}deg) rotate(${segmentAngle / 2}deg)`,
                      transformOrigin: "bottom right",
                    }}
                  >
                    <span className="text-xs font-bold text-white drop-shadow-md absolute"
                      style={{
                        transform: `rotate(${-angle - segmentAngle / 2}deg)`,
                        top: "30%",
                        fontSize: "10px",
                      }}
                    >
                      {segment.icon}
                    </span>
                  </div>
                </div>
              );
            })}
            {/* Center circle */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-gray-900 border-2 border-amber-500/50 flex items-center justify-center">
                <span className="text-lg">🎰</span>
              </div>
            </div>
          </div>
        </div>

        {/* Result */}
        {result && !isSpinning && (
          <div className="mt-4 p-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-purple-500/10 border border-amber-500/30 text-center animate-fade-in">
            <span className="text-3xl block mb-1">{result.icon}</span>
            <span className="text-sm font-bold text-white">{result.label}</span>
            {result.type !== "nothing" && (
              <p className="text-xs text-goblin-400 mt-0.5">Added to your inventory!</p>
            )}
          </div>
        )}

        {/* Spin Buttons */}
        <div className="flex items-center gap-3 mt-4">
          {hasFreeSpin && (
            <button
              onClick={() => handleSpin(true)}
              disabled={isSpinning}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 text-white font-bold text-sm hover:scale-105 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 animate-pulse"
            >
              🎁 Free Daily Spin!
            </button>
          )}
          <button
            onClick={() => handleSpin(false)}
            disabled={isSpinning || balance < 25}
            className={cn(
              "flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-bold text-sm transition-all",
              balance >= 25
                ? "bg-goblin-500/20 text-goblin-400 hover:bg-goblin-500/30 border border-goblin-500/30"
                : "bg-gray-800 text-gray-600 cursor-not-allowed border border-transparent",
              isSpinning && "opacity-50"
            )}
          >
            <GBLNIcon size={14} /> Spin Again (25 GBLN)
          </button>
        </div>
      </div>

      {/* Spin History */}
      {spinHistory.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-gray-400 mb-2">Recent Spins</h4>
          <div className="flex flex-wrap gap-1.5">
            {spinHistory.map((seg, i) => (
              <div
                key={i}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-800/30 text-[10px] animate-fade-in"
              >
                <span>{seg.icon}</span>
                <span className="text-gray-400">{seg.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prize Table */}
      <div>
        <h4 className="text-xs font-bold text-gray-400 mb-2">Prize Table</h4>
        <div className="grid grid-cols-3 gap-1.5">
          {WHEEL_SEGMENTS.map((seg, i) => (
            <div
              key={i}
              className="flex items-center gap-2 p-2 rounded-lg text-[10px]"
              style={{ backgroundColor: `${seg.color}20` }}
            >
              <span>{seg.icon}</span>
              <span className="text-gray-300">{seg.label}</span>
              <span className="ml-auto text-gray-500">
                {(seg.probability * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
