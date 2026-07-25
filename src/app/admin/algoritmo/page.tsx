"use client";

/**
 * /admin/algoritmo — Configurador do algoritmo de match (REL-G2).
 *
 * Ate aqui os pesos do feed eram constantes hardcoded no backend
 * (openticket-api · apps/relacionamentos/src/discovery.service.ts:138-150) e
 * nenhuma empresa conseguia calibrar nada. Esta page wira os sliders na
 * mutation real `saveMatchAlgorithmConfig` (model MatchAlgorithmConfig,
 * 1 linha por company).
 *
 * O shell proxia `/relacionamentos/admin/*` pra ESTE app, entao a rota nasce
 * aqui (mesmo motivo do /admin/qr-designer).
 *
 * ZERO MOCK:
 *   - Os padroes do sistema vem da query `matchAlgorithmDefaults` (le as
 *     constantes REAIS do DiscoveryService) — nao ha numero repetido a mao aqui.
 *   - Empresa sem calibragem => estado vazio honesto ("rodando nos padroes"),
 *     nunca uma config inventada.
 *   - Se a tabela ainda nao foi migrada, o backend devolve `pendingReason` e a
 *     page diz exatamente isso em vez de fingir que salvou.
 *
 * ANTI-IDOR: o companyId efetivo vem do JWT no backend. O cookie `ot_company_id`
 * so e enviado como hint (super-admin sem company no token); se nao bater com o
 * JWT, o resolver derruba com Forbidden — a decisao e sempre do servidor.
 */

import React from "react";
import Link from "next/link";
// Icones: so os que este repo ja usa em outras pages (Save/Info em
// QrDesigner.tsx) + SlidersHorizontal/RotateCcw, nomes estaveis da lucide.
import { SlidersHorizontal, RotateCcw, Save, Info } from "lucide-react";
import { gqlRequest, GqlClientError } from "@/lib/gql-client";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Contrato (espelha MatchAlgorithmWeights do backend)
// ---------------------------------------------------------------------------

type WeightKey =
  | "diversityRatio"
  | "crossVerticalFavourite"
  | "crossVerticalSource"
  | "newProfileBoost"
  | "newProfileBoostDays"
  | "premiumBoost"
  | "alreadyViewedDecay"
  | "activityWindowDays"
  | "feedViewTtlDays";

type Weights = Record<WeightKey, number>;

