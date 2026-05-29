// Relacionamentos — Super-likes
// WIRE_REAL: via GraphQL myLikes filtrando type SUPER (gateway federado).
// Zero-mock: estados loading/ready/empty/error; sem fake data inventada.
//
// NOTA de contrato (introspection RelacLike): { id fromProfileId toProfileId
// type createdAt } — sem displayName/avatar/message. Renderiza os campos reais
// (perfil alvo + quando) sem inventar nome/idade/cidade/mensagem.

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const MY_LIKES_QUERY = /* GraphQL */ `
  query MyLikes($input: MyLikesFilterInput) {
    myLikes(input: $input) {
      id
      fromProfileId
      toProfileId
      type
      createdAt
    }
  }
`;

interface RelacLike {
  id: string;
  fromProfileId: string;
  toProfileId: string;
  type: string;
  createdAt: string;
}

type LoadState = "loading" | "ready" | "empty" | "error";

function isSuper(type: string): boolean {
  return type.toUpperCase().includes("SUPER");
}

async function fetchSuperLikes(limit: number): Promise<RelacLike[]> {
  const res = await fetch("/api/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      query: MY_LIKES_QUERY,
      variables: { input: { limit } },
    }),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const json = (await res.json()) as {
    data?: { myLikes: RelacLike[] | null };
    errors?: { message: string }[];
  };
  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors[0]?.message ?? "GraphQL error");
  }
  // O input nao expoe filtro de type — filtra os SUPER no cliente.
  return (json.data?.myLikes ?? []).filter((l) => isSuper(l.type));
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

export default function SuperLikesPage() {
  const [state, setState] = useState<LoadState>("loading");
  const [supers, setSupers] = useState<RelacLike[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const items = await fetchSuperLikes(50);
        if (cancelled) return;
        if (items.length === 0) {
          setSupers([]);
          setState("empty");
          return;
        }
        setSupers(items);
        setState("ready");
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof Error ? err.message : "Falha ao carregar super-likes";
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
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <span className="text-blue-500">★</span> Super-likes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Seus super-likes enviados. Resposta tem prioridade.
          </p>
        </div>
        <Link
          href="/matches"
          className="text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-accent"
        >
          Voltar
        </Link>
      </header>

      {/* Loading */}
      {state === "loading" && (
        <ul className="space-y-3" role="status" aria-live="polite">
          {[1, 2].map((i) => (
            <li
              key={i}
              className="h-28 rounded-2xl border border-border bg-muted/30 animate-pulse"
            />
          ))}
        </ul>
      )}

      {/* Error */}
      {state === "error" && (
        <div
          className="text-center py-12 border border-rose-800 rounded-2xl bg-rose-950/20"
          role="alert"
        >
          <p className="font-medium text-rose-300">
            Nao foi possivel carregar seus super-likes
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
          <p className="text-3xl mb-2">★</p>
          <p className="font-medium">Nenhum super-like ainda</p>
          <p className="text-sm text-muted-foreground mt-1">
            Use o super-like no feed pra se destacar — eles aparecem aqui.
          </p>
          <Link
            href="/buscar"
            className="mt-4 inline-block px-5 py-2 rounded-lg bg-fuchsia-600 text-white text-sm font-medium hover:bg-fuchsia-700"
          >
            Ir pro feed
          </Link>
        </div>
      )}

      {/* Ready */}
      {state === "ready" && (
        <ul className="space-y-3">
          {supers.map((s) => (
            <li
              key={s.id}
              className="border-2 border-blue-300 dark:border-blue-800 rounded-2xl p-5 bg-blue-50/30 dark:bg-blue-950/20 relative"
            >
              <div className="absolute top-3 right-3 text-blue-500 text-2xl">
                ★
              </div>
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-300 to-fuchsia-400 flex-shrink-0" />
                <div className="flex-1 min-w-0 pr-8">
                  <h3 className="font-semibold">
                    Perfil {s.toProfileId.slice(0, 8)}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Super-like · {formatWhen(s.createdAt)}
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Link
                      href={`/perfil/${s.toProfileId}`}
                      className="px-4 py-1.5 text-sm rounded-lg bg-fuchsia-600 text-white hover:bg-fuchsia-700"
                    >
                      Ver perfil
                    </Link>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
