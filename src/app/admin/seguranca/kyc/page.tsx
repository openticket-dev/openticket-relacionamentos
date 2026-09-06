// Relacionamentos — Admin KYC (painel do gestor)
// REL-G3: WIRE_REAL via GraphQL verificationStats (VerificationStatsResolver,
// SUPER_ADMIN). Agrega a tabela Verification (pipeline foto+ID+selfie do
// claim 10): verificados (APPROVED dentro do TTL 90d), rejeitados, pendentes,
// expirados (expiresAt +90d ja passou) e motivos de rejeicao agrupados.
// Zero-mock: estados loading/ready/empty/error; sem numero hardcoded.
//
// QA100-REL-03 (06/09/2026) — backend pago sem tela. A segunda parte do REL-G3
// entregou quatro operacoes no gateway em 04/09 e nenhuma tela as chamava:
//
//   verificationCases(input)     lista paginada, filtravel por status
//   verificationCase(id)         um caso
//   approveVerificationCase      aprovacao MANUAL (o gestor olhou)
//   revokeVerificationCase       derruba a verificacao, com motivo obrigatorio
//
// O painel tinha so o agregado: dava pra saber que havia N pendentes e nao
// dava pra abrir nenhum deles. Aprovacao manual e o caminho de quando a
// maquina nao decide — `processVerification` exige FaceMatchProvider e lanca
// NOT_IMPLEMENTED sem ele, entao sem esta tela a fila pendente nunca anda.
//
// LGPD: o tipo VerificationCase do gateway NAO carrega selfieUrl, idUrl nem
// documentHash, de proposito. Esta tela nao tenta buscar nenhum dos tres. Ver
// o documento e outro fluxo, com acesso proprio.
//
// `status` e `profileVerified` aparecem lado a lado porque eles DIVERGEM por
// desenho: um APPROVED expirado mantem status=APPROVED com a flag ainda ligada
// ate o cron passar. Esconder um dos dois faz o gestor achar que a tela errou.

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

/** Espelha VerificationCase do gateway. Sem URL de documento, de proposito. */
interface VerificationCase {
  id: string;
  profileId: string;
  status: string;
  matchScore: number | null;
  rejectionReason: string | null;
  reviewerId: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  expiresAt: string | null;
  expired: boolean;
  profileVerified: boolean;
}

type CaseStatus = "PENDING" | "APPROVED" | "REJECTED";
type CaseFilter = CaseStatus | "all";
type LoadState = "loading" | "ready" | "empty" | "error";

/** Teto por pagina. O resolver aceita limit 1..100 e offset. */
const PAGE_SIZE = 25;

const STATUS_LABEL: Record<CaseStatus, string> = {
  PENDING: "Pendentes",
  APPROVED: "Aprovados",
  REJECTED: "Rejeitados",
};

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

const VERIFICATION_CASES_QUERY = /* GraphQL */ `
  query VerificationCases($input: VerificationCasesInput) {
    verificationCases(input: $input) {
      items {
        id
        profileId
        status
        matchScore
        rejectionReason
        reviewerId
        submittedAt
        reviewedAt
        expiresAt
        expired
        profileVerified
      }
      total
    }
  }
`;

const APPROVE_CASE_MUTATION = /* GraphQL */ `
  mutation ApproveVerificationCase($input: ApproveVerificationInput!) {
    approveVerificationCase(input: $input) {
      id
      profileId
      status
      matchScore
      rejectionReason
      reviewerId
      submittedAt
      reviewedAt
      expiresAt
      expired
      profileVerified
    }
  }
`;

