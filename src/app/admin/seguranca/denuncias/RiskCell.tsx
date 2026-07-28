// REL-G4 — celula de risco da fila de denuncias + painel de detalhe.
// Renderiza SO o que o motor mediu. Cada estado tem texto proprio:
//   carregando · n/d (falhou) · sem perfil · sem sinal (score null) · score.
"use client";

import {
  ACTION_LABEL,
  RISK_COLOR,
  RISK_LABEL,
  SIGNAL_LABEL,
  type TrustReport,
} from "./trust-signals";

export type TrustLoadState = "idle" | "loading" | "ready" | "error";

interface RiskCellProps {
  report?: TrustReport;
  state: TrustLoadState;
  missing: boolean;
  error: string | null;
  expanded: boolean;
  onToggle: () => void;
}

export function RiskCell({
  report,
  state,
  missing,
  error,
  expanded,
  onToggle,
}: RiskCellProps) {
  if (missing) {
    return (
      <span
        className="text-xs text-muted-foreground"
        title="O motor nao encontrou perfil de relacionamentos com este id (apagado por LGPD ou denuncia de outro dominio)."
      >
        sem perfil
      </span>
    );
  }

  if (!report) {
    if (state === "loading" || state === "idle") {
      return (
        <span className="text-xs text-muted-foreground" aria-busy="true">
          calculando...
        </span>
      );
    }
    return (
      <span
        className="text-xs text-muted-foreground"
        title={error ?? "Motor de trust-signals nao respondeu."}
      >
        n/d
      </span>
    );
  }

  const level = report.riskLevel;
  const score = report.trustScore;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className={`px-2 py-1 rounded-full text-xs font-medium ${RISK_COLOR[level]}`}
      title={
        score === null
          ? (report.scoreUnavailableReason ??
            "Nenhum sinal computavel — score nao calculado.")
          : `${report.signalsComputed} de ${report.signalsEvaluated} sinais medidos (confianca ${Math.round(
              report.confidence * 100,
            )}%)`
      }
    >
      {score === null
        ? RISK_LABEL.UNKNOWN
        : `${RISK_LABEL[level]} · ${score}/100`}
    </button>
  );
}

export function RiskDetail({ report }: { report: TrustReport }) {
  const gate = report.reverseImageSearch;
  return (
    <div className="p-4 bg-muted/30 text-xs space-y-3">
      <p className="text-muted-foreground">
        {report.signalsComputed} de {report.signalsEvaluated} sinais medidos ·
        confianca {Math.round(report.confidence * 100)}%
        {report.trustScore === null
          ? ` · ${report.scoreUnavailableReason ?? "score nao calculado"}`
          : ` · score ${report.trustScore}/100 (risco ${report.riskScore})`}
      </p>

      <ul className="space-y-1">
        {report.signals.map((s) => (
          <li key={s.kind} className="flex gap-2 items-start">
            <span className="font-medium min-w-[11rem]">
              {SIGNAL_LABEL[s.kind] ?? s.kind}
            </span>
            <span className="flex-1">
              {s.detail}
              {s.status === "UNAVAILABLE" && s.unavailableReason ? (
                <em className="text-rose-500"> — nao medido: {s.unavailableReason}</em>
              ) : null}
            </span>
            <span className="text-muted-foreground whitespace-nowrap">
              {s.status === "OK"
                ? `-${s.penalty} / ${s.maxPenalty}`
                : s.status === "NO_DATA"
                  ? "sem dado"
                  : "indisponivel"}
            </span>
          </li>
        ))}
      </ul>

      <div>
        <p className="font-medium mb-1">Acoes recomendadas (nenhuma automatica)</p>
        <ul className="space-y-1">
          {report.recommendedActions.map((a) => (
            <li key={a.kind}>
              <span className="font-medium">
                {ACTION_LABEL[a.kind] ?? a.kind}
              </span>{" "}
              — {a.reason}
              {a.graphqlMutation ? (
                <code className="ml-1 opacity-70">({a.graphqlMutation})</code>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      {!gate.enabled ? (
        <p className="text-amber-600 dark:text-amber-400">
          Busca reversa de foto: DESLIGADA ({gate.state}).{" "}
          {gate.reason ?? "Sem credencial configurada."}
          {gate.missingEnv.length > 0
            ? ` Falta: ${gate.missingEnv.join(", ")}.`
            : ""}
        </p>
      ) : (
        <p className="text-muted-foreground">
          Busca reversa de foto: ligada
          {gate.provider ? ` (${gate.provider})` : ""}.
        </p>
      )}
    </div>
  );
}
