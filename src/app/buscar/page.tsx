// Relacionamentos — Buscar (deck swipe Tinder-style)
// Sprint M8-1: deck card-stack com keyboard navigation (left=pass, right=like, up=super)
// WIRE_REAL: feed via GraphQL discoverProfiles(filters) no gateway federado.
// WIRE_REAL (swipe): cada swipe persiste no backend —
//   like/super -> acceptMatch(input:{likedProfileId,type}) -> LikeResult (status
//                 'matched' quando o reverso ja existe -> dispara aviso de match)
//   pass       -> rejectMatch(input:{likedProfileId}) (soft-remove, idempotente)
// Auth + anti-IDOR sao server-side: o resolver deriva o likerId do JWT (user.sub)
// via resolveProfileIdOrThrow; o client nunca manda o proprio id.
// Zero-mock: estados loading/ready/empty/error; swipe nao e mais descartado.

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SUBVERTICALS } from "@/lib/subverticals";

// Contrato do gateway (introspection DiscoveryFeedResultGql / DiscoveryProfile):
//   discoverProfiles(filters: DiscoveryFiltersInput): DiscoveryFeedResultGql!
//   DiscoveryProfile { id displayName avatar age distance bio interests score ... }
const DISCOVER_PROFILES_QUERY = /* GraphQL */ `
  query DiscoverProfiles($filters: DiscoveryFiltersInput) {
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
      }
      nextCursor
    }
  }
`;

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
}

type SwipeAction = "pass" | "like" | "super";
type LoadState = "loading" | "ready" | "empty" | "error";

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
          limit: 20,
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

const ACCEPT_MATCH_MUTATION = /* GraphQL */ `
  mutation AcceptMatch($input: LikeProfileInput!) {
    acceptMatch(input: $input) {
      status
      match {
        id
      }
    }
  }
`;

const REJECT_MATCH_MUTATION = /* GraphQL */ `
  mutation RejectMatch($input: LikeProfileInput!) {
    rejectMatch(input: $input)
  }
`;

/**
 * Persiste o swipe no backend. Retorna se virou match (so para like/super).
 * Anti-IDOR: o resolver deriva o likerId do JWT; so mandamos o alvo + tipo.
 */
async function persistSwipe(
  profileId: string,
  action: SwipeAction,
): Promise<{ matched: boolean }> {
  if (action === "pass") {
    const res = await fetch("/api/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        query: REJECT_MATCH_MUTATION,
        variables: { input: { likedProfileId: profileId } },
      }),
    });
    if (!res.ok && res.status !== 400) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { errors?: { message: string }[] };
    if (json.errors && json.errors.length > 0) {
      throw new Error(json.errors[0]?.message ?? "GraphQL error");
    }
    return { matched: false };
  }

  const res = await fetch("/api/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      query: ACCEPT_MATCH_MUTATION,
      variables: {
        input: {
          likedProfileId: profileId,
          type: action === "super" ? "SUPER_LIKE" : "LIKE",
        },
      },
    }),
  });
  if (!res.ok && res.status !== 400) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as {
    data?: { acceptMatch: { status: string } | null };
    errors?: { message: string }[];
  };
  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors[0]?.message ?? "GraphQL error");
  }
  return { matched: json.data?.acceptMatch?.status === "matched" };
}