const REVOKE_CASE_MUTATION = /* GraphQL */ `
  mutation RevokeVerificationCase($input: RevokeVerificationInput!) {
    revokeVerificationCase(input: $input) {
      revoked
      profileId
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

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

/** Score do face-match. `null` = o pipeline automatico nunca rodou neste caso. */
function formatScore(score: number | null): string {
  if (score == null) return "sem score";
  return `${Math.round(score * 100)}%`;
}

export default function KycPage() {
  const [stats, setStats] = useState<VerificationStats | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Drill-down
  const [cases, setCases] = useState<VerificationCase[]>([]);
  const [casesTotal, setCasesTotal] = useState(0);
  const [casesState, setCasesState] = useState<LoadState>("loading");
  const [casesError, setCasesError] = useState<string | null>(null);
  const [filter, setFilter] = useState<CaseFilter>("PENDING");
  const [offset, setOffset] = useState(0);

  // Painel de acao (aprovar / revogar). Um caso por vez.
  const [panel, setPanel] = useState<{
    mode: "approve" | "revoke";
    caseId: string;
    profileId: string;
  } | null>(null);
  const [panelText, setPanelText] = useState("");
  const [panelError, setPanelError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  const loadStats = useCallback(async () => {
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

  const loadCases = useCallback(async () => {
    setCasesState("loading");
    try {
      const data = await gql<{
        verificationCases: { items: VerificationCase[]; total: number };
      }>(VERIFICATION_CASES_QUERY, {
        input: {
          status: filter === "all" ? null : filter,
          limit: PAGE_SIZE,
          offset,
        },
      });
      const items = data.verificationCases?.items ?? [];
      setCases(items);
      setCasesTotal(data.verificationCases?.total ?? 0);
      setCasesState(items.length === 0 ? "empty" : "ready");
    } catch (err) {
      setCasesError(
        err instanceof Error ? err.message : "Falha ao carregar os casos",
      );
      setCasesState("error");
    }
  }, [filter, offset]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  function openPanel(mode: "approve" | "revoke", c: VerificationCase) {
    setPanel({ mode, caseId: c.id, profileId: c.profileId });
    setPanelText("");
    setPanelError(null);
  }

  function closePanel() {
    setPanel(null);
    setPanelText("");
    setPanelError(null);
  }

  const submitPanel = async () => {
    if (!panel) return;
    const text = panelText.trim();
    // O resolver exige motivo (min 3, max 500) para revogar. Observacao da
    // aprovacao e opcional, e string vazia nao pode ir — o Zod rejeita.
    if (panel.mode === "revoke" && text.length < 3) {
      setPanelError("Motivo obrigatorio, minimo de 3 caracteres.");
      return;
    }
    if (text.length > 500) {
      setPanelError("Maximo de 500 caracteres.");
      return;
    }
    setActing(true);
    setPanelError(null);
    try {
      if (panel.mode === "approve") {
        await gql(APPROVE_CASE_MUTATION, {
          input: {
            verificationId: panel.caseId,
            ...(text.length > 0 ? { note: text } : {}),
          },
        });
      } else {
        await gql(REVOKE_CASE_MUTATION, {
          input: { profileId: panel.profileId, reason: text },
        });
      }
      closePanel();
      // Os dois lados mudam: o funil e a pagina de casos.
      await Promise.all([loadStats(), loadCases()]);
    } catch (err) {
      setPanelError(
        err instanceof Error
          ? err.message
          : "Falha ao aplicar a acao no caso de verificacao",
      );
    } finally {
      setActing(false);
    }
  };

  const kpis: {
    label: string;
    value: number;
    accent: string;
    hint: string;
    jump: CaseFilter | null;
  }[] = stats
    ? [
        {
          label: "Verificados",
          value: stats.verifiedCount,
          accent: "text-green-600 dark:text-green-400",
          hint: "APPROVED dentro do TTL de 90d",
          jump: "APPROVED",
        },
        {
          label: "Pendentes",
          value: stats.pendingCount,
          accent: "text-orange-600 dark:text-orange-400",
          hint: "Aguardando processamento",
          jump: "PENDING",
        },
        {
          label: "Rejeitados",
          value: stats.rejectedCount,
          accent: "text-rose-600 dark:text-rose-400",
          hint: "Reprovados no face-match / documento",
          jump: "REJECTED",
        },
        {
          label: "Expirados",
          value: stats.expiredCount,
          accent: "text-gray-600 dark:text-gray-400",
          hint: "APPROVED com expiresAt (+90d) vencido",
          jump: null,
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
          ← Segurança
        </Link>
        <h1 className="text-2xl font-semibold mt-2">KYC — Verificação</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Funil de verificação de identidade (foto + ID + selfie-match).
          Verificação aprovada expira em 90 dias.
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
            Não foi possível carregar as stats de KYC
          </p>
          <p className="text-sm text-rose-400/80 mt-2">{errorMessage}</p>
          <button
            onClick={() => loadStats()}
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
          <p className="font-semibold mb-1">Nenhuma verificação submetida</p>
          <p className="text-sm text-muted-foreground">
            Quando usuários enviarem foto + documento + selfie, o funil aparece
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
                {k.jump ? (
                  <button
                    onClick={() => {
                      setFilter(k.jump as CaseFilter);
                      setOffset(0);
                    }}
                    className="mt-2 text-xs underline text-muted-foreground hover:text-foreground"
                  >
                    abrir a lista
                  </button>
                ) : null}
              </div>
            ))}
          </section>

          <p className="text-sm text-muted-foreground mb-8">
            Total de verificações submetidas:{" "}
            <span className="font-semibold text-foreground">
              {stats.totalCount}
            </span>
          </p>

          <section className="mb-10">
            <h2 className="font-semibold mb-3">Motivos de rejeição</h2>
            {stats.rejectionReasons.length === 0 ? (
              <div className="p-8 text-center rounded-lg border border-dashed border-border">
                <p className="text-sm text-muted-foreground">
                  Nenhuma rejeição com motivo registrado.
                </p>
              </div>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-medium">Motivo</th>
                      <th className="text-right p-3 font-medium">
                        Ocorrências
                      </th>
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

      {/* ------------------------------------------------------------------ */}
      {/* Casos — o drill-down. Vive fora do bloco de stats de proposito: se o
          agregado falhar, a fila continua operável. */}
      {/* ------------------------------------------------------------------ */}
      <section data-testid="kyc-casos">
        <div className="flex items-baseline justify-between gap-3 flex-wrap mb-2">
          <h2 className="font-semibold">Casos</h2>
          <p className="text-xs text-muted-foreground max-w-xl">
            A aprovação manual é o caminho de quando a máquina não decide: o
            pipeline automático exige provedor de face-match configurado. Ela
            não inventa score — o campo fica como o pipeline deixou.
          </p>
        </div>

        <div className="flex gap-2 mb-4 flex-wrap">
          {(["PENDING", "APPROVED", "REJECTED", "all"] as CaseFilter[]).map(
            (k) => (
              <button
                key={k}
                onClick={() => {
                  setFilter(k);
                  setOffset(0);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filter === k
                    ? "bg-fuchsia-600 text-white"
                    : "bg-muted hover:bg-accent"
                }`}
              >
                {k === "all" ? "Todos" : STATUS_LABEL[k as CaseStatus]}
                {filter === k && casesState !== "loading"
                  ? ` (${casesTotal})`
                  : ""}
              </button>
            ),
          )}
        </div>

        {casesState === "loading" && (
          <div className="space-y-2" role="status" aria-live="polite">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-12 rounded-lg border border-border bg-muted/30 animate-pulse"
              />
            ))}
          </div>
        )}

        {casesState === "error" && (
          <div
            className="text-center py-12 border border-rose-800 rounded-xl bg-rose-950/20"
            role="alert"
          >
            <p className="font-medium text-rose-300">
              Não foi possível carregar os casos de verificação
            </p>
            <p className="text-sm text-rose-400/80 mt-2">{casesError}</p>
            <button
              onClick={() => loadCases()}
              className="mt-4 px-4 py-2 text-sm rounded-lg border border-rose-700 hover:bg-rose-900/40"
            >
              Tentar de novo
            </button>
          </div>
        )}

        {casesState === "empty" && (
          <div className="p-10 text-center rounded-lg border border-dashed border-border">
            <p className="font-semibold mb-1">
              {offset === 0
                ? "Nenhum caso neste filtro"
                : "Nenhum caso nesta página"}
            </p>
            <p className="text-sm text-muted-foreground">
              {offset === 0
                ? "Nada a revisar aqui por enquanto."
                : `São ${casesTotal} no filtro atual. Você está além do fim da lista.`}
            </p>
            {offset > 0 ? (
              <button
                onClick={() => setOffset(0)}
                className="mt-4 px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-accent"
              >
                Voltar ao início
              </button>
            ) : null}
          </div>
        )}

        {casesState === "ready" && (
          <>
            <div className="border border-border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Perfil (id)</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Flag do perfil</th>
                    <th className="text-left p-3 font-medium">Face-match</th>
                    <th className="text-left p-3 font-medium">Motivo</th>
                    <th className="text-left p-3 font-medium">Enviado</th>
                    <th className="text-left p-3 font-medium">Expira</th>
                    <th className="text-left p-3 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((c) => (
                    <tr key={c.id} className="border-t border-border align-top">
                      <td className="p-3 font-mono text-xs">
                        {c.profileId.slice(0, 8)}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            c.status === "APPROVED"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                              : c.status === "REJECTED"
                                ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                                : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                          }`}
                        >
                          {c.status}
                        </span>
                        {c.expired ? (
                          <span className="ml-2 text-[11px] text-muted-foreground">
                            expirado
                          </span>
                        ) : null}
                      </td>
                      <td className="p-3 text-xs">
                        {c.profileVerified ? "verificado" : "não verificado"}
                        {c.status === "APPROVED" && !c.profileVerified ? (
                          <span
                            className="block text-[11px] text-orange-600 dark:text-orange-400"
                            title="O caso está aprovado e a flag do perfil não está ligada. Divergência real, não erro de tela."
                          >
                            diverge do status
                          </span>
                        ) : null}
                      </td>
                      <td className="p-3 text-xs font-mono">
                        {formatScore(c.matchScore)}
                      </td>
                      <td className="p-3 max-w-xs truncate text-xs">
                        {c.rejectionReason ?? "—"}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {formatDate(c.submittedAt)}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {formatDate(c.expiresAt)}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2 flex-wrap">
                          {c.status === "PENDING" ? (
                            <button
                              onClick={() => openPanel("approve", c)}
                              disabled={acting}
                              className="px-3 py-1 rounded text-xs bg-fuchsia-600 text-white hover:bg-fuchsia-700 disabled:opacity-50"
                            >
                              Aprovar
                            </button>
                          ) : null}
                          {c.profileVerified ? (
                            <button
                              onClick={() => openPanel("revoke", c)}
                              disabled={acting}
                              className="px-3 py-1 rounded text-xs border border-rose-500 text-rose-600 dark:text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
                            >
                              Revogar
                            </button>
                          ) : null}
                          {c.status !== "PENDING" && !c.profileVerified ? (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          ) : null}
                        </div>

                        {panel && panel.caseId === c.id ? (
                          <div className="mt-3 p-3 rounded-lg border border-border bg-muted/30 min-w-[260px]">
                            <p className="text-xs font-medium mb-2">
                              {panel.mode === "approve"
                                ? "Aprovar manualmente"
                                : "Revogar a verificação"}
                            </p>
                            <textarea
                              value={panelText}
                              onChange={(e) => setPanelText(e.target.value)}
                              rows={3}
                              maxLength={500}
                              placeholder={
                                panel.mode === "approve"
                                  ? "Observação do revisor (opcional, até 500 caracteres)"
                                  : "Motivo da revogação (obrigatório, 3 a 500 caracteres)"
                              }
                              className="w-full px-2 py-1.5 text-xs rounded border border-border bg-background"
                            />
                            {panelError ? (
                              <p
                                className="text-xs text-rose-600 dark:text-rose-400 mt-1"
                                role="alert"
                              >
                                {panelError}
                              </p>
                            ) : null}
                            <p className="text-[11px] text-muted-foreground mt-1">
                              {panel.mode === "approve"
                                ? "Fica registrado quem assinou embaixo: o revisor sai do seu login."
                                : "A revogação derruba a flag do perfil e marca a verificação aprovada como rejeitada."}
                            </p>
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={() => submitPanel()}
                                disabled={acting}
                                className="px-3 py-1 rounded text-xs bg-fuchsia-600 text-white hover:bg-fuchsia-700 disabled:opacity-50"
                              >
                                {acting ? "..." : "Confirmar"}
                              </button>
                              <button
                                onClick={() => closePanel()}
                                disabled={acting}
                                className="px-3 py-1 rounded text-xs border border-border hover:bg-accent disabled:opacity-50"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginação — o total é do servidor; a página nunca esconde o
                resto em silêncio. */}
            <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
              <p
                className="text-xs text-muted-foreground"
                data-testid="kyc-paginacao-resumo"
              >
                Mostrando {offset + 1}–{offset + cases.length} de {casesTotal}
                {filter === "all" ? "" : ` em ${STATUS_LABEL[filter]}`}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                  disabled={offset === 0}
                  className="px-3 py-1.5 rounded-lg border border-border text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent"
                >
                  ← Anterior
                </button>
                <button
                  onClick={() => setOffset((o) => o + PAGE_SIZE)}
                  disabled={offset + cases.length >= casesTotal}
                  className="px-3 py-1.5 rounded-lg border border-border text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent"
                >
                  Próxima →
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
