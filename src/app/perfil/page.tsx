// Relacionamentos — Perfil (dashboard view)
// Sprint M8-1: dashboard do meu perfil — preview + atalhos pra editar + verificar.
// Backend: W-R-4 wira query me { profile } GraphQL.

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SUBVERTICALS } from "@/lib/subverticals";

type StoredProfile = {
  displayName?: string;
  bio?: string;
  age?: string;
  city?: string;
  interests?: string[];
  photos?: { id: string; previewUrl: string }[];
  prompts?: { id: string; question: string; answer: string }[];
};

const STORAGE_KEY = "relac:perfil-editor";

export default function PerfilPage() {
  const [profile, setProfile] = useState<StoredProfile | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setProfile(JSON.parse(raw));
    } catch {
      // ignore
    } finally {
      setLoaded(true);
    }
  }, []);

  const interestsLabels = (profile?.interests ?? [])
    .map((slug) => SUBVERTICALS.find((sv) => sv.slug === slug))
    .filter(Boolean) as typeof SUBVERTICALS;

  const completeness = (() => {
    if (!profile) return 0;
    let pts = 0;
    if (profile.displayName) pts += 20;
    if (profile.bio && profile.bio.length > 30) pts += 20;
    if (profile.city) pts += 10;
    if (profile.age) pts += 10;
    if ((profile.interests?.length ?? 0) >= 3) pts += 20;
    if ((profile.prompts?.length ?? 0) >= 1) pts += 20;
    return pts;
  })();

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Meu perfil</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Preview do que aparece pros matches. Backend wireado em W-R-4.
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link
            href="/perfil/editar"
            className="px-3 py-1.5 rounded-lg bg-fuchsia-600 text-white hover:bg-fuchsia-700"
          >
            Editar
          </Link>
          <Link
            href="/perfil/verificar"
            className="px-3 py-1.5 rounded-lg border border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/30"
          >
            ✓ Verificar
          </Link>
        </div>
      </header>

      {/* Completeness */}
      <section className="mb-6 p-4 rounded-xl border border-border bg-muted/30">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            Completude do perfil: {completeness}%
          </span>
          <span className="text-xs text-muted-foreground">
            Perfil completo recebe ate 3x mais matches
          </span>
        </div>
        <div
          className="h-2 rounded-full bg-muted overflow-hidden"
          role="progressbar"
          aria-valuenow={completeness}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-fuchsia-600 transition-all"
            style={{ width: `${completeness}%` }}
          />
        </div>
      </section>

      {!loaded ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Carregando perfil local...
        </div>
      ) : !profile || !profile.displayName ? (
        <div className="text-center py-12 border border-border rounded-2xl bg-muted/30">
          <p className="text-3xl mb-2">👤</p>
          <p className="font-medium">Voce ainda nao montou seu perfil</p>
          <p className="text-sm text-muted-foreground mt-1">
            Comece adicionando nome, fotos, bio e prompts.
          </p>
          <Link
            href="/perfil/editar"
            className="inline-block mt-4 px-5 py-2 rounded-lg bg-fuchsia-600 text-white font-medium hover:bg-fuchsia-700"
          >
            Criar perfil
          </Link>
        </div>
      ) : (
        <article className="rounded-2xl border border-border overflow-hidden">
          <div className="h-48 bg-gradient-to-br from-fuchsia-300 via-rose-300 to-amber-300 dark:from-fuchsia-900/40 dark:via-rose-900/40 dark:to-amber-900/40 flex items-center justify-center">
            <span className="text-7xl opacity-30">👤</span>
          </div>
          <div className="p-6 space-y-4">
            <header>
              <h2 className="text-2xl font-semibold">
                {profile.displayName}
                {profile.age && (
                  <span className="text-muted-foreground">
                    , {profile.age}
                  </span>
                )}
              </h2>
              {profile.city && (
                <p className="text-sm text-muted-foreground">{profile.city}</p>
              )}
            </header>

            {profile.bio && (
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {profile.bio}
              </p>
            )}

            {profile.prompts && profile.prompts.length > 0 && (
              <div className="space-y-3">
                {profile.prompts
                  .filter((p) => p.answer.trim())
                  .map((p) => (
                    <div
                      key={p.id}
                      className="rounded-lg border border-border p-3 bg-muted/30"
                    >
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        {p.question}
                      </p>
                      <p className="text-sm">{p.answer}</p>
                    </div>
                  ))}
              </div>
            )}

            {interestsLabels.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Interesses
                </p>
                <div className="flex flex-wrap gap-2">
                  {interestsLabels.map((sv) => (
                    <span
                      key={sv.slug}
                      className="text-xs bg-muted px-2 py-1 rounded-full"
                    >
                      {sv.emoji} {sv.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </article>
      )}
    </main>
  );
}
