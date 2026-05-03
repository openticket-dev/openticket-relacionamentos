// Relacionamentos — Explore (perfis afinidade ML)
// Sprint M8-1: modo explore — grid sugestoes alta-afinidade.
// Backend ML scoring: W-R-3 (algoritmo matching). Por agora: PLACEHOLDER ranqueado por compatibility.

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SUBVERTICALS } from "@/lib/subverticals";

type ExploreProfile = {
  id: string;
  name_PLACEHOLDER: string;
  age_PLACEHOLDER: number;
  city_PLACEHOLDER: string;
  vertical: string;
  affinity_PLACEHOLDER: number;
  reasons_PLACEHOLDER: string[];
};

const PLACEHOLDER_EXPLORE: ExploreProfile[] = [
  {
    id: "ex-1",
    name_PLACEHOLDER: "Sugestao 1",
    age_PLACEHOLDER: 27,
    city_PLACEHOLDER: "Sao Paulo, SP",
    vertical: "dating",
    affinity_PLACEHOLDER: 94,
    reasons_PLACEHOLDER: [
      "Mesmos 3 interesses",
      "Mesma cidade",
      "Idade compativel",
    ],
  },
  {
    id: "ex-2",
    name_PLACEHOLDER: "Sugestao 2",
    age_PLACEHOLDER: 30,
    city_PLACEHOLDER: "Belo Horizonte, MG",
    vertical: "fitness",
    affinity_PLACEHOLDER: 88,
    reasons_PLACEHOLDER: ["Treina no mesmo horario", "Modalidades em comum"],
  },
  {
    id: "ex-3",
    name_PLACEHOLDER: "Sugestao 3",
    age_PLACEHOLDER: 24,
    city_PLACEHOLDER: "Recife, PE",
    vertical: "music",
    affinity_PLACEHOLDER: 85,
    reasons_PLACEHOLDER: ["Bandas favoritas em comum"],
  },
  {
    id: "ex-4",
    name_PLACEHOLDER: "Sugestao 4",
    age_PLACEHOLDER: 35,
    city_PLACEHOLDER: "Porto Alegre, RS",
    vertical: "business",
    affinity_PLACEHOLDER: 82,
    reasons_PLACEHOLDER: ["Stack tecnica similar", "Estagio empresa similar"],
  },
];

type SortMode = "affinity" | "newest" | "nearby";

export default function ExplorePage() {
  const [sort, setSort] = useState<SortMode>("affinity");
  const [filterVertical, setFilterVertical] = useState<string>("all");

  const list = useMemo(() => {
    const filtered = PLACEHOLDER_EXPLORE.filter(
      (p) => filterVertical === "all" || p.vertical === filterVertical,
    );
    if (sort === "affinity") {
      return [...filtered].sort(
        (a, b) => b.affinity_PLACEHOLDER - a.affinity_PLACEHOLDER,
      );
    }
    return filtered;
  }, [sort, filterVertical]);

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Explorar</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sugestoes ranqueadas por afinidade. Algoritmo ML em W-R-3.
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
          <option value="newest">Mais recentes</option>
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

      {list.length === 0 ? (
        <div className="text-center py-12 border border-border rounded-xl bg-muted/30">
          <p className="text-muted-foreground">
            Nenhuma sugestao com esses filtros agora.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((p) => (
            <article
              key={p.id}
              className="border border-border rounded-2xl p-5 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold">
                    {p.name_PLACEHOLDER}, {p.age_PLACEHOLDER}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {p.city_PLACEHOLDER}
                  </p>
                </div>
                <span className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-1 rounded-full font-semibold">
                  {p.affinity_PLACEHOLDER}%
                </span>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1 mb-4">
                {p.reasons_PLACEHOLDER.map((r) => (
                  <li key={r}>· {r}</li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Link
                  href={`/chat/${p.id}`}
                  className="flex-1 text-center px-3 py-2 text-sm rounded-lg bg-fuchsia-600 text-white hover:bg-fuchsia-700"
                >
                  Conversar
                </Link>
                <Link
                  href="/perfil"
                  className="px-3 py-2 text-sm rounded-lg border border-border hover:bg-accent"
                >
                  Perfil
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center mt-6">
        Ranqueamento atual: ordem fixa por compatibility_PLACEHOLDER. ML real em
        W-R-3.
      </p>
    </main>
  );
}
