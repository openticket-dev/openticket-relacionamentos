"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

// W3D scene is client-only (Canvas + WebGPU detection)
const W3DRelacionamentosScene = dynamic(
  () =>
    import("@/components/3d/W3DRelacionamentosScene").then(
      (m) => m.W3DRelacionamentosScene,
    ),
  { ssr: false, loading: () => null },
);

// Inline heart icon (no external icon library dependency)
function HeartIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}

export default function HubClient() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[#07060d] text-white">
      {/* WebGPU Tier 3 / Tier 2 fallback love sphere scene */}
      <W3DRelacionamentosScene tier="auto" className="absolute inset-0" />

      {/* Foreground overlay — readable above 3D */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="max-w-3xl">
          <div
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-4 py-1.5 text-xs uppercase tracking-widest backdrop-blur-md"
            style={{ color: "#f0abfc" }}
          >
            <HeartIcon className="h-3.5 w-3.5" />
            OpenTicket · Relacionamentos
          </div>
          <h1 className="mb-6 text-5xl font-bold leading-[1.05] md:text-7xl">
            Conexão,{" "}
            <span style={{ color: "#f0abfc" }}>match</span>, amor.
          </h1>
          <p className="mb-10 text-lg text-white/70 md:text-xl">
            18 subverticais — do amor ao co-founder, do mentor ao parceiro de
            treino. Hub 3D imersivo onde encontros viram experiencia, nao
            scrolling infinito.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/buscar"
              className="inline-block rounded-lg border border-white/20 bg-[#f0abfc]/25 px-6 py-3 text-white backdrop-blur-md transition-colors hover:border-white/40 hover:bg-[#f0abfc]/40"
            >
              Comecar a conectar
            </Link>
            <Link
              href="/perfil"
              className="inline-block rounded-lg border border-white/15 px-6 py-3 text-white/80 backdrop-blur-md transition-colors hover:border-white/30"
            >
              Criar perfil
            </Link>
            <Link
              href="/"
              className="inline-block rounded-lg border border-white/15 px-6 py-3 text-white/80 backdrop-blur-md transition-colors hover:border-white/30"
            >
              Voltar pro inicio
            </Link>
          </div>
        </div>

        {/* Subtle vignette bottom — keeps heart visible above CTA */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#07060d] to-transparent" />
      </div>
    </main>
  );
}
