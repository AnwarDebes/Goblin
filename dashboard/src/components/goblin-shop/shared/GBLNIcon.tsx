"use client";

interface GBLNIconProps {
  size?: number;
  className?: string;
}

export default function GBLNIcon({ size = 16, className = "" }: GBLNIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`inline-block shrink-0 ${className}`}
    >
      <defs>
        <linearGradient id="gblnGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: "#fbbf24" }} />
          <stop offset="100%" style={{ stopColor: "#d97706" }} />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="11" fill="url(#gblnGold)" />
      <circle cx="12" cy="12" r="9" fill="#78350f" />
      <text
        x="12"
        y="16"
        textAnchor="middle"
        fontSize="10"
        fontWeight="bold"
        fill="#fbbf24"
        fontFamily="monospace"
      >
        G
      </text>
    </svg>
  );
}
