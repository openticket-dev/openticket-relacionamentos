// Relacionamentos — Admin Denuncias
// W4-REDO: WIRE_REAL via GraphQL platformReports (PlatformModerationResolver,
// SUPER_ADMIN). Acoes wire reais: respondReport / closeReport.
// Zero-mock: estados loading/ready/empty/error; sem fila fake.
//
// NOTA de contrato (PlatformReport entity): { id reporterId reportedId reason
// status createdAt reviewedAt reviewerId priorReportsAgainstSubject }. Status
// enum PlatformReportStatus = PENDING | REVIEWED | ACTIONED | DISMISSED. NAO ha
// reporterName/targetName/evidenceUrls no gateway — renderiza ids reais.
//
// REL-G4: coluna RISCO wire real na query trustSignalsBatch (motor anti-catfish,
// 9 sinais medidos em dados proprios). A coluna carrega DEPOIS da fila, em lotes
// de 25 ids, e cada estado tem texto proprio (calculando / n/d / sem perfil /
// sem sinal). Nenhum score é inventado quando o motor nao mede.
//
// FILA PRIORIZADA: o gateway devolve platformReports por createdAt DESC
// (platform-moderation.service.ts) — mais recente primeiro, que nao e mais grave
// primeiro. A tela reordena pelo riskScore do lote (maior risco no topo). Ver
// o memo `ordered` abaixo pro tratamento de quem nao tem score medido.
//
// REL-ADM-07: o filtro de status agora vai no INPUT da query
// (`PlatformReportsFilterInput.status`, enum PlatformReportStatus — confirmado
// por introspection no gateway de staging), nao mais em `Array.filter` sobre a
// pagina. O `total` que o resolver ja devolvia era pedido e jogado fora; agora
// ele e renderizado e comanda a paginacao por `offset`. Antes disso, com mais de
// 100 denuncias a tela escondia o resto sem aviso e os contadores dos chips
// mediam so a pagina carregada.

"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { RiskCell, RiskDetail, type TrustLoadState } from "./RiskCell";
import {
  chunk,
  fetchTrustSignalsBatch,
  TRUST_BATCH_LIMIT,
  type TrustReport,
} from "./trust-signals";

type ReportStatus = "PENDING" | "REVIEWED" | "ACTIONED" | "DISMISSED";

interface PlatformReport {
  id: string;
  reporterId: string;
  reportedId: string;
  reason: string;
  status: ReportStatus;
  createdAt: string;
  reviewedAt: string | null;
  reviewerId: string | null;
  priorReportsAgainstSubject: number;
}

type LoadState = "loading" | "ready" | "empty" | "error";

const PLATFORM_REPORTS_QUERY = /* GraphQL */ `
  query PlatformReports($input: PlatformReportsFilterInput) {
    platformReports(input: $input) {
      items {
        id
        reporterId
        reportedId
        reason
        status
        createdAt
        reviewedAt
        reviewerId
        priorReportsAgainstSubject
      }
      total
    }
  }
`;

const RESPOND_REPORT_MUTATION = /* GraphQL */ `
  mutation RespondReport($input: ReportActionInput!) {
    respondReport(input: $input) {
      ok
      reportId
      newStatus
    }
  }
`;

