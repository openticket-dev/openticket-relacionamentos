'use client';

/**
 * W3DRelacionamentosScene — Tier 3 hub scene for relacionamentos vertical.
 *
 * Implements the OT-W3D-PATTERN-SPEC relacionamentos blueprint:
 *  - Hero: Central heart (ExtrudeGeometry red, emissive pink)
 *  - ProfileCloud: 2.5k profiles on sphere distribution
 *  - MatchLines: 12 randomized connection lines
 *  - BlossomFall: 800 cherry blossoms falling (TSL parabolic)
 *  - Sparkles: 400 flickering particles
 *  - LED Wall: Bumble (yellow #ffc628, honeycomb pattern, "bumble night sp")
 *  - Heart glow pink 15W, soft ambient dark purple
 *  - BPM 80, no strobe (romantic)
 *  - Cam pos [0, 6, 24] rotateSpeed 0.22, love sphere
 *  - Fog 0x14081c d=0.018, BG 0x0a0414
 *  - Accent #ec4899 (pink)
 *
 * Stack: R3F 9.6 + Three 0.184.
 *
 * Spec: plans/active/OT-W3D-PATTERN-SPEC-2026-05-14.md §3 relacionamentos
 * Sprint: W3D-PRIMITIVES-RELACIONAMENTOS (Onda 2)
 *
 * BLOCKED-ON: github:openticket-dev/openticket-packages#feat/w3d-setup-4-barrel
 *   tier3/ exports (CrowdLayer pattern="sphere" count=2500, BlossomFall via TSL,
 *   Heart MeshPhysical preset emissive-cross variant, LEDWall brand="bumble")
 *   stubbed.
 */

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

// ─── Relacionamentos config ───────────────────────────────────────────────────
export const RELACIONAMENTOS_CONFIG = {
  icon: '💕',
  accent: '#ec4899',
  bg: 0x0a0414,
  fog: { color: 0x14081c, density: 0.018 },
  cam: { position: [0, 6, 24] as const, rotateSpeed: 0.22 },
  bpm: 80,
  profileCount: 2_500,
  blossomCount: 800,
  sparkleCount: 400,
  matchLineCount: 12,
};

function useWebGPUSupport(): boolean | null {
  const [supported, setSupported] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    const detect = async () => {
      try {
        const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
        if (!gpu) {
          if (!cancelled) setSupported(false);
          return;
        }
        const adapter = await gpu.requestAdapter();
        if (!cancelled) setSupported(!!adapter);
      } catch {
        if (!cancelled) setSupported(false);
      }
    };
    void detect();
    return () => {
      cancelled = true;
    };
  }, []);
  return supported;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

// ─── HeartHero — ExtrudeGeometry red emissive ─────────────────────────────────
function HeartHero() {
  const ref = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshPhysicalMaterial>(null);

  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    const x = 0;
    const y = 0;
    shape.moveTo(x + 0.25, y + 0.25);
    shape.bezierCurveTo(x + 0.25, y + 0.25, x + 0.20, y, x, y);
    shape.bezierCurveTo(x - 0.30, y, x - 0.30, y + 0.35, x - 0.30, y + 0.35);
    shape.bezierCurveTo(x - 0.30, y + 0.55, x - 0.10, y + 0.77, x + 0.25, y + 0.95);
    shape.bezierCurveTo(x + 0.60, y + 0.77, x + 0.80, y + 0.55, x + 0.80, y + 0.35);
    shape.bezierCurveTo(x + 0.80, y + 0.35, x + 0.80, y, x + 0.50, y);
    shape.bezierCurveTo(x + 0.35, y, x + 0.25, y + 0.25, x + 0.25, y + 0.25);
    const extrudeSettings = { depth: 0.35, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 4 };
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geo.center();
    geo.scale(2.2, 2.2, 2.2);
    return geo;
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.rotation.y = t * 0.25;
    ref.current.position.y = 3.5 + Math.sin(t * 1.2) * 0.18;
    if (matRef.current) {
      const beatPhase = (t * RELACIONAMENTOS_CONFIG.bpm) / 60;
      const beat = Math.pow(Math.abs(Math.sin((beatPhase * Math.PI) % Math.PI)), 8);
      matRef.current.emissiveIntensity = 1.5 + beat * 1.5;
    }
  });

  return (
    <mesh ref={ref} geometry={geometry} position={[0, 3.5, 0]} castShadow>
      <meshPhysicalMaterial
        ref={matRef}
        color="#ec4899"
        emissive="#f43f5e"
        emissiveIntensity={1.5}
        metalness={0.45}
        roughness={0.25}
        clearcoat={0.85}
        clearcoatRoughness={0.15}
      />
    </mesh>
  );
}

