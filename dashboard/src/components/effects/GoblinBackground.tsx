"use client";

import { useEffect, useRef } from "react";

/* ── Floating goblin silhouettes (CSS animated SVGs) ─────────────── */

const SILHOUETTE_COUNT = 8;

function GoblinSilhouette({ index }: { index: number }) {
  const size = 20 + Math.random() * 40; // 20-60px
  const opacity = 0.03 + Math.random() * 0.05; // 0.03-0.08
  const duration = 15 + Math.random() * 25; // 15-40s
  const left = Math.random() * 100; // 0-100%
  const startTop = 80 + Math.random() * 30; // start near bottom
  const drift = -20 + Math.random() * 40; // horizontal drift

  return (
    <svg
      key={index}
      width={size}
      height={size}
      viewBox="0 0 256 256"
      className="absolute pointer-events-none"
      style={{
        left: `${left}%`,
        opacity,
        animation: `goblin-float-up ${duration}s linear ${index * 2}s infinite`,
        ["--drift" as string]: `${drift}px`,
        ["--start-top" as string]: `${startTop}%`,
      }}
    >
      {/* Simplified goblin face silhouette */}
      <ellipse cx="50" cy="100" rx="22" ry="35" fill="currentColor" transform="rotate(-30 50 100)" />
      <ellipse cx="206" cy="100" rx="22" ry="35" fill="currentColor" transform="rotate(30 206 100)" />
      <ellipse cx="128" cy="140" rx="65" ry="60" fill="currentColor" />
      <ellipse cx="102" cy="130" rx="12" ry="15" fill="#030712" opacity="0.5" />
      <ellipse cx="154" cy="130" rx="12" ry="15" fill="#030712" opacity="0.5" />
    </svg>
  );
}

/* ── Canvas particle system ──────────────────────────────────────── */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  pulseSpeed: number;
  pulseOffset: number;
  isGold: boolean;
}

function createParticles(width: number, height: number, count: number): Particle[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.3,
    size: 1 + Math.random() * 2,
    opacity: 0.2 + Math.random() * 0.5,
    pulseSpeed: 0.5 + Math.random() * 1.5,
    pulseOffset: Math.random() * Math.PI * 2,
    isGold: Math.random() < 0.3,
  }));
}

function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      particlesRef.current = createParticles(canvas.width, canvas.height, 50);
    };
    resize();
    window.addEventListener("resize", resize);

    let time = 0;

    const draw = () => {
      if (document.hidden) {
        animRef.current = requestAnimationFrame(draw);
        return;
      }

      time += 0.016;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around edges
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        const pulse = Math.sin(time * p.pulseSpeed + p.pulseOffset) * 0.3 + 0.7;
        const alpha = p.opacity * pulse;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.isGold
          ? `rgba(245, 158, 11, ${alpha})`
          : `rgba(34, 197, 94, ${alpha})`;
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ width: "100%", height: "100%" }}
    />
  );
}

/* ── Ambient glow orbs ───────────────────────────────────────────── */

const ORBS = [
  { size: 350, color: "rgba(34,197,94,0.06)", duration: 25, startX: 20, startY: 30 },
  { size: 280, color: "rgba(245,158,11,0.05)", duration: 30, startX: 70, startY: 60 },
  { size: 400, color: "rgba(34,197,94,0.04)", duration: 35, startX: 50, startY: 80 },
  { size: 220, color: "rgba(245,158,11,0.06)", duration: 28, startX: 80, startY: 20 },
];

/* ── Main component ──────────────────────────────────────────────── */

export default function GoblinBackground() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      {/* Grid overlay */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            repeating-linear-gradient(0deg, rgba(34,197,94,0.025) 0px, transparent 1px, transparent 60px),
            repeating-linear-gradient(90deg, rgba(34,197,94,0.025) 0px, transparent 1px, transparent 60px)
          `,
        }}
      />

      {/* Particle canvas */}
      <ParticleCanvas />

      {/* Ambient glow orbs */}
      {ORBS.map((orb, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: orb.size,
            height: orb.size,
            background: `radial-gradient(circle, ${orb.color}, transparent 70%)`,
            left: `${orb.startX}%`,
            top: `${orb.startY}%`,
            transform: "translate(-50%, -50%)",
            animation: `orb-drift-${i} ${orb.duration}s ease-in-out infinite`,
            filter: "blur(40px)",
          }}
        />
      ))}

      {/* Floating goblin silhouettes */}
      <div className="absolute inset-0 text-goblin-500">
        {Array.from({ length: SILHOUETTE_COUNT }, (_, i) => (
          <GoblinSilhouette key={i} index={i} />
        ))}
      </div>
    </div>
  );
}
