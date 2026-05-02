// Relacionamentos — Filtros de busca
// Sprint M8-1: idade, distancia, intencao, subverticais.
// Persistencia local (localStorage) ate W-R-2 ligar mutation savePreferences.

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SUBVERTICALS } from "@/lib/subverticals";

type Intent = "casual" | "serious" | "friendship" | "any";

type Filters = {
  ageMin: number;
  ageMax: number;
  distanceKm: number;
  intent: Intent;
  verticals: string[];
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

export default function FiltrosPage() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [saved, setSaved] = useState(false);

  // Hidratar do localStorage no mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setFilters({ ...DEFAULT_FILTERS, ...JSON.parse(raw) });
    } catch {
      // localStorage indisponivel — manter defaults
    }
  }, []);

  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const toggleVertical = (slug: string) => {
    setFilters((prev) => ({
      ...prev,
      verticals: prev.verticals.includes(slug)
        ? prev.verticals.filter((s) => s !== slug)
        : [...prev.verticals, slug],
    }));
    setSaved(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
      setSaved(true);
    } catch {
      // ignore
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
  };

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Filtros</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure sua busca. Persistencia local ate W-R-2 wirar backend.
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
            Subverticais ({filters.verticals.length} de {SUBVERTICALS.length})
          </legend>
          <p className="text-xs text-muted-foreground mt-1">
            Selecione zero pra ver tudo, ou marque as que importam.
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-3">
            {SUBVERTICALS.map((sv) => {
              const on = filters.verticals.includes(sv.slug);
              return (
                <button
                  key={sv.slug}
                  type="button"
                  onClick={() => toggleVertical(sv.slug)}
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
            className="px-6 py-2 rounded-lg bg-fuchsia-600 text-white font-medium hover:bg-fuchsia-700"
          >
            Aplicar filtros
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 rounded-lg border border-border hover:bg-accent text-sm"
          >
            Resetar
          </button>
          {saved && (
            <span className="text-sm text-emerald-600 dark:text-emerald-400">
              Filtros salvos localmente.
            </span>
          )}
        </div>
      </form>
    </main>
  );
}
