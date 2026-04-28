// Relacionamentos — Matches list
// Wave: W-R-9 (initial scaffold). W-R-2 ligara query GraphQL myMatches.
// Tabs: novos / conversando / arquivados.

"use client";

import Link from "next/link";
import { useState } from "react";

type MatchSummary = {
  id: string;
  name_PLACEHOLDER: string;
  lastMsg_PLACEHOLDER: string;
  bucket: "new" | "active" | "archived";
};

const PLACEHOLDER_MATCHES: MatchSummary[] = [
  {
    id: "ph-1",
    name_PLACEHOLDER: "Match exemplo 1",
    lastMsg_PLACEHOLDER: "Voces deram match! Comece a conversa.",
    bucket: "new",
  },
  {
    id: "ph-2",
    name_PLACEHOLDER: "Match exemplo 2",
    lastMsg_PLACEHOLDER: "Mensagem placeholder — feed real em W-R-2.",
    bucket: "active",
  },
  {
    id: "ph-3",
    name_PLACEHOLDER: "Match exemplo 3",
    lastMsg_PLACEHOLDER: "Conversa arquivada (placeholder).",
    bucket: "archived",
  },
];

const BUCKETS = [
  { key: "new", label: "Novos" },
  { key: "active", label: "Conversando" },
  { key: "archived", label: "Arquivados" },
] as const;

export default function MatchesPage() {
  const [tab, setTab] = useState<MatchSummary["bucket"]>("new");

  const filtered = PLACEHOLDER_MATCHES.filter((m) => m.bucket === tab);

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Meus matches</h1>
        <p className="text-muted-foreground mt-2">
          Lista placeholder. W-R-2 ligara query GraphQL myMatches(bucket).
        </p>
      </header>

      <div className="flex gap-2 mb-6 border-b border-border">
        {BUCKETS.map((b) => (
          <button
            key={b.key}
            onClick={() => setTab(b.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === b.key
                ? "border-fuchsia-600 text-fuchsia-600"
                : "border-transparent hover:text-foreground text-muted-foreground"
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 border border-border rounded-xl bg-muted/30">
          <p className="text-muted-foreground">
            Nenhum match nesta categoria no momento.
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
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-fuchsia-300 to-rose-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{m.name_PLACEHOLDER}</p>
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
