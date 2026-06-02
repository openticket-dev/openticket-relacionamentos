/**
 * SparklesConstellation3D — constelacao 3D de sparkles para /encontros.
 *
 * Cada ponto = um encontro/match marcado. Linhas conectam encontros
 * sequenciais. Estetica: ceu noturno romantico com pulsos suaves.
 *
 * Wave: 3D-EXPANSION (J1D) · 62 -> 66
 * Stack: R3F 9 + Three.js (transpilePackages no next.config.ts).
 */

"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Group, Points, BufferGeometry } from "three";
import * as THREE from "three";

export interface EncontroPoint {
  id: string;
  /** Timestamp do encontro em ms (epoch). Usado pra ordenar e posicionar. */
  timestampMs: number;
  /** Energia/score do encontro 0..1 — controla brilho. */
  energy?: number;
}

interface ConstellationCloudProps {
  points: EncontroPoint[];
  accent: string;
}

function ConstellationCloud({ points, accent }: ConstellationCloudProps) {
  const groupRef = useRef<Group>(null);
  const sparkleRef = useRef<Points>(null);

  // Gera posicoes 3D em espiral helicoidal — encontros se distribuem no espaco.
  const layout = useMemo(() => {
    const sorted = [...points].sort((a, b) => a.timestampMs - b.timestampMs);
    return sorted.map((p, i) => {
      const t = i / Math.max(1, sorted.length - 1);
      const angle = t * Math.PI * 4; // 2 voltas
      const radius = 1.4 + t * 1.4; // espiral pra fora
      const height = (t - 0.5) * 2.8; // sobe de -1.4 a +1.4
      return {
        id: p.id,
        position: [
          Math.cos(angle) * radius,
          height,
          Math.sin(angle) * radius,
        ] as [number, number, number],
        energy: Math.max(0, Math.min(1, p.energy ?? 0.7)),
      };
    });
  }, [points]);

  // Geometria de pontos brilhantes (sparkles).
  const pointsGeometry = useMemo<BufferGeometry>(() => {
    const positions = new Float32Array(layout.length * 3);
    const sizes = new Float32Array(layout.length);
    layout.forEach((p, i) => {
      positions[i * 3 + 0] = p.position[0];
      positions[i * 3 + 1] = p.position[1];
      positions[i * 3 + 2] = p.position[2];
      sizes[i] = 0.18 + p.energy * 0.14;
    });
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    return geom;
  }, [layout]);

  // Linhas conectando pontos consecutivos (linha temporal do romance).
  const linesGeometry = useMemo<BufferGeometry>(() => {
    if (layout.length < 2) return new THREE.BufferGeometry();
    const positions: number[] = [];
    for (let i = 0; i < layout.length - 1; i++) {
      positions.push(...layout[i].position, ...layout[i + 1].position);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    return geom;
  }, [layout]);

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.12;
    }
    if (sparkleRef.current) {
      // pulso de brilho global
      const t = state.clock.elapsedTime;
      const mat = sparkleRef.current.material as THREE.PointsMaterial;
      mat.opacity = 0.75 + Math.sin(t * 1.6) * 0.18;
    }
  });

  // Halos individuais — 1 esfera emissive por encontro
  const halos = layout.map((p) => (
    <mesh key={`halo-${p.id}`} position={p.position}>
      <sphereGeometry args={[0.08 + p.energy * 0.05, 12, 12]} />
      <meshStandardMaterial
        color={accent}
        emissive={accent}
        emissiveIntensity={0.6 + p.energy * 0.8}
        transparent
        opacity={0.85}
      />
    </mesh>
  ));

  return (
    <group ref={groupRef}>
      {/* Linhas conectoras */}
      {layout.length >= 2 && (
        <line>
          <primitive object={linesGeometry} attach="geometry" />
          <lineBasicMaterial
            color={accent}
            transparent
            opacity={0.35}
            linewidth={1}
          />
        </line>
      )}

      {/* Sparkles (pontos cintilantes) */}
      <points ref={sparkleRef}>
        <primitive object={pointsGeometry} attach="geometry" />
        <pointsMaterial
          color={accent}
          size={0.22}
          sizeAttenuation
          transparent
          opacity={0.9}
        />
      </points>

      {/* Halos individuais */}
      {halos}
    </group>
  );
}

export interface SparklesConstellation3DProps {
  /** Lista de encontros — cada um vira um ponto na constelacao. */
  points: EncontroPoint[];
  /** Cor base */
  accent?: string;
  /** aria-label customizado */
  ariaLabel?: string;
  /** Classes do container */
  className?: string;
}

export function SparklesConstellation3D({
  points,
  accent = "#f0abfc",
  ariaLabel,
  className = "h-80 w-full rounded-2xl bg-[#07060d]/40 border border-[#2a2342]",
}: SparklesConstellation3DProps) {
  const label =
    ariaLabel ??
    `Constelacao 3D de ${points.length} encontros conectados em linha temporal`;

  return (
    <div className={className} role="img" aria-label={label}>
      <Canvas camera={{ position: [0, 0.4, 6.2], fov: 50 }} dpr={[1, 2]}>
        <ambientLight intensity={0.35} />
        <pointLight position={[3, 4, 5]} intensity={0.9} color="#ffffff" />
        <pointLight position={[-3, -2, -3]} intensity={0.5} color={accent} />
        <ConstellationCloud points={points} accent={accent} />
      </Canvas>
    </div>
  );
}
