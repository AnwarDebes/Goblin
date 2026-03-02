"use client";

import { useState, useRef, useEffect } from "react";

interface GoblinCoin3DProps {
  size?: number;
  autoSpin?: boolean;
  interactive?: boolean;
  className?: string;
}

export default function GoblinCoin3D({
  size = 200,
  autoSpin = true,
  interactive = true,
  className = "",
}: GoblinCoin3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const animRef = useRef<number>(0);
  const angleRef = useRef(0);

  useEffect(() => {
    if (!autoSpin) return;

    const animate = () => {
      if (!isHovered) {
        angleRef.current += 0.5;
        setRotation({ x: 10, y: angleRef.current });
      }
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [autoSpin, isHovered]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!interactive || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const rotateY = ((e.clientX - centerX) / (rect.width / 2)) * 30;
    const rotateX = -((e.clientY - centerY) / (rect.height / 2)) * 20;
    setRotation({ x: rotateX, y: rotateY + angleRef.current });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const half = size / 2;
  const coinRadius = half - 4;

  return (
    <div
      ref={containerRef}
      className={`perspective-container inline-block ${className}`}
      style={{ width: size, height: size }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className="relative w-full h-full"
        style={{
          transformStyle: "preserve-3d",
          transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
          transition: isHovered ? "transform 0.1s ease-out" : "none",
        }}
      >
        {/* Front Face - Goblin */}
        <div
          className="coin-face rounded-full"
          style={{
            width: size,
            height: size,
            backfaceVisibility: "hidden",
          }}
        >
          <svg
            width={size}
            height={size}
            viewBox="0 0 256 256"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="bgGrad3d" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: "#2d5a27" }} />
                <stop offset="100%" style={{ stopColor: "#1a3d15" }} />
              </linearGradient>
              <linearGradient id="skinGrad3d" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: "#7cb342" }} />
                <stop offset="100%" style={{ stopColor: "#558b2f" }} />
              </linearGradient>
              <linearGradient id="earGrad3d" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: "#8bc34a" }} />
                <stop offset="100%" style={{ stopColor: "#689f38" }} />
              </linearGradient>
              <linearGradient id="goldRim" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: "#fbbf24" }} />
                <stop offset="50%" style={{ stopColor: "#f59e0b" }} />
                <stop offset="100%" style={{ stopColor: "#d97706" }} />
              </linearGradient>
              <filter id="coinGlow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feFlood floodColor="#22c55e" floodOpacity="0.3" />
                <feComposite in2="blur" operator="in" />
                <feMerge>
                  <feMergeNode />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Gold rim */}
            <circle cx="128" cy="128" r="124" fill="url(#goldRim)" />
            <circle cx="128" cy="128" r="118" fill="url(#bgGrad3d)" />

            {/* Inner decorative ring */}
            <circle cx="128" cy="128" r="108" fill="none" stroke="#5d9c4a" strokeWidth="1.5" opacity="0.5" />

            {/* Left Ear */}
            <ellipse cx="45" cy="100" rx="28" ry="42" fill="url(#earGrad3d)" transform="rotate(-30 45 100)" />
            <ellipse cx="48" cy="100" rx="16" ry="28" fill="#a5d6a7" opacity="0.4" transform="rotate(-30 48 100)" />

            {/* Right Ear */}
            <ellipse cx="211" cy="100" rx="28" ry="42" fill="url(#earGrad3d)" transform="rotate(30 211 100)" />
            <ellipse cx="208" cy="100" rx="16" ry="28" fill="#a5d6a7" opacity="0.4" transform="rotate(30 208 100)" />

            {/* Head/Face */}
            <ellipse cx="128" cy="138" rx="73" ry="68" fill="url(#skinGrad3d)" />
            <ellipse cx="115" cy="120" rx="38" ry="33" fill="#8bc34a" opacity="0.4" />

            {/* Eyes */}
            <ellipse cx="100" cy="130" rx="20" ry="24" fill="#fff" />
            <ellipse cx="103" cy="132" rx="11" ry="13" fill="#2d2d2d" />
            <circle cx="108" cy="126" r="4.5" fill="#fff" />
            <circle cx="98" cy="138" r="2.5" fill="#fff" opacity="0.6" />

            <ellipse cx="156" cy="130" rx="20" ry="24" fill="#fff" />
            <ellipse cx="159" cy="132" rx="11" ry="13" fill="#2d2d2d" />
            <circle cx="164" cy="126" r="4.5" fill="#fff" />
            <circle cx="154" cy="138" r="2.5" fill="#fff" opacity="0.6" />

            {/* Eyebrows */}
            <path d="M77 107 Q92 97 115 107" stroke="#4a7c40" strokeWidth="3.5" fill="none" strokeLinecap="round" />
            <path d="M141 107 Q164 97 179 107" stroke="#4a7c40" strokeWidth="3.5" fill="none" strokeLinecap="round" />

            {/* Nose */}
            <ellipse cx="128" cy="155" rx="11" ry="7" fill="#558b2f" />
            <circle cx="122" cy="154" r="2.5" fill="#2d2d2d" />
            <circle cx="134" cy="154" r="2.5" fill="#2d2d2d" />

            {/* Mouth */}
            <path d="M97 175 Q128 205 159 175" stroke="#2d2d2d" strokeWidth="3.5" fill="none" strokeLinecap="round" />

            {/* Cheeks */}
            <ellipse cx="72" cy="155" rx="14" ry="9" fill="#ff8a80" opacity="0.35" />
            <ellipse cx="184" cy="155" rx="14" ry="9" fill="#ff8a80" opacity="0.35" />

            {/* Horns */}
            <circle cx="100" cy="77" r="11" fill="url(#skinGrad3d)" />
            <circle cx="156" cy="77" r="11" fill="url(#skinGrad3d)" />

            {/* Small crypto symbols around */}
            <text x="30" y="55" fontSize="14" fill="#fbbf24" opacity="0.7" fontWeight="bold">₿</text>
            <text x="210" y="55" fontSize="14" fill="#fbbf24" opacity="0.7" fontWeight="bold">Ξ</text>
            <text x="22" y="200" fontSize="12" fill="#fbbf24" opacity="0.5" fontWeight="bold">◆</text>
            <text x="220" y="200" fontSize="12" fill="#fbbf24" opacity="0.5" fontWeight="bold">◆</text>

            {/* GBLN text */}
            <text
              x="128"
              y="235"
              textAnchor="middle"
              fontFamily="Arial Black, Arial, sans-serif"
              fontSize="22"
              fontWeight="bold"
              fill="#fbbf24"
              stroke="#2d5a27"
              strokeWidth="0.5"
            >
              GBLN
            </text>
          </svg>
        </div>

        {/* Back Face */}
        <div
          className="coin-back rounded-full"
          style={{
            width: size,
            height: size,
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          <svg
            width={size}
            height={size}
            viewBox="0 0 256 256"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="backGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: "#1a3d15" }} />
                <stop offset="100%" style={{ stopColor: "#2d5a27" }} />
              </linearGradient>
              <linearGradient id="goldRimBack" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: "#d97706" }} />
                <stop offset="50%" style={{ stopColor: "#f59e0b" }} />
                <stop offset="100%" style={{ stopColor: "#fbbf24" }} />
              </linearGradient>
            </defs>

            {/* Gold rim */}
            <circle cx="128" cy="128" r="124" fill="url(#goldRimBack)" />
            <circle cx="128" cy="128" r="118" fill="url(#backGrad)" />

            {/* Decorative rings */}
            <circle cx="128" cy="128" r="100" fill="none" stroke="#4a7c40" strokeWidth="2" opacity="0.5" />
            <circle cx="128" cy="128" r="85" fill="none" stroke="#4a7c40" strokeWidth="1" opacity="0.3" />

            {/* Center emblem - Trading chart */}
            <path
              d="M60 160 L80 140 L100 150 L120 110 L140 125 L160 95 L180 105 L200 80"
              stroke="#22c55e"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M60 160 L80 140 L100 150 L120 110 L140 125 L160 95 L180 105 L200 80 L200 160 Z"
              fill="url(#skinGrad3d)"
              opacity="0.15"
            />

            {/* Gold coins */}
            <circle cx="75" cy="80" r="15" fill="#fbbf24" stroke="#d97706" strokeWidth="1.5" />
            <text x="75" y="85" textAnchor="middle" fontSize="14" fill="#92400e" fontWeight="bold">$</text>

            <circle cx="185" cy="70" r="12" fill="#fbbf24" stroke="#d97706" strokeWidth="1.5" />
            <text x="185" y="75" textAnchor="middle" fontSize="12" fill="#92400e" fontWeight="bold">$</text>

            {/* GOBLIN text */}
            <text
              x="128"
              y="195"
              textAnchor="middle"
              fontFamily="Arial Black, Arial, sans-serif"
              fontSize="28"
              fontWeight="bold"
              fill="#fbbf24"
            >
              GOBLIN
            </text>
            <text
              x="128"
              y="220"
              textAnchor="middle"
              fontFamily="Arial, sans-serif"
              fontSize="12"
              fill="#86efac"
              opacity="0.8"
            >
              AI TRADING
            </text>
          </svg>
        </div>

        {/* Edge/Rim effect */}
        <div
          className="absolute rounded-full"
          style={{
            width: size,
            height: size,
            background: "linear-gradient(90deg, rgba(251,191,36,0.3), transparent, rgba(251,191,36,0.3))",
            transform: "translateZ(-2px)",
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
}
