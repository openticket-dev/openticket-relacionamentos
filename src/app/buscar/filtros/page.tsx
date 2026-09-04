// Relacionamentos — Filtros de busca
// Sprint M8-1: idade, distancia, intencao, subverticais.
// Onda I (s6) WIRE_REAL: persistencia no BACKEND via updateRelationshipPreferences
//   (camaleao). O backend espelha os filtros no RelationshipProfile.preferences
//   que o DiscoveryService le -> o feed (discoverProfiles) passa a respeitar os
//   filtros server-side. localStorage vira so cache otimista (UX), nao a fonte.

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  DISCOVERY_SUBVERTICALS,
  keepDiscoverySubverticals,
  type DiscoverySubvertical,
} from "@/lib/subverticals";

type Intent = "casual" | "serious" | "friendship" | "any";

type Filters = {
  ageMin: number;
  ageMax: number;
  distanceKm: number;
  intent: Intent;
  /**
   * Valores do ENUM `DiscoverySubvertical` do gateway — nao slug do catalogo
   * de interesses. Sao gravados em `metadata.verticals`, que o backend espelha
   * em `RelationshipProfile.preferences.subverticais`
   * (camaleao.service.ts, `mirrorToDiscoveryPreferences`) e o feed compara por
   * intersecao com o que `discoverProfiles` pede — os dois lados tem que falar
   * o mesmo enum. Ver src/lib/subverticals.ts (DISCOVERY_SUBVERTICALS).
   */
  verticals: DiscoverySubvertical[];
  verifiedOnly: boolean;
};

const DEFAULT_FILTERS: Filters = {
  ageMin: 18,
  ageMax: 45,
  distanceKm: 50,
  intent: "any",
  verticals: [],
  verifiedOnly: false,
};

const STORAGE_KEY = "relac:filters";

const INTENTS: { value: Intent; label: string; emoji: string }[] = [
  { value: "any", label: "Tanto faz", emoji: "🌀" },
  { value: "casual", label: "Casual", emoji: "🍸" },
  { value: "serious", label: "Algo serio", emoji: "💍" },
  { value: "friendship", label: "Amizade", emoji: "🤝" },
];

// ── Mapeamento front <-> backend ─────────────────────────────────────────────
// intent (UI) -> preferredIntent (enum camaleao: ALMA_GEMEA/AMIZADE/NETWORKING/
//   COMUNIDADE). "any" = sem preferencia (null). casual/serious -> ALMA_GEMEA
//   (romantico), friendship -> AMIZADE.
const INTENT_TO_BACKEND: Record<Intent, string | null> = {
  any: null,
  casual: "ALMA_GEMEA",
  serious: "ALMA_GEMEA",
  friendship: "AMIZADE",
};
const BACKEND_TO_INTENT: Record<string, Intent> = {
  ALMA_GEMEA: "serious",
  AMIZADE: "friendship",
  NETWORKING: "any",
  COMUNIDADE: "any",
};

const GQL_QUERY = /* GraphQL */ `
  query RelationshipPreferences {
    relationshipPreferences {
      desiredAgeMin
      desiredAgeMax
      maxDistanceKm
      preferredIntent
      metadata
    }
  }
`;

const GQL_MUTATION = /* GraphQL */ `
  mutation UpdateRelationshipPreferences($input: UpdatePreferencesInputDto!) {
    updateRelationshipPreferences(input: $input) {
      id
    }
  }
`;

async function gql<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch("/api/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as {
    data?: T;
    errors?: { message: string }[];
  };
  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors[0]?.message ?? "GraphQL error");
  }
  if (!json.data) throw new Error("No data returned");
  return json.data;
}

