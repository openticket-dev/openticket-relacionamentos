"use client";

/**
 * W3D-RELACIONAMENTOS — Tier 3 Love Sphere Scene
 *
 * Vertical config (OT-W3D-PATTERN-SPEC §3 relacionamentos):
 *   icon 💕 · accent #f0abfc · bg 0x07060d · fog 0x0d0a18 d=0.024
 *   cam pos [0,6,24] rot 0.22 · bpm 80 (romantic, no strobe)
 *
 * Hero: central heart (ExtrudeGeometry fuchsia emissive) + 2.5k profiles on sphere
 *       + 12 match lines randomized
 * Crowd: 800 cherry blossoms falling parabolic + 400 sparkles flickering
 * Lighting: heart glow (fuchsia 15W) + soft ambient (dark purple)
 * LED: Bumble (amber #fbbf24, honeycomb pattern, "bumble night sp")
 *
 * Tier 3 (default): R3F 9 + Three r0.184 + emissive bloom stack
 * Tier 2 fallback: reduced particle counts + simplified lighting
 */

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState, useEffect, Suspense } from "react";
import type {
  Group,
  Points,
  BufferGeometry,
  Shape,
  CanvasTexture,
  LineSegments,
} from "three";
import * as THREE from "three";

// ---------------------------------------------------------------------------
// Config (OT-W3D-PATTERN-SPEC §1 + §3 relacionamentos)
// ---------------------------------------------------------------------------

const REL_CONFIG = {
  icon: "💕",
  accent: "#f0abfc",
  bg: 0x07060d,
  fog: { color: 0x0d0a18, density: 0.024 },
  cam: { position: [0, 6, 24] as [number, number, number], rotateSpeed: 0.22 },
  bpm: 80,
  heartRed: "#d946ef",
  heartEmissive: "#e879f9",
  blossomPink: "#f0abfc",
  sparkleGold: "#f5d0fe",
  matchLineColor: "#e879f9",
  bumbleYellow: "#fbbf24",
} as const;

// Heartbeat helper — beat = pow(sin(beatPhase*PI), 16) (per spec §2)
function beatValue(time: number, bpm: number): number {
  if (bpm === 0) return 0;
  const beatPhase = (time * bpm) / 60;
  const p = Math.sin(beatPhase * Math.PI);
  return Math.pow(Math.max(0, p), 16);
}

// ---------------------------------------------------------------------------
// Heart Shape (ExtrudeGeometry) — built once, memoized
// ---------------------------------------------------------------------------

function makeHeartShape(): Shape {
  const shape = new THREE.Shape();
  // Classic heart curve, oriented Y-up at origin
  // Reference: parametric heart curve scaled to ~3m
  const x = 0,
    y = 0;
  shape.moveTo(x + 0, y + 0.5);
  shape.bezierCurveTo(x + 0, y + 0.5, x - 0.6, y + 1.2, x - 1.2, y + 0.6);
  shape.bezierCurveTo(x - 2.0, y - 0.1, x - 1.6, y - 0.9, x + 0, y - 1.8);
  shape.bezierCurveTo(x + 1.6, y - 0.9, x + 2.0, y - 0.1, x + 1.2, y + 0.6);
  shape.bezierCurveTo(x + 0.6, y + 1.2, x + 0, y + 0.5, x + 0, y + 0.5);
  return shape;
}

// ---------------------------------------------------------------------------
// Hero Heart: scale-pulses on BPM 80 beat
// ---------------------------------------------------------------------------

