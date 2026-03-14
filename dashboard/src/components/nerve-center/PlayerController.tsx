"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useNerveCenterStore } from "./NerveCenterStore";
import { ZONES } from "./zones/ZoneConfig";
import type { ZoneId } from "./zones/ZoneConfig";

/* ── Constants ─────────────────────────────────────────────────────── */
const MOVE_SPEED = 12;
const SPRINT_SPEED = 20;
const MOUSE_SENSITIVITY = 0.003;
const TOUCH_SENSITIVITY = 0.005;
const CAM_DISTANCE = 10;
const CAM_HEIGHT = 5;
const CAM_MIN_V = 0.05;
const CAM_MAX_V = 0.85;
const PLAYER_Y = 0; // ground level
const AUTO_WALK_SPEED = 14;
const AUTO_WALK_STOP_DIST = 2;
const WORLD_BOUND = 45; // keep player within this radius
const JOYSTICK_DEAD_ZONE = 0.15;

/* ── Pre-allocated vectors ─────────────────────────────────────────── */
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _move = new THREE.Vector3();
const _camPos = new THREE.Vector3();
const _lookAt = new THREE.Vector3();
const _zoneVec = new THREE.Vector3();
const _autoDir = new THREE.Vector3();

/* ── Input tracking ────────────────────────────────────────────────── */
const keys: Record<string, boolean> = {};

/* ── Touch input tracking ──────────────────────────────────────────── */
const touchInput = { moveX: 0, moveY: 0, lookDX: 0, lookDY: 0 };

/* ── Skin palette ──────────────────────────────────────────────────── */
const SKIN = "#6dd676";
const SKIN_DARK = "#4abe54";

