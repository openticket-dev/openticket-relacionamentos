// Relacionamentos — Admin Auditoria (RELAC-E2E WIRE_REAL)
// Log imutavel de acoes de moderacao (LGPD / Lei 13.787 hash-chain).
// WIRE: queryAuditLog (PlatformModeration backend, SUPER_ADMIN, read-only).
// Zero-mock: entries vem do gateway GraphQL; sem ENTRIES hardcoded.

"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

// Categorias derivadas no backend a partir do `action` do LgpdAuditLog.
type AuditCategory =
  | "MODERATION"
  | "DATA_ACCESS"
  | "CONSENT"
  | "AUTH"
  | "PRIVACY_REQUEST";

type AuditEntry = {
  id: string;
  profileId: string;
  actor: string;
  action: string;
  category: AuditCategory;
  entity: string | null;
  entityId: string | null;
  ipAddress: string | null;
  hashChain: string;
  previousHash: string | null;
  createdAt: string;
};

type AuditPage = {
  items: AuditEntry[];
  total: number;
  retentionYears: number;
  chainIntact: boolean;
};

type LoadState = "loading" | "ready" | "error";

const CATEGORY_LABEL: Record<AuditCategory, string> = {
  MODERATION: "Moderacao",
  DATA_ACCESS: "Acesso a dados",
  CONSENT: "Consentimento",
  AUTH: "Autenticacao",
  PRIVACY_REQUEST: "Solicitacao LGPD",
};

const CATEGORY_COLOR: Record<AuditCategory, string> = {
  MODERATION:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  DATA_ACCESS:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  CONSENT:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  AUTH: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  PRIVACY_REQUEST:
    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const AUDIT_LOG_QUERY = /* GraphQL */ `
  query QueryAuditLog($input: QueryAuditLogInput) {
    queryAuditLog(input: $input) {
      items {
        id
        profileId
        actor
        action
        category
        entity
        entityId
        ipAddress
        hashChain
        previousHash
        createdAt
      }
      total
      retentionYears
      chainIntact
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

export default function AuditoriaPage() {
  const [filter, setFilter] = useState<AuditCategory | "all">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState<AuditPage | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const res = await gql<{ queryAuditLog: AuditPage }>(AUDIT_LOG_QUERY, {
        input: {
          category: filter === "all" ? null : filter,
          limit: 200,
          offset: 0,
        },
      });
      setPage(res.queryAuditLog);
      setState("ready");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Falha ao carregar auditoria",
      );
      setState("error");
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const entries = page?.items ?? [];

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return entries.filter((e) => {
      if (!term) return true;
      return (
        e.actor.toLowerCase().includes(term) ||
        (e.entityId ?? "").toLowerCase().includes(term) ||
        e.action.toLowerCase().includes(term) ||
        e.profileId.toLowerCase().includes(term)
      );
    });
  }, [entries, search]);

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
              Read-only. Hash-chained para integridade. Retencao:{" "}
              {page?.retentionYears ?? 5} anos (LGPD).
            </p>
          </div>
          <div className="flex items-center gap-3">
            {state === "ready" && (
              <span
                className={`flex items-center gap-1 text-xs font-medium ${
                  page?.chainIntact
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
                title="Integridade da hash-chain (Lei 13.787)"
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    page?.chainIntact ? "bg-green-500" : "bg-red-500"
                  }`}
                />
                {page?.chainIntact ? "Cadeia integra" : "Cadeia rompida"}
              </span>
            )}
            <button
              onClick={() => load()}
              className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted"
            >
              Atualizar
            </button>
          </div>
        </div>
      </header>

      <div className="flex gap-3 mb-6 flex-wrap items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por actor, profileId, target ou acao..."
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

      {state === "loading" ? (
        <div className="p-12 text-center rounded-lg border border-dashed border-border">
          <p className="text-sm text-muted-foreground">Carregando registros…</p>
        </div>
      ) : state === "error" ? (
        <div className="p-12 text-center rounded-lg border border-dashed border-red-300 dark:border-red-800">
          <p className="text-4xl mb-3">⚠️</p>
          <p className="font-semibold mb-1">Falha ao carregar auditoria</p>
          <p className="text-sm text-muted-foreground mb-4">
            {errorMessage ?? "Erro desconhecido."}
          </p>
          <button
            onClick={() => load()}
            className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted"
          >
            Tentar novamente
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center rounded-lg border border-dashed border-border">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-semibold mb-1">
            {entries.length === 0
              ? "Sem registros de auditoria"
              : "Nenhum registro neste filtro"}
          </p>
          <p className="text-sm text-muted-foreground">
            {entries.length === 0
              ? "Toda acao de moderador, acesso a dados sensiveis, ou solicitacao LGPD sera registrada aqui."
              : "Tente outro filtro ou termo de busca."}
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground mb-2">
            {filtered.length} de {page?.total ?? entries.length} registros
          </p>
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
                      {new Date(e.createdAt).toLocaleString("pt-BR")}
                    </td>
                    <td className="p-3">
                      <p className="font-medium text-xs">{e.actor}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {e.profileId}
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
                    <td className="p-3 text-xs font-mono">
                      {e.entity ? `${e.entity}:` : ""}
                      {e.entityId ?? "—"}
                    </td>
                    <td className="p-3 text-xs font-mono text-muted-foreground">
                      {e.ipAddress ?? "—"}
                    </td>
                    <td className="p-3 text-[10px] font-mono text-muted-foreground truncate max-w-[100px]">
                      {e.hashChain}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