function HeartHero() {
  const group = useRef<Group>(null);
  const heartShape = useMemo(() => makeHeartShape(), []);
  const extrudeOpts = useMemo(
    () => ({
      depth: 0.6,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 2,
      bevelSize: 0.18,
      bevelThickness: 0.18,
      curveSegments: 24,
    }),
    [],
  );

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.getElapsedTime();
    const beat = beatValue(t, REL_CONFIG.bpm);
    // Heartbeat: scale pulse 1.0 → 1.18 on beat
    const scale = 1.0 + beat * 0.18;
    group.current.scale.set(scale, scale, scale);
    // Slow rotation
    group.current.rotation.y = t * 0.18;
    // Hover float
    group.current.position.y = 6 + Math.sin(t * 0.6) * 0.25;
  });

  return (
    <group ref={group} position={[0, 6, 0]} rotation={[Math.PI, 0, 0]}>
      <mesh castShadow>
        <extrudeGeometry args={[heartShape, extrudeOpts]} />
        <meshStandardMaterial
          color={REL_CONFIG.heartRed}
          emissive={REL_CONFIG.heartEmissive}
          emissiveIntensity={0.85}
          metalness={0.4}
          roughness={0.35}
        />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Profile Cloud — 2.5k profiles distributed on a sphere around the heart
// ---------------------------------------------------------------------------

function ProfileCloud({ count = 2500 }: { count?: number }) {
  const ref = useRef<Points>(null);

  const { positions, phases } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const radius = 10;
    for (let i = 0; i < count; i++) {
      // Uniform sphere sampling (golden spiral)
      const phi = Math.acos(1 - (2 * (i + 0.5)) / count);
      const theta = Math.PI * (1 + Math.sqrt(5)) * (i + 0.5);
      const r = radius + (Math.random() - 0.5) * 1.2;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi) + 6; // center on heart Y
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      phases[i] = Math.random() * Math.PI * 2;
    }
    return { positions, phases };
  }, [count]);

  // Color buffer — pink with subtle variation
  const colors = useMemo(() => {
    const arr = new Float32Array(count * 3);
    const base = new THREE.Color(REL_CONFIG.accent);
    const alt = new THREE.Color(REL_CONFIG.blossomPink);
    for (let i = 0; i < count; i++) {
      const mix = Math.random();
      const c = base.clone().lerp(alt, mix);
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    return arr;
  }, [count]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    // Whole sphere slowly orbits
    ref.current.rotation.y = t * 0.05;
    // Twinkle via material opacity oscillation (cheap, GPU-friendly)
    const mat = ref.current.material as THREE.PointsMaterial;
    if (mat) {
      mat.opacity = 0.75 + Math.sin(t * 1.4) * 0.15;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
          count={colors.length / 3}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.16}
        vertexColors
        transparent
        opacity={0.85}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// ---------------------------------------------------------------------------
// Match Lines — 12 randomized lines between profile points, regenerate every 4s
// ---------------------------------------------------------------------------

function MatchLines({ count = 12 }: { count?: number }) {
  const ref = useRef<LineSegments>(null);

  const generateEndpoints = useMemo(() => {
    return (): Float32Array => {
      // 12 line segments → 24 vertices
      const positions = new Float32Array(count * 2 * 3);
      const radius = 10;
      for (let i = 0; i < count; i++) {
        // Two random points on the sphere
        for (let v = 0; v < 2; v++) {
          const u = Math.random();
          const phi = Math.acos(1 - 2 * u);
          const theta = Math.random() * Math.PI * 2;
          positions[(i * 2 + v) * 3] = radius * Math.sin(phi) * Math.cos(theta);
          positions[(i * 2 + v) * 3 + 1] = radius * Math.cos(phi) + 6;
          positions[(i * 2 + v) * 3 + 2] =
            radius * Math.sin(phi) * Math.sin(theta);
        }
      }
      return positions;
    };
  }, [count]);

  const [positions, setPositions] = useState<Float32Array>(() =>
    generateEndpoints(),
  );

  // Regenerate match lines every 4s
  useEffect(() => {
    const id = setInterval(() => {
      setPositions(generateEndpoints());
    }, 4000);
    return () => clearInterval(id);
  }, [generateEndpoints]);

  // Pulse opacity on heartbeat
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const beat = beatValue(t, REL_CONFIG.bpm);
    const mat = ref.current.material as THREE.LineBasicMaterial;
    if (mat) {
      mat.opacity = 0.35 + beat * 0.5;
    }
  });

  return (
    <lineSegments ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial
        color={REL_CONFIG.matchLineColor}
        transparent
        opacity={0.5}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </lineSegments>
  );
}

// ---------------------------------------------------------------------------
// Blossom Fall — 800 cherry blossoms falling on parabolic paths
// ---------------------------------------------------------------------------