// ─── ProfileCloud — 2.5k particles on sphere distribution ─────────────────────
interface ProfileCloudProps {
  count: number;
}
function ProfileCloud({ count }: ProfileCloudProps) {
  const ref = useRef<THREE.Points>(null);
  const { positions, colors, phases } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const palette = [
      new THREE.Color('#ec4899'),
      new THREE.Color('#a855f7'),
      new THREE.Color('#fbbf24'),
      new THREE.Color('#f43f5e'),
      new THREE.Color('#ffffff'),
    ];
    // Sphere distribution
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 9 + Math.random() * 5;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = 3 + r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      phases[i] = Math.random() * Math.PI * 2;
      const c = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    return { positions, colors, phases };
  }, [count]);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.rotation.y = t * 0.06;
    const geo = ref.current.geometry as THREE.BufferGeometry;
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    const stride = Math.max(1, Math.floor(count / 300));
    for (let i = 0; i < count; i += stride) {
      // Slight breathe in/out radial
      const base = arr[i * 3 + 1];
      arr[i * 3 + 1] = base + Math.sin(t * 0.4 + phases[i]) * 0.005;
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={count} itemSize={3} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} count={count} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.18} sizeAttenuation vertexColors transparent opacity={0.85} depthWrite={false} />
    </points>
  );
}

// ─── MatchLines — 12 randomized connection lines between random points ────────
function MatchLines({ count }: { count: number }) {
  const lines = useMemo(() => {
    const arr: { from: THREE.Vector3; to: THREE.Vector3 }[] = [];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const b = a + Math.PI + (Math.random() - 0.5) * 0.4;
      const r1 = 9 + Math.random() * 4;
      const r2 = 9 + Math.random() * 4;
      arr.push({
        from: new THREE.Vector3(Math.cos(a) * r1, 3 + Math.random() * 4, Math.sin(a) * r1),
        to: new THREE.Vector3(Math.cos(b) * r2, 3 + Math.random() * 4, Math.sin(b) * r2),
      });
    }
    return arr;
  }, [count]);
  return (
    <group>
      {lines.map((line, i) => {
        const dir = new THREE.Vector3().subVectors(line.to, line.from);
        const dist = dir.length();
        const mid = new THREE.Vector3().addVectors(line.from, line.to).multiplyScalar(0.5);
        const orient = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
        return (
          <mesh key={`line-${i}`} position={mid} quaternion={orient}>
            <cylinderGeometry args={[0.025, 0.025, dist, 6]} />
            <meshBasicMaterial color="#ec4899" transparent opacity={0.35} toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
}

// ─── BlossomFall — 800 cherry blossoms falling (TSL-style on CPU) ─────────────
interface BlossomFallProps {
  count: number;
}
function BlossomFall({ count }: BlossomFallProps) {
  const ref = useRef<THREE.Points>(null);
  const { positions, baseX, baseZ, phases } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const baseX = new Float32Array(count);
    const baseZ = new Float32Array(count);
    const phases = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 40;
      const z = (Math.random() - 0.5) * 40;
      const y = Math.random() * 18;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      baseX[i] = x;
      baseZ[i] = z;
      phases[i] = Math.random() * Math.PI * 2;
    }
    return { positions, baseX, baseZ, phases };
  }, [count]);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const geo = ref.current.geometry as THREE.BufferGeometry;
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    for (let i = 0; i < count; i++) {
      // Falling parabolic — wrap y when below ground
      const y = ((t * 0.6 + phases[i]) * 1.5) % 18;
      arr[i * 3 + 1] = 18 - y;
      // Side-to-side sway
      arr[i * 3] = baseX[i] + Math.sin(t + phases[i]) * 0.6;
      arr[i * 3 + 2] = baseZ[i] + Math.cos(t * 0.7 + phases[i]) * 0.6;
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={count} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={0.12}
        sizeAttenuation
        color="#fbcfe8"
        transparent
        opacity={0.7}
        depthWrite={false}
      />
    </points>
  );
}

// ─── Sparkles — 400 flickering points ─────────────────────────────────────────
function Sparkles({ count }: { count: number }) {
  const ref = useRef<THREE.Points>(null);
  const { positions, phases } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 4 + Math.random() * 10;
      positions[i * 3] = Math.cos(angle) * r;
      positions[i * 3 + 1] = 1 + Math.random() * 8;
      positions[i * 3 + 2] = Math.sin(angle) * r;
      phases[i] = Math.random() * Math.PI * 2;
    }
    return { positions, phases };
  }, [count]);

  const materialRef = useRef<THREE.PointsMaterial>(null);
  useFrame((state) => {
    if (!materialRef.current) return;
    const t = state.clock.elapsedTime;
    materialRef.current.opacity = 0.5 + Math.sin(t * 4) * 0.3;
  });

  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={count} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        ref={materialRef}
        size={0.09}
        sizeAttenuation
        color="#fbbf24"
        transparent
        opacity={0.6}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// ─── Bumble LEDWall ───────────────────────────────────────────────────────────
