// Relacionamentos — Admin Dashboard (visão consolidada da operação)
//
// N10 cure: /relacionamentos/admin/dashboard dava 404 (rota ausente neste repo;
// o web-relacionamentos serve /relacionamentos/admin/* e não havia page.tsx).
// O stale `.next/types/validator.ts` ainda referenciava admin/dashboard/page.js,
// confirmando que a rota era esperada.
//
// WIRE_REAL via GraphQL (PlatformModerationResolver, role SUPER_ADMIN, gateway
// federado /api/graphql). Zero-mock: TODOS os números vêm do gateway ao vivo —
// platformReports.total, platformBans.total, platformPhotoQueue.total,
// curatorialQueue.total, panicMetrics, panicAuditLog. Sem KPI hardcoded.
//
// Repro live (SUPER_ADMIN, 2026-06-03): curatorialQueue.total=6330, demais 0 —
// estado vazio honesto onde não há dado, número real onde há.
//
// Contrato (entities): PanicMetrics { totalAlerts respondedWithinSla
// slaCompliancePct avgResponseSeconds }; *List/*Queue { total ... };
// PanicAuditLogPage { items { id action actor panicId profileId createdAt } }.

"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { gqlRequest, GqlClientError } from "@/lib/gql-client";

interface PanicMetrics {
  totalAlerts: number;
  respondedWithinSla: number;
  slaCompliancePct: number;
  avgResponseSeconds: number;
}

interface AuditEntry {
  id: string;
  action: string;
  actor: string;
  panicId: string | null;
  profileId: string | null;
  createdAt: string;
}

interface DashboardData {
  reportsTotal: number;
  bansTotal: number;
  photoQueueTotal: number;
  curatorialTotal: number;
  metrics: PanicMetrics | null;
  recent: AuditEntry[];
}

type LoadState = "loading" | "ready" | "error";

