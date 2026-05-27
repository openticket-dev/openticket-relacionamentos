// Relacionamentos — Quem curtiu voce (premium gate)
// Sprint M8-1: lista de likes recebidos. Free user ve blur+count, premium ve cards.
// Backend: W-R-2 wira query GraphQL receivedLikes + auth.subscription tier check.

"use client";

import Link from "next/link";
import { useState } from "react";

type LikeProfile = {
  id: string;
  name_PLACEHOLDER: string;
  age_PLACEHOLDER: number;
  city_PLACEHOLDER: string;
  likedAt_PLACEHOLDER: string;
};

const PLACEHOLDER_LIKES: LikeProfile[] = [
  {
    id: "lk-1",
    name_PLACEHOLDER: "Curtiu voce 1",
    age_PLACEHOLDER: 26,
    city_PLACEHOLDER: "Sao Paulo, SP",
    likedAt_PLACEHOLDER: "ha 1h",
  },
  {
    id: "lk-2",
    name_PLACEHOLDER: "Curtiu voce 2",
    age_PLACEHOLDER: 31,
    city_PLACEHOLDER: "Rio, RJ",
    likedAt_PLACEHOLDER: "ha 4h",
  },
  {
    id: "lk-3",
    name_PLACEHOLDER: "Curtiu voce 3",
    age_PLACEHOLDER: 24,
    city_PLACEHOLDER: "Florianopolis, SC",
    likedAt_PLACEHOLDER: "ontem",
  },
  {
    id: "lk-4",
    name_PLACEHOLDER: "Curtiu voce 4",
    age_PLACEHOLDER: 29,
    city_PLACEHOLDER: "Curitiba, PR",
    likedAt_PLACEHOLDER: "ha 2d",
  },
  {
    id: "lk-5",
    name_PLACEHOLDER: "Curtiu voce 5",
    age_PLACEHOLDER: 33,
    city_PLACEHOLDER: "Salvador, BA",
    likedAt_PLACEHOLDER: "semana passada",
  },
];

export default function LikesPage() {
  // PLACEHOLDER: detectar tier real via auth/subscription em W-R-2 + W-R-7
  // Por enquanto, permite toggle local pra preview
  const [isPremium, setIsPremium] = useState(false);

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Quem curtiu voce</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {PLACEHOLDER_LIKES.length} pessoas curtiram seu perfil. Premium
            destrava a lista completa.
          </p>
        </div>
        <Link
          href="/matches"
          className="text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-accent"
        >
          Voltar
        </Link>
      </header>

      {/* Preview toggle (debug — remover quando auth real conectar) */}
      <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300">
        <strong>Preview:</strong> tier checking sera ligado em W-R-7 (Stripe
        subscription). Toggle abaixo simula state.{" "}
        <button
          onClick={() => setIsPremium((v) => !v)}
          className="ml-2 underline font-medium"
        >
          {isPremium ? "Voltar pra free" : "Simular premium"}
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {PLACEHOLDER_LIKES.map((l) => (
          <article
            key={l.id}
            className="border border-border rounded-2xl p-5 relative overflow-hidden"
          >
            {!isPremium && (
              <div
                aria-hidden
                className="absolute inset-0 backdrop-blur-md bg-background/30 z-10 flex items-center justify-center"
              >
                <span className="text-3xl opacity-60">🔒</span>
              </div>
            )}
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-semibold">
                  {isPremium
                    ? `${l.name_PLACEHOLDER}, ${l.age_PLACEHOLDER}`
                    : "Perfil oculto"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {isPremium ? l.city_PLACEHOLDER : "—"}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                {l.likedAt_PLACEHOLDER}
              </span>
            </div>
            <div className="h-32 rounded-xl bg-gradient-to-br from-fuchsia-200 via-rose-200 to-amber-200 dark:from-fuchsia-900/40 dark:via-rose-900/40 dark:to-amber-900/40 mb-3 flex items-center justify-center">
              <span className="text-4xl opacity-30">👤</span>
            </div>
            {isPremium ? (
              <div className="flex gap-2">
                <Link
                  href={`/chat/${l.id}`}
                  className="flex-1 text-center px-3 py-2 text-sm rounded-lg bg-fuchsia-600 text-white hover:bg-fuchsia-700"
                >
                  Curtir de volta
                </Link>
              </div>
            ) : (
              <Link
                href="/perfil"
                className="block text-center px-3 py-2 text-sm rounded-lg bg-fuchsia-600 text-white hover:bg-fuchsia-700"
              >
                Upgrade para ver
              </Link>
            )}
          </article>
        ))}
      </div>

      {!isPremium && (
        <div className="mt-8 text-center p-6 rounded-2xl border border-border bg-gradient-to-br from-fuchsia-50 to-rose-50 dark:from-fuchsia-950/30 dark:to-rose-950/30">
          <p className="text-2xl mb-2">⭐</p>
          <h2 className="font-semibold text-lg">Veja quem te curtiu</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-3">
            Premium libera a lista completa, super-likes ilimitados e perfil
            destacado.
          </p>
          <Link
            href="/premium"
            className="inline-block px-5 py-2 rounded-lg bg-fuchsia-600 text-white font-medium hover:bg-fuchsia-700 transition-colors"
          >
            Ver planos premium
          </Link>
        </div>
      )}
    </main>
  );
}
