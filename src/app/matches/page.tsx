// Relacionamentos — Matches list
// WIRE_REAL: lista via GraphQL myMatches (gateway federado).
// Zero-mock: estados loading/ready/empty/error; sem fake data inventada.
//
// NOTA de contrato (introspection MyMatchEntity): a entidade traz
// { id targetProfileId intent note pinnedAt createdAt } — NAO ha displayName,
// avatar, "bucket" nem unreadCount no gateway. A UI renderiza os campos reais
// disponiveis (intent, note, quando) + link pro perfil/chat; busca filtra por
// note/intent. Sem inventar nome/idade/mensagem que o backend nao expoe.

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const MY_MATCHES_QUERY = /* GraphQL */ `
  query MyMatches {
    myMatches {
      id
      targetProfileId
      intent
      note
      pinnedAt
      createdAt
    }
  }
`;

interface MyMatch {
  id: string;
  targetProfileId: string;
  intent: string | null;
  note: string | null;
  pinnedAt: string | null;
  createdAt: string;
}

type LoadState = "loading" | "ready" | "empty" | "error";

async function fetchMatches(): Promise<MyMatch[]> {
  const res = await fetch("/api/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ query: MY_MATCHES_QUERY }),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const json = (await res.json()) as {
    data?: { myMatches: MyMatch[] | null };
    errors?: { message: string }[];
  };
  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors[0]?.message ?? "GraphQL error");
  }
  return json.data?.myMatches ?? [];
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function MatchesPage() {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<LoadState>("loading");
  const [matches, setMatches] = useState<MyMatch[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const items = await fetchMatches();
        if (cancelled) return;
        if (items.length === 0) {
          setMatches([]);
          setState("empty");
          return;
        }
        // Pinned primeiro, depois mais recentes.
        const sorted = [...items].sort((a, b) => {
          if (!!a.pinnedAt !== !!b.pinnedAt) return a.pinnedAt ? -1 : 1;
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        });
        setMatches(sorted);
        setState("ready");
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof Error ? err.message : "Falha ao carregar matches";
        setErrorMessage(msg);
        setState("error");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return matches;
    const q = query.trim().toLowerCase();
    return matches.filter(
      (m) =>
        (m.note ?? "").toLowerCase().includes(q) ||
        (m.intent ?? "").toLowerCase().includes(q) ||
        m.targetProfileId.toLowerCase().includes(q),
    );
  }, [matches, query]);

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <header className="mb-6">
        <div className="flex items-baseline justify-between">
          <h1 className="text-3xl font-bold">Meus matches</h1>
          <div className="flex gap-2 text-sm">
            <Link
              href="/matches/likes"
              className="px-3 py-1.5 rounded-lg border border-border hover:bg-accent"
            >
              ♡ Curtidas
            </Link>
            <Link
              href="/matches/super-likes"
              className="px-3 py-1.5 rounded-lg border border-border hover:bg-accent"
            >
              ★ Super
            </Link>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {state === "ready"
            ? `${matches.length} matches ativos.`
            : "Seus matches confirmados."}
        </p>
      </header>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por nota, intencao ou perfil..."
        className="w-full mb-4 px-3 py-2 border border-border rounded-lg bg-background text-sm"
      />

      {/* Loading */}
      {state === "loading" && (
        <ul className="space-y-2" role="status" aria-live="polite">
          {[1, 2, 3].map((i) => (
            <li
              key={i}
              className="h-20 rounded-xl border border-border bg-muted/30 animate-pulse"
            />
          ))}
        </ul>
      )}

      {/* Error */}
      {state === "error" && (
        <div
          className="text-center py-12 border border-rose-800 rounded-xl bg-rose-950/20"
          role="alert"
        >
          <p className="font-medium text-rose-300">
            Nao foi possivel carregar seus matches
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
          <p className="text-3xl mb-2">💞</p>
          <p className="font-medium">Nenhum match ainda</p>
          <p className="text-sm text-muted-foreground mt-2">
            Curta perfis no feed — quando o interesse for mutuo, o match aparece
            aqui.
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
      {state === "ready" &&
        (filtered.length === 0 ? (
          <div className="text-center py-12 border border-border rounded-xl bg-muted/30">
            <p className="text-muted-foreground">
              Nenhum match encontrado pra essa busca.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/chat/${m.id}`}
                  className="flex items-center gap-4 p-4 rounded-xl border border-border hover:bg-accent transition-colors"
                >
                  <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-fuchsia-300 to-rose-400 flex-shrink-0">
                    {m.pinnedAt && (
                      <span
                        className="absolute -top-1 -right-1 text-xs"
                        title="Fixado"
                      >
                        📌
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-semibold truncate">
                        {m.intent
                          ? m.intent
                          : `Perfil ${m.targetProfileId.slice(0, 8)}`}
                      </p>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatWhen(m.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {m.note ?? "Voces deram match! Comece a conversa."}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ))}
    </main>
  );
}
