// Relacionamentos — Sugestoes diarias (card 01.6 "Conexoes Sugeridas")
// WIRE_REAL: lista via GraphQL dailySuggestions, ranqueada pelo score do backend
// (DNA/afinidade + sinal geografico + co-attendance de eventos — REL-S9).
// REL-S9: o motivo REAL da sugestao vem de `reasons` — "frequentam os mesmos
// lugares" (mesma cidade) e "estiveram no mesmo evento" (co-attendance). So
// aparece quando o backend capturou o sinal — nunca inventado (zero-mock).
// Dispensar usa a mutation real dismissSuggestion. Estados loading/ready/empty/error.

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const DAILY_SUGGESTIONS_QUERY = /* GraphQL */ `
  query DailySuggestions($input: DailySuggestionsInput) {
    dailySuggestions(input: $input) {
      id
      profileId
      displayName
      avatar
      age
      distanceKm
      bio
      interests
      score
      source
      reasons {
        kind
        label
        detail
        count
      }
    }
  }
`;

const DISMISS_SUGGESTION_MUTATION = /* GraphQL */ `
  mutation DismissSuggestion($input: DismissSuggestionInput!) {
    dismissSuggestion(input: $input) {
      ok
    }
  }
`;

interface SuggestionReason {
  kind: string;
  label: string;
  detail: string | null;
  count: number;
}

interface SuggestionCard {
  id: string;
  profileId: string;
  displayName: string | null;
  avatar: string | null;
  age: number | null;
  distanceKm: number | null;
  bio: string | null;
  interests: string[];
  score: number;
  source: string | null;
  reasons: SuggestionReason[];
}

type LoadState = "loading" | "ready" | "empty" | "error";

async function fetchDailySuggestions(): Promise<SuggestionCard[]> {
  const res = await fetch("/api/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      query: DAILY_SUGGESTIONS_QUERY,
      variables: { input: { limit: 20 } },
    }),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const json = (await res.json()) as {
    data?: { dailySuggestions: SuggestionCard[] | null };
    errors?: { message: string }[];
  };
  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors[0]?.message ?? "GraphQL error");
  }
  return json.data?.dailySuggestions ?? [];
}

async function dismissSuggestion(
  suggestedId: string,
  source: string | null,
): Promise<boolean> {
  const res = await fetch("/api/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      query: DISMISS_SUGGESTION_MUTATION,
      variables: {
        input: {
          suggestedId,
          ...(source ? { source } : {}),
        },
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const json = (await res.json()) as {
    data?: { dismissSuggestion: { ok: boolean } | null };
    errors?: { message: string }[];
  };
  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors[0]?.message ?? "GraphQL error");
  }
  return json.data?.dismissSuggestion?.ok ?? false;
}

export default function SugestoesPage() {
  const [state, setState] = useState<LoadState>("loading");
  const [cards, setCards] = useState<SuggestionCard[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dismissing, setDismissing] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const items = await fetchDailySuggestions();
        if (cancelled) return;
        if (items.length === 0) {
          setCards([]);
          setState("empty");
          return;
        }
        setCards(items);
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
  }, []);

  const list = useMemo(
    () => [...cards].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
    [cards],
  );

  async function handleDismiss(card: SuggestionCard) {
    setDismissing((prev) => ({ ...prev, [card.profileId]: true }));
    try {
      const ok = await dismissSuggestion(card.profileId, card.source);
      if (ok) {
        setCards((prev) => {
          const next = prev.filter((c) => c.profileId !== card.profileId);
          if (next.length === 0) setState("empty");
          return next;
        });
      }
    } catch {
      // Falha ao dispensar nao derruba a lista — apenas libera o botao.
    } finally {
      setDismissing((prev) => {
        const next = { ...prev };
        delete next[card.profileId];
        return next;
      });
    }
  }

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Conexoes sugeridas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sugestoes do dia com o motivo real (dailySuggestions).
          </p>
        </div>
        <Link
          href="/buscar"
          className="text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-accent"
        >
          Voltar deck
        </Link>
      </header>

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
              className="h-56 rounded-2xl border border-border bg-muted/30 animate-pulse"
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
            Nenhuma sugestao por agora. Volte mais tarde.
          </p>
        </div>
      )}

      {/* Ready */}
      {state === "ready" && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((c) => {
            const affinity = Math.round((c.score ?? 0) * 100);
            const isDismissing = !!dismissing[c.profileId];
            return (
              <article
                key={c.id}
                className="border border-border rounded-2xl p-5 hover:shadow-lg transition-shadow flex flex-col"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">
                      {c.displayName ?? "Perfil"}
                      {c.age != null && `, ${c.age}`}
                    </h3>
                    {c.distanceKm != null && (
                      <p className="text-xs text-muted-foreground">
                        {Math.round(c.distanceKm)} km
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
                {c.reasons.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5 mb-3">
                    {c.reasons.map((reason) => (
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

                {c.reasons.length === 0 && c.bio ? (
                  <p className="text-xs text-muted-foreground mb-4 line-clamp-3">
                    {c.bio}
                  </p>
                ) : (
                  <div className="mb-4" />
                )}

                <div className="mt-auto flex gap-2">
                  <Link
                    href={`/perfil/${c.profileId}`}
                    className="flex-1 text-center px-3 py-2 text-sm rounded-lg bg-fuchsia-600 text-white hover:bg-fuchsia-700"
                  >
                    Ver perfil
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDismiss(c)}
                    disabled={isDismissing}
                    aria-label={`Dispensar sugestao ${c.displayName ?? "perfil"}`}
                    className="px-3 py-2 text-sm rounded-lg border border-border hover:bg-accent disabled:opacity-50"
                  >
                    {isDismissing ? "..." : "Dispensar"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
