"use client";

import { useRef, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";

const MESSAGES = [
  "Welcome to the Grand Bazaar!",
  "Finest strategies in the realm!",
  "Earn GBLN, grow your power!",
];

export default function GoblinMerchant() {
  const groupRef = useRef<THREE.Group>(null);
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex((i) => (i + 1) % MESSAGES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(clock.getElapsedTime() * 1.2) * 0.08;
    }
  });

  return (
    <group ref={groupRef} position={[0, 0.5, 0]}>
      {/* Stall / Counter */}
      <mesh position={[0, -0.3, 0.6]}>
        <boxGeometry args={[1.8, 0.6, 0.5]} />
        <meshStandardMaterial color="#78350f" roughness={0.8} />
      </mesh>
      {/* Stall roof */}
      <mesh position={[0, 0.8, 0.3]} rotation={[0.3, 0, 0]}>
        <boxGeometry args={[2.2, 0.05, 1.2]} />
        <meshStandardMaterial color="#92400e" roughness={0.7} />
      </mesh>
      {/* Roof supports */}
      <mesh position={[-0.9, 0.25, 0.6]}>
        <cylinderGeometry args={[0.03, 0.03, 1, 6]} />
        <meshStandardMaterial color="#78350f" />
      </mesh>
      <mesh position={[0.9, 0.25, 0.6]}>
        <cylinderGeometry args={[0.03, 0.03, 1, 6]} />
        <meshStandardMaterial color="#78350f" />
      </mesh>

      {/* Body */}
      <mesh position={[0, 0.2, 0]}>
        <capsuleGeometry args={[0.2, 0.3, 8, 8]} />
        <meshStandardMaterial color="#4a7c3f" roughness={0.6} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 0.65, 0]}>
        <sphereGeometry args={[0.2, 12, 12]} />
        <meshStandardMaterial color="#7cb342" roughness={0.5} />
      </mesh>

      {/* Eyes */}
      <mesh position={[-0.07, 0.7, 0.17]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh position={[-0.07, 0.7, 0.19]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[0.07, 0.7, 0.17]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0.07, 0.7, 0.19]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>

      {/* Ears */}
      <mesh position={[-0.25, 0.68, 0]} rotation={[0, 0, -0.5]}>
        <coneGeometry args={[0.06, 0.18, 6]} />
        <meshStandardMaterial color="#8bc34a" />
      </mesh>
      <mesh position={[0.25, 0.68, 0]} rotation={[0, 0, 0.5]}>
        <coneGeometry args={[0.06, 0.18, 6]} />
        <meshStandardMaterial color="#8bc34a" />
      </mesh>

      {/* Nose */}
      <mesh position={[0, 0.62, 0.2]}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshStandardMaterial color="#558b2f" />
      </mesh>

      {/* Merchant Hat */}
      <mesh position={[0, 0.85, 0]}>
        <cylinderGeometry args={[0.22, 0.25, 0.05, 12]} />
        <meshStandardMaterial color="#d97706" metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.12, 0.15, 0.12, 12]} />
        <meshStandardMaterial color="#b45309" roughness={0.5} />
      </mesh>

      {/* Arms */}
      <mesh position={[-0.3, 0.2, 0.1]} rotation={[0, 0, -0.5]}>
        <capsuleGeometry args={[0.05, 0.18, 6, 6]} />
        <meshStandardMaterial color="#7cb342" />
      </mesh>
      <mesh position={[0.3, 0.2, 0.1]} rotation={[0, 0, 0.5]}>
        <capsuleGeometry args={[0.05, 0.18, 6, 6]} />
        <meshStandardMaterial color="#7cb342" />
      </mesh>

      {/* Status glow ring */}
      <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.4, 0.02, 8, 32]} />
        <meshStandardMaterial
          color="#f59e0b"
          emissive="#f59e0b"
          emissiveIntensity={1.5}
          transparent
          opacity={0.6}
        />
      </mesh>

      {/* Speech bubble */}
      <Html position={[0, 1.3, 0]} center distanceFactor={8}>
        <div className="bg-gray-900/90 border border-gold-500/40 rounded-lg px-3 py-1.5 text-xs text-gold-400 font-medium whitespace-nowrap backdrop-blur-sm">
          {MESSAGES[msgIndex]}
        </div>
      </Html>
    </group>
  );
}
