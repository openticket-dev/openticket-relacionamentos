// REL-G4 — cliente do motor de trust-signals anti-catfish.
//
// Contrato do backend: apps/relacionamentos/src/trust-signals/ no openticket-api
// (query `trustSignalsBatch`, SUPER_ADMIN). O motor mede 9 sinais em dados
// proprios (idade da conta, verificacao, denuncias, bloqueios, velocidade e
// template de mensagem, reciprocidade, IP/geo, reuso de foto).
//
// Zero-mock no front tambem:
//   - `trustScore` pode vir NULL (nenhum sinal computavel) → a UI mostra
//     "sem sinal" com o motivo, nunca um numero de enfeite;
//   - perfil que o backend nao achou entra em `missingProfileIds` → a UI diz
//     "sem perfil";
//   - falha de rede/permissao → "n/d" com o erro no title. Nunca 0/100 fake.

export type TrustRiskLevel = "UNKNOWN" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type TrustSignalStatus = "OK" | "NO_DATA" | "UNAVAILABLE";

export interface TrustSignal {
  kind: string;
  status: TrustSignalStatus;
  observedCount: number;
  windowDays: number | null;
  penalty: number;
  maxPenalty: number;
  detail: string;
  unavailableReason: string | null;
}

export interface TrustAction {
  kind: string;
  reason: string;
  graphqlMutation: string | null;
  automatic: boolean;
}

export interface ReverseImageGate {
  enabled: boolean;
  state: string;
  provider: string | null;
  reason: string | null;
  missingEnv: string[];
}

export interface TrustReport {
  profileId: string;
  trustScore: number | null;
  riskScore: number | null;
  riskLevel: TrustRiskLevel;
  signalsEvaluated: number;
  signalsComputed: number;
  confidence: number;
  signals: TrustSignal[];
  recommendedActions: TrustAction[];
  reverseImageSearch: ReverseImageGate;
  scoreUnavailableReason: string | null;
}

export interface TrustBatch {
  items: TrustReport[];
  requested: number;
  resolved: number;
  missingProfileIds: string[];
}

/** Teto do resolver (TRUST_SIGNALS_MAX_BATCH no service). */
export const TRUST_BATCH_LIMIT = 25;

export const TRUST_SIGNALS_BATCH_QUERY = /* GraphQL */ `
  query TrustSignalsBatch($input: TrustSignalsBatchInput!) {
    trustSignalsBatch(input: $input) {
      requested
      resolved
      missingProfileIds
      items {
        profileId
        trustScore
        riskScore
        riskLevel
        signalsEvaluated
        signalsComputed
        confidence
        signals {
          kind
          status
          observedCount
          windowDays
          penalty
          maxPenalty
          detail
          unavailableReason
        }
        recommendedActions {
          kind
          reason
          graphqlMutation
          automatic
        }
        reverseImageSearch {
          enabled
          state
          provider
          reason
          missingEnv
        }
        scoreUnavailableReason
      }
    }
  }
`;

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Um lote (<= TRUST_BATCH_LIMIT ids). Erros sobem — quem chama decide a UI. */
export async function fetchTrustSignalsBatch(
  profileIds: string[],
): Promise<TrustBatch> {
  const res = await fetch("/api/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      query: TRUST_SIGNALS_BATCH_QUERY,
      variables: { input: { profileIds } },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as {
    data?: { trustSignalsBatch: TrustBatch };
    errors?: { message: string }[];
  };
  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors[0]?.message ?? "GraphQL error");
  }
  if (!json.data?.trustSignalsBatch) throw new Error("No data returned");
  return json.data.trustSignalsBatch;
}

export const RISK_LABEL: Record<TrustRiskLevel, string> = {
  UNKNOWN: "sem sinal",
  LOW: "Baixo",
  MEDIUM: "Medio",
  HIGH: "Alto",
  CRITICAL: "Critico",
};

export const RISK_COLOR: Record<TrustRiskLevel, string> = {
  UNKNOWN: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  LOW: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  MEDIUM:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  HIGH: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  CRITICAL: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
};

export const SIGNAL_LABEL: Record<string, string> = {
  ACCOUNT_AGE: "Idade da conta",
  IDENTITY_VERIFICATION: "Verificacao de identidade",
  REPORT_DENSITY: "Densidade de denuncias",
  BLOCK_DENSITY: "Bloqueios recebidos",
  MESSAGE_VELOCITY: "Velocidade de mensagens",
  MESSAGE_TEMPLATE_REUSE: "Template repetido",
  RECIPROCITY: "Reciprocidade",
  GEO_DEVICE_ANOMALY: "Anomalia geo/device",
  PHOTO_REUSE: "Reuso de foto",
};

export const ACTION_LABEL: Record<string, string> = {
  MONITOR: "Observar",
  REQUEST_VERIFICATION: "Pedir verificacao",
  REVIEW_QUEUE: "Revisar na fila",
  ESCALATE_BAN: "Escalar p/ ban",
};
