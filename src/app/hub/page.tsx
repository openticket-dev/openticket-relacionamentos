/**
 * /hub — Relacionamentos vertical Tier 3 immersive hub
 *
 * Sprint: W3D-PRIMITIVES-RELACIONAMENTOS (Onda 2)
 * Spec:   plans/active/OT-W3D-PATTERN-SPEC-2026-05-14.md §3 relacionamentos
 *
 * BLOCKED-ON: tier3 exports from @openticket-dev/3d-kit barrel
 *   (W3D-SETUP-4 PR pending merge).
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import Link from 'next/link';

const W3DRelacionamentosScene = dynamic(
  () => import('@/components/3d/relacionamentos/W3DRelacionamentosScene'),
  {
    ssr: false,
    loading: () => <RelacionamentosSceneFallback />,
  },
);

export const metadata: Metadata = {
  title: 'Relacionamentos · OpenTicket',
  description: 'Conexões reais. A plataforma de matchmaking, perfis e encontros do OpenTicket.',
};

function RelacionamentosSceneFallback() {
  return (
    <div
      className="fixed inset-0 -z-0"
      style={{
        background:
          'radial-gradient(ellipse at 50% 60%, rgba(236,72,153,0.18), transparent 55%), ' +
          'radial-gradient(ellipse at 30% 30%, rgba(168,85,247,0.10), transparent 60%), ' +
          'linear-gradient(180deg, #14081c 0%, #0a0414 100%)',
      }}
      aria-hidden
    />
  );
}

const CTAS = [
  { label: 'Buscar matches', href: '/buscar' },
  { label: 'Meu perfil', href: '/perfil' },
  { label: 'Premium', href: '/premium' },
] as const;

export default function RelacionamentosHubPage() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-black text-white">
      <W3DRelacionamentosScene />
      <div
        className="pointer-events-none fixed inset-0 z-10"
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 35%, rgba(0,0,0,0.10) 65%, rgba(0,0,0,0.70) 100%)',
        }}
        aria-hidden
      />
      <section className="relative z-20 mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-between px-6 py-16 text-center md:py-20">
        <header className="space-y-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs uppercase tracking-[0.25em] text-white/70 backdrop-blur">
            <span aria-hidden>💕</span>
            OpenTicket · Relacionamentos
          </span>
          <h1 className="text-balance text-4xl font-bold leading-[1.05] sm:text-5xl md:text-6xl lg:text-7xl">
            Conexão real,<br />
            <span className="bg-gradient-to-r from-pink-300 via-rose-200 to-fuchsia-200 bg-clip-text text-transparent">
              encontro presencial.
            </span>
          </h1>
          <p className="mx-auto max-w-2xl text-base text-white/65 md:text-lg">
            Perfis, matchmaking, eventos sociais e premium.
            A plataforma que tira da tela e leva pro mundo real.
          </p>
        </header>
        <div className="mt-12 flex flex-wrap items-center justify-center gap-3 md:gap-4">
          {CTAS.map((cta, i) => (
            <Link
              key={cta.href}
              href={cta.href}
              className={
                i === 0
                  ? 'rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:scale-[1.02] hover:bg-white/90 md:px-8 md:py-3.5 md:text-base'
                  : 'rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-medium text-white backdrop-blur transition hover:bg-white/15 md:px-8 md:py-3.5 md:text-base'
              }
            >
              {cta.label}
            </Link>
          ))}
        </div>
        <footer className="mt-auto pt-16 text-xs text-white/40">
          <span className="hidden md:inline">Arraste para girar · Scroll para zoom · </span>
          <span>BPM 80 · romantic · 2500 profiles sphere · 800 blossoms · WebGPU + AgX</span>
        </footer>
      </section>
    </main>
  );
}
