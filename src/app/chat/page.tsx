// Relacionamentos — Lista de conversas
// W4-REDO: WIRE_REAL via GraphQL myConversations (Rollout6Resolver, gateway federado).
// Zero-mock: estados loading/ready/empty/error; sem fake data inventada.
//
// NOTA de contrato (RelacConversation entity): a entidade expoe
// { id matchId createdAt archivedAt archivedBy blockedAt blockedBy } —
// NAO ha matchName, lastMessage, unreadCount nem online no gateway. A UI
// renderiza os campos reais (match, quando, estado arquivado/bloqueado) +
// link pro chat. Sem inventar nome/avatar/mensagem que o backend nao expoe.

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const MY_CONVERSATIONS_QUERY = /* GraphQL */ `
  query MyConversations {
    myConversations {
      id
      matchId
      createdAt
      archivedAt
      blockedAt
    }
  }
`;

interface Conversation {
  id: string;
  matchId: string;
  createdAt: string;
  archivedAt: string | null;
  blockedAt: string | null;
}

type LoadState = "loading" | "ready" | "empty" | "error";

async function fetchConversations(): Promise<Conversation[]> {
  const res = await fetch("/api/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ query: MY_CONVERSATIONS_QUERY }),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const json = (await res.json()) as {
    data?: { myConversations: Conversation[] | null };
    errors?: { message: string }[];
  };
  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors[0]?.message ?? "GraphQL error");
  }
  return json.data?.myConversations ?? [];
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

export default function ChatListPage() {
  const [search, setSearch] = useState("");
  const [state, setState] = useState<LoadState>("loading");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const items = await fetchConversations();
        if (cancelled) return;
        if (items.length === 0) {
          setConversations([]);
          setState("empty");
          return;
        }
        const sorted = [...items].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        setConversations(sorted);
        setState("ready");
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof Error ? err.message : "Falha ao carregar conversas";
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
    if (!search.trim()) return conversations;
    const q = search.trim().toLowerCase();
    return conversations.filter(
      (c) =>
        c.matchId.toLowerCase().includes(q) || c.id.toLowerCase().includes(q),
    );
  }, [conversations, search]);

  return (
    <main className="min-h-screen max-w-2xl mx-auto">
      <header className="sticky top-0 bg-background/95 backdrop-blur border-b border-border p-4 z-10">
        <div className="flex items-center justify-between mb-3">
          <Link
            href="/matches"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Matches
          </Link>
          <h1 className="font-semibold">Conversas</h1>
          <Link
            href="/chat/configuracoes"
            className="text-sm text-fuchsia-600 hover:text-fuchsia-700"
          >
            Config
          </Link>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar conversa..."
          className="w-full px-4 py-2 border border-border rounded-full bg-background text-sm"
        />
      </header>

      <div className="bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-900/30 p-3">
        <p className="text-xs text-amber-800 dark:text-amber-200">
          Lembrete de seguranca: nunca compartilhe dados pessoais (CPF, endereco, senhas) ou
          codigos de WhatsApp em conversas. Em caso de assedio, denuncie pelo botao de cada perfil.
        </p>
      </div>

      {/* Loading */}
      {state === "loading" && (
        <ul className="divide-y divide-border" role="status" aria-live="polite">
          {[1, 2, 3].map((i) => (
            <li key={i} className="h-20 bg-muted/30 animate-pulse" />
          ))}
        </ul>
      )}

      {/* Error */}
      {state === "error" && (
        <div className="m-4 text-center py-12 border border-rose-800 rounded-xl bg-rose-950/20" role="alert">
          <p className="font-medium text-rose-300">
            Nao foi possivel carregar suas conversas
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
        <div className="p-12 text-center">
          <p className="text-4xl mb-3">💬</p>
          <p className="font-semibold mb-1">Nenhuma conversa ainda</p>
          <p className="text-sm text-muted-foreground">
            Quando alguem virar match, a conversa aparece aqui.
          </p>
          <Link
            href="/matches"
            className="inline-block mt-6 px-6 py-2 rounded-full bg-fuchsia-600 text-white text-sm font-medium hover:bg-fuchsia-700"
          >
            Ver matches
          </Link>
        </div>
      )}

      {/* Ready */}
      {state === "ready" && (
        <section className="divide-y divide-border">
          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhuma conversa bate com a busca.
              </p>
            </div>
          ) : (
            filtered.map((c) => (
              <Link
                key={c.id}
                href={`/chat/${c.id}`}
                className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-fuchsia-300 to-rose-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold truncate">
                      Match {c.matchId.slice(0, 8)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatWhen(c.createdAt)}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {c.blockedAt
                      ? "Conversa bloqueada"
                      : c.archivedAt
                        ? "Conversa arquivada"
                        : "Abrir conversa"}
                  </p>
                </div>
              </Link>
            ))
          )}
        </section>
      )}
    </main>
  );
}
