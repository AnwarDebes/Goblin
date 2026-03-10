"use client";

import { useTilt } from "@/hooks/useTilt";
import { useCallback, useRef, useState } from "react";

interface CardTiltEffectProps {
  children: React.ReactNode;
  className?: string;
  intensity?: number;
  glare?: boolean;
}

export default function CardTiltEffect({
  children,
  className = "",
  intensity = 4,
  glare = false,
}: CardTiltEffectProps) {
  const { onMouseMove: tiltMove, onMouseLeave: tiltLeave, style } = useTilt(intensity);
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50 });
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      tiltMove(e);
      if (glare && ref.current) {
        const rect = ref.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setGlarePos({ x, y });
      }
    },
    [tiltMove, glare]
  );

  const handleMouseLeave = useCallback(() => {
    tiltLeave();
    setGlarePos({ x: 50, y: 50 });
  }, [tiltLeave]);

  return (
    <div
      ref={ref}
      className={`relative ${className}`}
      style={style}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {glare && (
        <div
          className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(255,255,255,0.15) 0%, transparent 60%)`,
            opacity: glarePos.x !== 50 || glarePos.y !== 50 ? 0.8 : 0,
          }}
        />
      )}
    </div>
  );
}
