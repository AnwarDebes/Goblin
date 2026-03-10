"use client";

import GBLNIcon from "./GBLNIcon";

interface PriceTagProps {
  price: number;
  size?: "sm" | "md" | "lg";
  suffix?: string;
  className?: string;
}

const sizeMap = {
  sm: { icon: 14, text: "text-xs" },
  md: { icon: 16, text: "text-sm" },
  lg: { icon: 20, text: "text-base" },
};

export default function PriceTag({ price, size = "md", suffix, className = "" }: PriceTagProps) {
  const s = sizeMap[size];
  return (
    <span className={`inline-flex items-center gap-1 text-gold-400 font-bold ${s.text} ${className}`}>
      <GBLNIcon size={s.icon} />
      <span>{price.toLocaleString()}</span>
      {suffix && <span className="text-gray-500 font-normal">{suffix}</span>}
    </span>
  );
}
