"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";

interface DistrictPortalProps {
  position: [number, number, number];
  color: string;
  isActive: boolean;
}

export default function DistrictPortal({ position, color, isActive }: DistrictPortalProps) {
  const ringRef = useRef<Mesh>(null);
  const innerRef = useRef<Mesh>(null);

  useFrame(() => {
    if (!ringRef.current || !isActive) return;
    ringRef.current.rotation.z += 0.02;
    if (innerRef.current) {
      innerRef.current.rotation.z -= 0.01;
      const scale = 0.8 + Math.sin(Date.now() * 0.005) * 0.2;
      innerRef.current.scale.set(scale, scale, 1);
    }
  });

  if (!isActive) return null;

  return (
    <group position={position}>
      {/* Outer ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.4, 0.03, 8, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.5}
          transparent
          opacity={0.7}
        />
      </mesh>
      {/* Inner vortex */}
      <mesh ref={innerRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.25, 0.02, 8, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={2}
          transparent
          opacity={0.5}
        />
      </mesh>
      {/* Center glow */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.2, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.8}
          transparent
          opacity={0.3}
        />
      </mesh>
    </group>
  );
}