const CLOSE_REPORT_MUTATION = /* GraphQL */ `
  mutation CloseReport($input: CloseReportInput!) {
    closeReport(input: $input) {
      ok
      reportId
      newStatus
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

const STATUS_LABEL: Record<ReportStatus, string> = {
  PENDING: "Pendente",
  REVIEWED: "Revisada",
  ACTIONED: "Acionada",
  DISMISSED: "Descartada",
};

const STATUS_COLOR: Record<ReportStatus, string> = {
  PENDING:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  REVIEWED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  ACTIONED:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  DISMISSED: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

// Teto por pagina. O resolver aceita `limit`/`offset` obrigatorios
// (PlatformReportsFilterInput), entao a navegacao e por offset.
const PAGE_SIZE = 100;

export default function DenunciasPage() {
  const [reports, setReports] = useState<PlatformReport[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReportStatus | "all">("all");
  // `total` vem do resolver e e a verdade do tamanho da fila — nunca reports.length.
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [acting, setActing] = useState<string | null>(null);
  // REL-G4 — risco por perfil denunciado (motor de trust-signals).
  const [trust, setTrust] = useState<Record<string, TrustReport>>({});
  const [trustMissing, setTrustMissing] = useState<string[]>([]);
  const [trustState, setTrustState] = useState<TrustLoadState>("idle");
  const [trustError, setTrustError] = useState<string | null>(null);
  const [expandedRisk, setExpandedRisk] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const data = await gql<{
        platformReports: { items: PlatformReport[]; total: number };
      }>(PLATFORM_REPORTS_QUERY, {
        input: {
          status: filter === "all" ? null : filter,
          limit: PAGE_SIZE,
          offset,
        },
      });
      const items = data.platformReports?.items ?? [];
      setReports(items);
      setTotal(data.platformReports?.total ?? 0);
      setState(items.length === 0 ? "empty" : "ready");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Falha ao carregar denuncias",
      );
      setState("error");
    }
  }, [filter, offset]);

  useEffect(() => {
    load();
  }, [load]);

  // Ids denunciados da pagina atual — deduplicados.
  const reportedIds = useMemo(
    () => Array.from(new Set(reports.map((r) => r.reportedId))),
    [reports],
  );

  // Carrega o risco em lotes de 25 (teto do resolver), preenchendo a coluna
  // conforme chega. Falha de um lote NAO apaga o que ja veio.
  useEffect(() => {
    if (reportedIds.length === 0) {
      setTrustState("idle");
      return;
    }
    let cancelled = false;
    setTrustState("loading");
    setTrustError(null);
    (async () => {
      try {
        for (const lote of chunk(reportedIds, TRUST_BATCH_LIMIT)) {
          const batch = await fetchTrustSignalsBatch(lote);
          if (cancelled) return;
          setTrust((prev) => {
            const next = { ...prev };
            for (const item of batch.items) next[item.profileId] = item;
            return next;
          });
          setTrustMissing((prev) =>
            Array.from(new Set([...prev, ...batch.missingProfileIds])),
          );
        }
        if (!cancelled) setTrustState("ready");
      } catch (err) {
        if (cancelled) return;
        setTrustError(
          err instanceof Error ? err.message : "Falha ao calcular risco",
        );
        setTrustState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reportedIds]);

  const respond = async (id: string) => {
    setActing(id);
    try {
      await gql(RESPOND_REPORT_MUTATION, { input: { reportId: id } });
      await load();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Falha ao responder denuncia",
      );
    } finally {
      setActing(null);
    }
  };

  const dismiss = async (id: string) => {
    setActing(id);
    try {
      await gql(CLOSE_REPORT_MUTATION, { input: { reportId: id } });
      await load();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Falha ao descartar denuncia",
      );
    } finally {
      setActing(null);
    }
  };

  /**
   * Fila priorizada pelo motor: maior `riskScore` primeiro.
   *
   * O backend ordena por `createdAt: 'desc'` (platform-moderation.service.ts,
   * `platformReports`), entao ate aqui a nota de risco era so uma coluna: o
   * moderador via a denuncia mais recente no topo, nao a mais grave. O score ja
   * chega em lote via `trustSignalsBatch`, entao a ordenacao acontece no
   * cliente, sobre a pagina carregada (PAGE_SIZE).
   *
   * Sem score medido (`riskScore === null`, perfil que o motor nao achou, ou
   * lote ainda em voo) a linha NAO vira 0 — 0 significaria "risco minimo,
   * medido". Ela cai num balde proprio DEPOIS das medidas, preservando a ordem
   * de data que o backend mandou; o indice original desempata, o que tambem
   * torna a ordenacao estavel. Conforme os lotes chegam, as medidas sobem.
   */
  const ordered = useMemo(() => {
    const riskOf = (r: PlatformReport): number | null =>
      trust[r.reportedId]?.riskScore ?? null;
    return reports
      .map((report, index) => ({ report, index }))
      .sort((a, b) => {
        const ra = riskOf(a.report);
        const rb = riskOf(b.report);
        if (ra === null || rb === null) {
          if (ra === rb) return a.index - b.index;
          return ra === null ? 1 : -1;
        }
        if (rb !== ra) return rb - ra;
        return a.index - b.index;
      })
      .map((x) => x.report);
  }, [reports, trust]);

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <header className="mb-6">
        <Link
          href="/admin/seguranca"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Seguranca
        </Link>
        <h1 className="text-2xl font-semibold mt-2">Denuncias</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Fila de moderacao. Acoes ficam logadas em Auditoria (LGPD).
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          A coluna <strong>Risco</strong> vem do motor de trust-signals
          anti-catfish: 9 sinais medidos no proprio banco (idade da conta,
          verificacao, denuncias, bloqueios, velocidade e template de mensagem,
          reciprocidade, geo/device, reuso de foto). Clique no selo pra ver sinal
          por sinal. Sem sinal medido, nao ha score — e a celula diz isso.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          A fila vem ordenada por <strong>maior risco primeiro</strong>, nao por
          data. Denuncia cujo risco o motor ainda nao mediu (ou nao conseguiu
          medir) fica depois das medidas, na ordem de chegada — nunca no topo
          nem tratada como risco zero.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          O filtro de status e aplicado <strong>no servidor</strong>, e o numero
          no chip selecionado e o <strong>total da fila</strong> naquele status —
          nao o tamanho da pagina. Os chips nao selecionados nao mostram numero
          porque esse total nao foi consultado: contador que so conta a pagina
          carregada mente quando ha mais de {PAGE_SIZE} denuncias.
        </p>
      </header>

      <div className="flex gap-2 mb-6 flex-wrap">
        {(["all", "PENDING", "REVIEWED", "ACTIONED", "DISMISSED"] as const).map(
          (k) => (
            <button
              key={k}
              data-testid={`denuncias-chip-${k}`}
              onClick={() => {
                setFilter(k as ReportStatus | "all");
                setOffset(0);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === k
                  ? "bg-fuchsia-600 text-white"
                  : "bg-muted hover:bg-accent"
              }`}
            >
              {k === "all" ? "Todas" : STATUS_LABEL[k as ReportStatus]}
              {filter === k && state !== "loading" ? ` (${total})` : ""}
            </button>
          ),
        )}
      </div>

      {/* Loading */}
      {state === "loading" && (
        <div
          className="space-y-2"
          role="status"
          aria-live="polite"
        >
          {[1, 2, 3, 4].map((i) => (
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
            Nao foi possivel carregar as denuncias
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
      {state === "empty" &&
        (filter === "all" && offset === 0 ? (
          <div className="p-12 text-center rounded-lg border border-dashed border-border">
            <p className="text-4xl mb-3">✅</p>
            <p className="font-semibold mb-1">Sem denuncias</p>
            <p className="text-sm text-muted-foreground">
              Quando usuarios denunciarem perfis ou mensagens, aparecem aqui.
            </p>
          </div>
        ) : (
          <div className="p-12 text-center rounded-lg border border-dashed border-border">
            <p className="font-semibold mb-1">
              Nenhuma denuncia nesta pagina do filtro
            </p>
            <p className="text-sm text-muted-foreground">
              O servidor contou {total} denuncia(s) nesta consulta.
            </p>
            <button
              onClick={() => {
                setFilter("all");
                setOffset(0);
              }}
              className="mt-4 px-4 py-2 text-sm rounded-lg border border-border hover:bg-accent"
            >
              Ver todas
            </button>
          </div>
        ))}

      {/* Ready */}
      {state === "ready" && (
        <>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">ID</th>
                  <th className="text-left p-3 font-medium">Reporter</th>
                  <th className="text-left p-3 font-medium">Alvo</th>
                  <th className="text-left p-3 font-medium">Motivo</th>
                  <th className="text-left p-3 font-medium">Reinc.</th>
                  <th className="text-left p-3 font-medium">Risco</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Quando</th>
                  <th className="text-left p-3 font-medium">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((r) => (
                  <Fragment key={r.id}>
                  <tr className="border-t border-border">
                    <td className="p-3 font-mono text-xs">
                      {r.id.slice(0, 8)}
                    </td>
                    <td className="p-3 font-mono text-xs">
                      {r.reporterId.slice(0, 8)}
                    </td>
                    <td className="p-3 font-mono text-xs">
                      {r.reportedId.slice(0, 8)}
                    </td>
                    <td className="p-3">{r.reason}</td>
                    <td className="p-3 text-center">
                      {r.priorReportsAgainstSubject}
                    </td>
                    <td className="p-3">
                      <RiskCell
                        report={trust[r.reportedId]}
                        state={trustState}
                        missing={trustMissing.includes(r.reportedId)}
                        error={trustError}
                        expanded={expandedRisk === r.id}
                        onToggle={() =>
                          setExpandedRisk((cur) => (cur === r.id ? null : r.id))
                        }
                      />
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLOR[r.status]}`}
                      >
                        {STATUS_LABEL[r.status]}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground text-xs">
                      {new Date(r.createdAt).toLocaleString("pt-BR")}
                    </td>
                    <td className="p-3 flex gap-1">
                      <button
                        onClick={() => respond(r.id)}
                        disabled={acting === r.id}
                        className="px-2 py-1 rounded text-xs bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        {acting === r.id ? "..." : "Resolver"}
                      </button>
                      <button
                        onClick={() => dismiss(r.id)}
                        disabled={acting === r.id}
                        className="px-2 py-1 rounded text-xs bg-gray-500 text-white hover:bg-gray-600 disabled:opacity-50"
                      >
                        Descartar
                      </button>
                    </td>
                  </tr>
                  {expandedRisk === r.id && trust[r.reportedId] ? (
                    <tr className="border-t border-border">
                      <td colSpan={9} className="p-0">
                        <RiskDetail report={trust[r.reportedId]} />
                      </td>
                    </tr>
                  ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginacao — o `total` e do servidor; a pagina nunca esconde o resto
              em silencio. */}
          <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
            <p
              className="text-xs text-muted-foreground"
              data-testid="denuncias-paginacao-resumo"
            >
              Mostrando {offset + 1}–{offset + reports.length} de {total}
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
                disabled={offset + reports.length >= total}
                className="px-3 py-1.5 rounded-lg border border-border text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent"
              >
                Proxima →
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
