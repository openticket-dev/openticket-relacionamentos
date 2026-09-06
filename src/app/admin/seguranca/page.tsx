// Relacionamentos — Admin Security Dashboard
// W4-REDO: WIRE_REAL — KPIs e acoes recentes via GraphQL platformReports +
// platformBans + panicMetrics + panicAuditLog (PlatformModerationResolver,
// SUPER_ADMIN). Zero-mock: numeros e log vem do gateway; sem KPI hardcoded.
// RBAC role: SUPER_ADMIN (gateway), trust_safety (intencao de produto).

"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface PanicMetrics {
  totalAlerts: number;
  respondedWithinSla: number;
  slaCompliancePct: number;
  avgResponseSeconds: number;
}

interface PanicAuditEntry {
  id: string;
  action: string;
  actor: string;
  panicId: string | null;
  profileId: string | null;
  createdAt: string;
}

interface OverviewData {
  reportsTotal: number;
  bansTotal: number;
  metrics: PanicMetrics | null;
  recent: PanicAuditEntry[];
}

type LoadState = "loading" | "ready" | "error";

const OVERVIEW_QUERY = /* GraphQL */ `
  query SecurityOverview {
    platformReports(input: { limit: 1, offset: 0 }) {
      total
    }
    platformBans(input: { activeOnly: true, limit: 1, offset: 0 }) {
      total
    }
    panicMetrics {
      totalAlerts
      respondedWithinSla
      slaCompliancePct
      avgResponseSeconds
    }
    panicAuditLog(input: { limit: 10, offset: 0 }) {
      items {
        id
        action
        actor
        panicId
        profileId
        createdAt
      }
    }
  }
`;