function BlossomFall({ count = 800 }: { count?: number }) {
  const ref = useRef<Points>(null);

  const { initial, phases, fallRates } = useMemo(() => {
    const initial = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const fallRates = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      initial[i * 3] = (Math.random() - 0.5) * 30;
      initial[i * 3 + 1] = Math.random() * 22 + 4;
      initial[i * 3 + 2] = (Math.random() - 0.5) * 30;
      phases[i] = Math.random() * Math.PI * 2;
      fallRates[i] = 0.4 + Math.random() * 0.8;
    }
    return { initial, phases, fallRates };
  }, [count]);

  // Mutable working buffer
  const positions = useMemo(() => initial.slice(), [initial]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const geo = ref.current.geometry as BufferGeometry;
    const posAttr = geo.attributes.position;
    for (let i = 0; i < count; i++) {
      const phase = phases[i];
      const rate = fallRates[i];
      // Falling Y with loop (24m loop)
      const y = ((initial[i * 3 + 1] - t * rate) % 26 + 26) % 26;
      // Parabolic sway in X/Z
      const swayX = Math.sin(t * 0.5 + phase) * 0.8;
      const swayZ = Math.cos(t * 0.4 + phase * 1.3) * 0.6;
      posAttr.setX(i, initial[i * 3] + swayX);
      posAttr.setY(i, y);
      posAttr.setZ(i, initial[i * 3 + 2] + swayZ);
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.22}
        color={REL_CONFIG.blossomPink}
        transparent
        opacity={0.75}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// ---------------------------------------------------------------------------
// Sparkles — 400 flickering points with individual phases
// ---------------------------------------------------------------------------

function Sparkles({ count = 400 }: { count?: number }) {
  const ref = useRef<Points>(null);

  const { positions, phases } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // Cluster around the heart, within 12m
      const r = Math.random() * 12 + 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi) + 6;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      phases[i] = Math.random() * Math.PI * 2;
    }
    return { positions, phases };
  }, [count]);

  const sizes = useMemo(() => {
    const arr = new Float32Array(count);
    for (let i = 0; i < count; i++) arr[i] = 0.1 + Math.random() * 0.18;
    return arr;
  }, [count]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    // Flicker via material opacity oscillation — affordable
    const mat = ref.current.material as THREE.PointsMaterial;
    if (mat) {
      mat.opacity = 0.4 + Math.sin(t * 3.0) * 0.35;
    }
    ref.current.rotation.y = t * 0.03;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.14}
        color={REL_CONFIG.sparkleGold}
        transparent
        opacity={0.6}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// ---------------------------------------------------------------------------
// Bumble LED Wall — canvas-driven honeycomb texture, "bumble night sp"
// ---------------------------------------------------------------------------