type ConfigDto = Weights & {
  id: string;
  companyId: string;
  label: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type SaveResult = {
  ok: boolean;
  persisted: boolean;
  config: ConfigDto | null;
  pendingReason: string | null;
};

interface FactorMeta {
  key: WeightKey;
  label: string;
  /** O que o peso faz no ranking, em portugues de gente. */
  help: string;
  min: number;
  max: number;
  step: number;
  /** Formatacao do valor exibido. */
  unit: "x" | "%" | "dias";
}

// Faixas identicas ao Zod do resolver (SaveMatchAlgorithmConfigSchema) — um
// slider nunca pode produzir valor que o backend recusa.
const FACTORS: FactorMeta[] = [
  {
    key: "diversityRatio",
    label: "Diversidade do feed",
    help: "Fatia do feed reservada a perfis fora do nicho do usuario. Sobe pra furar bolha, desce pra afinar.",
    min: 0,
    max: 0.5,
    step: 0.01,
    unit: "%",
  },
  {
    key: "crossVerticalFavourite",
    label: "Mesma subvertical favorita",
    help: "Multiplicador quando os dois perfis tem a mesma subvertical favorita (alma-gemea, networking, etc).",
    min: 1,
    max: 5,
    step: 0.05,
    unit: "x",
  },
  {
    key: "crossVerticalSource",
    label: "Mesmo evento / curso / igreja",
    help: "Multiplicador quando os dois vieram do mesmo contexto OpenTicket. O peso mais forte do ranking.",
    min: 1,
    max: 10,
    step: 0.1,
    unit: "x",
  },
  {
    key: "premiumBoost",
    label: "Impulso premium",
    help: "Multiplicador de quem assina premium. Alto demais e o feed vira vitrine de assinante.",
    min: 1,
    max: 20,
    step: 0.5,
    unit: "x",
  },
  {
    key: "newProfileBoost",
    label: "Impulso de perfil novo",
    help: "Multiplicador de quem acabou de entrar (cold start), pra o perfil novo nao nascer invisivel.",
    min: 1,
    max: 5,
    step: 0.05,
    unit: "x",
  },
  {
    key: "newProfileBoostDays",
    label: "Janela de perfil novo",
    help: "Por quantos dias o perfil ainda conta como novo e recebe o impulso acima.",
    min: 0,
    max: 30,
    step: 1,
    unit: "dias",
  },
  {
    key: "alreadyViewedDecay",
    label: "Decaimento de ja visto",
    help: "Quanto do score sobra pra quem ja apareceu no feed dentro do TTL. 1 = nao penaliza.",
    min: 0.05,
    max: 1,
    step: 0.05,
    unit: "x",
  },
  {
    key: "feedViewTtlDays",
    label: "TTL de ja visto",
    help: "Por quantos dias uma exibicao anterior continua penalizando o perfil.",
    min: 1,
    max: 90,
    step: 1,
    unit: "dias",
  },
  {
    key: "activityWindowDays",
    label: "Janela de atividade",
    help: "Periodo considerado no score de atividade (likes e engajamento recentes).",
    min: 1,
    max: 90,
    step: 1,
    unit: "dias",
  },
];

const WEIGHT_KEYS: WeightKey[] = FACTORS.map((f) => f.key);

const WEIGHT_FIELDS = WEIGHT_KEYS.join("\n      ");

const LOAD_QUERY = /* GraphQL */ `
  query MatchAlgorithmPanel($input: MatchAlgorithmConfigInput) {
    matchAlgorithmDefaults {
      ${WEIGHT_FIELDS}
    }
    matchAlgorithmConfig(input: $input) {
      id
      companyId
      label
      active
      createdAt
      updatedAt
      ${WEIGHT_FIELDS}
    }
  }
`;

const SAVE_MUTATION = /* GraphQL */ `
  mutation SaveMatchAlgorithmConfig($input: SaveMatchAlgorithmConfigInput!) {
    saveMatchAlgorithmConfig(input: $input) {
      ok
      persisted
      pendingReason
      config {
        id
        companyId
        label
        active
        createdAt
        updatedAt
        ${WEIGHT_FIELDS}
      }
    }
  }
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Le um cookie client-side (SSR-safe). Mesmo helper do /admin/qr-designer. */
function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  const parts = document.cookie ? document.cookie.split("; ") : [];
  for (const part of parts) {
    if (part.startsWith(prefix)) {
      const raw = part.slice(prefix.length);
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
  }
  return null;
}

function pickWeights(source: Weights): Weights {
  const out = {} as Weights;
  for (const key of WEIGHT_KEYS) out[key] = source[key];
  return out;
}

function formatValue(meta: FactorMeta, value: number): string {
  if (meta.unit === "%") return `${Math.round(value * 100)}%`;
  if (meta.unit === "dias") return `${value} ${value === 1 ? "dia" : "dias"}`;
  return `${value}x`;
}

function isDirty(draft: Weights | null, baseline: Weights | null): boolean {
  if (!draft || !baseline) return false;
  return WEIGHT_KEYS.some((k) => draft[k] !== baseline[k]);
}

type LoadState = "loading" | "ready" | "error";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AlgoritmoAdminPage() {
  const [state, setState] = React.useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [defaults, setDefaults] = React.useState<Weights | null>(null);
  const [config, setConfig] = React.useState<ConfigDto | null>(null);
  const [draft, setDraft] = React.useState<Weights | null>(null);
  const [label, setLabel] = React.useState("");
  const [active, setActive] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<string | null>(null);
  const [pendingReason, setPendingReason] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setState("loading");
    setErrorMessage(null);
    try {
      const companyId = readCookie("ot_company_id");
      const data = await gqlRequest<{
        matchAlgorithmDefaults: Weights;
        matchAlgorithmConfig: ConfigDto | null;
      }>(LOAD_QUERY, {
        // Hint pra escopo super-admin. Tenant normal: o backend usa o JWT e
        // ignora/valida este campo (Forbidden se nao bater).
        input: companyId ? { companyId } : {},
      });
      const serverDefaults = pickWeights(data.matchAlgorithmDefaults);
      setDefaults(serverDefaults);
      const cfg = data.matchAlgorithmConfig;
      setConfig(cfg);
      setDraft(cfg ? pickWeights(cfg) : serverDefaults);
      setLabel(cfg?.label ?? "");
      setActive(cfg?.active ?? true);
      setSavedAt(cfg?.updatedAt ?? null);
      setState("ready");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Falha ao carregar a configuracao",
      );
      setState("error");
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const setFactor = (key: WeightKey, value: number) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next: Weights = { ...prev };
      next[key] = value;
      return next;
    });
  };

  const resetToDefaults = () => {
    if (defaults) setDraft({ ...defaults });
  };

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    setErrorMessage(null);
    setPendingReason(null);
    try {
      const companyId = readCookie("ot_company_id");
      const data = await gqlRequest<{
        saveMatchAlgorithmConfig: SaveResult;
      }>(SAVE_MUTATION, {
        input: {
          ...(companyId ? { companyId } : {}),
          ...draft,
          label: label.trim() ? label.trim() : null,
          active,
        },
      });
      const res = data.saveMatchAlgorithmConfig;
      if (res.persisted && res.config) {
        setConfig(res.config);
        setDraft(pickWeights(res.config));
        setLabel(res.config.label ?? "");
        setActive(res.config.active);
        setSavedAt(res.config.updatedAt);
      } else {
        // Degradacao honesta: o backend NAO gravou e disse por que.
        setPendingReason(
          res.pendingReason ?? "PERSISTENCIA_NAO_CONFIRMADA_PELO_BACKEND",
        );
      }
    } catch (err) {
      setErrorMessage(
        err instanceof GqlClientError
          ? err.message
          : "Falha ao salvar — o backend nao confirmou a gravacao.",
      );
    } finally {
      setSaving(false);
    }
  };

  // Sem config gravada, QUALQUER estado e "pendente" — a empresa ainda nao tem
  // linha no banco, entao salvar sempre faz sentido (mesmo nos padroes).
  const dirty = config
    ? isDirty(draft, pickWeights(config)) ||
      label.trim() !== (config.label ?? "") ||
      active !== config.active
    : true;

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto">
      <header className="mb-6">
        <Link
          href="/admin"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Admin
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold">
              <SlidersHorizontal className="h-5 w-5 text-fuchsia-600" />
              Algoritmo de match
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Calibre o peso de cada fator do feed da sua empresa. Sem
              calibragem, o feed roda nos padroes do sistema.
            </p>
          </div>
          {savedAt && (
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              Salvo em {new Date(savedAt).toLocaleString("pt-BR")}
            </span>
          )}
        </div>
      </header>

      {state === "loading" && (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Carregando configuracao...
        </p>
      )}

      {state === "error" && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
          <p className="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-300">
            <Info className="h-4 w-4" />
            Nao foi possivel carregar
          </p>
          <p className="mt-1 text-sm text-red-700/80 dark:text-red-300/80">
            {errorMessage}
          </p>
          <button
            type="button"
            onClick={load}
            className="mt-3 rounded-md border border-red-400 px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-300"
          >
            Tentar de novo
          </button>
        </div>
      )}

      {state === "ready" && draft && defaults && (
        <>
          {!config && (
            <div className="mb-5 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/40">
              <p className="font-medium text-amber-800 dark:text-amber-300">
                Esta empresa ainda nao calibrou o algoritmo.
              </p>
              <p className="mt-1 text-amber-800/80 dark:text-amber-300/80">
                Os valores abaixo sao os padroes do sistema. Nada foi gravado
                ainda — salve pra criar a calibragem da empresa.
              </p>
            </div>
          )}

          {pendingReason && (
            <div className="mb-5 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/40">
              <p className="font-medium text-amber-800 dark:text-amber-300">
                Nao gravado: {pendingReason}
              </p>
              <p className="mt-1 text-amber-800/80 dark:text-amber-300/80">
                A tabela de configuracao ainda nao foi migrada no banco. O feed
                segue nos padroes do sistema ate a migration rodar.
              </p>
            </div>
          )}

          {errorMessage && (
            <div className="mb-5 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {errorMessage}
            </div>
          )}

          <section className="mb-6 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Rotulo da calibragem
              </span>
              <input
                type="text"
                value={label}
                maxLength={120}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="ex.: foco networking presencial"
                className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
              />
            </label>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4 accent-fuchsia-600"
              />
              <span>
                Calibragem ativa
                <span className="block text-xs text-muted-foreground">
                  Desligada, o feed volta aos padroes
                </span>
              </span>
            </label>
          </section>

          <section className="space-y-5">
            {FACTORS.map((meta) => {
              const value = draft[meta.key];
              const def = defaults[meta.key];
              const changed = value !== def;
              return (
                <div
                  key={meta.key}
                  className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <label
                      htmlFor={`factor-${meta.key}`}
                      className="text-sm font-semibold"
                    >
                      {meta.label}
                    </label>
                    <span className="text-sm font-mono tabular-nums">
                      {formatValue(meta, value)}
                      {changed && (
                        <span className="ml-2 text-xs font-sans text-muted-foreground">
                          padrao {formatValue(meta, def)}
                        </span>
                      )}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {meta.help}
                  </p>
                  <input
                    id={`factor-${meta.key}`}
                    type="range"
                    min={meta.min}
                    max={meta.max}
                    step={meta.step}
                    value={value}
                    onChange={(e) =>
                      setFactor(meta.key, Number(e.target.value))
                    }
                    className="mt-3 w-full accent-fuchsia-600"
                  />
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>{formatValue(meta, meta.min)}</span>
                    <span>{formatValue(meta, meta.max)}</span>
                  </div>
                </div>
              );
            })}
          </section>

          <div className="sticky bottom-0 mt-6 flex flex-wrap items-center gap-3 border-t border-neutral-200 bg-background/90 py-4 backdrop-blur dark:border-neutral-800">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !dirty}
              className="inline-flex items-center gap-2 rounded-lg bg-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "Salvando..." : "Salvar calibragem"}
            </button>
            <button
              type="button"
              onClick={resetToDefaults}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-semibold disabled:opacity-50 dark:border-neutral-700"
            >
              <RotateCcw className="h-4 w-4" />
              Voltar aos padroes
            </button>
            {!dirty && !saving && (
              <span className="text-xs text-muted-foreground">
                Nenhuma alteracao pendente.
              </span>
            )}
          </div>
        </>
      )}
    </main>
  );
}
