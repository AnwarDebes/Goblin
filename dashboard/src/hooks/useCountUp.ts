"use client";

import { useEffect, useRef, useState } from "react";

export function useCountUp(
  target: number,
  duration: number = 800,
  decimals: number = 2
): number {
  const [value, setValue] = useState(0);
  const prevTarget = useRef(0);
  const animRef = useRef<number>(0);

  useEffect(() => {
    if (target === prevTarget.current) return;

    const start = prevTarget.current;
    const diff = target - start;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + diff * eased;

      setValue(Number(current.toFixed(decimals)));

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        prevTarget.current = target;
      }
    };

    animRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animRef.current);
  }, [target, duration, decimals]);

  return value;
}
