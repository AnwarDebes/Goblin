"use client";

import { useCallback, useRef, useState } from "react";

interface TiltStyle {
  transform: string;
  transition: string;
}

interface UseTiltReturn {
  onMouseMove: (e: React.MouseEvent<HTMLElement>) => void;
  onMouseLeave: () => void;
  style: TiltStyle;
}

export function useTilt(maxDegrees: number = 2): UseTiltReturn {
  const ref = useRef<DOMRect | null>(null);
  const [style, setStyle] = useState<TiltStyle>({
    transform: "perspective(600px) rotateX(0deg) rotateY(0deg)",
    transition: "transform 0.1s ease-out",
  });

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const el = e.currentTarget;
      if (!ref.current) {
        ref.current = el.getBoundingClientRect();
      }
      const rect = ref.current;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateY = ((x - centerX) / centerX) * maxDegrees;
      const rotateX = ((centerY - y) / centerY) * maxDegrees;

      setStyle({
        transform: `perspective(600px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`,
        transition: "transform 0.1s ease-out",
      });
    },
    [maxDegrees]
  );

  const onMouseLeave = useCallback(() => {
    ref.current = null;
    setStyle({
      transform: "perspective(600px) rotateX(0deg) rotateY(0deg)",
      transition: "transform 0.4s ease-out",
    });
  }, []);

  return { onMouseMove, onMouseLeave, style };
}
