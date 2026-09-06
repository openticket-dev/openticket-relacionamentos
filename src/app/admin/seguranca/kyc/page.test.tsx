// QA100-REL-03 — GATE do drill-down de KYC.
//
// O defeito: o gateway expunha `verificationCases`, `verificationCase`,
// `approveVerificationCase` e `revokeVerificationCase` desde 04/09 e NENHUMA
// tela chamava nenhuma delas. O painel lia so o agregado `verificationStats`:
// dava pra ver que havia N pendentes e nao dava pra abrir nem aprovar nenhum.
// Como o pipeline automatico exige provedor de face-match e lanca
// NOT_IMPLEMENTED sem ele, a fila pendente nao andava por caminho nenhum.
//
// Este gate FALHA no codigo antigo: nao havia chamada de `verificationCases`,
// nem botao de aprovar, nem revogar.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import KycPage from "./page";

type GqlCall = { query: string; variables?: Record<string, unknown> };

const STATS = {
  verifiedCount: 12,
  rejectedCount: 3,
  pendingCount: 5,
  expiredCount: 1,
  totalCount: 21,
  rejectionReasons: [{ reason: "FACE_MISMATCH", count: 3 }],
};

const CASO_PENDENTE = {
  id: "ver-0001",
  profileId: "prof-abcdefgh-1",
  status: "PENDING",
  matchScore: null,
  rejectionReason: null,
  reviewerId: null,
  submittedAt: "2026-09-01T12:00:00.000Z",
  reviewedAt: null,
  expiresAt: null,
  expired: false,
  profileVerified: false,
};

const CASO_APROVADO = {
  ...CASO_PENDENTE,
  id: "ver-0002",
  profileId: "prof-abcdefgh-2",
  status: "APPROVED",
  matchScore: 0.93,
  reviewedAt: "2026-09-02T12:00:00.000Z",
  expiresAt: "2026-12-01T12:00:00.000Z",
  profileVerified: true,
};

function installFetch(opts: {
  cases?: unknown[];
  total?: number;
  mutationError?: string;
}) {
  const calls: GqlCall[] = [];
  const fn = jest.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string) as GqlCall;
    calls.push(body);
    const reply = (data: unknown) =>
      ({ ok: true, status: 200, json: async () => ({ data }) }) as Response;

    if (body.query.includes("approveVerificationCase")) {
      if (opts.mutationError) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ errors: [{ message: opts.mutationError }] }),
        } as Response;
      }
      return reply({
        approveVerificationCase: { ...CASO_PENDENTE, status: "APPROVED" },
      });
    }
    if (body.query.includes("revokeVerificationCase")) {
      return reply({
        revokeVerificationCase: { revoked: true, profileId: "prof-abcdefgh-2" },
      });
    }
    if (body.query.includes("verificationCases")) {
      const items = opts.cases ?? [];
      return reply({
        verificationCases: { items, total: opts.total ?? items.length },
      });
    }
    return reply({ verificationStats: STATS });
  });
  global.fetch = fn as unknown as typeof fetch;
  return { calls };
}

function ultima(calls: GqlCall[], trecho: string) {
  return [...calls].reverse().find((c) => c.query.includes(trecho));
}

afterEach(() => jest.restoreAllMocks());

describe("Admin KYC — o drill-down existe e chama o backend que ja estava pago", () => {
  it("pede a lista de casos, nao so o agregado", async () => {
    const { calls } = installFetch({ cases: [CASO_PENDENTE], total: 5 });
    render(<KycPage />);
    await waitFor(() => {
      const call = ultima(calls, "verificationCases");
      expect(call).toBeDefined();
      const input = (call?.variables as { input: Record<string, unknown> })
        ?.input;
      // Abre em PENDING: e a fila que precisa de gente.
      expect(input.status).toBe("PENDING");
      expect(input.offset).toBe(0);
      expect(input.limit).toBeLessThanOrEqual(100);
    });
  });

  it("nao pede selfieUrl, idUrl nem documentHash (LGPD)", async () => {
    const { calls } = installFetch({ cases: [CASO_PENDENTE], total: 1 });
    render(<KycPage />);
    await waitFor(() => expect(ultima(calls, "verificationCases")).toBeDefined());
    const q = ultima(calls, "verificationCases")?.query ?? "";
    expect(q).not.toContain("selfieUrl");
    expect(q).not.toContain("idUrl");
    expect(q).not.toContain("documentHash");
  });

  it("aprova um caso pendente com o id do proprio caso", async () => {
    const { calls } = installFetch({ cases: [CASO_PENDENTE], total: 1 });
    render(<KycPage />);
    fireEvent.click(await screen.findByText("Aprovar"));
    fireEvent.change(screen.getByPlaceholderText(/Observação do revisor/), {
      target: { value: "Documento conferido a mao" },
    });
    fireEvent.click(screen.getByText("Confirmar"));
    await waitFor(() => {
      const call = ultima(calls, "approveVerificationCase");
      expect(call?.variables).toEqual({
        input: {
          verificationId: "ver-0001",
          note: "Documento conferido a mao",
        },
      });
    });
  });

  it("aprovacao sem observacao nao manda `note` vazio (o Zod rejeita)", async () => {
    const { calls } = installFetch({ cases: [CASO_PENDENTE], total: 1 });
    render(<KycPage />);
    fireEvent.click(await screen.findByText("Aprovar"));
    fireEvent.click(screen.getByText("Confirmar"));
    await waitFor(() => {
      const call = ultima(calls, "approveVerificationCase");
      expect(call?.variables).toEqual({
        input: { verificationId: "ver-0001" },
      });
    });
  });

  it("revogacao exige motivo e manda profileId, nao o id do caso", async () => {
    const { calls } = installFetch({ cases: [CASO_APROVADO], total: 1 });
    render(<KycPage />);
    fireEvent.click(await screen.findByText("Revogar"));

    // Motivo curto demais: nao dispara nada e diz por que.
    fireEvent.change(screen.getByPlaceholderText(/Motivo da revogação/), {
      target: { value: "ab" },
    });
    fireEvent.click(screen.getByText("Confirmar"));
    expect(await screen.findByText(/Motivo obrigatorio/)).toBeInTheDocument();
    expect(ultima(calls, "revokeVerificationCase")).toBeUndefined();

    fireEvent.change(screen.getByPlaceholderText(/Motivo da revogação/), {
      target: { value: "Documento falso confirmado" },
    });
    fireEvent.click(screen.getByText("Confirmar"));
    await waitFor(() => {
      const call = ultima(calls, "revokeVerificationCase");
      expect(call?.variables).toEqual({
        input: {
          profileId: "prof-abcdefgh-2",
          reason: "Documento falso confirmado",
        },
      });
    });
  });

  it("erro de mutation aparece na tela em vez de sumir", async () => {
    installFetch({
      cases: [CASO_PENDENTE],
      total: 1,
      mutationError: "SUPER_ADMIN role required",
    });
    render(<KycPage />);
    fireEvent.click(await screen.findByText("Aprovar"));
    fireEvent.click(screen.getByText("Confirmar"));
    expect(
      await screen.findByText("SUPER_ADMIN role required"),
    ).toBeInTheDocument();
  });

  it("a pagina mostra o total do servidor, nao o tamanho da pagina", async () => {
    installFetch({ cases: [CASO_PENDENTE], total: 137 });
    render(<KycPage />);
    await waitFor(() => {
      expect(
        screen.getByTestId("kyc-paginacao-resumo").textContent,
      ).toContain("de 137");
    });
  });
});