/* ── King Goblin Model (the player character) ──────────────────────── */
function KingGoblin() {
  const groupRef = useRef<THREE.Group>(null);
  const legPhaseRef = useRef(0);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    // Simple walk animation: bob legs when moving
    const isMoving = keys["w"] || keys["a"] || keys["s"] || keys["d"] ||
                     keys["arrowup"] || keys["arrowleft"] || keys["arrowdown"] || keys["arrowright"];
    if (isMoving) {
      legPhaseRef.current += delta * 10;
    } else {
      // Ease back to rest
      legPhaseRef.current *= 0.9;
    }
    const legSwing = Math.sin(legPhaseRef.current) * 0.4;
    // Left leg
    const leftLeg = groupRef.current.children.find((c) => c.userData.id === "leftLeg");
    const rightLeg = groupRef.current.children.find((c) => c.userData.id === "rightLeg");
    if (leftLeg) leftLeg.rotation.x = legSwing;
    if (rightLeg) rightLeg.rotation.x = -legSwing;

    // Arm swing
    const leftArm = groupRef.current.children.find((c) => c.userData.id === "leftArm");
    const rightArm = groupRef.current.children.find((c) => c.userData.id === "rightArm");
    if (leftArm) leftArm.rotation.x = -legSwing * 0.5;
    if (rightArm) rightArm.rotation.x = legSwing * 0.5;
  });

  return (
    <group ref={groupRef}>
      {/* Platform glow ring */}
      <mesh position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1, 0.06, 8, 24]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={1.5} />
      </mesh>

      {/* Legs */}
      <group position={[-0.18, 0.35, 0]} userData={{ id: "leftLeg" }}>
        <mesh>
          <capsuleGeometry args={[0.09, 0.35, 4, 8]} />
          <meshStandardMaterial color={SKIN_DARK} />
        </mesh>
        {/* Boot */}
        <mesh position={[0, -0.25, 0.05]}>
          <boxGeometry args={[0.12, 0.1, 0.18]} />
          <meshStandardMaterial color="#78350f" />
        </mesh>
      </group>
      <group position={[0.18, 0.35, 0]} userData={{ id: "rightLeg" }}>
        <mesh>
          <capsuleGeometry args={[0.09, 0.35, 4, 8]} />
          <meshStandardMaterial color={SKIN_DARK} />
        </mesh>
        <mesh position={[0, -0.25, 0.05]}>
          <boxGeometry args={[0.12, 0.1, 0.18]} />
          <meshStandardMaterial color="#78350f" />
        </mesh>
      </group>

      {/* Torso — Royal armor */}
      <mesh position={[0, 0.95, 0]}>
        <capsuleGeometry args={[0.32, 0.45, 4, 8]} />
        <meshStandardMaterial color="#92400e" metalness={0.5} roughness={0.3} />
      </mesh>
      {/* Chest plate */}
      <mesh position={[0, 1, 0.2]}>
        <boxGeometry args={[0.35, 0.3, 0.08]} />
        <meshStandardMaterial color="#fbbf24" metalness={0.9} roughness={0.1} emissive="#f59e0b" emissiveIntensity={0.3} />
      </mesh>

      {/* Cape */}
      <mesh position={[0, 0.95, -0.25]} rotation={[0.15, 0, 0]}>
        <planeGeometry args={[0.55, 0.8]} />
        <meshStandardMaterial color="#7c2d12" side={THREE.DoubleSide} />
      </mesh>

      {/* Arms */}
      <group position={[-0.48, 0.95, 0]} rotation={[0, 0, 0.3]} userData={{ id: "leftArm" }}>
        <mesh>
          <capsuleGeometry args={[0.09, 0.38, 4, 8]} />
          <meshStandardMaterial color={SKIN} />
        </mesh>
        {/* Gauntlet */}
        <mesh position={[0, -0.22, 0]}>
          <cylinderGeometry args={[0.1, 0.08, 0.12, 6]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.2} />
        </mesh>
      </group>
      <group position={[0.48, 0.95, 0]} rotation={[0, 0, -0.3]} userData={{ id: "rightArm" }}>
        <mesh>
          <capsuleGeometry args={[0.09, 0.38, 4, 8]} />
          <meshStandardMaterial color={SKIN} />
        </mesh>
        {/* Sword */}
        <mesh position={[0, -0.15, 0.1]} rotation={[0.5, 0, -0.1]}>
          <boxGeometry args={[0.04, 0.75, 0.02]} />
          <meshStandardMaterial color="#e5e7eb" metalness={0.95} roughness={0.05} />
        </mesh>
        <mesh position={[0, -0.5, 0.1]} rotation={[0.5, 0, -0.1]}>
          <boxGeometry args={[0.15, 0.04, 0.04]} />
          <meshStandardMaterial color="#78350f" />
        </mesh>
      </group>

      {/* Head */}
      <mesh position={[0, 1.6, 0]}>
        <sphereGeometry args={[0.38, 12, 12]} />
        <meshStandardMaterial color={SKIN} />
      </mesh>

      {/* Ears */}
      <mesh position={[-0.42, 1.72, 0]} rotation={[0, 0, -0.8]}>
        <coneGeometry args={[0.08, 0.32, 4]} />
        <meshStandardMaterial color={SKIN} />
      </mesh>
      <mesh position={[0.42, 1.72, 0]} rotation={[0, 0, 0.8]}>
        <coneGeometry args={[0.08, 0.32, 4]} />
        <meshStandardMaterial color={SKIN} />
      </mesh>

      {/* Eyes */}
      <mesh position={[-0.13, 1.65, 0.32]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshStandardMaterial color="white" />
      </mesh>
      <mesh position={[0.13, 1.65, 0.32]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshStandardMaterial color="white" />
      </mesh>
      <mesh position={[-0.13, 1.65, 0.38]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>
      <mesh position={[0.13, 1.65, 0.38]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>

      {/* Nose */}
      <mesh position={[0, 1.55, 0.38]}>
        <sphereGeometry args={[0.06, 6, 6]} />
        <meshStandardMaterial color={SKIN_DARK} />
      </mesh>

      {/* Grin */}
      <mesh position={[0, 1.47, 0.35]} rotation={[0.2, 0, 0]}>
        <torusGeometry args={[0.08, 0.015, 4, 8, Math.PI]} />
        <meshStandardMaterial color="#2d5a30" />
      </mesh>

      {/* ── CROWN ── */}
      <mesh position={[0, 2.05, 0]}>
        <torusGeometry args={[0.28, 0.06, 4, 8]} />
        <meshStandardMaterial color="#fbbf24" metalness={0.95} roughness={0.05} emissive="#f59e0b" emissiveIntensity={0.6} />
      </mesh>
      {/* Crown points */}
      {[0, 1.05, 2.1, 3.15, 4.2, 5.25].map((a, i) => (
        <mesh key={i} position={[Math.cos(a) * 0.28, 2.15, Math.sin(a) * 0.28]}>
          <coneGeometry args={[0.05, 0.18, 4]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.95} roughness={0.05} emissive="#f59e0b" emissiveIntensity={0.5} />
        </mesh>
      ))}
      {/* Crown jewel */}
      <mesh position={[0, 2.22, 0.28]}>
        <octahedronGeometry args={[0.06]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={1} />
      </mesh>

      {/* Spotlight below player */}
      <pointLight position={[0, 3, 0]} color="#fbbf24" intensity={1.5} distance={8} decay={2} />
    </group>
  );
}

/* ── Virtual Joystick (mobile controls) ────────────────────────────── */
function VirtualJoystick() {
  const knobRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLDivElement>(null);
  const activeTouch = useRef<number | null>(null);
  const baseRect = useRef<{ cx: number; cy: number; r: number }>({ cx: 0, cy: 0, r: 0 });

  const handleStart = useCallback((e: React.TouchEvent) => {
    if (activeTouch.current !== null) return;
    const touch = e.changedTouches[0];
    activeTouch.current = touch.identifier;
    const base = baseRef.current;
    if (base) {
      const rect = base.getBoundingClientRect();
      baseRect.current = { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2, r: rect.width / 2 };
    }
    useNerveCenterStore.setState({ isPlaying: true });
  }, []);

  const handleMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier !== activeTouch.current) continue;
      const { cx, cy, r } = baseRect.current;
      let dx = (touch.clientX - cx) / r;
      let dy = (touch.clientY - cy) / r;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 1) { dx /= len; dy /= len; }
      if (len < JOYSTICK_DEAD_ZONE) { dx = 0; dy = 0; }
      touchInput.moveX = dx;
      touchInput.moveY = dy;
      if (knobRef.current) {
        knobRef.current.style.transform = `translate(${dx * r * 0.7}px, ${dy * r * 0.7}px)`;
      }
    }
  }, []);

  const handleEnd = useCallback((e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeTouch.current) {
        activeTouch.current = null;
        touchInput.moveX = 0;
        touchInput.moveY = 0;
        if (knobRef.current) knobRef.current.style.transform = "translate(0px, 0px)";
      }
    }
  }, []);

  return (
    <div
      ref={baseRef}
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
      onTouchCancel={handleEnd}
      className="absolute bottom-6 left-6 w-28 h-28 sm:w-32 sm:h-32 rounded-full border-2 border-amber-500/30 bg-gray-950/40 backdrop-blur-sm flex items-center justify-center pointer-events-auto touch-none z-20"
    >
      <div
        ref={knobRef}
        className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-amber-500/50 border-2 border-amber-400/60 shadow-lg shadow-amber-500/20"
      />
    </div>
  );
}

