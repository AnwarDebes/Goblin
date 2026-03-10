"use client";

import { useCountUp } from "@/hooks/useCountUp";
import GBLNIcon from "../shared/GBLNIcon";

interface CoinCounterProps {
  amount: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: { icon: 14, text: "text-sm" },
  md: { icon: 18, text: "text-lg" },
  lg: { icon: 24, text: "text-2xl" },
};

export default function CoinCounter({ amount, size = "md", className = "" }: CoinCounterProps) {
  const animated = useCountUp(amount, 800, 0);
  const s = sizeMap[size];

  return (
    <span className={`inline-flex items-center gap-1.5 text-gold-400 font-bold ${s.text} ${className}`}>
      <GBLNIcon size={s.icon} />
      <span>{animated.toLocaleString()}</span>
    </span>
  );
}
