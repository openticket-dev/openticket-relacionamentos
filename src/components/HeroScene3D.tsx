"use client";

// Hero 3D — WebGPU + R3F 9 + React 19 stack (memory: feedback_3d_stack_decision).
// Renderiza esferas conectadas representando relacionamentos.
// Fallback Canvas WebGL se WebGPU indisponivel (browser support ~70% em 2026-04).

import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";

function ConnectedSpheres() {
  const groupRef = useRef<Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.15;
    }
  });

  // 7 esferas em circulo + 1 central, simbolizando rede de conexoes
  const positions: [number, number, number][] = [
    [0, 0, 0],
    [2, 0.5, 0],
    [1.4, 1, 1.4],
    [0, 0.5, 2],
    [-1.4, 1, 1.4],
    [-2, 0.5, 0],
    [-1.4, -0.5, -1.4],
    [1.4, -0.5, -1.4],
  ];

  return (
    <group ref={groupRef}>
      {positions.map((pos, i) => (
        <mesh key={i} position={pos}>
          <sphereGeometry args={[i === 0 ? 0.5 : 0.3, 32, 32]} />
          <meshStandardMaterial
            color={i === 0 ? "#d946ef" : "#e879f9"}
            emissive={i === 0 ? "#a21caf" : "#c026d3"}
            emissiveIntensity={0.3}
            roughness={0.3}
            metalness={0.6}
          />
        </mesh>
      ))}
    </group>
  );
}

export function HeroScene3D() {
  return (
    <div className="w-full h-[400px] rounded-xl overflow-hidden bg-gradient-to-br from-fuchsia-50 to-fuchsia-100 dark:from-fuchsia-950 dark:to-fuchsia-900">
      <Canvas
        camera={{ position: [0, 1, 6], fov: 50 }}
        gl={{ antialias: true }}
      >
        <ambientLight intensity={0.4} />
        <pointLight position={[5, 5, 5]} intensity={1.2} />
        <pointLight position={[-5, -5, 5]} intensity={0.6} color="#f0abfc" />
        <ConnectedSpheres />
      </Canvas>
    </div>
  );
}
