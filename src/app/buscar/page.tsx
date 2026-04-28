// Relacionamentos — Buscar (feed de matches)
// Wave: W-R-9 (initial scaffold). Wireado em W-R-2 com api-relacionamentos GraphQL.
//
// Status: feed renderiza placeholders explicitos (_PLACEHOLDER) ate W-R-2 ligar backend.
// Filtro por subvertical via query param ?vertical=<slug>.

"use client";

import Link from "next/link";
import { useState } from "react";
import { SUBVERTICALS } from "@/lib/subverticals";

type MatchPlaceholder = {
  id: string;
  name_PLACEHOLDER: string;
  age_PLACEHOLDER: number;
  bio_PLACEHOLDER: string;
  vertical: string;
  compatibility_PLACEHOLDER: number;
};

// Placeholders explicitos — sufixo _PLACEHOLDER deixa claro que sao fixtures
// ate W-R-2 wirar o backend real (GraphQL: matches(filter, page))
const PLACEHOLDER_MATCHES: MatchPlaceholder[] = [
  {
    id: "ph-1",
    name_PLACEHOLDER: "Perfil exemplo 1",
    age_PLACEHOLDER: 28,
    bio_PLACEHOLDER:
      "Bio exemplo — backend api-relacionamentos sera ligado em W-R-2.",
    vertical: "dating",
    compatibility_PLACEHOLDER: 87,
  },
  {
    id: "ph-2",
    name_PLACEHOLDER: "Perfil exemplo 2",
    age_PLACEHOLDER: 32,
    bio_PLACEHOLDER:
      "Bio exemplo — feed real virá da query GraphQL matches(filter).",
    vertical: "networking",
    compatibility_PLACEHOLDER: 72,
  },
  {
    id: "ph-3",
    name_PLACEHOLDER: "Perfil exemplo 3",
    age_PLACEHOLDER: 25,
    bio_PLACEHOLDER:
      "Bio exemplo — algoritmo de matching em desenvolvimento (W-R-3).",
    vertical: "fitness",
    compatibility_PLACEHOLDER: 91,
  },
];

export default function BuscarPage() {
  const [activeVertical, setActiveVertical] = useState<string>("all");

  const filtered = PLACEHOLDER_MATCHES.filter(
    (m) => activeVertical === "all" || m.vertical === activeVertical,
  );

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Buscar conexoes</h1>
        <p className="text-muted-foreground mt-2">
          Feed de matches. Backend api-relacionamentos sera wireado em W-R-2.
        </p>
      </header>

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

      {/* Feed de matches placeholder */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 border border-border rounded-xl bg-muted/30">
          <p className="text-muted-foreground">
            Nenhum match disponivel para esta vertical no momento.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Backend api-relacionamentos sera wireado em W-R-2.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((m) => (
            <article
              key={m.id}
              className="border border-border rounded-xl p-5 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold">{m.name_PLACEHOLDER}</h3>
                  <p className="text-sm text-muted-foreground">
                    {m.age_PLACEHOLDER} anos
                  </p>
                </div>
                <span className="text-xs bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-700 dark:text-fuchsia-300 px-2 py-1 rounded-full">
                  {m.compatibility_PLACEHOLDER}% match
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                {m.bio_PLACEHOLDER}
              </p>
              <div className="flex gap-2">
                <Link
                  href={`/chat/${m.id}`}
                  className="flex-1 text-center px-3 py-2 text-sm rounded-lg bg-fuchsia-600 text-white hover:bg-fuchsia-700"
                >
                  Conversar
                </Link>
                <Link
                  href={`/perfil`}
                  className="px-3 py-2 text-sm rounded-lg border border-border hover:bg-accent"
                >
                  Perfil
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
