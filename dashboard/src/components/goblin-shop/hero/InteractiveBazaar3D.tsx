"use client";

import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, AdaptiveDpr } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import BazaarStall from "./BazaarStall";
import WalkingGoblin from "./WalkingGoblin";
import DistrictPortal from "./DistrictPortal";
import GoldParticles from "./GoldParticles";

type DistrictKey = string;

interface StallConfig {
  id: DistrictKey;
  position: [number, number, number];
  color: string;
  emissiveColor: string;
  icon: string;
  label: string;
}

const STALL_CONFIGS: StallConfig[] = [
  { id: "forge", position: [-3, 0, 0], color: "#dc2626", emissiveColor: "#ef4444", icon: "⚔️", label: "Forge" },
  { id: "oracle", position: [-1.5, 0, -0.8], color: "#7c3aed", emissiveColor: "#a855f7", icon: "📜", label: "Oracle" },
  { id: "alchemist", position: [0, 0, -1.2], color: "#22c55e", emissiveColor: "#4ade80", icon: "⚗️", label: "Alchemist" },
  { id: "champions", position: [1.5, 0, -0.8], color: "#f59e0b", emissiveColor: "#fbbf24", icon: "🏆", label: "Champions" },
  { id: "vault", position: [3, 0, 0], color: "#3b82f6", emissiveColor: "#60a5fa", icon: "🏦", label: "Vault" },
];

interface InteractiveBazaar3DProps {
  activeDistrict: string;
  onDistrictClick: (district: string) => void;
}

function Scene({ activeDistrict, onDistrictClick }: InteractiveBazaar3DProps) {
  const activeStall = STALL_CONFIGS.find((s) => s.id === activeDistrict);
  const targetPos: [number, number, number] = activeStall
    ? [activeStall.position[0], 0, activeStall.position[2] + 1.5]
    : [0, 0, 2];

  return (
    <>
      <ambientLight intensity={0.25} />
      <pointLight position={[0, 4, 2]} color="#f59e0b" intensity={2} />
      <spotLight position={[0, 6, 0]} angle={0.6} penumbra={0.5} intensity={1.2} color="#fbbf24" />
      <pointLight position={[-4, 2, 0]} color="#ef4444" intensity={0.4} />
      <pointLight position={[4, 2, 0]} color="#3b82f6" intensity={0.4} />
      <fog attach="fog" args={["#0a0a0a", 6, 18]} />

      {/* Stalls */}
      {STALL_CONFIGS.map((stall) => (
        <BazaarStall
          key={stall.id}
          position={stall.position}
          color={stall.color}
          emissiveColor={stall.emissiveColor}
          icon={stall.icon}
          label={stall.label}
          isActive={activeDistrict === stall.id}
          onClick={() => onDistrictClick(stall.id)}
        />
      ))}

      {/* Walking goblin */}
      <WalkingGoblin targetPosition={targetPos} />

      {/* Portal at active stall */}
      {activeStall && (
        <DistrictPortal
          position={[activeStall.position[0], 0.3, activeStall.position[2]]}
          color={activeStall.emissiveColor}
          isActive
        />
      )}

      {/* Gold particles */}
      <GoldParticles />

      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.55, 0]}>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#151515" roughness={1} />
      </mesh>

      {/* Cobblestone path hint */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.54, 0.5]}>
        <planeGeometry args={[8, 3]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
      </mesh>

      <OrbitControls
        autoRotate
        autoRotateSpeed={0.2}
        enableZoom={false}
        enablePan={false}
        maxPolarAngle={Math.PI / 2.2}
        minPolarAngle={Math.PI / 4}
      />

      <EffectComposer>
        <Bloom luminanceThreshold={0.4} intensity={0.7} levels={3} mipmapBlur />
      </EffectComposer>

      <AdaptiveDpr pixelated />
    </>
  );
}

export default function InteractiveBazaar3D({
  activeDistrict,
  onDistrictClick,
}: InteractiveBazaar3DProps) {
  return (
    <div className="w-full h-[280px] sm:h-[220px] relative cursor-pointer">
      <Canvas
        camera={{ position: [0, 3, 7], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        style={{
          background: "linear-gradient(to bottom, #0a0a0a 0%, #14532d10 100%)",
        }}
      >
        <Suspense fallback={null}>
          <Scene activeDistrict={activeDistrict} onDistrictClick={onDistrictClick} />
        </Suspense>
      </Canvas>
      {/* Gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-gray-950 to-transparent pointer-events-none" />
      {/* Interactive hint */}
      <div className="absolute top-3 right-3 text-[10px] text-gray-500 bg-gray-900/50 px-2 py-1 rounded-full backdrop-blur-sm pointer-events-none">
        Click a stall to explore
      </div>
    </div>
  );
}
