/**
 * /perfil/[id] — Perfil publico de outro usuario com Heart Pulse 3D.
 *
 * Mostra perfil do match candidato com coracao 3D pulsando proporcional
 * a compatibilidade. Heart 3D = "esse match e vivo, tem energia".
 *
 * Wave: 3D-EXPANSION (J1D) · 62 -> 66
 * Stack: Next 16 App Router + R3F 9 (Tier 3).
 * Zero-mock: dados via fetch direto pro api gateway; sem fake data inventada.
 *   Quando endpoint nao existe ainda (esperado), mostra estado empty/error real.
 */

"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { HeartPulse3D } from "@/components/HeartPulse3D";
import { SaveToFavoritesButton } from "@/components/SaveToFavoritesButton";

const PROFILE_BY_ID_QUERY = /* GraphQL */ `
  query ProfileById($id: ID!) {
    profileById(id: $id) {
      id
      displayName
      age
      city
      bio
      photos { id previewUrl }
      compatibility
      lastActiveAt
    }
  }
`;

interface ProfileByIdData {
  id: string;
  displayName: string;
  age: number | null;
  city: string | null;
  bio: string | null;
  photos: { id: string; previewUrl: string }[];
  compatibility: number | null;
  lastActiveAt: string | null;
}

type LoadState = "loading" | "ready" | "empty" | "error";

async function fetchProfile(id: string): Promise<ProfileByIdData | null> {
  const res = await fetch("/api/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: PROFILE_BY_ID_QUERY, variables: { id } }),
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const json = (await res.json()) as {
    data?: { profileById: ProfileByIdData | null };
    errors?: { message: string }[];
  };
  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors[0]?.message ?? "GraphQL error");
  }
  return json.data?.profileById ?? null;
}

export default function ProfileByIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [state, setState] = useState<LoadState>("loading");
  const [profile, setProfile] = useState<ProfileByIdData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const data = await fetchProfile(id);
        if (cancelled) return;
        if (!data) {
          setState("empty");
          return;
        }
        setProfile(data);
        setState("ready");
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Falha ao carregar perfil";
        setErrorMessage(msg);
        setState("error");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // TELA QUE MENTE (corrigido): aqui havia `profile?.compatibility ?? 0.7`.
  // O campo e `compatibility: number | null` — quando o gateway nao calcula o
  // score, o fallback 0.7 fazia a tela imprimir "70% compativel" e dizer a
  // mesma coisa no aria-label. Numero escrito pelo front, lido pelo usuario
  // como veredito do algoritmo, numa vertical que cobra por revelacao de lead.
  // Agora: score nulo => nao ha selo e nao ha porcentagem em lugar nenhum.
  // O coracao 3D continua batendo no ritmo padrao dele (decoracao, nao dado).
  const compatibility = profile?.compatibility ?? null;
  const compatibilityPct =
    compatibility != null ? Math.round(compatibility * 100) : null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <nav className="mb-4">
          <Link
            href="/buscar"
            className="text-sm text-fuchsia-300 hover:text-fuchsia-200 inline-flex items-center gap-1"
          >
            ← Voltar pra buscar
          </Link>
        </nav>

        {/* Loading state */}
        {state === "loading" && (
          <div
            className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-center"
            role="status"
            aria-live="polite"
          >
            <div className="h-72 w-full rounded-xl bg-zinc-800/30 animate-pulse mb-4" />
            <p className="text-sm text-zinc-400">Carregando perfil...</p>
          </div>
        )}

        {/* Error state */}
        {state === "error" && (
          <div
            className="rounded-2xl border border-rose-800 bg-rose-950/30 p-8 text-center"
            role="alert"
          >
            <p className="text-lg font-semibold mb-1">Nao foi possivel abrir o perfil</p>
            <p className="text-sm text-rose-300 mb-4">{errorMessage}</p>
            <Link
              href="/buscar"
              className="inline-block px-4 py-2 rounded-lg bg-rose-700 hover:bg-rose-600 text-sm font-medium"
            >
              Voltar
            </Link>
          </div>
        )}

        {/* Empty state */}
        {state === "empty" && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-10 text-center">
            <p className="text-5xl mb-3">👻</p>
            <p className="text-lg font-semibold">Perfil nao encontrado</p>
            <p className="text-sm text-zinc-400 mt-1 mb-4">
              Talvez tenha sido removido ou voce nao tem acesso a esse perfil.
            </p>
            <Link
              href="/buscar"
              className="inline-block px-4 py-2 rounded-lg bg-fuchsia-700 hover:bg-fuchsia-600 text-sm font-medium"
            >
              Ver outros perfis
            </Link>
          </div>
        )}

        {/* Ready state */}
        {state === "ready" && profile && (
          <article className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
            {/* Heart Pulse 3D — pulsa proporcional a compatibilidade */}
            <div className="relative">
              <HeartPulse3D
                {...(compatibility != null ? { compatibility } : {})}
                ariaLabel={
                  compatibilityPct != null
                    ? `Compatibilidade de ${compatibilityPct} porcento com ${profile.displayName}`
                    : `Perfil de ${profile.displayName}. Compatibilidade ainda nao calculada.`
                }
                className="h-72 sm:h-80 w-full bg-gradient-to-br from-fuchsia-950/40 via-rose-950/30 to-zinc-950/60"
              />
              {compatibilityPct != null ? (
                <div className="absolute top-4 right-4 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm border border-fuchsia-700/50 text-xs font-semibold text-fuchsia-200">
                  {compatibilityPct}% compativel
                </div>
              ) : (
                <div className="absolute top-4 right-4 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm border border-zinc-700 text-xs font-medium text-zinc-300">
                  Compatibilidade nao calculada
                </div>
              )}
            </div>

            {/* Profile content */}
            <div className="p-6 space-y-4">
              <header>
                <h1 className="text-2xl font-bold">
                  {profile.displayName}
                  {profile.age != null && (
                    <span className="text-zinc-400 font-normal">
                      , {profile.age}
                    </span>
                  )}
                </h1>
                {profile.city && (
                  <p className="text-sm text-zinc-400">{profile.city}</p>
                )}
              </header>

              {profile.bio && (
                <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
                  {profile.bio}
                </p>
              )}

              {profile.photos.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {profile.photos.slice(0, 6).map((photo) => (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      key={photo.id}
                      src={photo.previewUrl}
                      alt=""
                      className="aspect-square w-full rounded-lg object-cover border border-zinc-800"
                      loading="lazy"
                    />
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  href={`/chat/${profile.id}`}
                  className="flex-1 min-w-[160px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-700 text-sm font-semibold transition-colors"
                >
                  💬 Mandar mensagem
                </Link>
                <SaveToFavoritesButton
                  targetProfileId={profile.id}
                  className="min-w-[120px]"
                />
                <Link
                  href="/buscar"
                  className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-sm font-semibold transition-colors"
                >
                  Proximo
                </Link>
              </div>
            </div>
          </article>
        )}
      </div>
    </main>
  );
}
