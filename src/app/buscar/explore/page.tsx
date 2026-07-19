// Relacionamentos — Explore (perfis afinidade)
// WIRE_REAL: grid de sugestoes via GraphQL discoverProfiles, ranqueado por score.
// REL-S9: o motivo REAL da sugestao vem de `reasons` — "frequentam os mesmos
// lugares" (mesma cidade) e "estiveram no mesmo evento" (co-attendance). So
// aparece quando o backend capturou o sinal; matchedInterests fica de fallback.
// Zero-mock: estados loading/ready/empty/error; sem fake data inventada.

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SUBVERTICALS } from "@/lib/subverticals";

const DISCOVER_PROFILES_QUERY = /* GraphQL */ `
  query DiscoverProfilesExplore($filters: DiscoveryFiltersInput) {
    discoverProfiles(filters: $filters) {
      profiles {
        id
        displayName
        avatar
        age
        distance
        bio
        interests
        matchedInterests
        score
        reasons {
          kind
          label
          detail
          count
        }
      }
      nextCursor
    }
  }
`;

interface SuggestionReason {
  kind: string;
  label: string;
  detail: string | null;
  count: number;
}

interface DiscoveryProfile {
  id: string;
  displayName: string | null;
  avatar: string | null;
  age: number | null;
  distance: number | null;
  bio: string | null;
  interests: string[];
  matchedInterests: string[];
  score: number;
  reasons: SuggestionReason[];
}

type LoadState = "loading" | "ready" | "empty" | "error";
type SortMode = "affinity" | "nearby";

async function fetchDiscovery(
  subverticais: string[] | null,
): Promise<DiscoveryProfile[]> {
  const res = await fetch("/api/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      query: DISCOVER_PROFILES_QUERY,
      variables: {
        filters: {
          limit: 30,
          cursor: 0,
          ...(subverticais && subverticais.length > 0 ? { subverticais } : {}),
        },
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const json = (await res.json()) as {
    data?: { discoverProfiles: { profiles: DiscoveryProfile[] } | null };
    errors?: { message: string }[];
  };
  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors[0]?.message ?? "GraphQL error");
  }
  return json.data?.discoverProfiles?.profiles ?? [];
}

export default function ExplorePage() {
  const [sort, setSort] = useState<SortMode>("affinity");
  const [filterVertical, setFilterVertical] = useState<string>("all");

  const [state, setState] = useState<LoadState>("loading");
  const [profiles, setProfiles] = useState<DiscoveryProfile[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const subverticais =
          filterVertical === "all" ? null : [filterVertical];
        const items = await fetchDiscovery(subverticais);
        if (cancelled) return;
        if (items.length === 0) {
          setProfiles([]);
          setState("empty");
          return;
        }
        setProfiles(items);
        setState("ready");
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof Error ? err.message : "Falha ao carregar sugestoes";
        setErrorMessage(msg);
        setState("error");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [filterVertical]);

  const list = useMemo(() => {
    const sorted = [...profiles];
    if (sort === "affinity") {
      sorted.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    } else if (sort === "nearby") {
      sorted.sort(
        (a, b) =>
          (a.distance ?? Number.POSITIVE_INFINITY) -
          (b.distance ?? Number.POSITIVE_INFINITY),
      );
    }
    return sorted;
  }, [profiles, sort]);

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Explorar</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sugestoes ranqueadas por afinidade real (discoverProfiles).
          </p>
        </div>
        <Link
          href="/buscar"
          className="text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-accent"
        >
          Voltar deck
        </Link>
      </header>

      <div className="flex flex-wrap gap-2 mb-4">
        <select
          aria-label="Ordenacao"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
          className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
        >
          <option value="affinity">Maior afinidade</option>
          <option value="nearby">Mais proximos</option>
        </select>
        <select
          aria-label="Vertical"
          value={filterVertical}
          onChange={(e) => setFilterVertical(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
        >
          <option value="all">Todas verticais</option>
          {SUBVERTICALS.map((sv) => (
            <option key={sv.slug} value={sv.slug}>
              {sv.emoji} {sv.label}
            </option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {state === "loading" && (
        <div
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
          role="status"
          aria-live="polite"
          aria-label="Carregando sugestoes"
        >
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-52 rounded-2xl border border-border bg-muted/30 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Error */}
      {state === "error" && (
        <div
          className="text-center py-12 border border-rose-800 rounded-2xl bg-rose-950/20"
          role="alert"
        >
          <p className="font-medium text-rose-300">
            Nao foi possivel carregar sugestoes
          </p>
          <p className="text-sm text-rose-400/80 mt-2">{errorMessage}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 text-sm rounded-lg border border-rose-700 hover:bg-rose-900/40"
          >
            Tentar de novo
          </button>
        </div>
      )}

      {/* Empty */}
      {state === "empty" && (
        <div className="text-center py-12 border border-border rounded-xl bg-muted/30">
          <p className="text-muted-foreground">
            Nenhuma sugestao com esses filtros agora.
          </p>
        </div>
      )}

      {/* Ready */}
      {state === "ready" && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((p) => {
            const affinity = Math.round((p.score ?? 0) * 100);
            return (
              <article
                key={p.id}
                className="border border-border rounded-2xl p-5 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">
                      {p.displayName ?? "Perfil"}
                      {p.age != null && `, ${p.age}`}
                    </h3>
                    {p.distance != null && (
                      <p className="text-xs text-muted-foreground">
                        {Math.round(p.distance)} km
                      </p>
                    )}
                  </div>
                  {affinity > 0 && (
                    <span className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-1 rounded-full font-semibold">
                      {affinity}%
                    </span>
                  )}
                </div>
                {/* REL-S9: motivo REAL da sugestao (so sinais capturados). */}
                {p.reasons.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5 mb-3">
                    {p.reasons.map((reason) => (
                      <li
                        key={reason.kind}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-700 dark:text-fuchsia-300"
                        title={reason.detail ?? undefined}
                      >
                        <span aria-hidden>
                          {reason.kind === "PLACES" ? "📍" : "🎟️"}
                        </span>
                        <span>{reason.label}</span>
                        {reason.detail && (
                          <span className="opacity-70">· {reason.detail}</span>
                        )}
                        {reason.kind === "EVENTS" && reason.count > 1 && (
                          <span className="opacity-70">({reason.count})</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {p.matchedInterests.length > 0 ? (
                  <ul className="text-xs text-muted-foreground space-y-1 mb-4">
                    {p.matchedInterests.slice(0, 4).map((r) => (
                      <li key={r}>· {r}</li>
                    ))}
                  </ul>
                ) : p.reasons.length === 0 && p.bio ? (
                  <p className="text-xs text-muted-foreground mb-4 line-clamp-3">
                    {p.bio}
                  </p>
                ) : (
                  <div className="mb-4" />
                )}
                <div className="flex gap-2">
                  <Link
                    href={`/perfil/${p.id}`}
                    className="flex-1 text-center px-3 py-2 text-sm rounded-lg bg-fuchsia-600 text-white hover:bg-fuchsia-700"
                  >
                    Ver perfil
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