export default function BuscarPage() {
  const [activeVertical, setActiveVertical] = useState<string>("all");
  const [cursor, setCursor] = useState(0);
  const [history, setHistory] = useState<{ id: string; action: SwipeAction }[]>(
    [],
  );
  const [dragX, setDragX] = useState(0);

  const [state, setState] = useState<LoadState>("loading");
  const [deck, setDeck] = useState<DiscoveryProfile[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [matchToast, setMatchToast] = useState<string | null>(null);
  const [swipeError, setSwipeError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      setCursor(0);
      setHistory([]);
      try {
        const subverticais = activeVertical === "all" ? null : [activeVertical];
        const items = await fetchDiscovery(subverticais);
        if (cancelled) return;
        if (items.length === 0) {
          setDeck([]);
          setState("empty");
          return;
        }
        setDeck(items);
        setState("ready");
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof Error ? err.message : "Falha ao carregar o feed";
        setErrorMessage(msg);
        setState("error");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [activeVertical]);

  const current = deck[cursor];
  const next = deck[cursor + 1];

  const swipe = useCallback(
    (action: SwipeAction) => {
      const c = deck[cursor];
      if (!c) return;
      // Avanca o card de imediato (UX), mas persiste o swipe no backend.
      setHistory((h) => [...h, { id: c.id, action }]);
      setCursor((idx) => idx + 1);
      setDragX(0);
      setSwipeError(null);
      void persistSwipe(c.id, action)
        .then(({ matched }) => {
          if (matched) {
            setMatchToast(c.displayName ?? "Voce tem um novo match!");
          }
        })
        .catch((err: unknown) => {
          setSwipeError(
            err instanceof Error
              ? `Nao foi possivel registrar o ultimo swipe: ${err.message}`
              : "Nao foi possivel registrar o ultimo swipe.",
          );
        });
    },
    [deck, cursor],
  );

  // Keyboard nav: ArrowLeft=pass, ArrowRight=like, ArrowUp=super
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") swipe("pass");
      if (e.key === "ArrowRight") swipe("like");
      if (e.key === "ArrowUp") swipe("super");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [swipe]);

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <header className="mb-4 flex items-baseline justify-between">
        <div>
          <h1 className="text-3xl font-bold">Buscar conexoes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Deck Tinder-style. Feed real via discoverProfiles.
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link
            href="/buscar/filtros"
            className="px-3 py-1.5 rounded-lg border border-border hover:bg-accent"
          >
            Filtros
          </Link>
          <Link
            href="/buscar/explore"
            className="px-3 py-1.5 rounded-lg border border-border hover:bg-accent"
          >
            Explorar
          </Link>
          <Link
            href="/sugestoes"
            className="px-3 py-1.5 rounded-lg border border-border hover:bg-accent"
          >
            Sugestoes
          </Link>
        </div>
      </header>

      {/* Aviso de match real (acceptMatch retornou status 'matched') */}
      {matchToast && (
        <div
          className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-fuchsia-500/50 bg-fuchsia-600/10 px-4 py-3"
          role="status"
          aria-live="polite"
        >
          <p className="text-sm font-medium text-fuchsia-700 dark:text-fuchsia-300">
            🎉 Deu match com {matchToast}! Veja em{" "}
            <Link href="/matches" className="underline">
              Matches
            </Link>
            .
          </p>
          <button
            onClick={() => setMatchToast(null)}
            aria-label="Fechar aviso"
            className="text-fuchsia-700 dark:text-fuchsia-300 hover:opacity-70"
          >
            ✕
          </button>
        </div>
      )}

      {/* Erro ao persistir o ultimo swipe (nao bloqueia o deck) */}
      {swipeError && (
        <div
          className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-700 dark:text-amber-300"
          role="alert"
        >
          {swipeError}
        </div>
      )}

      {/* Filtros por vertical */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-6 border-b border-border">
        <button
          onClick={() => setActiveVertical("all")}
          className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            activeVertical === "all"
              ? "bg-fuchsia-600 text-white"
              : "bg-muted hover:bg-accent"
          }`}
        >
          Todos
        </button>
        {SUBVERTICALS.slice(0, 8).map((sv) => (
          <button
            key={sv.slug}
            onClick={() => setActiveVertical(sv.slug)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              activeVertical === sv.slug
                ? "bg-fuchsia-600 text-white"
                : "bg-muted hover:bg-accent"
            }`}
          >
            {sv.emoji} {sv.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {state === "loading" && (
        <div
          className="h-[480px] rounded-2xl border border-border bg-muted/30 animate-pulse"
          role="status"
          aria-live="polite"
          aria-label="Carregando perfis"
        />
      )}

      {/* Error */}
      {state === "error" && (
        <div
          className="text-center py-16 border border-rose-800 rounded-2xl bg-rose-950/20"
          role="alert"
        >
          <p className="font-medium text-rose-300">
            Nao foi possivel carregar o feed
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
        <div className="text-center py-16 border border-border rounded-2xl bg-muted/30">
          <p className="text-2xl mb-2">🎴</p>
          <p className="font-medium">Nenhum perfil por aqui ainda</p>
          <p className="text-sm text-muted-foreground mt-2">
            Ajuste os filtros ou volte mais tarde — novos perfis aparecem aqui
            conforme entram na sua regiao.
          </p>
        </div>
      )}

      {/* Ready — fim do deck */}
      {state === "ready" && !current && (
        <div className="text-center py-16 border border-border rounded-2xl bg-muted/30">
          <p className="text-2xl mb-2">🎴</p>
          <p className="font-medium">Voce viu todos por aqui</p>
          <p className="text-sm text-muted-foreground mt-2">
            {history.length} avaliacoes nesta sessao. Volte mais tarde ou
            ajuste filtros.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 text-sm rounded-lg border border-border hover:bg-accent"
          >
            Recarregar feed
          </button>
        </div>
      )}

      {/* Ready — deck ativo */}
      {state === "ready" && current && (
        <>
          <div className="relative h-[480px] mb-6">
            {/* Card de baixo (proximo) */}
            {next && (
              <article
                aria-hidden
                className="absolute inset-0 rounded-2xl border border-border bg-card shadow-md scale-95 opacity-60"
              >
                <CardContent profile={next} dragX={0} />
              </article>
            )}
            {/* Card atual */}
            <article
              role="region"
              aria-label={`Card de ${current.displayName ?? "perfil"}`}
              onMouseDown={(e) => {
                const startX = e.clientX;
                const onMove = (ev: MouseEvent) =>
                  setDragX(ev.clientX - startX);
                const onUp = () => {
                  window.removeEventListener("mousemove", onMove);
                  window.removeEventListener("mouseup", onUp);
                  if (dragX > 120) swipe("like");
                  else if (dragX < -120) swipe("pass");
                  else setDragX(0);
                };
                window.addEventListener("mousemove", onMove);
                window.addEventListener("mouseup", onUp);
              }}
              className="absolute inset-0 rounded-2xl border border-border bg-card shadow-xl cursor-grab active:cursor-grabbing transition-transform"
              style={{
                transform: `translateX(${dragX}px) rotate(${dragX * 0.05}deg)`,
              }}
            >
              <CardContent profile={current} dragX={dragX} />
            </article>
          </div>

          {/* Acoes */}
          <div className="flex justify-center gap-4">
            <button
              onClick={() => swipe("pass")}
              aria-label="Passar (seta esquerda)"
              className="w-14 h-14 rounded-full bg-white dark:bg-zinc-900 border border-border shadow hover:bg-rose-50 dark:hover:bg-rose-950 text-2xl"
            >
              ✕
            </button>
            <button
              onClick={() => swipe("super")}
              aria-label="Super-like (seta cima)"
              className="w-14 h-14 rounded-full bg-white dark:bg-zinc-900 border border-border shadow hover:bg-blue-50 dark:hover:bg-blue-950 text-2xl"
            >
              ★
            </button>
            <button
              onClick={() => swipe("like")}
              aria-label="Curtir (seta direita)"
              className="w-14 h-14 rounded-full bg-white dark:bg-zinc-900 border border-border shadow hover:bg-emerald-50 dark:hover:bg-emerald-950 text-2xl"
            >
              ♡
            </button>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-4">
            Atalhos: ← passar · ↑ super · → curtir
          </p>
        </>
      )}
    </main>
  );
}

