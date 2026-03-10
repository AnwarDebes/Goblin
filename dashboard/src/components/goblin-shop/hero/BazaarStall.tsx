"use client";

import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { Group } from "three";

interface BazaarStallProps {
  position: [number, number, number];
  color: string;
  emissiveColor: string;
  icon: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

export default function BazaarStall({
  position,
  color,
  emissiveColor,
  icon,
  label,
  isActive,
  onClick,
}: BazaarStallProps) {
  const ref = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!ref.current) return;
    // Hover bob
    const targetY = position[1] + (hovered ? 0.1 : 0);
    ref.current.position.y += (targetY - ref.current.position.y) * 0.1;

    // Active glow pulse
    if (glowRef.current) {
      const scale = isActive ? 1.1 + Math.sin(Date.now() * 0.003) * 0.05 : 1;
      glowRef.current.scale.set(scale, scale, scale);
    }
  });

  return (
    <group
      ref={ref}
      position={position}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {/* Stall base/table */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.8, 0.1, 0.6]} />
        <meshStandardMaterial color="#5c4033" roughness={0.8} />
      </mesh>

      {/* Stall legs */}
      {[[-0.35, -0.3, -0.25], [0.35, -0.3, -0.25], [-0.35, -0.3, 0.25], [0.35, -0.3, 0.25]].map(
        (pos, i) => (
          <mesh key={i} position={pos as [number, number, number]}>
            <cylinderGeometry args={[0.03, 0.03, 0.5, 6]} />
            <meshStandardMaterial color="#3e2723" roughness={0.9} />
          </mesh>
        )
      )}

      {/* Canopy poles */}
      <mesh position={[-0.35, 0.4, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.7, 6]} />
        <meshStandardMaterial color="#5c4033" />
      </mesh>
      <mesh position={[0.35, 0.4, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.7, 6]} />
        <meshStandardMaterial color="#5c4033" />
      </mesh>

      {/* Canopy */}
      <mesh position={[0, 0.75, 0]}>
        <boxGeometry args={[0.9, 0.05, 0.7]} />
        <meshStandardMaterial
          color={color}
          emissive={emissiveColor}
          emissiveIntensity={isActive ? 0.5 : 0.1}
          roughness={0.6}
        />
      </mesh>

      {/* Active glow ring */}
      {isActive && (
        <mesh ref={glowRef} position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.5, 0.02, 8, 24]} />
          <meshStandardMaterial
            color={emissiveColor}
            emissive={emissiveColor}
            emissiveIntensity={1.5}
            transparent
            opacity={0.6}
          />
        </mesh>
      )}

      {/* Hover glow */}
      {hovered && !isActive && (
        <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.4, 0.01, 8, 24]} />
          <meshStandardMaterial
            color={emissiveColor}
            emissive={emissiveColor}
            emissiveIntensity={0.8}
            transparent
            opacity={0.4}
          />
        </mesh>
      )}

      {/* Floating icon label */}
      <Html position={[0, 1.1, 0]} center distanceFactor={6}>
        <div
          className={cn(
            "flex flex-col items-center select-none pointer-events-none transition-all",
            isActive ? "scale-110" : hovered ? "scale-105" : "scale-100"
          )}
        >
          <span className="text-lg">{icon}</span>
          <span
            className={cn(
              "text-[9px] font-bold mt-0.5 whitespace-nowrap",
              isActive ? "text-white" : "text-gray-400"
            )}
          >
            {label}
          </span>
        </div>
      </Html>
    </group>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
