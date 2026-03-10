"use client";

import { Suspense, useMemo, useRef, useState, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Stars,
  Sparkles,
  Float,
  Billboard,
  Html,
  AdaptiveDpr,
  Trail,
  MeshDistortMaterial,
} from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { cn } from "@/lib/utils";
import type { Rarity } from "@/types/shop";
import { RARITY_CONFIG } from "@/lib/shop-utils";

/* ── Types ────────────────────────────────────────────────────────── */

export interface GalaxyCardData {
  id: string;
  rarity: Rarity;
  element?: string;
  glowColor?: string;
}

export interface CardGalaxy3DProps {
  cards: GalaxyCardData[];
  renderCard: (card: GalaxyCardData, opts: { isSelected: boolean; isHovered: boolean }) => React.ReactNode;
  selectedId: string | null;
  onSelectCard: (id: string | null) => void;
  galaxyConfig?: Partial<GalaxyConfig>;
}

interface GalaxyConfig {
  arms: number;
  spread: number;
  verticalSpread: number;
  autoRotateSpeed: number;
  cameraDistance: number;
  cardScale: number;
  enableNebula: boolean;
  nebulaColor: string;
  sparkleColor: string;
  starCount: number;
}

const DEFAULT_CONFIG: GalaxyConfig = {
  arms: 3,
  spread: 12,
  verticalSpread: 2.5,
  autoRotateSpeed: 0.15,
  cameraDistance: 18,
  cardScale: 1,
  enableNebula: true,
  nebulaColor: "#22c55e",
  sparkleColor: "#fbbf24",
  starCount: 4000,
};

/* ── Galaxy Position Calculator ──────────────────────────────────── */

function computeGalaxyPositions(
  count: number,
  config: GalaxyConfig
): Array<{ pos: [number, number, number]; angle: number }> {
  const positions: Array<{ pos: [number, number, number]; angle: number }> = [];

  for (let i = 0; i < count; i++) {
    const arm = i % config.arms;
    const t = (i / count) * Math.PI * 4;
    const armOffset = (arm / config.arms) * Math.PI * 2;
    const radius = (t / (Math.PI * 4)) * config.spread + 2;

    // Spiral with logarithmic falloff for natural galaxy shape
    const angle = t + armOffset;
    const noise = (Math.sin(i * 7.3) * 0.5 + Math.cos(i * 13.7) * 0.5) * 1.2;
    const x = Math.cos(angle) * radius + noise;
    const z = Math.sin(angle) * radius + noise;

    // Y: slight wave pattern + random scatter
    const y = Math.sin(t * 2 + arm * 1.5) * config.verticalSpread * 0.3 +
      (Math.sin(i * 4.1) * 0.5) * config.verticalSpread;

    positions.push({ pos: [x, y, z], angle });
  }

  return positions;
}

/* ── Rarity Color Map ─────────────────────────────────────────────── */

const RARITY_3D_COLORS: Record<Rarity, string> = {
  common: "#6b7280",
  uncommon: "#22c55e",
  rare: "#3b82f6",
  epic: "#a855f7",
  legendary: "#f59e0b",
};

/* ── Main Galaxy Component ────────────────────────────────────────── */

