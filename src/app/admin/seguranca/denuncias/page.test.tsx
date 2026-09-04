// REL-G4 — fila de denuncias com a coluna de RISCO (motor anti-catfish).
// Prova o contrato do front: dispara trustSignalsBatch com os ids denunciados,
// mostra score real, e — o que mais importa — NAO inventa numero quando o motor
// nao mede (sem sinal / sem perfil / n/d).
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import DenunciasPage from "./page";

type GqlCall = { query: string; variables?: Record<string, unknown> };

const REPORT = {
  id: "rep-00000001",
  reporterId: "prof-reporter-1",
  reportedId: "prof-alvo-1",
  reason: "SCAM",
  status: "PENDING",
  createdAt: "2026-07-01T12:00:00.000Z",
  reviewedAt: null,
  reviewerId: null,
  priorReportsAgainstSubject: 3,
};

const GATE_OFF = {
  enabled: false,
  state: "GATED",
  provider: null,
  reason: "Busca reversa de foto desligada: falta TRUST_REVERSE_IMAGE_ENDPOINT.",
  missingEnv: ["TRUST_REVERSE_IMAGE_ENDPOINT", "TRUST_REVERSE_IMAGE_API_KEY"],
};

function trustReport(overrides: Record<string, unknown> = {}) {
  return {
    profileId: "prof-alvo-1",
    trustScore: 25,
    riskScore: 75,
    riskLevel: "CRITICAL",
    signalsEvaluated: 9,
    signalsComputed: 7,
    confidence: 0.78,
    signals: [
      {
        kind: "REPORT_DENSITY",
        status: "OK",
        observedCount: 5,
        windowDays: 30,
        penalty: 25,
        maxPenalty: 25,
        detail: "5 denunciante(s) distinto(s) em 30d.",
        unavailableReason: null,
      },
      {
        kind: "MESSAGE_TEMPLATE_REUSE",
        status: "NO_DATA",
        observedCount: 0,
        windowDays: 7,
        penalty: 0,
        maxPenalty: 20,
        detail: "Sem mensagem na janela de 7d pra comparar.",
        unavailableReason: null,
      },
    ],
    recommendedActions: [
      {
        kind: "ESCALATE_BAN",
        reason: "Risco CRITICAL — REPORT_DENSITY=5 (-25).",
        graphqlMutation: "escalateReport",
        automatic: false,
      },
    ],
    reverseImageSearch: GATE_OFF,
    scoreUnavailableReason: null,
    ...overrides,
  };
}

function installFetch(opts: {
  reports?: unknown[];
  trust?: { items: unknown[]; missingProfileIds?: string[] };
  trustError?: string;
}) {
  const calls: GqlCall[] = [];
  const fn = jest.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string) as GqlCall;
    calls.push(body);
    if (body.query.includes("trustSignalsBatch")) {
      if (opts.trustError) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ errors: [{ message: opts.trustError }] }),
        } as Response;
      }
      const items = opts.trust?.items ?? [];
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            trustSignalsBatch: {
              items,
              requested: 1,
              resolved: items.length,
              missingProfileIds: opts.trust?.missingProfileIds ?? [],
            },
          },
        }),
      } as Response;
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          platformReports: {
            items: opts.reports ?? [],
            total: (opts.reports ?? []).length,
          },
        },
      }),
    } as Response;
  });
  global.fetch = fn as unknown as typeof fetch;
  return { calls };
}

afterEach(() => jest.restoreAllMocks());