function useBumbleLedTexture(): THREE.CanvasTexture | null {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    canvasRef.current = canvas;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    setTexture(tex);
    return () => {
      tex.dispose();
    };
  }, []);

  useEffect(() => {
    if (!texture || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let lastT = 0;
    let frame = 0;

    // Hexagon helper
    const drawHexagon = (cx: number, cy: number, size: number) => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const x = cx + Math.cos(angle) * size;
        const y = cy + Math.sin(angle) * size;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    };

    const draw = (t: number) => {
      if (t - lastT < 50) {
        raf = requestAnimationFrame(draw);
        return;
      }
      lastT = t;
      frame++;
      // Yellow bg
      ctx.fillStyle = '#ffc628';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // Honeycomb pattern (light overlay)
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 2;
      const hexSize = 30;
      for (let row = -2; row < canvas.height / hexSize + 2; row++) {
        for (let col = -2; col < canvas.width / (hexSize * 1.5) + 2; col++) {
          const cx = col * hexSize * 1.5 + (row % 2) * hexSize * 0.75;
          const cy = row * hexSize * Math.sqrt(3) * 0.5;
          drawHexagon(cx, cy, hexSize * 0.8);
          ctx.stroke();
        }
      }
      // Black "bumble"
      ctx.fillStyle = '#1a1208';
      ctx.font = 'bold italic 120px Inter, system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText('bumble', 80, canvas.height / 2 - 20);
      // Subline
      ctx.fillStyle = 'rgba(26,18,8,0.85)';
      ctx.font = '32px Inter, sans-serif';
      ctx.fillText('night sp · open ticket', 80, canvas.height / 2 + 65);
      // Pulse heart
      const pulse = 0.5 + 0.5 * Math.sin(frame * 0.12);
      ctx.fillStyle = `rgba(244,63,94,${0.7 + pulse * 0.3})`;
      ctx.font = 'bold 70px serif';
      ctx.fillText('♥', 480, canvas.height / 2 - 20);
      texture.needsUpdate = true;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [texture]);
  return texture;
}

function LEDWall() {
  const texture = useBumbleLedTexture();
  return (
    <mesh position={[0, 8, -10]}>
      <planeGeometry args={[16, 4]} />
      {texture ? <meshBasicMaterial map={texture} toneMapped={false} /> : <meshBasicMaterial color="#ffc628" />}
    </mesh>
  );
}

function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <circleGeometry args={[40, 64]} />
      <meshStandardMaterial color="#0a0414" roughness={0.7} metalness={0.25} />
    </mesh>
  );
}

function Tier3Relacionamentos() {
  return (
    <>
      <color attach="background" args={[RELACIONAMENTOS_CONFIG.bg]} />
      <fog attach="fog" args={[RELACIONAMENTOS_CONFIG.fog.color, 10, 1 / Math.max(RELACIONAMENTOS_CONFIG.fog.density, 0.001)]} />
      <ambientLight color="#14081c" intensity={0.5} />
      <Floor />
      <LEDWall />
      <HeartHero />
      <ProfileCloud count={RELACIONAMENTOS_CONFIG.profileCount} />
      <MatchLines count={RELACIONAMENTOS_CONFIG.matchLineCount} />
      <BlossomFall count={RELACIONAMENTOS_CONFIG.blossomCount} />
      <Sparkles count={RELACIONAMENTOS_CONFIG.sparkleCount} />
      <pointLight position={[0, 4, 0]} color="#ec4899" intensity={2.2} distance={20} />
      <OrbitControls
        autoRotate
        autoRotateSpeed={RELACIONAMENTOS_CONFIG.cam.rotateSpeed}
        enableZoom
        enablePan={false}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 2.1}
        target={[0, 3.5, 0]}
      />
    </>
  );
}

function Tier2Relacionamentos() {
  return (
    <>
      <color attach="background" args={[RELACIONAMENTOS_CONFIG.bg]} />
      <fog attach="fog" args={[RELACIONAMENTOS_CONFIG.fog.color, 12, 55]} />
      <ambientLight color="#14081c" intensity={0.65} />
      <Floor />
      <LEDWall />
      <HeartHero />
      <ProfileCloud count={500} />
      <MatchLines count={6} />
      <pointLight position={[0, 4, 0]} color="#ec4899" intensity={2.2} distance={20} />
      <OrbitControls
        autoRotate
        autoRotateSpeed={RELACIONAMENTOS_CONFIG.cam.rotateSpeed}
        enableZoom
        enablePan={false}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 2.1}
        target={[0, 3.5, 0]}
      />
    </>
  );
}

function CameraInit() {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(...(RELACIONAMENTOS_CONFIG.cam.position as unknown as [number, number, number]));
    camera.lookAt(0, 3.5, 0);
  }, [camera]);
  return null;
}

export interface W3DRelacionamentosSceneProps {
  className?: string;
}

export default function W3DRelacionamentosScene({ className }: W3DRelacionamentosSceneProps) {
  const webgpu = useWebGPUSupport();
  const reducedMotion = useReducedMotion();
  const useTier3 = webgpu === true && !reducedMotion;
  return (
    <div className={className ?? 'fixed inset-0 -z-0'} data-tier={useTier3 ? 'tier3' : 'tier2'} aria-hidden>
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.25,
        }}
        camera={{ fov: 55, near: 0.1, far: 200 }}
      >
        <CameraInit />
        {useTier3 ? <Tier3Relacionamentos /> : <Tier2Relacionamentos />}
      </Canvas>
    </div>
  );
}
