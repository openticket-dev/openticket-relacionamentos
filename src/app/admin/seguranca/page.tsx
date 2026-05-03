// Relacionamentos — Admin Security Dashboard (REFINADO Sprint M8-2)
// Overview hub: KPIs + links pra denuncias / banidos / auditoria.
// W-R-6 ligara queries reais via Apollo. Honest empty when no data.
// RBAC role: trust_safety.

"use client";

import Link from "next/link";

type ModerationKPIs = {
  openReports: number;
  reportsToday: number;
  bannedUsers: number;
  avgResolutionMinutes: number;
};

type RecentAction = {
  id: string;
  actor: string;
  action: string;
  target: string;
  ts: number;
};

// SEED zero — dados reais via queryModerationOverview() em W-R-6.
const KPIS: ModerationKPIs = {
  openReports: 0,
  reportsToday: 0,
  bannedUsers: 0,
  avgResolutionMinutes: 0,
};

const RECENT_ACTIONS: RecentAction[] = [];

export default function SegurancaOverviewPage() {
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
            <p className="text-sm text-muted-foreground mt-1">
              Trust & Safety dashboard. RBAC role: trust_safety.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            LGPD compliance ativo
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="p-4 rounded-lg border border-border bg-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            Denuncias abertas
          </p>
          <p className="text-3xl font-bold mt-1">{KPIS.openReports}</p>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            Hoje
          </p>
          <p className="text-3xl font-bold mt-1">{KPIS.reportsToday}</p>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            Banidos
          </p>
          <p className="text-3xl font-bold mt-1">{KPIS.bannedUsers}</p>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            Resolucao media
          </p>
          <p className="text-3xl font-bold mt-1">
            {KPIS.avgResolutionMinutes > 0
              ? `${KPIS.avgResolutionMinutes}m`
              : "—"}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
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
      </section>

      <section>
        <h2 className="font-semibold mb-3">Acoes recentes</h2>
        {RECENT_ACTIONS.length === 0 ? (
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
            {RECENT_ACTIONS.map((a) => (
              <li key={a.id} className="p-4 text-sm">
                <span className="font-medium">{a.actor}</span>{" "}
                <span className="text-muted-foreground">{a.action}</span>{" "}
                <span className="font-medium">{a.target}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  {new Date(a.ts).toLocaleString("pt-BR")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