/* ── Touch Look Area (right side of screen for camera) ─────────────── */
function TouchLookArea() {
  const lastTouch = useRef<{ x: number; y: number } | null>(null);
  const activeId = useRef<number | null>(null);

  const handleStart = useCallback((e: React.TouchEvent) => {
    if (activeId.current !== null) return;
    const touch = e.changedTouches[0];
    activeId.current = touch.identifier;
    lastTouch.current = { x: touch.clientX, y: touch.clientY };
    useNerveCenterStore.setState({ isPlaying: true });
  }, []);

  const handleMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier !== activeId.current || !lastTouch.current) continue;
      const dx = touch.clientX - lastTouch.current.x;
      const dy = touch.clientY - lastTouch.current.y;
      lastTouch.current = { x: touch.clientX, y: touch.clientY };
      const state = useNerveCenterStore.getState();
      const newH = state.cameraAngleH + dx * TOUCH_SENSITIVITY;
      const newV = Math.max(CAM_MIN_V, Math.min(CAM_MAX_V, state.cameraAngleV + dy * TOUCH_SENSITIVITY));
      useNerveCenterStore.setState({ cameraAngleH: newH, cameraAngleV: newV });
    }
  }, []);

  const handleEnd = useCallback((e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeId.current) {
        activeId.current = null;
        lastTouch.current = null;
      }
    }
  }, []);

  return (
    <div
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
      onTouchCancel={handleEnd}
      className="absolute top-0 right-0 w-1/2 h-full pointer-events-auto touch-none z-10"
    />
  );
}

