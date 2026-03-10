"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const PARTICLE_COUNT = 60;

export default function GoldParticles() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const particles = useMemo(() => {
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      x: ((i * 7.3) % 8) - 4,
      y: ((i * 3.7) % 6) - 1,
      z: ((i * 5.1) % 6) - 3,
      speed: 0.2 + ((i * 2.3) % 5) * 0.1,
      phase: (i * 1.7) % (Math.PI * 2),
    }));
  }, []);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = particles[i];
      const y = ((p.y + t * p.speed) % 6) - 1;
      dummy.position.set(
        p.x + Math.sin(t * 0.5 + p.phase) * 0.3,
        y,
        p.z + Math.cos(t * 0.5 + p.phase) * 0.3
      );
      dummy.scale.setScalar(0.6 + Math.sin(t * 2 + p.phase) * 0.3);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, PARTICLE_COUNT]}>
      <sphereGeometry args={[0.015, 4, 4]} />
      <meshStandardMaterial
        color="#fbbf24"
        emissive="#fbbf24"
        emissiveIntensity={2}
        transparent
        opacity={0.8}
      />
    </instancedMesh>
  );
}
