"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, AdaptiveDpr } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import GoblinMerchant from "./GoblinMerchant";
import FloatingShopItems from "./FloatingShopItems";
import GoldParticles from "./GoldParticles";

function Scene() {
  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 3, 2]} color="#f59e0b" intensity={2} />
      <spotLight
        position={[0, 5, 0]}
        angle={0.5}
        penumbra={0.5}
        intensity={1.5}
        color="#fbbf24"
        castShadow={false}
      />
      <fog attach="fog" args={["#0a0a0a", 5, 15]} />

      <GoblinMerchant />
      <FloatingShopItems />
      <GoldParticles />

      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]}>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#1a1a1a" roughness={1} />
      </mesh>

      <OrbitControls
        autoRotate
        autoRotateSpeed={0.3}
        enableZoom={false}
        enablePan={false}
        maxPolarAngle={Math.PI / 2.2}
        minPolarAngle={Math.PI / 4}
      />

      <EffectComposer>
        <Bloom luminanceThreshold={0.5} intensity={0.6} levels={3} mipmapBlur />
      </EffectComposer>

      <AdaptiveDpr pixelated />
    </>
  );
}

export default function BazaarHero3D() {
  return (
    <div className="w-full h-[280px] md:h-[280px] sm:h-[200px] relative">
      <Canvas
        camera={{ position: [0, 2, 6], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "linear-gradient(to bottom, #0a0a0a 0%, #14532d10 100%)" }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
      {/* Gradient fade at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-gray-950 to-transparent pointer-events-none" />
    </div>
  );
}