/* ── Mobile Touch Controls Overlay (rendered outside Canvas) ───────── */
export function MobileTouchControls() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile("ontouchstart" in window && window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (!isMobile) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      <TouchLookArea />
      <VirtualJoystick />
    </div>
  );
}

/* ── Main PlayerController ─────────────────────────────────────────── */
export default function PlayerController() {
  const { gl, camera } = useThree();
  const playerRef = useRef<THREE.Group>(null);
  const store = useNerveCenterStore;

  // Keyboard handlers
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      keys[e.key.toLowerCase()] = true;

      // Zone navigation shortcuts (0-6)
      const key = e.key;
      if (key === "0") store.getState().setActiveZone("overview");
      else if (key === "1") store.getState().setActiveZone("treasury");
      else if (key === "2") store.getState().setActiveZone("warRoom");
      else if (key === "3") store.getState().setActiveZone("marketSquare");
      else if (key === "4") store.getState().setActiveZone("oracleTower");
      else if (key === "5") store.getState().setActiveZone("wizardAcademy");
      else if (key === "6") store.getState().setActiveZone("guardTower");
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.key.toLowerCase()] = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // Pointer lock for mouse look (desktop only)
  const requestPointerLock = useCallback(() => {
    // Skip pointer lock on touch devices
    if ("ontouchstart" in window && window.innerWidth < 1024) return;
    gl.domElement.requestPointerLock();
  }, [gl]);

  useEffect(() => {
    const canvas = gl.domElement;

    const onMouseDown = (e: MouseEvent) => {
      // Right-click or left-click to lock pointer
      if (!document.pointerLockElement) {
        requestPointerLock();
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      const state = store.getState();
      // Mouse right → angleH increases → look right (standard FPS/TPS convention)
      const newH = state.cameraAngleH + e.movementX * MOUSE_SENSITIVITY;
      const newV = Math.max(CAM_MIN_V, Math.min(CAM_MAX_V, state.cameraAngleV + e.movementY * MOUSE_SENSITIVITY));
      store.setState({ cameraAngleH: newH, cameraAngleV: newV });
    };

    const onLockChange = () => {
      store.setState({ isPlaying: !!document.pointerLockElement });
    };

    canvas.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("pointerlockchange", onLockChange);

    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("pointerlockchange", onLockChange);
    };
  }, [gl, store, requestPointerLock]);

  // Main game loop
  useFrame((_, delta) => {
    const state = store.getState();
    const pp = state.playerPosition;
    let px = pp[0];
    let pz = pp[2];
    const angleH = state.cameraAngleH;
    const angleV = state.cameraAngleV;
    let moved = false;

    // Calculate camera-relative directions (standard TPS convention)
    // angleH=0 → forward=(0,0,-1), angleH increases → look right
    _forward.set(Math.sin(angleH), 0, -Math.cos(angleH)).normalize();
    _right.set(-_forward.z, 0, _forward.x); // perpendicular right on XZ plane

    // Auto-walk to target
    const target = state.walkToTarget;
    if (target) {
      _autoDir.set(target[0] - px, 0, target[2] - pz);
      const dist = _autoDir.length();
      if (dist < AUTO_WALK_STOP_DIST) {
        store.setState({ walkToTarget: null });
      } else {
        _autoDir.normalize();
        px += _autoDir.x * AUTO_WALK_SPEED * delta;
        pz += _autoDir.z * AUTO_WALK_SPEED * delta;
        moved = true;
        // Face movement direction
        const targetRot = Math.atan2(_autoDir.x, _autoDir.z);
        store.setState({ playerRotation: targetRot });
      }
    }

    // WASD / Arrow key / Touch joystick movement (overrides auto-walk)
    const isSprinting = keys["shift"];
    const speed = (isSprinting ? SPRINT_SPEED : MOVE_SPEED) * delta;
    _move.set(0, 0, 0);

    if (keys["w"] || keys["arrowup"]) _move.add(_forward);
    if (keys["s"] || keys["arrowdown"]) _move.sub(_forward);
    if (keys["a"] || keys["arrowleft"]) _move.sub(_right);
    if (keys["d"] || keys["arrowright"]) _move.add(_right);

    // Touch joystick input (Y is inverted: up = negative = forward)
    if (Math.abs(touchInput.moveX) > JOYSTICK_DEAD_ZONE || Math.abs(touchInput.moveY) > JOYSTICK_DEAD_ZONE) {
      _move.addScaledVector(_forward, -touchInput.moveY);
      _move.addScaledVector(_right, touchInput.moveX);
    }

    if (_move.lengthSq() > 0) {
      // Cancel auto-walk when player manually moves
      if (state.walkToTarget) store.setState({ walkToTarget: null });

      _move.normalize().multiplyScalar(speed);
      px += _move.x;
      pz += _move.z;
      moved = true;

      // Face movement direction
      const targetRot = Math.atan2(_move.x, _move.z);
      // Smooth rotation
      let currentRot = state.playerRotation;
      let diff = targetRot - currentRot;
      // Normalize to -PI..PI
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const newRot = currentRot + diff * Math.min(1, delta * 10);
      store.setState({ playerRotation: newRot });
    }

    // Clamp to world bounds
    const distFromCenter = Math.sqrt(px * px + pz * pz);
    if (distFromCenter > WORLD_BOUND) {
      const scale = WORLD_BOUND / distFromCenter;
      px *= scale;
      pz *= scale;
    }

    // Update player position
    if (moved) {
      state.playerPosition[0] = px;
      state.playerPosition[1] = PLAYER_Y;
      state.playerPosition[2] = pz;
    }

    // Update player mesh
    if (playerRef.current) {
      playerRef.current.position.set(px, PLAYER_Y, pz);
      playerRef.current.rotation.y = state.playerRotation;
    }

    // Third-person camera — placed BEHIND the player
    // Behind direction = opposite of forward = (-sin(angleH), 0, cos(angleH))
    const camDist = CAM_DISTANCE;
    const camHeight = CAM_HEIGHT + angleV * 6;
    _camPos.set(
      px - Math.sin(angleH) * camDist,
      PLAYER_Y + camHeight,
      pz + Math.cos(angleH) * camDist
    );

    // Look at point (slightly above player)
    _lookAt.set(px, PLAYER_Y + 1.5, pz);

    // Set camera position directly — no lerp so 360° rotation is instant and smooth
    camera.position.copy(_camPos);
    camera.lookAt(_lookAt);

    // Update camera world position for minimap
    state.cameraWorldPos[0] = px;
    state.cameraWorldPos[1] = PLAYER_Y;
    state.cameraWorldPos[2] = pz;

    // Zone proximity detection (based on player position)
    let closest: ZoneId | null = null;
    let closestDist = Infinity;
    for (const zone of ZONES) {
      _zoneVec.set(zone.position[0], 0, zone.position[2]);
      const d = Math.sqrt((px - _zoneVec.x) ** 2 + (pz - _zoneVec.z) ** 2);
      if (d < zone.proximityRadius && d < closestDist) {
        closest = zone.id;
        closestDist = d;
      }
    }
    state.setNearestZone(closest);
  });

  return (
    <group ref={playerRef} position={[0, PLAYER_Y, 30]}>
      <KingGoblin />
      {/* Name label above player */}
      <Html position={[0, 3, 0]} distanceFactor={12} center style={{ pointerEvents: "none" }}>
        <div className="text-center select-none">
          <div className="bg-gradient-to-r from-amber-900/90 to-yellow-900/90 backdrop-blur border border-amber-500/50 rounded-lg px-3 py-1 shadow-xl">
            <div className="text-amber-300 text-xs font-black">Goblin King</div>
            <div className="text-[9px] text-amber-200/60 italic">Ruler of the Kingdom</div>
          </div>
        </div>
      </Html>
    </group>
  );
}
