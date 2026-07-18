// Relacionamentos — Minhas Denuncias (REL-S3)
// Root /denuncias: lista REAL das denuncias do usuario autenticado via query
// myReports do subgraph relacionamentos (gateway federado /api/graphql).
// O resolver e scoped server-side a reporterId = user.sub (anti-IDOR).
// Zero-mock: estados loading/ready/empty/error; sem fila fake, sem redirect.
//
// NOTA de contrato (RelacReport entity, gateway): { id reporterId reportedId
// reason status createdAt processedAt }. Status enum RelacReportStatus =
// PENDING | REVIEWED | ACTIONED | DISMISSED. Reason enum RelacReportReason =
// HARASSMENT | FAKE_PHOTO | UNDERAGE | PAYMENT_REQUEST | AGGRESSIVE | SPAM |
// OTHER (mesmo mapa usado pelo form /denuncias/nova).

"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type ReportStatus = "PENDING" | "REVIEWED" | "ACTIONED" | "DISMISSED";

type ReportReason =
  | "HARASSMENT"
  | "FAKE_PHOTO"
  | "UNDERAGE"
  | "PAYMENT_REQUEST"
  | "AGGRESSIVE"
  | "SPAM"
  | "OTHER";

interface MyReport {
  id: string;
  reportedId: string;
  reason: ReportReason | string;
  status: ReportStatus;
  createdAt: string;
  processedAt: string | null;
}

type LoadState = "loading" | "ready" | "empty" | "error";

const MY_REPORTS_QUERY = /* GraphQL */ `
  query MyReports {
    myReports {
      id
      reportedId
      reason
      status
      createdAt
      processedAt
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
  PENDING: "Em analise",
  REVIEWED: "Revisada",
  ACTIONED: "Acao tomada",
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

// Inverso do REASON_TO_ENUM do form /denuncias/nova — mesmos rotulos.
const REASON_LABEL: Record<ReportReason, string> = {
  SPAM: "Spam ou conteudo promocional",
  HARASSMENT: "Assedio, ameaca ou discurso de odio",
  FAKE_PHOTO: "Perfil falso",
  UNDERAGE: "Menor de idade",
  PAYMENT_REQUEST: "Fraude ou golpe",
  AGGRESSIVE: "Conteudo improprio",
  OTHER: "Outro",
};

function reasonLabel(reason: string): string {
  return REASON_LABEL[reason as ReportReason] ?? reason;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MinhasDenunciasPage() {
  const [reports, setReports] = useState<MyReport[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    setErrorMessage(null);
    try {
      const data = await gql<{ myReports: MyReport[] }>(MY_REPORTS_QUERY);
      const items = data.myReports ?? [];
      setReports(items);
      setState(items.length === 0 ? "empty" : "ready");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Falha ao carregar denuncias",
      );
      setState("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="min-h-screen p-6 max-w-2xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Minhas denuncias</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Historico das denuncias que voce enviou. A equipe de Trust &amp;
            Safety analisa em ate 24h.
          </p>
        </div>
        <Link
          href="/denuncias/nova"
          className="shrink-0 px-4 py-2 rounded-full bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
        >
          Nova denuncia
        </Link>
      </header>

      {state === "loading" && (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-20 rounded-lg border border-border animate-pulse bg-muted/40"
            />
          ))}
        </div>
      )}

      {state === "error" && (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30">
          <p className="text-sm font-semibold text-red-700 dark:text-red-300">
            Nao foi possivel carregar suas denuncias
          </p>
          {errorMessage && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
              {errorMessage}
            </p>
          )}
          <button
            onClick={load}
            className="mt-3 px-4 py-2 rounded-full border border-red-300 dark:border-red-800 text-sm text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/40"
          >
            Tentar de novo
          </button>
        </div>
      )}

      {state === "empty" && (
        <div className="p-8 rounded-lg border border-dashed border-border text-center">
          <p className="text-4xl mb-3">🛡️</p>
          <p className="font-semibold mb-1">Nenhuma denuncia enviada</p>
          <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
            Voce ainda nao denunciou nenhum perfil ou mensagem. Se algo te
            incomodar na comunidade, denuncie — a moderacao analisa tudo.
          </p>
          <Link
            href="/denuncias/nova"
            className="inline-block px-5 py-2.5 rounded-full bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
          >
            Fazer uma denuncia
          </Link>
        </div>
      )}

      {state === "ready" && (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li
              key={r.id}
              className="p-4 rounded-lg border border-border flex items-start justify-between gap-4"
            >
              <div className="min-w-0">
                <p className="font-medium text-sm">{reasonLabel(r.reason)}</p>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  Perfil denunciado: {r.reportedId}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Enviada em {formatDate(r.createdAt)}
                  {r.processedAt
                    ? ` · Processada em ${formatDate(r.processedAt)}`
                    : ""}
                </p>
              </div>
              <span
                className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${
                  STATUS_COLOR[r.status] ?? STATUS_COLOR.PENDING
                }`}
              >
                {STATUS_LABEL[r.status] ?? r.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
