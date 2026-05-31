// Relacionamentos — Admin Banidos
// W4-REDO: WIRE_REAL via GraphQL platformBans (PlatformModerationResolver,
// SUPER_ADMIN). Desbloqueio wire real: unbanUser(banId, reason).
// Zero-mock: estados loading/ready/empty/error; sem lista fake.
//
// NOTA de contrato (PlatformBan entity): { id blockerId blockedId reason
// createdAt active }. NAO ha userName/banType/expiresAt/bannedBy no gateway —
// renderiza ids reais + estado active. Filtro activeOnly server-side.

"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

interface PlatformBan {
  id: string;
  blockerId: string;
  blockedId: string;
  reason: string | null;
  createdAt: string;
  active: boolean;
}

type LoadState = "loading" | "ready" | "empty" | "error";

const PLATFORM_BANS_QUERY = /* GraphQL */ `
  query PlatformBans($input: PlatformBansFilterInput) {
    platformBans(input: $input) {
      items {
        id
        blockerId
        blockedId
        reason
        createdAt
        active
      }
      total
    }
  }
`;

const UNBAN_USER_MUTATION = /* GraphQL */ `
  mutation UnbanUser($input: UnbanUserInput!) {
    unbanUser(input: $input) {
      ok
      banId
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

export default function BanidosPage() {
  const [bans, setBans] = useState<PlatformBan[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const data = await gql<{
        platformBans: { items: PlatformBan[]; total: number };
      }>(PLATFORM_BANS_QUERY, {
        input: { activeOnly, limit: 100, offset: 0 },
      });
      const items = data.platformBans?.items ?? [];
      setBans(items);
      setState(items.length === 0 ? "empty" : "ready");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Falha ao carregar banidos",
      );
      setState("error");
    }
  }, [activeOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const unban = async (id: string) => {
    if (!confirm("Confirmar desbloqueio? Acao sera logada em Auditoria.")) {
      return;
    }
    setActing(id);
    try {
      await gql(UNBAN_USER_MUTATION, { input: { banId: id } });
      await load();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Falha ao desbanir",
      );
    } finally {
      setActing(null);
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return bans;
    const q = search.trim().toLowerCase();
    return bans.filter(
      (b) =>
        b.blockedId.toLowerCase().includes(q) ||
        b.blockerId.toLowerCase().includes(q) ||
        (b.reason ?? "").toLowerCase().includes(q),
    );
  }, [bans, search]);

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <header className="mb-6">
        <Link
          href="/admin/seguranca"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Seguranca
        </Link>
        <h1 className="text-2xl font-semibold mt-2">Usuarios Banidos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {state === "ready"
            ? `${bans.length} ban(s) ${activeOnly ? "ativo(s)" : "no historico"}.`
            : "Desbloqueios sao logados."}
        </p>
      </header>

      <div className="flex gap-3 mb-6 flex-wrap items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por id ou motivo..."
          className="flex-1 min-w-[200px] px-4 py-2 border border-border rounded-lg bg-background text-sm"
        />
        <div className="flex gap-2">
          <button
            onClick={() => setActiveOnly(true)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium ${
              activeOnly ? "bg-fuchsia-600 text-white" : "bg-muted hover:bg-accent"
            }`}
          >
            Ativos
          </button>
          <button
            onClick={() => setActiveOnly(false)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium ${
              !activeOnly ? "bg-fuchsia-600 text-white" : "bg-muted hover:bg-accent"
            }`}
          >
            Todos
          </button>
        </div>
      </div>

      {/* Loading */}
      {state === "loading" && (
        <div className="space-y-2" role="status" aria-live="polite">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-12 rounded-lg border border-border bg-muted/30 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Error */}
      {state === "error" && (
        <div
          className="text-center py-12 border border-rose-800 rounded-xl bg-rose-950/20"
          role="alert"
        >
          <p className="font-medium text-rose-300">
            Nao foi possivel carregar os banidos
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

      {/* Empty */}
      {state === "empty" && (
        <div className="p-12 text-center rounded-lg border border-dashed border-border">
          <p className="text-4xl mb-3">🤝</p>
          <p className="font-semibold mb-1">Nenhum usuario banido</p>
          <p className="text-sm text-muted-foreground">
            Comunidade limpa por enquanto. Bans aparecem aqui apos resolucao de denuncias.
          </p>
        </div>
      )}

      {/* Ready */}
      {state === "ready" &&
        (filtered.length === 0 ? (
          <div className="p-12 text-center rounded-lg border border-dashed border-border">
            <p className="font-semibold mb-1">Nenhum resultado</p>
            <p className="text-sm text-muted-foreground">
              Nenhum ban bate com a busca.
            </p>
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Banido (id)</th>
                  <th className="text-left p-3 font-medium">Por (id)</th>
                  <th className="text-left p-3 font-medium">Motivo</th>
                  <th className="text-left p-3 font-medium">Estado</th>
                  <th className="text-left p-3 font-medium">Banido em</th>
                  <th className="text-left p-3 font-medium">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.id} className="border-t border-border">
                    <td className="p-3 font-mono text-xs">
                      {b.blockedId.slice(0, 8)}
                    </td>
                    <td className="p-3 font-mono text-xs">
                      {b.blockerId.slice(0, 8)}
                    </td>
                    <td className="p-3 max-w-xs truncate">
                      {b.reason ?? "—"}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          b.active
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                        }`}
                      >
                        {b.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {new Date(b.createdAt).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="p-3">
                      {b.active ? (
                        <button
                          onClick={() => unban(b.id)}
                          disabled={acting === b.id}
                          className="px-3 py-1 rounded text-xs bg-fuchsia-600 text-white hover:bg-fuchsia-700 disabled:opacity-50"
                        >
                          {acting === b.id ? "..." : "Desbanir"}
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </main>
  );
}
