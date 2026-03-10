"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { Group, Mesh } from "three";
import type { FamiliarStage, FamiliarMood } from "@/types/familiar";
import { MOOD_CONFIG, STAGE_CONFIG } from "@/lib/familiar-utils";

interface FamiliarScene3DProps {
  stage: FamiliarStage;
  mood: FamiliarMood;
  happiness: number;
  equippedColor?: string;
  equippedAura?: string;
  equippedHat?: string;
  isEvolving?: boolean;
  name: string;
}

function EggModel({ mood }: { mood: FamiliarMood }) {
  const ref = useRef<Mesh>(null);
  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.z = Math.sin(Date.now() * 0.002) * 0.1;
    ref.current.position.y = Math.sin(Date.now() * 0.003) * 0.05;
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.35, 16, 16]} />
      <meshStandardMaterial
        color={mood === "excited" ? "#fbbf24" : "#d4a574"}
        roughness={0.3}
        metalness={0.2}
        emissive={mood === "excited" ? "#f59e0b" : "#8b6914"}
        emissiveIntensity={0.3}
      />
    </mesh>
  );
}

function HatchlingModel({ color, mood }: { color: string; mood: FamiliarMood }) {
  const ref = useRef<Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.y = Math.sin(Date.now() * 0.003) * 0.08;
    ref.current.rotation.y = Math.sin(Date.now() * 0.001) * 0.3;
  });
  return (
    <group ref={ref}>
      <mesh position={[0, 0, 0]}>
        <capsuleGeometry args={[0.2, 0.2, 8, 16]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.35, 0]}>
        <sphereGeometry args={[0.18, 12, 12]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
      {/* Eyes */}
      <mesh position={[-0.07, 0.38, 0.15]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[0.07, 0.38, 0.15]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={0.8} />
      </mesh>
      {/* Tiny wings */}
      <mesh position={[-0.25, 0.15, 0]} rotation={[0, 0, 0.4]}>
        <planeGeometry args={[0.15, 0.1]} />
        <meshStandardMaterial color="#4ade80" transparent opacity={0.6} side={2} />
      </mesh>
      <mesh position={[0.25, 0.15, 0]} rotation={[0, 0, -0.4]}>
        <planeGeometry args={[0.15, 0.1]} />
        <meshStandardMaterial color="#4ade80" transparent opacity={0.6} side={2} />
      </mesh>
    </group>
  );
}

function JuvenileModel({ color, mood }: { color: string; mood: FamiliarMood }) {
  const ref = useRef<Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.y = Math.sin(Date.now() * 0.002) * 0.1;
    ref.current.rotation.y += 0.003;
  });
  return (
    <group ref={ref}>
      <mesh position={[0, 0, 0]}>
        <capsuleGeometry args={[0.22, 0.3, 8, 16]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.45, 0]}>
        <sphereGeometry args={[0.2, 12, 12]} />
        <meshStandardMaterial color={color} roughness={0.3} />
      </mesh>
      {/* Glowing eyes */}
      <mesh position={[-0.08, 0.48, 0.16]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={1.2} />
      </mesh>
      <mesh position={[0.08, 0.48, 0.16]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={1.2} />
      </mesh>
      {/* Ears */}
      <mesh position={[-0.2, 0.6, 0]} rotation={[0, 0, 0.5]}>
        <coneGeometry args={[0.06, 0.15, 4]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0.2, 0.6, 0]} rotation={[0, 0, -0.5]}>
        <coneGeometry args={[0.06, 0.15, 4]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Rune belt */}
      <mesh position={[0, -0.05, 0]}>
        <torusGeometry args={[0.24, 0.02, 8, 16]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.6} metalness={0.8} />
      </mesh>
    </group>
  );
}

