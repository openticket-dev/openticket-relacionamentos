// Relacionamentos — Matches list (refinado M8-1)
// Tabs: novos / conversando / arquivados + busca + atalhos pra likes/super.
// Backend wiring: W-R-2 (myMatches(bucket) GraphQL).

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type MatchSummary = {
  id: string;
  name_PLACEHOLDER: string;
  age_PLACEHOLDER: number;
  lastMsg_PLACEHOLDER: string;
  bucket: "new" | "active" | "archived";
  unreadCount_PLACEHOLDER: number;
  matchedAt_PLACEHOLDER: string;
};

const PLACEHOLDER_MATCHES: MatchSummary[] = [
  {
    id: "ph-1",
    name_PLACEHOLDER: "Match exemplo 1",
    age_PLACEHOLDER: 28,
    lastMsg_PLACEHOLDER: "Voces deram match! Comece a conversa.",
    bucket: "new",
    unreadCount_PLACEHOLDER: 0,
    matchedAt_PLACEHOLDER: "ha 5 min",
  },
  {
    id: "ph-2",
    name_PLACEHOLDER: "Match exemplo 2",
    age_PLACEHOLDER: 32,
    lastMsg_PLACEHOLDER: "Mensagem placeholder — feed real em W-R-2.",
    bucket: "active",
    unreadCount_PLACEHOLDER: 3,
    matchedAt_PLACEHOLDER: "ontem",
  },
  {
    id: "ph-3",
    name_PLACEHOLDER: "Match exemplo 3",
    age_PLACEHOLDER: 25,
    lastMsg_PLACEHOLDER: "Conversa arquivada (placeholder).",
    bucket: "archived",
    unreadCount_PLACEHOLDER: 0,
    matchedAt_PLACEHOLDER: "semana passada",
  },
  {
    id: "ph-4",
    name_PLACEHOLDER: "Match exemplo 4",
    age_PLACEHOLDER: 30,
    lastMsg_PLACEHOLDER: "Bora marcar?",
    bucket: "active",
    unreadCount_PLACEHOLDER: 1,
    matchedAt_PLACEHOLDER: "2h atras",
  },
];

const BUCKETS = [
  { key: "new", label: "Novos" },
  { key: "active", label: "Conversando" },
  { key: "archived", label: "Arquivados" },
] as const;

export default function MatchesPage() {
  const [tab, setTab] = useState<MatchSummary["bucket"]>("new");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const byTab = PLACEHOLDER_MATCHES.filter((m) => m.bucket === tab);
    if (!query.trim()) return byTab;
    const q = query.trim().toLowerCase();
    return byTab.filter(
      (m) =>
        m.name_PLACEHOLDER.toLowerCase().includes(q) ||
        m.lastMsg_PLACEHOLDER.toLowerCase().includes(q),
    );
  }, [tab, query]);

  const counts = useMemo(
    () => ({
      new: PLACEHOLDER_MATCHES.filter((m) => m.bucket === "new").length,
      active: PLACEHOLDER_MATCHES.filter((m) => m.bucket === "active").length,
      archived: PLACEHOLDER_MATCHES.filter((m) => m.bucket === "archived")
        .length,
    }),
    [],
  );

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
          Lista placeholder. W-R-2 ligara query GraphQL myMatches(bucket).
        </p>
      </header>

      <div className="flex gap-2 mb-4 border-b border-border overflow-x-auto">
        {BUCKETS.map((b) => (
          <button
            key={b.key}
            onClick={() => setTab(b.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
              tab === b.key
                ? "border-fuchsia-600 text-fuchsia-600"
                : "border-transparent hover:text-foreground text-muted-foreground"
            }`}
          >
            {b.label}{" "}
            <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">
              {counts[b.key]}
            </span>
          </button>
        ))}
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por nome ou mensagem..."
        className="w-full mb-4 px-3 py-2 border border-border rounded-lg bg-background text-sm"
      />

      {filtered.length === 0 ? (
        <div className="text-center py-12 border border-border rounded-xl bg-muted/30">
          <p className="text-muted-foreground">
            {query
              ? "Nenhum match encontrado pra essa busca."
              : "Nenhum match nesta categoria no momento."}
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
                  {m.unreadCount_PLACEHOLDER > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-5 h-5 rounded-full bg-fuchsia-600 text-white text-xs font-bold flex items-center justify-center px-1">
                      {m.unreadCount_PLACEHOLDER}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-semibold truncate">
                      {m.name_PLACEHOLDER}, {m.age_PLACEHOLDER}
                    </p>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {m.matchedAt_PLACEHOLDER}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {m.lastMsg_PLACEHOLDER}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
