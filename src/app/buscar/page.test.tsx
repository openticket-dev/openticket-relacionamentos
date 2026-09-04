// Fluxo CRITICO: swipe/match (deck Tinder-style).
// Feed real via discoverProfiles; cada swipe persiste no gateway federado —
// like/super -> acceptMatch(input:{likedProfileId,type}); pass -> rejectMatch.
// Assercoes reais: carrega o deck, dispara a mutation certa com as variables
// certas por acao, e mostra o toast quando o backend devolve status 'matched'.
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import BuscarPage from "./page";

type GqlCall = { query: string; variables?: Record<string, unknown> };

/** Roteia a resposta pela operacao contida na query enviada. */
function installFetch(handlers: {
  discover?: unknown[];
  acceptStatus?: string;
}) {
  const calls: GqlCall[] = [];
  const fn = jest.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string) as GqlCall;
    calls.push(body);
    if (body.query.includes("discoverProfiles")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: { discoverProfiles: { profiles: handlers.discover ?? [], nextCursor: null } },
        }),
      } as Response;
    }
    if (body.query.includes("acceptMatch")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: { acceptMatch: { status: handlers.acceptStatus ?? "liked", match: null } },
        }),
      } as Response;
    }
    if (body.query.includes("rejectMatch")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { rejectMatch: true } }),
      } as Response;
    }
    return { ok: true, status: 200, json: async () => ({ data: {} }) } as Response;
  });
  global.fetch = fn as unknown as typeof fetch;
  return { fn, calls };
}

const PROFILE = {
  id: "prof-123",
  displayName: "Alex",
  avatar: null,
  age: 28,
  distance: 3,
  bio: "gosta de trilha",
  interests: ["trilha"],
  matchedInterests: ["trilha"],
  score: 0.9,
};

afterEach(() => jest.restoreAllMocks());

describe("Buscar — deck de swipe (fluxo swipe/match)", () => {
  it("mostra estado vazio quando o gateway devolve 0 perfis", async () => {
    installFetch({ discover: [] });
    render(<BuscarPage />);
    expect(await screen.findByText("Nenhum perfil por aqui ainda")).toBeInTheDocument();
  });

  it("carrega o deck e renderiza o card do perfil real", async () => {
    installFetch({ discover: [PROFILE] });
    render(<BuscarPage />);
    expect(await screen.findByRole("region", { name: /Card de Alex/ })).toBeInTheDocument();
  });

  it("curtir (like) dispara acceptMatch com likedProfileId + type LIKE", async () => {
    const { calls } = installFetch({ discover: [PROFILE], acceptStatus: "liked" });
    render(<BuscarPage />);
    await screen.findByRole("region", { name: /Card de Alex/ });

    fireEvent.click(screen.getByRole("button", { name: /Curtir/ }));

    await waitFor(() => {
      const accept = calls.find((c) => c.query.includes("acceptMatch"));
      expect(accept).toBeDefined();
      expect(accept!.variables).toEqual({
        input: { likedProfileId: "prof-123", type: "LIKE" },
      });
    });
  });

  it("super-like manda type SUPER_LIKE", async () => {
    const { calls } = installFetch({ discover: [PROFILE] });
    render(<BuscarPage />);
    await screen.findByRole("region", { name: /Card de Alex/ });

    fireEvent.click(screen.getByRole("button", { name: /Super-like/ }));

    await waitFor(() => {
      const accept = calls.find((c) => c.query.includes("acceptMatch"));
      expect(accept?.variables).toEqual({
        input: { likedProfileId: "prof-123", type: "SUPER_LIKE" },
      });
    });
  });

  it("passar (pass) dispara rejectMatch, nao acceptMatch", async () => {
    const { calls } = installFetch({ discover: [PROFILE] });
    render(<BuscarPage />);
    await screen.findByRole("region", { name: /Card de Alex/ });

    fireEvent.click(screen.getByRole("button", { name: /Passar/ }));

    await waitFor(() => {
      expect(calls.some((c) => c.query.includes("rejectMatch"))).toBe(true);
    });
    expect(calls.some((c) => c.query.includes("acceptMatch"))).toBe(false);
  });

  // Regressao: os chips mandavam o slug minusculo do catalogo de interesses
  // ("networking") num campo tipado [DiscoverySubvertical] — o gateway rejeita a
  // query inteira na validacao do enum e a tela cai no estado de erro.
  it("chip manda o valor do ENUM DiscoverySubvertical, nao slug minusculo", async () => {
    const { calls } = installFetch({ discover: [PROFILE] });
    render(<BuscarPage />);
    await screen.findByRole("region", { name: /Card de Alex/ });

    // Sem chip: nenhuma subvertical vai no filtro.
    expect(
      calls.find((c) => c.query.includes("discoverProfiles"))?.variables,
    ).toEqual({ filters: { limit: 20, cursor: 0 } });

    fireEvent.click(screen.getByRole("button", { name: /Networking/ }));

    await waitFor(() => {
      const discover = calls.filter((c) =>
        c.query.includes("discoverProfiles"),
      );
      expect(discover.length).toBeGreaterThan(1);
      expect(discover[discover.length - 1]!.variables).toEqual({
        filters: { limit: 20, cursor: 0, subverticais: ["NETWORKING"] },
      });
    });
  });

  it("mostra o toast de match quando acceptMatch retorna status 'matched'", async () => {
    installFetch({ discover: [PROFILE], acceptStatus: "matched" });
    render(<BuscarPage />);
    await screen.findByRole("region", { name: /Card de Alex/ });

    fireEvent.click(screen.getByRole("button", { name: /Curtir/ }));

    expect(await screen.findByText(/Deu match com Alex/)).toBeInTheDocument();
  });
});