function AdultModel({ color, mood }: { color: string; mood: FamiliarMood }) {
  const ref = useRef<Group>(null);
  const runeRef = useRef<Mesh>(null);
  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.y = Math.sin(Date.now() * 0.0015) * 0.12;
    if (runeRef.current) {
      runeRef.current.rotation.y += 0.02;
      runeRef.current.rotation.x = Math.sin(Date.now() * 0.001) * 0.2;
    }
  });
  return (
    <group ref={ref}>
      {/* Body */}
      <mesh position={[0, 0, 0]}>
        <capsuleGeometry args={[0.25, 0.35, 8, 16]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.2} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.5, 0]}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial color={color} roughness={0.3} />
      </mesh>
      {/* Glowing eyes */}
      <mesh position={[-0.09, 0.54, 0.18]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial color="#a855f7" emissive="#a855f7" emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[0.09, 0.54, 0.18]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial color="#a855f7" emissive="#a855f7" emissiveIntensity={1.5} />
      </mesh>
      {/* Armor plates */}
      <mesh position={[0, 0.1, 0.22]}>
        <boxGeometry args={[0.3, 0.25, 0.05]} />
        <meshStandardMaterial color="#374151" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Floating runes */}
      <mesh ref={runeRef} position={[0, 0.85, 0]}>
        <torusGeometry args={[0.3, 0.015, 6, 24]} />
        <meshStandardMaterial color="#f59e0b" emissive="#fbbf24" emissiveIntensity={1} transparent opacity={0.8} />
      </mesh>
      {/* Pointed ears */}
      <mesh position={[-0.22, 0.65, 0]} rotation={[0, 0, 0.6]}>
        <coneGeometry args={[0.05, 0.2, 4]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0.22, 0.65, 0]} rotation={[0, 0, -0.6]}>
        <coneGeometry args={[0.05, 0.2, 4]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

function ElderModel({ color, mood }: { color: string; mood: FamiliarMood }) {
  const ref = useRef<Group>(null);
  const haloRef = useRef<Mesh>(null);
  const orbRef = useRef<Mesh>(null);
  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.y = Math.sin(Date.now() * 0.001) * 0.15;
    if (haloRef.current) haloRef.current.rotation.y += 0.01;
    if (orbRef.current) {
      orbRef.current.position.x = Math.cos(Date.now() * 0.002) * 0.5;
      orbRef.current.position.z = Math.sin(Date.now() * 0.002) * 0.5;
      orbRef.current.position.y = 0.7 + Math.sin(Date.now() * 0.003) * 0.1;
    }
  });
  return (
    <group ref={ref}>
      {/* Ethereal body */}
      <mesh position={[0, 0, 0]}>
        <capsuleGeometry args={[0.25, 0.4, 8, 16]} />
        <meshStandardMaterial color={color} roughness={0.1} metalness={0.3} transparent opacity={0.85} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.55, 0]}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial color={color} transparent opacity={0.85} roughness={0.1} />
      </mesh>
      {/* Radiant eyes */}
      <mesh position={[-0.09, 0.6, 0.18]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={2} />
      </mesh>
      <mesh position={[0.09, 0.6, 0.18]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={2} />
      </mesh>
      {/* Crown/Halo */}
      <mesh ref={haloRef} position={[0, 0.85, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.25, 0.02, 8, 32]} />
        <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={1.5} metalness={1} roughness={0} />
      </mesh>
      {/* Orbiting wisdom orb */}
      <mesh ref={orbRef}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshStandardMaterial color="#a855f7" emissive="#a855f7" emissiveIntensity={2} />
      </mesh>
      {/* Flowing robe effect */}
      <mesh position={[0, -0.35, 0]}>
        <coneGeometry args={[0.35, 0.3, 8]} />
        <meshStandardMaterial color={color} transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

function AuraEffect({ color }: { color: string }) {
  const ref = useRef<Mesh>(null);
  useFrame(() => {
    if (!ref.current) return;
    const scale = 1 + Math.sin(Date.now() * 0.003) * 0.15;
    ref.current.scale.set(scale, scale, scale);
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.6, 16, 16]} />
      <meshStandardMaterial color={color} transparent opacity={0.1} emissive={color} emissiveIntensity={0.3} />
    </mesh>
  );
}

export default function FamiliarScene3D({
  stage,
  mood,
  happiness,
  equippedColor,
  equippedAura,
  name,
  isEvolving,
}: FamiliarScene3DProps) {
  const bodyColor = equippedColor || "#22c55e";
  const moodConfig = MOOD_CONFIG[mood];

  const FamiliarModel = useMemo(() => {
    switch (stage) {
      case "egg": return EggModel;
      case "hatchling": return HatchlingModel;
      case "juvenile": return JuvenileModel;
      case "adult": return AdultModel;
      case "elder": return ElderModel;
      default: return EggModel;
    }
  }, [stage]);

  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[0, 2, 2]} color="#f59e0b" intensity={1.5} />
      <pointLight position={[-1, 1, -1]} color="#22c55e" intensity={0.5} />

      {equippedAura && <AuraEffect color={equippedAura} />}

      <FamiliarModel color={bodyColor} mood={mood} />

      {isEvolving && (
        <mesh>
          <sphereGeometry args={[0.8, 16, 16]} />
          <meshStandardMaterial
            color="#fbbf24"
            transparent
            opacity={0.4}
            emissive="#fbbf24"
            emissiveIntensity={3}
          />
        </mesh>
      )}
    </>
  );
}