function CardContent({
  profile,
  dragX,
}: {
  profile: DiscoveryProfile;
  dragX: number;
}) {
  const compatibility = Math.round((profile.score ?? 0) * 100);
  return (
    <div className="relative h-full p-6 flex flex-col">
      <div className="flex-1 rounded-xl bg-gradient-to-br from-fuchsia-200 via-rose-200 to-amber-200 dark:from-fuchsia-900/40 dark:via-rose-900/40 dark:to-amber-900/40 mb-4 flex items-center justify-center overflow-hidden">
        {profile.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatar}
            alt={profile.displayName ?? "Perfil"}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-6xl opacity-30">👤</span>
        )}
      </div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">
            {profile.displayName ?? "Perfil"}
            {profile.age != null && `, ${profile.age}`}
          </h2>
          {profile.distance != null && (
            <p className="text-sm text-muted-foreground">
              {Math.round(profile.distance)} km
            </p>
          )}
        </div>
        {compatibility > 0 && (
          <span className="shrink-0 text-xs bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-700 dark:text-fuchsia-300 px-2 py-1 rounded-full">
            {compatibility}% match
          </span>
        )}
      </div>
      {profile.bio && (
        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
          {profile.bio}
        </p>
      )}
      {profile.interests.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {profile.interests.slice(0, 6).map((tag) => {
            const matched = profile.matchedInterests.includes(tag);
            return (
              <span
                key={tag}
                className={`text-[11px] px-2 py-0.5 rounded-full ${
                  matched
                    ? "bg-fuchsia-600/20 text-fuchsia-700 dark:text-fuchsia-300 border border-fuchsia-500/40"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {tag}
              </span>
            );
          })}
        </div>
      )}
      {/* Overlays drag */}
      {dragX > 40 && (
        <div className="absolute top-8 left-8 px-3 py-1 border-2 border-emerald-500 text-emerald-500 text-xl font-bold rounded rotate-[-12deg]">
          CURTIR
        </div>
      )}
      {dragX < -40 && (
        <div className="absolute top-8 right-8 px-3 py-1 border-2 border-rose-500 text-rose-500 text-xl font-bold rounded rotate-[12deg]">
          PASSAR
        </div>
      )}
    </div>
  );
}
