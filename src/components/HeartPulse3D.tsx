/**
 * HeartPulse3D — coracao 3D pulsante (W3D Tier 3).
 *
 * Estetica: coracao roxo/rosa pulsando suavemente, sugerindo conexao
 * romantica viva. Particulas orbitais reforcam o "match e vivo".
 *
 * Wave: 3D-EXPANSION (J1D) · 62 -> 66
 * Stack: R3F 9 + Three.js (transpilePackages ja no next.config.ts).
 */

"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Group, Mesh } from "three";
import * as THREE from "three";

interface HeartShapeProps {
  baseScale: number;
  pulseSpeed: number;
  accent: string;
  glow: string;
}

function HeartShape({ baseScale, pulseSpeed, accent, glow }: HeartShapeProps) {
  const meshRef = useRef<Mesh>(null);
  const groupRef = useRef<Group>(null);

  const heartGeometry = useMemo(() => {
    // Curva parametrica de coracao 2D extrudada
    const shape = new THREE.Shape();
    const x = 0;
    const y = 0;
    shape.moveTo(x + 0.5, y + 0.5);
    shape.bezierCurveTo(x + 0.5, y + 0.5, x + 0.4, y, x, y);
    shape.bezierCurveTo(x - 0.6, y, x - 0.6, y + 0.7, x - 0.6, y + 0.7);
    shape.bezierCurveTo(x - 0.6, y + 1.1, x - 0.3, y + 1.54, x + 0.5, y + 1.9);
    shape.bezierCurveTo(x + 1.3, y + 1.54, x + 1.6, y + 1.1, x + 1.6, y + 0.7);
    shape.bezierCurveTo(x + 1.6, y + 0.7, x + 1.6, y, x + 1.0, y);
    shape.bezierCurveTo(x + 0.7, y, x + 0.5, y + 0.5, x + 0.5, y + 0.5);

    const extrudeSettings = {
      depth: 0.35,
      bevelEnabled: true,
      bevelSegments: 8,
      bevelSize: 0.06,
      bevelThickness: 0.06,
      steps: 1,
      curveSegments: 24,
    };
    const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geom.center();
    geom.computeVertexNormals();
    return geom;
  }, []);

  // 8 particulas orbitando suavemente
  const orbitParticles = useMemo(() => {
    return Array.from({ length: 8 }).map((_, i) => ({
      key: i,
      angleOffset: (i / 8) * Math.PI * 2,
      radius: 1.8 + (i % 2) * 0.3,
      speed: 0.4 + (i % 3) * 0.1,
    }));
  }, []);

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.15;
    }
    if (meshRef.current) {
      // Pulso suave: 1 + sin(t * speed) * 0.08
      const t = state.clock.elapsedTime;
      const pulse = baseScale * (1 + Math.sin(t * pulseSpeed) * 0.08);
      meshRef.current.scale.set(pulse, pulse, pulse);
    }
  });

  return (
    <group ref={groupRef}>
      <mesh ref={meshRef} geometry={heartGeometry} rotation={[Math.PI, 0, 0]}>
        <meshStandardMaterial
          color={accent}
          emissive={glow}
          emissiveIntensity={0.35}
          metalness={0.2}
          roughness={0.35}
        />
      </mesh>

      {orbitParticles.map((p) => (
        <OrbitParticle
          key={p.key}
          angleOffset={p.angleOffset}
          radius={p.radius}
          speed={p.speed}
          color={glow}
        />
      ))}
    </group>
  );
}

interface OrbitParticleProps {
  angleOffset: number;
  radius: number;
  speed: number;
  color: string;
}

function OrbitParticle({ angleOffset, radius, speed, color }: OrbitParticleProps) {
  const ref = useRef<Mesh>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime * speed + angleOffset;
    ref.current.position.x = Math.cos(t) * radius;
    ref.current.position.z = Math.sin(t) * radius;
    ref.current.position.y = Math.sin(t * 0.7) * 0.4;
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.06, 12, 12]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={1.4}
      />
    </mesh>
  );
}

export interface HeartPulse3DProps {
  /** 0..1 compatibilidade — controla intensidade do pulso */
  compatibility?: number;
  /** Cor base do coracao */
  accent?: string;
  /** Cor emissive (glow) */
  glow?: string;
  /** aria-label customizado */
  ariaLabel?: string;
  /** Altura do container (default h-72) */
  className?: string;
}

export function HeartPulse3D({
  compatibility = 0.7,
  accent = "#e879f9",
  glow = "#d946ef",
  ariaLabel,
  className = "h-72 w-full rounded-2xl bg-[#13101f]/40 border border-[#2a2342]",
}: HeartPulse3DProps) {
  // compatibility entra como baseScale (0.7 -> 0.85, 1.0 -> 1.0)
  const baseScale = 0.7 + Math.max(0, Math.min(1, compatibility)) * 0.3;
  // pulseSpeed escala com compatibilidade (sentimento mais forte = bate mais rapido)
  const pulseSpeed = 1.4 + compatibility * 1.2;

  const label =
    ariaLabel ??
    `Coracao 3D pulsante representando compatibilidade de ${Math.round(
      compatibility * 100,
    )} porcento`;

  return (
    <div className={className} role="img" aria-label={label}>
      <Canvas camera={{ position: [0, 0, 5.2], fov: 50 }} dpr={[1, 2]}>
        <ambientLight intensity={0.55} />
        <pointLight position={[4, 4, 5]} intensity={1.2} color="#ffffff" />
        <pointLight position={[-4, -3, -2]} intensity={0.7} color={glow} />
        <HeartShape
          baseScale={baseScale}
          pulseSpeed={pulseSpeed}
          accent={accent}
          glow={glow}
        />
      </Canvas>
    </div>
  );
}
