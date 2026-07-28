// Relacionamentos — Admin KYC (painel do gestor)
// REL-G3: WIRE_REAL via GraphQL verificationStats (VerificationStatsResolver,
// SUPER_ADMIN). Agrega a tabela Verification (pipeline foto+ID+selfie do
// claim 10): verificados (APPROVED dentro do TTL 90d), rejeitados, pendentes,
// expirados (expiresAt +90d ja passou) e motivos de rejeicao agrupados.
// Zero-mock: estados loading/ready/empty/error; sem numero hardcoded.

"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface RejectionReasonCount {
  reason: string;
  count: number;
}

interface VerificationStats {
  verifiedCount: number;
  rejectedCount: number;
  pendingCount: number;
  expiredCount: number;
  totalCount: number;
  rejectionReasons: RejectionReasonCount[];
}

type LoadState = "loading" | "ready" | "empty" | "error";

const VERIFICATION_STATS_QUERY = /* GraphQL */ `
  query VerificationStats {
    verificationStats {
      verifiedCount
      rejectedCount
      pendingCount
      expiredCount
      totalCount
      rejectionReasons {
        reason
        count
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

export default function KycPage() {
  const [stats, setStats] = useState<VerificationStats | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const data = await gql<{ verificationStats: VerificationStats }>(
        VERIFICATION_STATS_QUERY,
      );
      const s = data.verificationStats;
      setStats(s);
      setState(!s || s.totalCount === 0 ? "empty" : "ready");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Falha ao carregar stats de KYC",
      );
      setState("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const kpis: { label: string; value: number; accent: string; hint: string }[] =
    stats
      ? [
          {
            label: "Verificados",
            value: stats.verifiedCount,
            accent: "text-green-600 dark:text-green-400",
            hint: "APPROVED dentro do TTL de 90d",
          },
          {
            label: "Pendentes",
            value: stats.pendingCount,
            accent: "text-orange-600 dark:text-orange-400",
            hint: "Aguardando processamento",
          },
          {
            label: "Rejeitados",
            value: stats.rejectedCount,
            accent: "text-rose-600 dark:text-rose-400",
            hint: "Reprovados no face-match / documento",
          },
          {
            label: "Expirados",
            value: stats.expiredCount,
            accent: "text-gray-600 dark:text-gray-400",
            hint: "APPROVED com expiresAt (+90d) vencido",
          },
        ]
      : [];

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <header className="mb-6">
        <Link
          href="/admin/seguranca"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Seguranca
        </Link>
        <h1 className="text-2xl font-semibold mt-2">KYC — Verificacao</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Funil de verificacao de identidade (foto + ID + selfie-match).
          Verificacao aprovada expira em 90 dias.
        </p>
      </header>

      {/* Loading */}
      {state === "loading" && (
        <div role="status" aria-live="polite">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-24 rounded-lg border border-border bg-muted/30 animate-pulse"
              />
            ))}
          </div>
          <div className="h-40 rounded-lg border border-border bg-muted/30 animate-pulse" />
        </div>
      )}

      {/* Error */}
      {state === "error" && (
        <div
          className="text-center py-12 border border-rose-800 rounded-xl bg-rose-950/20"
          role="alert"
        >
          <p className="font-medium text-rose-300">
            Nao foi possivel carregar as stats de KYC
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
          <p className="text-4xl mb-3">🪪</p>
          <p className="font-semibold mb-1">Nenhuma verificacao submetida</p>
          <p className="text-sm text-muted-foreground">
            Quando usuarios enviarem foto + documento + selfie, o funil aparece
            aqui.
          </p>
        </div>
      )}

      {/* Ready */}
      {state === "ready" && stats && (
        <>
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {kpis.map((k) => (
              <div
                key={k.label}
                className="p-4 rounded-lg border border-border bg-card"
              >
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  {k.label}
                </p>
                <p className={`text-3xl font-bold mt-1 ${k.accent}`}>
                  {k.value}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{k.hint}</p>
              </div>
            ))}
          </section>

          <p className="text-sm text-muted-foreground mb-8">
            Total de verificacoes submetidas:{" "}
            <span className="font-semibold text-foreground">
              {stats.totalCount}
            </span>
          </p>

          <section>
            <h2 className="font-semibold mb-3">Motivos de rejeicao</h2>
            {stats.rejectionReasons.length === 0 ? (
              <div className="p-8 text-center rounded-lg border border-dashed border-border">
                <p className="text-sm text-muted-foreground">
                  Nenhuma rejeicao com motivo registrado.
                </p>
              </div>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-medium">Motivo</th>
                      <th className="text-right p-3 font-medium">Ocorrencias</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.rejectionReasons.map((r) => (
                      <tr key={r.reason} className="border-t border-border">
                        <td className="p-3">{r.reason}</td>
                        <td className="p-3 text-right font-mono">{r.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
