// Relacionamentos — Quem demonstrou interesse no seu perfil (premium gate)
// WIRE_REAL: lista via GraphQL myProfileViewers (quem viu seu perfil) — o sinal
// de interesse real disponivel no gateway. Free user ve blur+count, premium ve cards.
// Zero-mock: estados loading/ready/empty/error; sem fake data inventada.
//
// D5 (par do backend openticket-api PR#661): o gate premium agora é REAL —
// `myDatingEntitlements.seeWhoLiked` decide se destrava as identidades (antes
// era um toggle "Simular premium" fake). Fail-closed: sem confirmar o tier, fica
// bloqueado (nunca finge premium). O backend TAMBÉM redige server-side
// (viewerId/displayName/avatar) pra free — este gate é a camada visual.
//
// NOTA de contrato: o gateway nao expoe `receivedLikes` (so `myLikes`, que sao
// os likes que VOCE enviou, sem displayName/avatar). `myProfileViewers` e a
// unica query com dado enriquecido (displayName + avatar + viewedAt) sobre quem
// se interessou pelo seu perfil — e o que alimenta esta tela.

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadMyEntitlements } from "@/lib/dating-billing-client";

// Contrato (introspection): myProfileViewers(input: MyProfileViewersInput): [ProfileViewer!]!
//   ProfileViewer { id viewerId displayName avatar viewedAt source }
const MY_PROFILE_VIEWERS_QUERY = /* GraphQL */ `
  query MyProfileViewers($input: MyProfileViewersInput) {
    myProfileViewers(input: $input) {
      id
      viewerId
      displayName
      avatar
      viewedAt
      source
    }
  }
`;

interface ProfileViewer {
  id: string;
  viewerId: string;
  displayName: string | null;
  avatar: string | null;
  viewedAt: string;
  source: string | null;
}

type LoadState = "loading" | "ready" | "empty" | "error";

async function fetchViewers(limit: number): Promise<ProfileViewer[]> {
  const res = await fetch("/api/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      query: MY_PROFILE_VIEWERS_QUERY,
      variables: { input: { limit } },
    }),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const json = (await res.json()) as {
    data?: { myProfileViewers: ProfileViewer[] | null };
    errors?: { message: string }[];
  };
  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors[0]?.message ?? "GraphQL error");
  }
  return json.data?.myProfileViewers ?? [];
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function LikesPage() {
  // Gate REAL: myDatingEntitlements.seeWhoLiked (GOLD/PLATINUM ativos). Fail-closed
  // → false enquanto não confirma (degradado / sem sessão / BE D5 offline).
  const [canSeeWhoLiked, setCanSeeWhoLiked] = useState(false);
  const [tierUnknown, setTierUnknown] = useState(false);

  const [state, setState] = useState<LoadState>("loading");
  const [viewers, setViewers] = useState<ProfileViewer[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ent = await loadMyEntitlements();
      if (cancelled) return;
      setCanSeeWhoLiked(ent.data.seeWhoLiked);
      setTierUnknown(ent.degraded);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const items = await fetchViewers(50);
        if (cancelled) return;
        if (items.length === 0) {
          setViewers([]);
          setState("empty");
          return;
        }
        setViewers(items);
        setState("ready");
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof Error ? err.message : "Falha ao carregar a lista";
        setErrorMessage(msg);
        setState("error");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Quem viu seu perfil</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {state === "ready"
              ? `${viewers.length} pessoas visualizaram seu perfil. Premium destrava a lista completa.`
              : "Quem demonstrou interesse no seu perfil. Premium destrava a lista completa."}
          </p>
        </div>
        <Link
          href="/matches"
          className="text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-accent"
        >
          Voltar
        </Link>
      </header>

      {/* Degrade honesto: só aparece se não deu pra confirmar o tier ao vivo. */}
      {tierUnknown && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300">
          Nao consegui confirmar seu plano agora — a lista fica bloqueada por
          seguranca (fail-closed) ate a checagem de tier conectar.
        </div>
      )}

      {/* Loading */}
      {state === "loading" && (
        <div
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
          role="status"
          aria-live="polite"
          aria-label="Carregando lista"
        >
          {[1, 2, 3].map((i) => (
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
            Nao foi possivel carregar a lista
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
          <p className="text-3xl mb-2">👀</p>
          <p className="font-medium">Ninguem viu seu perfil ainda</p>
          <p className="text-sm text-muted-foreground mt-2">
            Complete seu perfil e comece a curtir — as visualizacoes aparecem
            aqui.
          </p>
        </div>
      )}

      {/* Ready */}
      {state === "ready" && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {viewers.map((v) => (
            <article
              key={v.id}
              className="border border-border rounded-2xl p-5 relative overflow-hidden"
            >
              {!canSeeWhoLiked && (
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
                    {canSeeWhoLiked
                      ? (v.displayName ?? "Perfil")
                      : "Perfil oculto"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {canSeeWhoLiked && v.source ? v.source : "—"}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatWhen(v.viewedAt)}
                </span>
              </div>
              <div className="h-32 rounded-xl bg-gradient-to-br from-fuchsia-200 via-rose-200 to-amber-200 dark:from-fuchsia-900/40 dark:via-rose-900/40 dark:to-amber-900/40 mb-3 flex items-center justify-center overflow-hidden">
                {canSeeWhoLiked && v.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={v.avatar}
                    alt={v.displayName ?? "Perfil"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-4xl opacity-30">👤</span>
                )}
              </div>
              {canSeeWhoLiked ? (
                <Link
                  href={`/perfil/${v.viewerId}`}
                  className="block text-center px-3 py-2 text-sm rounded-lg bg-fuchsia-600 text-white hover:bg-fuchsia-700"
                >
                  Ver perfil
                </Link>
              ) : (
                <Link
                  href="/premium"
                  className="block text-center px-3 py-2 text-sm rounded-lg bg-fuchsia-600 text-white hover:bg-fuchsia-700"
                >
                  Upgrade para ver
                </Link>
              )}
            </article>
          ))}
        </div>
      )}

      {state === "ready" && !canSeeWhoLiked && (
        <div className="mt-8 text-center p-6 rounded-2xl border border-border bg-gradient-to-br from-fuchsia-50 to-rose-50 dark:from-fuchsia-950/30 dark:to-rose-950/30">
          <p className="text-2xl mb-2">⭐</p>
          <h2 className="font-semibold text-lg">Veja quem se interessou</h2>
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
