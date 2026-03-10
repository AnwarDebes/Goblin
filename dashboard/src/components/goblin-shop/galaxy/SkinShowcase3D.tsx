"use client";

import { Suspense, useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  Stars,
  Sparkles,
  Float,
  Billboard,
  Html,
  MeshDistortMaterial,
  AdaptiveDpr,
  RoundedBox,
} from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { cn } from "@/lib/utils";
import { RARITY_CONFIG } from "@/lib/shop-utils";
import type { DashboardSkin } from "@/types/arena";

interface SkinShowcase3DProps {
  skins: DashboardSkin[];
  selectedSkin: DashboardSkin | null;
  onSelectSkin: (skin: DashboardSkin) => void;
}

/* ── Theme color presets ────────────────────────────────────────── */

const SKIN_THEME_COLORS: Record<string, { primary: string; secondary: string; accent: string }> = {
  "skin-neon": { primary: "#00ff88", secondary: "#ff00ff", accent: "#00ccff" },
  "skin-gold": { primary: "#ffd700", secondary: "#8b0000", accent: "#daa520" },
  "skin-ice": { primary: "#00bfff", secondary: "#e0f7ff", accent: "#87ceeb" },
  "skin-blood": { primary: "#dc143c", secondary: "#2d0a0a", accent: "#8b0000" },
  "skin-matrix": { primary: "#00ff41", secondary: "#003b00", accent: "#00cc33" },
};

const CATEGORY_ICONS: Record<string, string> = {
  theme: "🖥️",
  chart: "📊",
  cursor: "🖱️",
  sound: "🔊",
  frame: "🖼️",
};

export default function SkinShowcase3D({
  skins,
  selectedSkin,
  onSelectSkin,
}: SkinShowcase3DProps) {
  return (
    <div className="w-full h-[500px] rounded-xl overflow-hidden relative bg-black">
      <div className="absolute top-3 left-3 z-10">
        <span className="text-[10px] text-gray-600 bg-black/50 backdrop-blur px-2 py-1 rounded-full">
          Drag to explore • Click skins to preview
        </span>
      </div>

      <Canvas
        camera={{ position: [0, 4, 14], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: "#050510" }}
        dpr={[1, 1.5]}
      >
        <AdaptiveDpr pixelated />
        <Suspense fallback={null}>
          <SkinScene
            skins={skins}
            selectedSkin={selectedSkin}
            onSelectSkin={onSelectSkin}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

function SkinScene({
  skins,
  selectedSkin,
  onSelectSkin,
}: SkinShowcase3DProps) {
  // Arrange skins in a circular carousel
  const positions = useMemo(() => {
    const radius = 8;
    return skins.map((_, i) => {
      const angle = (i / skins.length) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = Math.sin(i * 1.7) * 0.8;
      return [x, y, z] as [number, number, number];
    });
  }, [skins]);

  return (
    <>
      <ambientLight intensity={0.1} />
      <pointLight position={[0, 10, 0]} color="#a855f7" intensity={2} distance={30} />
      <pointLight position={[5, -3, 5]} color="#22c55e" intensity={1} distance={20} />

      <fog attach="fog" args={["#050510", 15, 35]} />

      <Stars radius={60} depth={40} count={2000} factor={3} fade speed={0.3} />
      <Sparkles count={100} speed={0.2} opacity={0.4} color="#a855f7" size={2} scale={20} />

      {/* Central display pedestal */}
      <CentralPedestal selectedSkin={selectedSkin} />

      {/* Skin cards */}
      {skins.map((skin, i) => (
        <Float key={skin.id} speed={0.8} floatIntensity={0.2} rotationIntensity={0.05}>
          <SkinCard3D
            skin={skin}
            position={positions[i]}
            isSelected={selectedSkin?.id === skin.id}
            onClick={() => onSelectSkin(skin)}
          />
        </Float>
      ))}

      <OrbitControls
        autoRotate
        autoRotateSpeed={0.3}
        enableDamping
        dampingFactor={0.05}
        maxDistance={25}
        minDistance={6}
        maxPolarAngle={Math.PI * 0.7}
        minPolarAngle={Math.PI * 0.3}
      />

      <EffectComposer multisampling={0}>
        <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} intensity={0.5} mipmapBlur />
        <Vignette offset={0.3} darkness={0.6} />
      </EffectComposer>
    </>
  );
}

function SkinCard3D({
  skin,
  position,
  isSelected,
  onClick,
}: {
  skin: DashboardSkin;
  position: [number, number, number];
  isSelected: boolean;
  onClick: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const config = RARITY_CONFIG[skin.rarity];
  const glowColor = config.glowColor;

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      const pulse = Math.sin(clock.elapsedTime * 2) * 0.15 + 0.3;
      mat.emissiveIntensity = isSelected ? 0.9 : pulse;
    }
  });

  return (
    <group position={position} onClick={(e) => { e.stopPropagation(); onClick(); }}>
      <Billboard>
        <mesh ref={meshRef} scale={isSelected ? [1.15, 1.15, 1] : [1, 1, 1]}>
          <planeGeometry args={[2, 2.6]} />
          <meshStandardMaterial
            color="#0a0a1a"
            emissive={new THREE.Color(glowColor)}
            emissiveIntensity={0.3}
            transparent
            opacity={0.85}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Border glow */}
        <mesh position={[0, 0, -0.01]}>
          <planeGeometry args={[2.1, 2.7]} />
          <meshStandardMaterial
            color={glowColor}
            emissive={new THREE.Color(glowColor)}
            emissiveIntensity={isSelected ? 1 : 0.4}
            transparent
            opacity={isSelected ? 0.5 : 0.1}
            side={THREE.DoubleSide}
          />
        </mesh>

        <Html transform distanceFactor={5} position={[0, 0, 0.02]}>
          <div
            className={cn(
              "w-[150px] rounded-lg overflow-hidden cursor-pointer transition-all",
              isSelected && "ring-1 ring-white/30"
            )}
            style={{
              background: "linear-gradient(135deg, rgba(10,10,26,0.95), rgba(15,10,25,0.9))",
              boxShadow: isSelected ? `0 0 15px ${glowColor}` : "none",
              fontSize: "10px",
            }}
          >
            {/* Preview */}
            <div
              className="w-full h-16 flex items-center justify-center"
              style={{ background: `radial-gradient(circle, ${glowColor}40, transparent)` }}
            >
              <span className="text-3xl">{skin.preview}</span>
            </div>
            <div className="p-2">
              <h4 className="text-[9px] font-bold text-white truncate">{skin.name}</h4>
              <div className="flex items-center justify-between mt-1">
                <span className={cn("text-[7px] font-medium", config.color)}>
                  {config.icon} {config.label}
                </span>
                <span className="text-[7px] text-gray-500 capitalize">
                  {CATEGORY_ICONS[skin.category]} {skin.category}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1 pt-1 border-t border-gray-800/50">
                <span className="text-[8px] text-gold-400 font-bold">💰 {skin.cost}</span>
                {skin.isOwned && (
                  <span className="text-[7px] text-goblin-400">Owned</span>
                )}
              </div>
            </div>
          </div>
        </Html>

        <pointLight
          color={glowColor}
          intensity={isSelected ? 2 : 0.3}
          distance={isSelected ? 6 : 3}
          position={[0, 0, 0.5]}
        />
      </Billboard>
    </group>
  );
}

