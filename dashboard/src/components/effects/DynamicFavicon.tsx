"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSystemHealth } from "@/lib/api";

function drawFavicon(status: "healthy" | "degraded" | "critical"): string {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // Face color
  const faceColor = status === "healthy" ? "#22c55e" : status === "degraded" ? "#f59e0b" : "#ef4444";
  const darkFace = status === "healthy" ? "#166534" : status === "degraded" ? "#78350f" : "#7f1d1d";

  // Head
  ctx.fillStyle = faceColor;
  ctx.beginPath();
  ctx.ellipse(16, 18, 12, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ears
  ctx.beginPath();
  ctx.ellipse(4, 12, 4, 6, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(28, 12, 4, 6, 0.5, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(11, 16, 3, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(21, 16, 3, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pupils
  ctx.fillStyle = "#1a1a1a";
  ctx.beginPath();
  ctx.ellipse(12, 17, 1.5, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(22, 17, 1.5, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mouth
  ctx.strokeStyle = darkFace;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(16, 22, 4, 0, Math.PI);
  ctx.stroke();

  return canvas.toDataURL();
}

export default function DynamicFavicon() {
  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: getSystemHealth,
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (!health) return;

    const downCount = health.filter((s) => s.status === "down").length;
    const degradedCount = health.filter((s) => s.status === "degraded").length;

    let status: "healthy" | "degraded" | "critical" = "healthy";
    if (downCount > 2) status = "critical";
    else if (downCount > 0 || degradedCount > 2) status = "degraded";

    const dataUrl = drawFavicon(status);
    if (!dataUrl) return;

    let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = dataUrl;
  }, [health]);

  return null;
}
