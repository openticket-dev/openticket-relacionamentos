// QA100-REL-02 — GATE do rotulo do filtro de descoberta.
//
// O defeito: o select dizia "Todas verticais" e tinha aria-label "Vertical".
// Vertical, na OpenTicket, e Eventos / Varejo / Saude / Igreja / Educacao. O
// que este filtro escolhe sao os 18 interesses do enum DiscoverySubvertical,
// TODOS dentro da propria vertical Relacionamentos. Quem lia o rotulo achava
// que estava buscando gente das outras verticais e, com a lista curta,
// concluia que a busca cross-vertical estava quebrada — ela nunca existiu ali.
//
// Este gate FALHA no codigo antigo: la existe a opcao "Todas verticais" e o
// aria-label "Vertical".
import { render, screen, waitFor } from "@testing-library/react";
import ExplorePage from "./page";

function installFetch() {
  const calls: { query: string; variables?: Record<string, unknown> }[] = [];
  const fn = jest.fn(async (_url: string, init: RequestInit) => {
    calls.push(JSON.parse(init.body as string));
    return {
      ok: true,
      status: 200,
      json: async () => ({ data: { discoverProfiles: { profiles: [] } } }),
    } as Response;
  });
  global.fetch = fn as unknown as typeof fetch;
  return { calls };
}

afterEach(() => jest.restoreAllMocks());

describe("Explore — o filtro nao pode se chamar 'vertical'", () => {
  it("o select se apresenta como interesse", async () => {
    installFetch();
    render(<ExplorePage />);
    const select = await screen.findByLabelText("Interesse");
    expect(select).toBeInTheDocument();
    expect(screen.queryByLabelText("Vertical")).toBeNull();
  });

  it("a opcao neutra nao promete busca cross-vertical", async () => {
    installFetch();
    render(<ExplorePage />);
    await screen.findByLabelText("Interesse");
    expect(screen.getByText("Todos os interesses")).toBeInTheDocument();
    expect(screen.queryByText("Todas verticais")).toBeNull();
    expect(screen.queryByText("Todas as verticais")).toBeNull();
  });

  it("continua mandando o ENUM do gateway, nao o slug", async () => {
    const { calls } = installFetch();
    render(<ExplorePage />);
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    const q = calls[0]?.query ?? "";
    expect(q).toContain("discoverProfiles");
  });
});