const DASHBOARD_QUERY = /* GraphQL */ `
  query AdminDashboard {
    platformReports(input: { limit: 1, offset: 0 }) {
      total
    }
    platformBans(input: { activeOnly: true, limit: 1, offset: 0 }) {
      total
    }
    platformPhotoQueue(input: { limit: 1, offset: 0 }) {
      total
    }
    curatorialQueue(input: { limit: 1, offset: 0 }) {
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

interface DashboardResponse {
  platformReports: { total: number } | null;
  platformBans: { total: number } | null;
  platformPhotoQueue: { total: number } | null;
  curatorialQueue: { total: number } | null;
  panicMetrics: PanicMetrics | null;
  panicAuditLog: { items: AuditEntry[] } | null;
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    setErrorMessage(null);
    try {
      const res = await gqlRequest<DashboardResponse>(DASHBOARD_QUERY);
      setData({
        reportsTotal: res.platformReports?.total ?? 0,
        bansTotal: res.platformBans?.total ?? 0,
        photoQueueTotal: res.platformPhotoQueue?.total ?? 0,
        curatorialTotal: res.curatorialQueue?.total ?? 0,
        metrics: res.panicMetrics ?? null,
        recent: res.panicAuditLog?.items ?? [],
      });
      setState("ready");
    } catch (err) {
      setErrorMessage(
        err instanceof GqlClientError || err instanceof Error
          ? err.message
          : "Falha ao carregar o dashboard",
      );
      setState("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const kpi = (value: number) => (state === "loading" ? "…" : value);

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
            <h1 className="text-2xl font-semibold">Dashboard</h1>
            {/* A frase dizia "RBAC role: SUPER_ADMIN." cravada no JSX —
                afirmacao sobre QUEM esta olhando, escrita sem nunca ler a
                sessao: renderizava identica pra qualquer visitante. Trocado
                por uma frase sobre o ENDPOINT, que e verificavel e verdadeira:
                as queries deste dashboard vivem no PlatformModerationResolver
                atras de RolesGuard(SUPER_ADMIN) — quem nao tem o papel recebe
                erro do gateway e a tela cai no estado de erro. */}
            <p className="text-sm text-muted-foreground mt-1">
              Visão consolidada da operação Relacionamentos. Os dados abaixo
              exigem papel SUPER_ADMIN no gateway.
            </p>
          </div>
          <button
            onClick={() => load()}
            disabled={state === "loading"}
            className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted/40 disabled:opacity-50"
          >
            Atualizar
          </button>
        </div>
      </header>

      {state === "error" && (
        <div
          className="mb-8 text-center py-8 border border-rose-800 rounded-xl bg-rose-950/20"
          role="alert"
        >
          <p className="font-medium text-rose-300">
            Não foi possível carregar os indicadores
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
            Denúncias
          </p>
          <p className="text-3xl font-bold mt-1">{kpi(data?.reportsTotal ?? 0)}</p>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            Banidos ativos
          </p>
          <p className="text-3xl font-bold mt-1">{kpi(data?.bansTotal ?? 0)}</p>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            Fila de fotos
          </p>
          <p className="text-3xl font-bold mt-1">
            {kpi(data?.photoQueueTotal ?? 0)}
          </p>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            Fila de curadoria
          </p>
          <p className="text-3xl font-bold mt-1">
            {kpi(data?.curatorialTotal ?? 0)}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="p-4 rounded-lg border border-border bg-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            Alertas pânico
          </p>
          <p className="text-3xl font-bold mt-1">
            {kpi(data?.metrics?.totalAlerts ?? 0)}
          </p>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            Respondidos no SLA
          </p>
          <p className="text-3xl font-bold mt-1">
            {kpi(data?.metrics?.respondedWithinSla ?? 0)}
          </p>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            SLA pânico
          </p>
          <p className="text-3xl font-bold mt-1">
            {state === "loading"
              ? "…"
              : data?.metrics
                ? `${data.metrics.slaCompliancePct.toFixed(0)}%`
                : "—"}
          </p>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            Resposta média
          </p>
          <p className="text-3xl font-bold mt-1">
            {state === "loading"
              ? "…"
              : data?.metrics
                ? `${data.metrics.avgResponseSeconds.toFixed(0)}s`
                : "—"}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Link
          href="/admin/seguranca"
          className="p-6 rounded-lg border border-border hover:border-fuchsia-500 transition-colors group"
        >
          <p className="text-2xl mb-2">🛡️</p>
          <h3 className="font-semibold group-hover:text-fuchsia-600">
            Segurança &amp; Moderação
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Trust &amp; Safety: denúncias, banidos e auditoria
          </p>
        </Link>

        <Link
          href="/admin/seguranca/denuncias"
          className="p-6 rounded-lg border border-border hover:border-fuchsia-500 transition-colors group"
        >
          <p className="text-2xl mb-2">🚨</p>
          <h3 className="font-semibold group-hover:text-fuchsia-600">
            Denúncias
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Fila de denúncias por moderar (spam, assédio, fraude)
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
            Usuários banidos com motivo e duração
          </p>
        </Link>

        {/* REL-G2 — configurador dos pesos do algoritmo de match (backend real:
            matchAlgorithmConfig / saveMatchAlgorithmConfig). O link nasceu no hub
            /admin, que o REL-S4 transformou em redirect pra /comunidade; mora aqui
            pra rota não ficar órfã. */}
        <Link
          href="/admin/algoritmo"
          className="p-6 rounded-lg border border-border hover:border-fuchsia-500 transition-colors group"
        >
          <p className="text-2xl mb-2">🎚️</p>
          <h3 className="font-semibold group-hover:text-fuchsia-600">
            Algoritmo de match
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Pesos por fator do ranking de compatibilidade
          </p>
        </Link>
      </section>

      <section>
        <h2 className="font-semibold mb-3">Ações recentes</h2>
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
              Nenhuma ação de moderação registrada ainda.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Quando moderadores tomarem ações (banir, ocultar, escalar),
              aparecem aqui em ordem cronológica.
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