export default function CardGalaxy3D({
  cards,
  renderCard,
  selectedId,
  onSelectCard,
  galaxyConfig,
}: CardGalaxy3DProps) {
  const config = useMemo(
    () => ({ ...DEFAULT_CONFIG, ...galaxyConfig }),
    [galaxyConfig]
  );

  return (
    <div className="w-full h-[600px] rounded-xl overflow-hidden relative bg-black">
      {/* Galaxy label overlay */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <span className="text-[10px] text-gray-600 bg-black/50 backdrop-blur px-2 py-1 rounded-full">
          Drag to orbit • Scroll to zoom • Click a card to select
        </span>
      </div>

      {/* Card count */}
      <div className="absolute top-3 right-3 z-10">
        <span className="text-[10px] text-gray-600 bg-black/50 backdrop-blur px-2 py-1 rounded-full">
          {cards.length} artifacts in galaxy
        </span>
      </div>

      <Canvas
        camera={{ position: [0, 8, config.cameraDistance], fov: 55 }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        style={{ background: "#030308" }}
        dpr={[1, 1.5]}
      >
        <AdaptiveDpr pixelated />
        <Suspense fallback={null}>
          <GalaxyScene
            cards={cards}
            renderCard={renderCard}
            selectedId={selectedId}
            onSelectCard={onSelectCard}
            config={config}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

/* ── Galaxy Scene ─────────────────────────────────────────────────── */

function GalaxyScene({
  cards,
  renderCard,
  selectedId,
  onSelectCard,
  config,
}: {
  cards: GalaxyCardData[];
  renderCard: CardGalaxy3DProps["renderCard"];
  selectedId: string | null;
  onSelectCard: (id: string | null) => void;
  config: GalaxyConfig;
}) {
  const positions = useMemo(
    () => computeGalaxyPositions(cards.length, config),
    [cards.length, config]
  );

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.08} />
      <pointLight position={[0, 15, 0]} color="#f59e0b" intensity={3} distance={40} />
      <pointLight position={[-10, -5, 10]} color="#a855f7" intensity={1.5} distance={30} />
      <pointLight position={[10, -5, -10]} color="#22c55e" intensity={1.5} distance={30} />

      {/* Fog for depth */}
      <fog attach="fog" args={["#030308", 20, 50]} />

      {/* Stars background */}
      <Stars
        radius={80}
        depth={60}
        count={config.starCount}
        factor={4}
        saturation={0.2}
        fade
        speed={0.5}
      />

      {/* Sparkles near center */}
      <Sparkles
        count={200}
        speed={0.3}
        opacity={0.5}
        color={config.sparkleColor}
        size={3}
        scale={25}
        noise={2}
      />

      {/* Central nebula */}
      {config.enableNebula && <GalaxyNebula color={config.nebulaColor} />}

      {/* Galaxy core glow */}
      <GalaxyCore />

      {/* Orbital rings */}
      <OrbitalRing radius={5} color="#22c55e" opacity={0.05} />
      <OrbitalRing radius={9} color="#a855f7" opacity={0.04} />
      <OrbitalRing radius={13} color="#f59e0b" opacity={0.03} />

      {/* Cards */}
      {cards.map((card, i) => {
        const posData = positions[i];
        if (!posData) return null;
        return (
          <GalaxyCardSlot
            key={card.id}
            card={card}
            position={posData.pos}
            index={i}
            isSelected={selectedId === card.id}
            isAnySelected={selectedId !== null}
            renderCard={renderCard}
            onSelect={() => onSelectCard(selectedId === card.id ? null : card.id)}
            config={config}
          />
        );
      })}

      {/* Controls */}
      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        autoRotate
        autoRotateSpeed={config.autoRotateSpeed}
        maxDistance={35}
        minDistance={6}
        dampingFactor={0.05}
        enableDamping
        maxPolarAngle={Math.PI * 0.75}
        minPolarAngle={Math.PI * 0.25}
      />

      {/* Post-processing */}
      <EffectComposer multisampling={0}>
        <Bloom
          luminanceThreshold={0.15}
          luminanceSmoothing={0.9}
          intensity={0.6}
          mipmapBlur
        />
        <Vignette offset={0.3} darkness={0.7} />
      </EffectComposer>
    </>
  );
}

/* ── Individual Card Slot ─────────────────────────────────────────── */

function GalaxyCardSlot({
  card,
  position,
  index,
  isSelected,
  isAnySelected,
  renderCard,
  onSelect,
  config,
}: {
  card: GalaxyCardData;
  position: [number, number, number];
  index: number;
  isSelected: boolean;
  isAnySelected: boolean;
  renderCard: CardGalaxy3DProps["renderCard"];
  onSelect: () => void;
  config: GalaxyConfig;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const [isHovered, setIsHovered] = useState(false);
  const glowColor = card.glowColor || RARITY_3D_COLORS[card.rarity];

  // Animate glow pulse
  useFrame(({ clock }) => {
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      const pulse = Math.sin(clock.elapsedTime * 2 + index * 0.5) * 0.15 + 0.35;
      mat.emissiveIntensity = isSelected ? 0.8 : isHovered ? 0.6 : pulse;
    }
  });

  const floatSpeed = 0.8 + (index % 5) * 0.3;
  const floatIntensity = isSelected ? 0.05 : 0.25;

  return (
    <Float
      speed={floatSpeed}
      floatIntensity={floatIntensity}
      rotationIntensity={isSelected ? 0 : 0.08}
    >
      <group
        ref={groupRef}
        position={position}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onPointerEnter={() => setIsHovered(true)}
        onPointerLeave={() => setIsHovered(false)}
      >
        <Billboard follow lockX={false} lockY={false} lockZ={false}>
          {/* 3D backing card mesh — provides the glow and depth */}
          <mesh ref={meshRef} scale={isSelected ? [1.15, 1.15, 1] : isHovered ? [1.05, 1.05, 1] : [1, 1, 1]}>
            <planeGeometry args={[2.4 * config.cardScale, 3.2 * config.cardScale]} />
            <meshStandardMaterial
              color="#0a0a1a"
              emissive={new THREE.Color(glowColor)}
              emissiveIntensity={0.35}
              transparent
              opacity={isAnySelected && !isSelected ? 0.3 : 0.85}
              side={THREE.DoubleSide}
            />
          </mesh>

          {/* Card border glow */}
          <mesh position={[0, 0, -0.01]} scale={isSelected ? [1.2, 1.2, 1] : [1.02, 1.02, 1]}>
            <planeGeometry args={[2.5 * config.cardScale, 3.3 * config.cardScale]} />
            <meshStandardMaterial
              color={glowColor}
              emissive={new THREE.Color(glowColor)}
              emissiveIntensity={isSelected ? 1.2 : 0.5}
              transparent
              opacity={isSelected ? 0.6 : isHovered ? 0.35 : 0.12}
              side={THREE.DoubleSide}
            />
          </mesh>

          {/* HTML card overlay — real React content in 3D */}
          <Html
            transform
            distanceFactor={5}
            position={[0, 0, 0.02]}
            style={{
              transition: "all 0.3s ease",
              opacity: isAnySelected && !isSelected ? 0.2 : 1,
              pointerEvents: isAnySelected && !isSelected ? "none" : "auto",
            }}
          >
            <div
              className={cn(
                "w-[180px] transition-all duration-300 cursor-pointer select-none",
                isSelected && "scale-105",
                isHovered && !isSelected && "scale-[1.02]"
              )}
              style={{ fontSize: "10px" }}
            >
              {renderCard(card, { isSelected, isHovered })}
            </div>
          </Html>
        </Billboard>

        {/* Point light per card for local glow */}
        <pointLight
          color={glowColor}
          intensity={isSelected ? 3 : isHovered ? 1.5 : 0.4}
          distance={isSelected ? 8 : 4}
          position={[0, 0, 0.5]}
        />
      </group>
    </Float>
  );
}

/* ── Galaxy Core (central glow) ──────────────────────────────────── */

function GalaxyCore() {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.elapsedTime * 0.1;
      ref.current.rotation.z = clock.elapsedTime * 0.05;
      const scale = 1 + Math.sin(clock.elapsedTime * 0.5) * 0.1;
      ref.current.scale.set(scale, scale, scale);
    }
  });

  return (
    <mesh ref={ref} position={[0, 0, 0]}>
      <sphereGeometry args={[1.5, 32, 32]} />
      <MeshDistortMaterial
        color="#f59e0b"
        emissive="#f59e0b"
        emissiveIntensity={0.8}
        transparent
        opacity={0.15}
        distort={0.4}
        speed={2}
        roughness={0}
      />
    </mesh>
  );
}

/* ── Nebula Effect ────────────────────────────────────────────────── */

function GalaxyNebula({ color }: { color: string }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.elapsedTime * 0.02;
    }
  });

  return (
    <mesh ref={ref} position={[0, -0.5, 0]} rotation={[Math.PI * 0.45, 0, 0]}>
      <torusGeometry args={[8, 4, 16, 100]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.15}
        transparent
        opacity={0.04}
        wireframe
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/* ── Orbital Ring ─────────────────────────────────────────────────── */

function OrbitalRing({
  radius,
  color,
  opacity,
}: {
  radius: number;
  color: string;
  opacity: number;
}) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.x = Math.PI * 0.5 + Math.sin(clock.elapsedTime * 0.3) * 0.05;
    }
  });

  return (
    <mesh ref={ref} rotation={[Math.PI * 0.5, 0, 0]}>
      <torusGeometry args={[radius, 0.02, 8, 128]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.5}
        transparent
        opacity={opacity}
      />
    </mesh>
  );
}
