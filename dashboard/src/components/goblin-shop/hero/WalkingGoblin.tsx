"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";

interface WalkingGoblinProps {
  targetPosition: [number, number, number];
}

export default function WalkingGoblin({ targetPosition }: WalkingGoblinProps) {
  const ref = useRef<Group>(null);

  useFrame(() => {
    if (!ref.current) return;

    // Lerp to target position
    ref.current.position.x += (targetPosition[0] - ref.current.position.x) * 0.03;
    ref.current.position.z += (targetPosition[2] - ref.current.position.z) * 0.03;

    // Walking bob
    const speed = Math.abs(targetPosition[0] - ref.current.position.x);
    if (speed > 0.02) {
      ref.current.position.y = -0.35 + Math.abs(Math.sin(Date.now() * 0.01)) * 0.05;
    } else {
      ref.current.position.y = -0.35 + Math.sin(Date.now() * 0.002) * 0.02;
    }

    // Face direction of movement
    const dx = targetPosition[0] - ref.current.position.x;
    const dz = targetPosition[2] - ref.current.position.z;
    if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
      const angle = Math.atan2(dx, dz);
      ref.current.rotation.y += (angle - ref.current.rotation.y) * 0.05;
    }
  });

  return (
    <group ref={ref} position={[0, -0.35, 2]}>
      {/* Body */}
      <mesh position={[0, 0.2, 0]}>
        <capsuleGeometry args={[0.1, 0.15, 6, 12]} />
        <meshStandardMaterial color="#22c55e" roughness={0.6} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.42, 0]}>
        <sphereGeometry args={[0.1, 10, 10]} />
        <meshStandardMaterial color="#22c55e" roughness={0.5} />
      </mesh>
      {/* Eyes */}
      <mesh position={[-0.04, 0.44, 0.08]}>
        <sphereGeometry args={[0.025, 6, 6]} />
        <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={1} />
      </mesh>
      <mesh position={[0.04, 0.44, 0.08]}>
        <sphereGeometry args={[0.025, 6, 6]} />
        <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={1} />
      </mesh>
      {/* Ears */}
      <mesh position={[-0.12, 0.48, 0]} rotation={[0, 0, 0.5]}>
        <coneGeometry args={[0.03, 0.08, 3]} />
        <meshStandardMaterial color="#22c55e" />
      </mesh>
      <mesh position={[0.12, 0.48, 0]} rotation={[0, 0, -0.5]}>
        <coneGeometry args={[0.03, 0.08, 3]} />
        <meshStandardMaterial color="#22c55e" />
      </mesh>
      {/* Backpack/Bag */}
      <mesh position={[0, 0.2, -0.12]}>
        <boxGeometry args={[0.12, 0.12, 0.08]} />
        <meshStandardMaterial color="#92400e" roughness={0.9} />
      </mesh>
    </group>
  );
}