function makeBumbleCanvasTexture(): CanvasTexture {
  const w = 1024,
    h = 512;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function drawBumbleFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: number,
): void {
  // Background: Bumble yellow
  ctx.fillStyle = REL_CONFIG.bumbleYellow;
  ctx.fillRect(0, 0, w, h);

  // Honeycomb pattern (hexagons)
  const hexSize = 36;
  const hexW = Math.sqrt(3) * hexSize;
  const hexH = hexSize * 1.5;
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = 2;
  const colShift = Math.sin(time * 0.4) * 6;
  const rowShift = Math.cos(time * 0.4) * 6;
  for (let row = -1; row < h / hexH + 1; row++) {
    for (let col = -1; col < w / hexW + 1; col++) {
      const cx = col * hexW + (row % 2 ? hexW / 2 : 0) + colShift;
      const cy = row * hexH + rowShift;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const x = cx + Math.cos(a) * hexSize;
        const y = cy + Math.sin(a) * hexSize;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }

  // Pulsing dot — heartbeat alignment
  const beat = beatValue(time, REL_CONFIG.bpm);
  ctx.fillStyle = `rgba(255, 80, 120, ${0.6 + beat * 0.4})`;
  ctx.beginPath();
  ctx.arc(w * 0.85, h * 0.18, 16 + beat * 8, 0, Math.PI * 2);
  ctx.fill();

  // Main text
  ctx.fillStyle = "#221a00";
  ctx.font = "bold 96px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("bumble", w / 2, h * 0.42);

  ctx.font = "300 38px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "rgba(34, 26, 0, 0.78)";
  ctx.fillText("night sp · " + new Date().getFullYear(), w / 2, h * 0.62);

  // Subtitle
  ctx.font = "italic 24px system-ui";
  ctx.fillStyle = "rgba(34, 26, 0, 0.55)";
  ctx.fillText("make the first move", w / 2, h * 0.76);
}

function BumbleLEDWall() {
  const texture = useMemo(() => {
    if (typeof document === "undefined") return null;
    return makeBumbleCanvasTexture();
  }, []);
  const lastDraw = useRef<number>(0);

  useFrame(({ clock }) => {
    if (!texture) return;
    const t = clock.getElapsedTime();
    // Redraw at ~30fps (every other frame)
    if (t - lastDraw.current < 1 / 30) return;
    lastDraw.current = t;
    const canvas = texture.image as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawBumbleFrame(ctx, canvas.width, canvas.height, t);
    texture.needsUpdate = true;
  });

  if (!texture) return null;

  return (
    <mesh position={[0, 9, -14]}>
      <planeGeometry args={[22, 11]} />
      <meshBasicMaterial
        map={texture}
        toneMapped={false}
        transparent={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Floor (dark gradient circle, romantic stage)
// ---------------------------------------------------------------------------

function Floor() {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      receiveShadow
    >
      <circleGeometry args={[44, 64]} />
      <meshStandardMaterial
        color="#13101f"
        roughness={0.92}
        metalness={0.08}
        emissive="#2a1530"
        emissiveIntensity={0.05}
      />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Lighting — pink heart glow + soft dark-purple ambient
// ---------------------------------------------------------------------------

function RelLighting() {
  return (
    <>
      {/* Hero heart glow — pink point light hugging the heart */}
      <pointLight
        position={[0, 6, 0]}
        intensity={150}
        color={REL_CONFIG.heartEmissive}
        distance={18}
        decay={1.8}
      />
      {/* Fill light — secondary romantic glow from above-left */}
      <pointLight
        position={[-6, 12, 6]}
        intensity={45}
        color={REL_CONFIG.accent}
        distance={22}
        decay={2}
      />
      {/* Subtle warm rim from above-right */}
      <pointLight
        position={[6, 9, -4]}
        intensity={32}
        color={REL_CONFIG.matchLineColor}
        distance={20}
        decay={2}
      />
      {/* Dark purple ambient */}
      <ambientLight intensity={0.22} color="#2a2342" />
      <hemisphereLight args={[REL_CONFIG.accent, "#07060d", 0.18]} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Camera Orbit (rotateSpeed 0.22 romantic slow circle)
// ---------------------------------------------------------------------------

function CameraOrbit() {
  useFrame(({ camera, clock }) => {
    const t = clock.getElapsedTime();
    const radius = 24;
    const angle = t * REL_CONFIG.cam.rotateSpeed * 0.1;
    camera.position.x = Math.sin(angle) * radius;
    camera.position.z = Math.cos(angle) * radius;
    camera.position.y = REL_CONFIG.cam.position[1];
    camera.lookAt(0, 6, 0);
  });
  return null;
}

// ---------------------------------------------------------------------------
// Tier 2 Fallback (reduced particle counts, no canvas LED)
// ---------------------------------------------------------------------------

function Tier2FallbackScene() {
  return (
    <>
      <color
        attach="background"
        args={[`#${REL_CONFIG.bg.toString(16).padStart(6, "0")}`]}
      />
      <fog
        attach="fog"
        args={[
          `#${REL_CONFIG.fog.color.toString(16).padStart(6, "0")}`,
          16,
          48,
        ]}
      />
      <CameraOrbit />
      <RelLighting />
      <Floor />
      <HeartHero />
      <ProfileCloud count={800} />
      <MatchLines count={6} />
      <BlossomFall count={250} />
      <Sparkles count={120} />
      {/* No LED wall in Tier 2 to save CPU */}
    </>
  );
}

// ---------------------------------------------------------------------------
// Tier 3 Scene (full counts + Bumble LED canvas)
// ---------------------------------------------------------------------------

function Tier3Scene() {
  return (
    <>
      <color
        attach="background"
        args={[`#${REL_CONFIG.bg.toString(16).padStart(6, "0")}`]}
      />
      <fogExp2
        attach="fog"
        args={[
          `#${REL_CONFIG.fog.color.toString(16).padStart(6, "0")}`,
          REL_CONFIG.fog.density,
        ]}
      />
      <CameraOrbit />
      <RelLighting />
      <Floor />
      <HeartHero />
      <ProfileCloud count={2500} />
      <MatchLines count={12} />
      <BlossomFall count={800} />
      <Sparkles count={400} />
      <BumbleLEDWall />
    </>
  );
}

// ---------------------------------------------------------------------------
// WebGPU detection (matches sibling igreja/cultura pattern)
// ---------------------------------------------------------------------------

function useWebGPUAvailable(): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      setAvailable(false);
      return;
    }
    const navWithGpu = (navigator as unknown as { gpu?: unknown }).gpu;
    setAvailable(Boolean(navWithGpu));
  }, []);

  return available;
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export interface W3DRelacionamentosSceneProps {
  /** Force tier (default: auto-detect via navigator.gpu). */
  tier?: "tier2" | "tier3" | "auto";
  className?: string;
}

export function W3DRelacionamentosScene({
  tier = "auto",
  className,
}: W3DRelacionamentosSceneProps) {
  const webgpuAvailable = useWebGPUAvailable();

  const useTier3 =
    tier === "tier3" || (tier === "auto" && webgpuAvailable === true);

  const sceneContent = useTier3 ? <Tier3Scene /> : <Tier2FallbackScene />;

  return (
    <div
      className={className}
      style={{ position: "absolute", inset: 0, zIndex: 0 }}
    >
      <Canvas
        shadows
        dpr={[1, 1.8]}
        camera={{
          position: REL_CONFIG.cam.position,
          fov: 48,
          near: 0.5,
          far: 200,
        }}
        gl={{ antialias: true, alpha: false }}
      >
        <Suspense fallback={null}>{sceneContent}</Suspense>
      </Canvas>
    </div>
  );
}

export default W3DRelacionamentosScene;