export default function FiltrosPage() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hidratar: backend (fonte de verdade) com fallback pro localStorage (cache).
  useEffect(() => {
    let cancelled = false;
    // cache otimista imediato pra evitar flash
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const cached = JSON.parse(raw) as Partial<Filters>;
        setFilters({
          ...DEFAULT_FILTERS,
          ...cached,
          // Cache gravado antes do fix guarda slug minusculo; slug que o enum
          // do gateway nao conhece e descartado em vez de voltar como selecao
          // fantasma.
          verticals: keepDiscoverySubverticals(
            Array.isArray(cached.verticals) ? cached.verticals : [],
          ),
        });
      }
    } catch {
      /* localStorage indisponivel */
    }
    (async () => {
      try {
        const data = await gql<{
          relationshipPreferences: {
            desiredAgeMin: number | null;
            desiredAgeMax: number | null;
            maxDistanceKm: number | null;
            preferredIntent: string | null;
            metadata: Record<string, unknown> | null;
          } | null;
        }>(GQL_QUERY);
        const p = data.relationshipPreferences;
        if (cancelled || !p) return;
        const meta = (p.metadata ?? {}) as {
          verticals?: unknown[];
          verifiedOnly?: boolean;
        };
        setFilters({
          ageMin: p.desiredAgeMin ?? DEFAULT_FILTERS.ageMin,
          ageMax: p.desiredAgeMax ?? DEFAULT_FILTERS.ageMax,
          distanceKm: p.maxDistanceKm ?? DEFAULT_FILTERS.distanceKm,
          intent: p.preferredIntent
            ? (BACKEND_TO_INTENT[p.preferredIntent] ?? "any")
            : "any",
          verticals: keepDiscoverySubverticals(
            Array.isArray(meta.verticals) ? meta.verticals : [],
          ),
          verifiedOnly: !!meta.verifiedOnly,
        });
      } catch {
        // Sem backend/sessao -> mantem o que veio do localStorage (degrade ok).
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const toggleVertical = (value: DiscoverySubvertical) => {
    setFilters((prev) => ({
      ...prev,
      verticals: prev.verticals.includes(value)
        ? prev.verticals.filter((s) => s !== value)
        : [...prev.verticals, value],
    }));
    setSaved(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    // cache otimista local (UX) — backend e a fonte de verdade.
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    } catch {
      /* ignore */
    }
    try {
      await gql(GQL_MUTATION, {
        input: {
          desiredAgeMin: filters.ageMin,
          desiredAgeMax: filters.ageMax,
          maxDistanceKm: filters.distanceKm,
          preferredIntent: INTENT_TO_BACKEND[filters.intent],
          // metadata carrega o que nao tem coluna propria (verticals/verifiedOnly).
          // O backend espelha verticals -> subverticais e verifiedOnly no blob
          // de discovery (RelationshipProfile.preferences). `metadata` e
          // GraphQLJSON — o gateway NAO valida o dominio aqui, entao o valor
          // errado nao da erro: ele grava e o gate do feed nunca casa. Por isso
          // `verticals` so carrega valor do enum DiscoverySubvertical.
          metadata: {
            verticals: filters.verticals,
            verifiedOnly: filters.verifiedOnly,
          },
        },
      });
      setSaved(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Falha ao salvar filtros no servidor",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setFilters(DEFAULT_FILTERS);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setSaved(false);
    setError(null);
  };

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Filtros</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure sua busca. Salvo no servidor e aplicado ao feed.
          </p>
        </div>
        <Link
          href="/buscar"
          className="text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-accent"
        >
          Voltar
        </Link>
      </header>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Idade */}
        <fieldset className="rounded-xl border border-border p-4">
          <legend className="px-2 text-sm font-medium">Faixa de idade</legend>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <label className="block">
              <span className="text-xs text-muted-foreground">Minima</span>
              <input
                type="number"
                min={18}
                max={99}
                value={filters.ageMin}
                onChange={(e) =>
                  update("ageMin", Number.parseInt(e.target.value, 10) || 18)
                }
                className="mt-1 w-full px-3 py-2 border border-border rounded-lg bg-background"
              />
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">Maxima</span>
              <input
                type="number"
                min={18}
                max={99}
                value={filters.ageMax}
                onChange={(e) =>
                  update("ageMax", Number.parseInt(e.target.value, 10) || 99)
                }
                className="mt-1 w-full px-3 py-2 border border-border rounded-lg bg-background"
              />
            </label>
          </div>
        </fieldset>

        {/* Distancia */}
        <fieldset className="rounded-xl border border-border p-4">
          <legend className="px-2 text-sm font-medium">Distancia maxima</legend>
          <label className="block mt-2">
            <span className="text-xs text-muted-foreground">
              {filters.distanceKm} km
            </span>
            <input
              type="range"
              min={1}
              max={500}
              value={filters.distanceKm}
              onChange={(e) =>
                update("distanceKm", Number.parseInt(e.target.value, 10))
              }
              className="mt-1 w-full"
            />
          </label>
        </fieldset>

        {/* Intencao */}
        <fieldset className="rounded-xl border border-border p-4">
          <legend className="px-2 text-sm font-medium">Intencao</legend>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
            {INTENTS.map((i) => (
              <button
                key={i.value}
                type="button"
                onClick={() => update("intent", i.value)}
                className={`p-3 rounded-lg border text-sm transition-colors ${
                  filters.intent === i.value
                    ? "border-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-950/40 text-fuchsia-700 dark:text-fuchsia-300"
                    : "border-border hover:bg-accent"
                }`}
              >
                <div className="text-2xl mb-1">{i.emoji}</div>
                {i.label}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Subverticais */}
        <fieldset className="rounded-xl border border-border p-4">
          <legend className="px-2 text-sm font-medium">
            Subverticais ({filters.verticals.length} de{" "}
            {DISCOVERY_SUBVERTICALS.length})
          </legend>
          <p className="text-xs text-muted-foreground mt-1">
            Selecione zero pra ver tudo, ou marque as que importam.
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-3">
            {DISCOVERY_SUBVERTICALS.map((sv) => {
              const on = filters.verticals.includes(sv.value);
              return (
                <button
                  key={sv.value}
                  type="button"
                  onClick={() => toggleVertical(sv.value)}
                  className={`p-2 rounded-lg border text-xs font-medium transition-colors ${
                    on
                      ? "border-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-950/40 text-fuchsia-700 dark:text-fuchsia-300"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  <div className="text-xl mb-0.5">{sv.emoji}</div>
                  {sv.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Verificacao */}
        <label className="flex items-center gap-3 rounded-xl border border-border p-4 cursor-pointer hover:bg-accent">
          <input
            type="checkbox"
            checked={filters.verifiedOnly}
            onChange={(e) => update("verifiedOnly", e.target.checked)}
            className="w-5 h-5"
          />
          <div>
            <p className="text-sm font-medium">Apenas perfis verificados</p>
            <p className="text-xs text-muted-foreground">
              Reduz falsos positivos. Verificacao via Datavalid (sprint W3-3).
            </p>
          </div>
        </label>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 rounded-lg bg-fuchsia-600 text-white font-medium hover:bg-fuchsia-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Salvando..." : "Aplicar filtros"}
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={saving}
            className="px-4 py-2 rounded-lg border border-border hover:bg-accent text-sm disabled:opacity-50"
          >
            Resetar
          </button>
          {saved && !error && (
            <span className="text-sm text-emerald-600 dark:text-emerald-400">
              Filtros salvos e aplicados ao feed.
            </span>
          )}
          {error && (
            <span className="text-sm text-rose-600 dark:text-rose-400" role="alert">
              {error}
            </span>
          )}
        </div>
      </form>
    </main>
  );
}