describe("Admin denuncias — coluna de risco (REL-G4)", () => {
  it("dispara trustSignalsBatch com os ids denunciados", async () => {
    const { calls } = installFetch({
      reports: [REPORT],
      trust: { items: [trustReport()] },
    });
    render(<DenunciasPage />);
    await waitFor(() => {
      const call = calls.find((c) => c.query.includes("trustSignalsBatch"));
      expect(call).toBeDefined();
      expect(call?.variables).toEqual({
        input: { profileIds: ["prof-alvo-1"] },
      });
    });
  });

  it("mostra o selo com o score medido", async () => {
    installFetch({ reports: [REPORT], trust: { items: [trustReport()] } });
    render(<DenunciasPage />);
    expect(await screen.findByText("Critico · 25/100")).toBeInTheDocument();
  });

  it("score null vira 'sem sinal' com o motivo — nunca numero inventado", async () => {
    installFetch({
      reports: [REPORT],
      trust: {
        items: [
          trustReport({
            trustScore: null,
            riskScore: null,
            riskLevel: "UNKNOWN",
            signalsComputed: 0,
            confidence: 0,
            scoreUnavailableReason:
              "SEM_SINAL_COMPUTAVEL: nenhuma das 9 medicoes retornou dado.",
          }),
        ],
      },
    });
    render(<DenunciasPage />);
    const chip = await screen.findByText("sem sinal");
    expect(chip).toHaveAttribute(
      "title",
      expect.stringContaining("SEM_SINAL_COMPUTAVEL"),
    );
  });

  it("perfil ausente no motor vira 'sem perfil'", async () => {
    installFetch({
      reports: [REPORT],
      trust: { items: [], missingProfileIds: ["prof-alvo-1"] },
    });
    render(<DenunciasPage />);
    expect(await screen.findByText("sem perfil")).toBeInTheDocument();
  });

  it("motor fora do ar: celula 'n/d' e a fila continua utilizavel", async () => {
    installFetch({
      reports: [REPORT],
      trustError: "Forbidden resource",
    });
    render(<DenunciasPage />);
    const cell = await screen.findByText("n/d");
    expect(cell).toHaveAttribute("title", "Forbidden resource");
    // A denuncia segue na tela (a coluna nao derruba a fila).
    expect(screen.getByText("SCAM")).toBeInTheDocument();
  });

  it("expandir mostra sinal por sinal, acao recomendada e o gate da busca reversa", async () => {
    installFetch({ reports: [REPORT], trust: { items: [trustReport()] } });
    render(<DenunciasPage />);
    fireEvent.click(await screen.findByText("Critico · 25/100"));

    expect(
      await screen.findByText("5 denunciante(s) distinto(s) em 30d."),
    ).toBeInTheDocument();
    expect(screen.getByText("sem dado")).toBeInTheDocument();
    expect(screen.getByText("Escalar p/ ban")).toBeInTheDocument();
    expect(
      screen.getByText(/Busca reversa de foto: DESLIGADA/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/TRUST_REVERSE_IMAGE_ENDPOINT/),
    ).toBeInTheDocument();
  });
});

// Regressao: o gateway devolve platformReports por createdAt DESC
// (platform-moderation.service.ts) e a tela nao reordenava — o score do motor
// ficava so como coluna e o moderador via o mais RECENTE no topo, nao o mais
// GRAVE. As linhas abaixo chegam na pior ordem possivel de proposito: um sort
// que nao faz nada reprova.
describe("Admin denuncias — fila priorizada pela nota de risco", () => {
  const row = (id: string, reportedId: string, createdAt: string) => ({
    ...REPORT,
    id,
    reportedId,
    createdAt,
  });

  it("ordena por riskScore desc e deixa quem nao tem score medido por ultimo", async () => {
    installFetch({
      reports: [
        // ordem que o backend manda: createdAt desc (mais recente primeiro).
        row("risk-na-1", "prof-nulo", "2026-07-03T12:00:00.000Z"),
        row("risk-lo-1", "prof-baixo", "2026-07-02T12:00:00.000Z"),
        row("risk-hi-1", "prof-alto", "2026-07-01T12:00:00.000Z"),
      ],
      trust: {
        items: [
          trustReport({
            profileId: "prof-nulo",
            trustScore: null,
            riskScore: null,
            riskLevel: "UNKNOWN",
            signalsComputed: 0,
            confidence: 0,
            scoreUnavailableReason:
              "SEM_SINAL_COMPUTAVEL: nenhuma das 9 medicoes retornou dado.",
          }),
          trustReport({
            profileId: "prof-baixo",
            trustScore: 90,
            riskScore: 10,
            riskLevel: "LOW",
          }),
          trustReport({
            profileId: "prof-alto",
            trustScore: 18,
            riskScore: 82,
            riskLevel: "CRITICAL",
          }),
        ],
      },
    });

    const { container } = render(<DenunciasPage />);

    // A coluna ID renderiza id.slice(0, 8) — os 3 prefixos sao distintos.
    await waitFor(() => {
      const ids = Array.from(container.querySelectorAll("tbody tr")).map(
        (tr) => tr.querySelector("td")?.textContent,
      );
      expect(ids).toEqual(["risk-hi-", "risk-lo-", "risk-na-"]);
    });
  });
});
