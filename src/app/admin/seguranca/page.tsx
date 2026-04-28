// Relacionamentos — Admin Security Dashboard
// Wave: W-R-9 (initial scaffold). W-R-6 ligara queries reais.
// RBAC role: trust_safety. Block/report dashboard.

"use client";

import { useState } from "react";

type ReportStatus = "open" | "in_review" | "resolved" | "rejected";

type SafetyReport = {
  id: string;
  reporter_PLACEHOLDER: string;
  target_PLACEHOLDER: string;
  reason_PLACEHOLDER: string;
  status: ReportStatus;
  createdAt: string;
};

const PLACEHOLDER_REPORTS: SafetyReport[] = [
  {
    id: "rep-1",
    reporter_PLACEHOLDER: "user-A",
    target_PLACEHOLDER: "user-X",
    reason_PLACEHOLDER: "spam",
    status: "open",
    createdAt: "2026-04-28",
  },
  {
    id: "rep-2",
    reporter_PLACEHOLDER: "user-B",
    target_PLACEHOLDER: "user-Y",
    reason_PLACEHOLDER: "harassment",
    status: "in_review",
    createdAt: "2026-04-27",
  },
];

const STATUS_LABEL: Record<ReportStatus, string> = {
  open: "Aberto",
  in_review: "Em revisao",
  resolved: "Resolvido",
  rejected: "Rejeitado",
};

const STATUS_COLOR: Record<ReportStatus, string> = {
  open: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  in_review:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  resolved:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
};

export default function SegurancaPage() {
  const [reports, setReports] = useState<SafetyReport[]>(PLACEHOLDER_REPORTS);
  const [filter, setFilter] = useState<ReportStatus | "all">("all");

  const filtered = reports.filter(
    (r) => filter === "all" || r.status === filter,
  );

  const updateStatus = (id: string, status: ReportStatus) => {
    // W-R-6: substituir por mutation updateReportStatus(id, status)
    setReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status } : r)),
    );
  };

  const counts = {
    open: reports.filter((r) => r.status === "open").length,
    in_review: reports.filter((r) => r.status === "in_review").length,
    resolved: reports.filter((r) => r.status === "resolved").length,
    rejected: reports.filter((r) => r.status === "rejected").length,
  };

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Painel de Seguranca</h1>
        <p className="text-muted-foreground mt-2">
          Reports e blocks. RBAC: role <code>trust_safety</code>. Backend
          sera wireado em W-R-6.
        </p>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {(["open", "in_review", "resolved", "rejected"] as ReportStatus[]).map(
          (s) => (
            <div
              key={s}
              className="border border-border rounded-xl p-4 bg-muted/30"
            >
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                {STATUS_LABEL[s]}
              </p>
              <p className="text-2xl font-bold mt-1">{counts[s]}</p>
            </div>
          ),
        )}
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1 rounded-full text-xs font-medium ${
            filter === "all"
              ? "bg-fuchsia-600 text-white"
              : "bg-muted hover:bg-accent"
          }`}
        >
          Todos
        </button>
        {(Object.keys(STATUS_LABEL) as ReportStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              filter === s
                ? "bg-fuchsia-600 text-white"
                : "bg-muted hover:bg-accent"
            }`}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">ID</th>
              <th className="text-left p-3 font-medium">Reporter</th>
              <th className="text-left p-3 font-medium">Target</th>
              <th className="text-left p-3 font-medium">Motivo</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-left p-3 font-medium">Data</th>
              <th className="text-left p-3 font-medium">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="text-center p-8 text-muted-foreground"
                >
                  Nenhum report nesta categoria.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-3 font-mono text-xs">{r.id}</td>
                  <td className="p-3">{r.reporter_PLACEHOLDER}</td>
                  <td className="p-3">{r.target_PLACEHOLDER}</td>
                  <td className="p-3">{r.reason_PLACEHOLDER}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLOR[r.status]}`}
                    >
                      {STATUS_LABEL[r.status]}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground">{r.createdAt}</td>
                  <td className="p-3">
                    <select
                      value={r.status}
                      onChange={(e) =>
                        updateStatus(r.id, e.target.value as ReportStatus)
                      }
                      className="text-xs border border-border rounded px-2 py-1 bg-background"
                    >
                      {(Object.keys(STATUS_LABEL) as ReportStatus[]).map(
                        (s) => (
                          <option key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </option>
                        ),
                      )}
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