function CentralPedestal({ selectedSkin }: { selectedSkin: DashboardSkin | null }) {
  const ref = useRef<THREE.Mesh>(null);
  const themeColors = selectedSkin ? SKIN_THEME_COLORS[selectedSkin.id] : null;

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.elapsedTime * 0.3;
      const scale = 1 + Math.sin(clock.elapsedTime) * 0.05;
      ref.current.scale.set(scale, scale, scale);
    }
  });

  return (
    <group position={[0, -1, 0]}>
      {/* Pedestal */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI * 0.5, 0, 0]}>
        <cylinderGeometry args={[2, 2.5, 0.3, 32]} />
        <meshStandardMaterial
          color="#1a1a2e"
          emissive={themeColors?.primary || "#a855f7"}
          emissiveIntensity={0.2}
          transparent
          opacity={0.6}
        />
      </mesh>

      {/* Floating preview */}
      {selectedSkin && (
        <mesh ref={ref} position={[0, 2, 0]}>
          <sphereGeometry args={[1, 32, 32]} />
          <MeshDistortMaterial
            color={themeColors?.primary || "#a855f7"}
            emissive={themeColors?.secondary || "#a855f7"}
            emissiveIntensity={0.6}
            transparent
            opacity={0.3}
            distort={0.5}
            speed={3}
            roughness={0}
          />
        </mesh>
      )}

      {/* Selected skin info */}
      {selectedSkin && (
        <Html position={[0, 4.5, 0]} center>
          <div className="text-center whitespace-nowrap">
            <span className="text-3xl block">{selectedSkin.preview}</span>
            <span className="text-sm font-bold text-white block mt-1">{selectedSkin.name}</span>
            <span className="text-[10px] text-gray-400 block">{selectedSkin.description}</span>
          </div>
        </Html>
      )}
    </group>
  );
}
