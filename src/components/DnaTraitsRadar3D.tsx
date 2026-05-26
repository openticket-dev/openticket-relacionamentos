/**
 * DnaTraitsRadar3D — 3D radar/pentagon visualization of Big Five traits.
 *
 * Renderiza pentagono 3D rotativo onde cada eixo representa uma das 5 dimensoes.
 * O comprimento de cada eixo e proporcional ao trait normalizado (0..1).
 *
 * Wave: DNA-30 · feat/ot-r-dna-30-perguntas-onboarding-2026-05-14
 * Stack: R3F 9 + Three.js + WebGPU-ready (transpile no next.config.ts).
 */

"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Group, BufferGeometry } from "three";
import * as THREE from "three";
import {
  DNA_DIMENSION_LABELS,
  type DnaDimension,
} from "@/lib/dna-questions";

const DIMENSIONS: DnaDimension[] = [
  "OPENNESS",
  "CONSCIENTIOUSNESS",
  "EXTRAVERSION",
  "AGREEABLENESS",
  "NEUROTICISM",
];

function PentagonShape({ traits }: { traits: Record<DnaDimension, number> }) {
  const groupRef = useRef<Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.2;
    }
  });

  // Pentagon: 5 vertices em circulo, raio = traits[d]
  const polygonGeom = useMemo<BufferGeometry>(() => {
    const positions: number[] = [];
    const center = [0, 0, 0];
    const verts: [number, number, number][] = DIMENSIONS.map((d, i) => {
      const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const r = Math.max(0.1, (traits[d] ?? 0) * 2.5);
      return [Math.cos(angle) * r, Math.sin(angle) * r, 0];
    });
    for (let i = 0; i < 5; i++) {
      const next = (i + 1) % 5;
      positions.push(...center, ...verts[i], ...verts[next]);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geom.computeVertexNormals();
    return geom;
  }, [traits]);

  // 5 spheres at vertices showing each dimension
  const vertices = DIMENSIONS.map((d, i) => {
    const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
    const r = Math.max(0.1, (traits[d] ?? 0) * 2.5);
    return {
      dimension: d,
      position: [Math.cos(angle) * r, Math.sin(angle) * r, 0] as [number, number, number],
      value: traits[d] ?? 0,
    };
  });

  return (
    <group ref={groupRef}>
      <mesh geometry={polygonGeom}>
        <meshStandardMaterial
          color="#c084fc"
          transparent
          opacity={0.4}
          side={THREE.DoubleSide}
          emissive="#a855f7"
          emissiveIntensity={0.2}
        />
      </mesh>
      {vertices.map((v) => (
        <mesh key={v.dimension} position={v.position}>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshStandardMaterial
            color="#e879f9"
            emissive="#d946ef"
            emissiveIntensity={0.5}
          />
        </mesh>
      ))}
    </group>
  );
}

export function DnaTraitsRadar3D({
  traits,
}: {
  traits: Record<DnaDimension, number>;
}) {
  return (
    <div
      className="h-64 w-full rounded-lg bg-zinc-950/40 border border-zinc-800"
      role="img"
      aria-label={`Visualizacao 3D dos seus 5 tracos: ${DIMENSIONS.map(
        (d) =>
          `${DNA_DIMENSION_LABELS[d]} ${Math.round((traits[d] ?? 0) * 100)}%`,
      ).join(", ")}`}
    >
      <Canvas camera={{ position: [0, 0, 6], fov: 50 }}>
        <ambientLight intensity={0.6} />
        <pointLight position={[5, 5, 5]} intensity={1} />
        <pointLight position={[-5, -5, -5]} intensity={0.5} color="#e879f9" />
        <PentagonShape traits={traits} />
      </Canvas>
    </div>
  );
}