async function gql<T>(query: string): Promise<T> {
  const res = await fetch("/api/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ query }),
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

export default function SegurancaOverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const res = await gql<{
        platformReports: { total: number };
        platformBans: { total: number };
        panicMetrics: PanicMetrics | null;
        panicAuditLog: { items: PanicAuditEntry[] };
      }>(OVERVIEW_QUERY);
      setData({
        reportsTotal: res.platformReports?.total ?? 0,
        bansTotal: res.platformBans?.total ?? 0,
        metrics: res.panicMetrics ?? null,
        recent: res.panicAuditLog?.items ?? [],
      });
      setState("ready");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Falha ao carregar overview",
      );
      setState("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // TELA QUE MENTE (corrigido): igual ao /admin/dashboard — o kpi so tratava
  // "loading", entao no erro `data` era null, cada tile caia no `?? 0` do
  // callsite e a tela dizia "Denuncias 0 · Banidos ativos 0 · Alertas panico 0"
  // com a query quebrada. Sem dado confirmado o tile mostra "—".
  const kpi = (value: number | string) =>
    state === "loading" ? "…" : state === "ready" && data ? value : "—";

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <header className="mb-8">
        <Link
          href="/admin"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Admin
        </Link>
        <div className="flex items-center justify-between mt-2">
          <div>
            <h1 className="text-2xl font-semibold">Seguranca & Moderacao</h1>
            {/* TELA QUE MENTE (corrigido), dois pedacos:
                1) "RBAC role: trust_safety." era uma afirmacao sobre QUEM esta
                   olhando, cravada no JSX sem nunca ler a sessao — renderizava
                   identica pra qualquer visitante. O /admin/dashboard ja tinha
                   matado a mesma frase; esta ficou. Trocada por uma frase sobre
                   o ENDPOINT, que e verificavel: as queries deste painel vivem
                   no PlatformModerationResolver atras de RolesGuard, e quem nao
                   tem o papel recebe erro do gateway e cai no estado de erro.
                2) o ponto verde + "LGPD compliance ativo" era um semaforo que
                   nao media nada: nenhuma query, nenhum flag, sempre verde.
                   Semaforo verde inventado num painel de compliance e o pior
                   tipo de status falso — some. O log imutavel de auditoria, que
                   e o instrumento REAL de LGPD, continua linkado abaixo. */}
            <p className="text-sm text-muted-foreground mt-1">
              Trust & Safety. Os dados abaixo exigem papel de moderacao no
              gateway — sem ele as queries falham e o painel entra em erro.
            </p>
          </div>
        </div>
      </header>

      {state === "error" && (
        <div
          className="mb-8 text-center py-8 border border-rose-800 rounded-xl bg-rose-950/20"
          role="alert"
        >
          <p className="font-medium text-rose-300">
            Nao foi possivel carregar os indicadores
          </p>
          <p className="text-sm text-rose-400/80 mt-2">{errorMessage}</p>
          <button
            onClick={() => load()}
            className="mt-4 px-4 py-2 text-sm rounded-lg border border-rose-700 hover:bg-rose-900/40"
          >
            Tentar de novo
          </button>
        </div>
      )}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="p-4 rounded-lg border border-border bg-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            Denuncias
          </p>
          <p className="text-3xl font-bold mt-1">
            {kpi(data?.reportsTotal ?? 0)}
          </p>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            Banidos ativos
          </p>
          <p className="text-3xl font-bold mt-1">{kpi(data?.bansTotal ?? 0)}</p>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            Alertas panico
          </p>
          <p className="text-3xl font-bold mt-1">
            {kpi(data?.metrics?.totalAlerts ?? 0)}
          </p>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            SLA panico
          </p>
          <p className="text-3xl font-bold mt-1">
            {state === "loading"
              ? "…"
              : data?.metrics
                ? `${data.metrics.slaCompliancePct.toFixed(0)}%`
                : "—"}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Link
          href="/admin/seguranca/denuncias"
          className="p-6 rounded-lg border border-border hover:border-fuchsia-500 transition-colors group"
        >
          <p className="text-2xl mb-2">🚨</p>
          <h3 className="font-semibold group-hover:text-fuchsia-600">
            Denuncias
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Fila de denuncias por moderar (spam, assedio, fraude)
          </p>
        </Link>

        <Link
          href="/admin/seguranca/banidos"
          className="p-6 rounded-lg border border-border hover:border-fuchsia-500 transition-colors group"
        >
          <p className="text-2xl mb-2">🚫</p>
          <h3 className="font-semibold group-hover:text-fuchsia-600">
            Banidos
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Lista de usuarios banidos com motivo e duracao
          </p>
        </Link>

        <Link
          href="/admin/seguranca/auditoria"
          className="p-6 rounded-lg border border-border hover:border-fuchsia-500 transition-colors group"
        >
          <p className="text-2xl mb-2">📋</p>
          <h3 className="font-semibold group-hover:text-fuchsia-600">
            Auditoria
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Log imutavel de acoes (LGPD compliance)
          </p>
        </Link>

        <Link
          href="/admin/seguranca/kyc"
          className="p-6 rounded-lg border border-border hover:border-fuchsia-500 transition-colors group"
        >
          <p className="text-2xl mb-2">🪪</p>
          <h3 className="font-semibold group-hover:text-fuchsia-600">
            KYC
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Funil de verificacao e a fila de casos: aprovar, revogar, paginar
          </p>
        </Link>

        {/* QA100-REL-06 — a curadoria nasceu sem porta. Sem um link aqui a
            tela seria mais uma "rota que existe e ninguem acha", que e o
            defeito PLT-13 catalogado na plataforma. */}
        <Link
          href="/admin/eventos"
          className="p-6 rounded-lg border border-border hover:border-fuchsia-500 transition-colors group"
          data-testid="link-curadoria-eventos"
        >
          <p className="text-2xl mb-2">🗓️</p>
          <h3 className="font-semibold group-hover:text-fuchsia-600">
            Curadoria de eventos
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Fila do curador: publicar, tirar do ar e arquivar evento do catalogo
          </p>
        </Link>
      </section>

      <section>
        <h2 className="font-semibold mb-3">Acoes recentes</h2>
        {state === "loading" ? (
          <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden">
            {[1, 2, 3].map((i) => (
              <li key={i} className="p-4">
                <div className="h-4 w-2/3 rounded bg-muted/40 animate-pulse" />
              </li>
            ))}
          </ul>
        ) : !data || data.recent.length === 0 ? (
          <div className="p-8 text-center rounded-lg border border-dashed border-border">
            <p className="text-sm text-muted-foreground">
              Nenhuma acao de moderacao registrada ainda.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Quando moderadores tomarem acoes (banir, ocultar, etc.),
              aparecem aqui em ordem cronologica.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden">
            {data.recent.map((a) => (
              <li key={a.id} className="p-4 text-sm">
                <span className="font-mono text-xs text-muted-foreground">
                  {a.actor.slice(0, 8)}
                </span>{" "}
                <span className="font-medium">{a.action}</span>
                {a.profileId && (
                  <span className="font-mono text-xs text-muted-foreground">
                    {" "}
                    → {a.profileId.slice(0, 8)}
                  </span>
                )}
                <span className="text-xs text-muted-foreground ml-2">
                  {new Date(a.createdAt).toLocaleString("pt-BR")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
