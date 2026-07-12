// Fluxo CRITICO: lista de matches (resultado do swipe mutuo).
// myMatches via /api/graphql. Assercoes reais: loading -> ready/empty/error,
// dispara a query MyMatches, e renderiza os campos reais do contrato
// (intent/note/quando) sem inventar nome/idade que o gateway nao expoe.
import { render, screen, waitFor } from "@testing-library/react";
import MatchesPage from "./page";

type GqlCall = { query: string; variables?: Record<string, unknown> };

function installFetch(resp:
  | { ok: true; matches: unknown[] }
  | { ok: false; error: string }) {
  const calls: GqlCall[] = [];
  const fn = jest.fn(async (_url: string, init: RequestInit) => {
    calls.push(JSON.parse(init.body as string));
    if (!resp.ok) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ errors: [{ message: resp.error }] }),
      } as Response;
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ data: { myMatches: resp.matches } }),
    } as Response;
  });
  global.fetch = fn as unknown as typeof fetch;
  return { fn, calls };
}

const MATCH = {
  id: "m-1",
  targetProfileId: "prof-9999",
  intent: "amizade",
  note: "curtiu seu perfil de trilha",
  pinnedAt: null,
  createdAt: "2026-01-02T12:00:00.000Z",
};

afterEach(() => jest.restoreAllMocks());

describe("Matches — lista (fluxo swipe/match)", () => {
  it("dispara a query MyMatches ao montar", async () => {
    const { calls } = installFetch({ ok: true, matches: [] });
    render(<MatchesPage />);
    await waitFor(() => {
      expect(calls.some((c) => c.query.includes("myMatches"))).toBe(true);
    });
  });

  it("mostra o estado vazio quando nao ha matches", async () => {
    installFetch({ ok: true, matches: [] });
    render(<MatchesPage />);
    expect(await screen.findByText("Nenhum match ainda")).toBeInTheDocument();
  });

  it("renderiza o match com os campos reais do contrato (intent + note)", async () => {
    installFetch({ ok: true, matches: [MATCH] });
    render(<MatchesPage />);
    expect(await screen.findByText("amizade")).toBeInTheDocument();
    expect(screen.getByText("curtiu seu perfil de trilha")).toBeInTheDocument();
    // 1 match ativo no cabecalho.
    expect(screen.getByText(/1 matches ativos/)).toBeInTheDocument();
  });

  it("mostra o estado de erro quando o gateway devolve GraphQL error", async () => {
    installFetch({ ok: false, error: "UNAUTHENTICATED" });
    render(<MatchesPage />);
    expect(
      await screen.findByText("Nao foi possivel carregar seus matches"),
    ).toBeInTheDocument();
    expect(screen.getByText("UNAUTHENTICATED")).toBeInTheDocument();
  });
});
