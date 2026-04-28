// Relacionamentos — Landing public page
// Wave: W-R-9 (initial scaffold). Hero 3D + 18 subverticais grid + signup CTA.
//
// Stack: Next.js 16 + React 19 + R3F 9 + WebGPU-ready.
// Fluxo: visitor ve hero -> escolhe subvertical -> CTA leva pra /buscar?vertical=<slug>.

import Link from "next/link";
import { HeroScene3D } from "@/components/HeroScene3D";
import { SUBVERTICALS } from "@/lib/subverticals";

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="px-6 py-12 max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          <div className="space-y-6">
            <h1 className="text-5xl font-bold tracking-tight">
              Conecte com quem importa.
            </h1>
            <p className="text-xl text-muted-foreground">
              Relacionamentos B2C — 18 verticais, do amor ao co-founder, do
              mentor ao parceiro de treino. Tudo num lugar so.
            </p>
            <div className="flex gap-3 pt-2">
              <Link
                href="/buscar"
                className="px-6 py-3 rounded-lg bg-fuchsia-600 text-white font-medium hover:bg-fuchsia-700 transition-colors"
              >
                Comecar agora
              </Link>
              <Link
                href="/perfil"
                className="px-6 py-3 rounded-lg border border-border hover:bg-accent transition-colors"
              >
                Criar perfil
              </Link>
            </div>
          </div>
          <HeroScene3D />
        </div>
      </section>

      {/* 18 subverticals grid */}
      <section className="px-6 py-12 max-w-6xl mx-auto">
        <header className="mb-8">
          <h2 className="text-3xl font-bold">Escolha sua vibe</h2>
          <p className="text-muted-foreground mt-2">
            18 subverticais — escolhe um ou mais e a gente conecta voce com a
            galera certa.
          </p>
        </header>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {SUBVERTICALS.map((sv) => (
            <Link
              key={sv.slug}
              href={`/buscar?vertical=${sv.slug}`}
              className="group rounded-xl border border-border p-4 hover:border-fuchsia-400 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-950/40 transition-colors"
            >
              <div className="text-3xl mb-2">{sv.emoji}</div>
              <div className="font-semibold text-sm">{sv.label}</div>
              <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {sv.description}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Signup CTA */}
      <section className="px-6 py-16 bg-fuchsia-50 dark:bg-fuchsia-950/30">
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <h2 className="text-3xl font-bold">Pronto para conectar?</h2>
          <p className="text-muted-foreground">
            Cadastre-se gratis. Sem ads, sem spam. Seguranca em primeiro lugar
            (LGPD + verificacao de identidade).
          </p>
          <div className="flex justify-center gap-3 pt-4">
            <Link
              href="/perfil"
              className="px-8 py-3 rounded-lg bg-fuchsia-600 text-white font-medium hover:bg-fuchsia-700"
            >
              Criar conta gratis
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
