// Relacionamentos — Admin Denuncias (REFINADO Sprint M8-2)
// Fila de denuncias por moderar com filtros, motivos, evidencias.
// W-R-6 ligara queryReports + mutationResolveReport.
// Honest empty when no reports.

"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useState } from "react";

type ReportStatus = "open" | "in_review" | "resolved" | "rejected";
type ReportReason = "spam" | "harassment" | "fake" | "underage" | "fraud" | "other";

type Report = {
  id: string;
  reporterName: string;
  targetName: string;
  reason: ReportReason;
  description: string;
  evidenceUrls: string[];
  status: ReportStatus;
  createdAt: number;
  assignedTo?: string;
};

// SEED vazio — W-R-6 conecta queryReports().
const REPORTS: Report[] = [];

const STATUS_LABEL: Record<ReportStatus, string> = {
  open: "Aberta",
  in_review: "Em revisao",
  resolved: "Resolvida",
  rejected: "Rejeitada",
};

const STATUS_COLOR: Record<ReportStatus, string> = {
  open: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  in_review: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  resolved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

const REASON_LABEL: Record<ReportReason, string> = {
  spam: "Spam / Promocional",
  harassment: "Assedio / Ameaca",
  fake: "Perfil falso",
  underage: "Menor de idade",
  fraud: "Fraude / Golpe",
  other: "Outro",
};

export default function DenunciasPage() {
  const [reports, setReports] = useState<Report[]>(REPORTS);
  const [filter, setFilter] = useState<ReportStatus | "all">("all");

  const filtered = reports.filter(
    (r) => filter === "all" || r.status === filter
  );

  const resolve = (id: string, status: ReportStatus) => {
    // W-R-6: mutation resolveReport(id, status, notes)
    setReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status } : r))
    );
  };

  const counts = {
    all: reports.length,
    open: reports.filter((r) => r.status === "open").length,
    in_review: reports.filter((r) => r.status === "in_review").length,
    resolved: reports.filter((r) => r.status === "resolved").length,
    rejected: reports.filter((r) => r.status === "rejected").length,
  };

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
      </header>

      <div className="flex gap-2 mb-6 flex-wrap">
        {(["all", "open", "in_review", "resolved", "rejected"] as const).map(
          (k) => (
            <button
              key={k}
              onClick={() => setFilter(k as ReportStatus | "all")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === k
                  ? "bg-fuchsia-600 text-white"
                  : "bg-muted hover:bg-accent"
              }`}
            >
              {k === "all" ? "Todas" : STATUS_LABEL[k as ReportStatus]} (
              {counts[k]})
            </button>
          )
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="p-12 text-center rounded-lg border border-dashed border-border">
          <p className="text-4xl mb-3">✅</p>
          <p className="font-semibold mb-1">
            {reports.length === 0
              ? "Sem denuncias"
              : "Nenhuma denuncia neste filtro"}
          </p>
          <p className="text-sm text-muted-foreground">
            {reports.length === 0
              ? "Quando usuarios denunciarem perfis ou mensagens, aparecem aqui."
              : "Tente outro filtro."}
          </p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">ID</th>
                <th className="text-left p-3 font-medium">Reporter</th>
                <th className="text-left p-3 font-medium">Alvo</th>
                <th className="text-left p-3 font-medium">Motivo</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Quando</th>
                <th className="text-left p-3 font-medium">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-3 font-mono text-xs">{r.id}</td>
                  <td className="p-3">{r.reporterName}</td>
                  <td className="p-3">{r.targetName}</td>
                  <td className="p-3">{REASON_LABEL[r.reason]}</td>
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
                      onClick={() => resolve(r.id, "resolved")}
                      className="px-2 py-1 rounded text-xs bg-green-600 text-white hover:bg-green-700"
                    >
                      Resolver
                    </button>
                    <button
                      onClick={() => resolve(r.id, "rejected")}
                      className="px-2 py-1 rounded text-xs bg-gray-500 text-white hover:bg-gray-600"
                    >
                      Rejeitar
                    </button>
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
