"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface FloatingItemProps {
  position: [number, number, number];
  orbitRadius: number;
  orbitSpeed: number;
  orbitOffset: number;
  children: React.ReactNode;
}

function FloatingItem({ position, orbitRadius, orbitSpeed, orbitOffset, children }: FloatingItemProps) {
  const ref = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (ref.current) {
      const t = clock.getElapsedTime() * orbitSpeed + orbitOffset;
      ref.current.position.x = position[0] + Math.cos(t) * orbitRadius;
      ref.current.position.z = position[2] + Math.sin(t) * orbitRadius;
      ref.current.position.y = position[1] + Math.sin(t * 1.5) * 0.15;
      ref.current.rotation.y = t * 0.5;
    }
  });

  return <group ref={ref}>{children}</group>;
}

export default function FloatingShopItems() {
  return (
    <group>
      {/* Sword - Strategy Artifact */}
      <FloatingItem position={[0, 1.5, 0]} orbitRadius={2.2} orbitSpeed={0.3} orbitOffset={0}>
        <mesh>
          <boxGeometry args={[0.06, 0.5, 0.03]} />
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.8} metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[0, -0.28, 0]}>
          <boxGeometry args={[0.18, 0.06, 0.03]} />
          <meshStandardMaterial color="#78350f" metalness={0.5} />
        </mesh>
      </FloatingItem>

      {/* Potion - Indicator */}
      <FloatingItem position={[0, 1.3, 0]} orbitRadius={2.0} orbitSpeed={0.35} orbitOffset={Math.PI * 0.33}>
        <mesh>
          <capsuleGeometry args={[0.06, 0.12, 8, 8]} />
          <meshStandardMaterial color="#a855f7" emissive="#a855f7" emissiveIntensity={0.5} transparent opacity={0.8} />
        </mesh>
        <mesh position={[0, 0.1, 0]}>
          <cylinderGeometry args={[0.03, 0.04, 0.06, 8]} />
          <meshStandardMaterial color="#6b21a8" />
        </mesh>
      </FloatingItem>

      {/* Scroll - Signal Pack */}
      <FloatingItem position={[0, 1.6, 0]} orbitRadius={2.4} orbitSpeed={0.25} orbitOffset={Math.PI * 0.66}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.06, 0.06, 0.25, 8]} />
          <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.3} roughness={0.6} />
        </mesh>
      </FloatingItem>

      {/* Shield - Risk Tool */}
      <FloatingItem position={[0, 1.4, 0]} orbitRadius={1.8} orbitSpeed={0.28} orbitOffset={Math.PI}>
        <mesh>
          <circleGeometry args={[0.14, 6]} />
          <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={0.4} metalness={0.9} roughness={0.1} side={THREE.DoubleSide} />
        </mesh>
      </FloatingItem>

      {/* Crown - Achievement */}
      <FloatingItem position={[0, 1.7, 0]} orbitRadius={2.6} orbitSpeed={0.22} orbitOffset={Math.PI * 1.33}>
        <mesh>
          <torusGeometry args={[0.1, 0.025, 8, 6]} />
          <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.8} metalness={0.9} roughness={0.1} />
        </mesh>
      </FloatingItem>

      {/* Gem - GBLN Token */}
      <FloatingItem position={[0, 1.5, 0]} orbitRadius={1.6} orbitSpeed={0.4} orbitOffset={Math.PI * 1.66}>
        <mesh>
          <octahedronGeometry args={[0.1]} />
          <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={1.2} metalness={0.5} roughness={0.2} />
        </mesh>
      </FloatingItem>
    </group>
  );
}
