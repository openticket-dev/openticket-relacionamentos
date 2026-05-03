// Relacionamentos — Admin Auditoria (Sprint M8-2)
// Log imutavel de acoes de moderacao (LGPD compliance).
// W-R-6 ligara queryAuditLog (read-only, hash-chained).

"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useState } from "react";

type AuditCategory =
  | "moderation"
  | "data_access"
  | "consent"
  | "auth"
  | "privacy_request";

type AuditEntry = {
  id: string;
  ts: number;
  actor: string;
  actorRole: string;
  category: AuditCategory;
  action: string;
  target: string;
  ip: string;
  hashChain: string;
};

// SEED vazio — W-R-6 conecta queryAuditLog().
const ENTRIES: AuditEntry[] = [];

const CATEGORY_LABEL: Record<AuditCategory, string> = {
  moderation: "Moderacao",
  data_access: "Acesso a dados",
  consent: "Consentimento",
  auth: "Autenticacao",
  privacy_request: "Solicitacao LGPD",
};

const CATEGORY_COLOR: Record<AuditCategory, string> = {
  moderation: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  data_access: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  consent: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  auth: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  privacy_request: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

export default function AuditoriaPage() {
  const [filter, setFilter] = useState<AuditCategory | "all">("all");
  const [search, setSearch] = useState("");

  const filtered = ENTRIES.filter((e) => {
    const matchCat = filter === "all" || e.category === filter;
    const matchSearch =
      e.actor.toLowerCase().includes(search.toLowerCase()) ||
      e.target.toLowerCase().includes(search.toLowerCase()) ||
      e.action.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <main className="min-h-screen p-6 max-w-7xl mx-auto">
      <header className="mb-6">
        <Link
          href="/admin/seguranca"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Seguranca
        </Link>
        <div className="flex items-center justify-between mt-2">
          <div>
            <h1 className="text-2xl font-semibold">Log de Auditoria</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Read-only. Hash-chained para integridade. Retencao: 5 anos (LGPD).
            </p>
          </div>
          <button className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted">
            Exportar CSV
          </button>
        </div>
      </header>

      <div className="flex gap-3 mb-6 flex-wrap items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por actor, target ou acao..."
          className="flex-1 min-w-[200px] px-4 py-2 border border-border rounded-lg bg-background text-sm"
        />
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium ${
              filter === "all"
                ? "bg-fuchsia-600 text-white"
                : "bg-muted hover:bg-accent"
            }`}
          >
            Todas
          </button>
          {(Object.keys(CATEGORY_LABEL) as AuditCategory[]).map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                filter === c
                  ? "bg-fuchsia-600 text-white"
                  : "bg-muted hover:bg-accent"
              }`}
            >
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-12 text-center rounded-lg border border-dashed border-border">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-semibold mb-1">
            {ENTRIES.length === 0
              ? "Sem registros de auditoria"
              : "Nenhum registro neste filtro"}
          </p>
          <p className="text-sm text-muted-foreground">
            {ENTRIES.length === 0
              ? "Toda acao de moderador, acesso a dados sensiveis, ou solicitacao LGPD sera registrada aqui."
              : "Tente outro filtro ou termo de busca."}
          </p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Quando</th>
                <th className="text-left p-3 font-medium">Actor</th>
                <th className="text-left p-3 font-medium">Categoria</th>
                <th className="text-left p-3 font-medium">Acao</th>
                <th className="text-left p-3 font-medium">Target</th>
                <th className="text-left p-3 font-medium">IP</th>
                <th className="text-left p-3 font-medium">Hash</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="p-3 text-xs text-muted-foreground">
                    {new Date(e.ts).toLocaleString("pt-BR")}
                  </td>
                  <td className="p-3">
                    <p className="font-medium text-xs">{e.actor}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {e.actorRole}
                    </p>
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${CATEGORY_COLOR[e.category]}`}
                    >
                      {CATEGORY_LABEL[e.category]}
                    </span>
                  </td>
                  <td className="p-3 text-xs">{e.action}</td>
                  <td className="p-3 text-xs font-mono">{e.target}</td>
                  <td className="p-3 text-xs font-mono text-muted-foreground">
                    {e.ip}
                  </td>
                  <td className="p-3 text-[10px] font-mono text-muted-foreground truncate max-w-[100px]">
                    {e.hashChain}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
