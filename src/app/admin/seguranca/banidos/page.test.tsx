// QA100-REL-01 — GATE do cabecalho de banidos.
//
// O defeito: a tela pedia `total` ao resolver, recebia, e imprimia
// `bans.length` no cabecalho, com `limit: 100` e `offset: 0` cravados. Com 340
// bans ativos o gestor lia "100 ban(s) ativo(s)" e nao havia navegacao pra
// chegar nos outros 240 — numero real com rotulo mentiroso.
//
// Este gate FALHA no codigo antigo: o mock devolve total=340 numa pagina de 2
// itens, e o cabecalho antigo escreve "2 ban(s) ativo(s)".
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import BanidosPage from "./page";

type GqlCall = { query: string; variables?: Record<string, unknown> };

function ban(i: number, active = true) {
  return {
    id: `ban-${i}`,
    blockerId: `prof-blocker-${i}`,
    blockedId: `prof-blocked-${i}`,
    reason: "SCAM",
    createdAt: "2026-07-01T12:00:00.000Z",
    active,
  };
}

function installFetch(opts: { items?: unknown[]; total?: number }) {
  const calls: GqlCall[] = [];
  const fn = jest.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string) as GqlCall;
    calls.push(body);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          platformBans: {
            items: opts.items ?? [],
            total: opts.total ?? (opts.items ?? []).length,
          },
        },
      }),
    } as Response;
  });
  global.fetch = fn as unknown as typeof fetch;
  return { calls };
}

afterEach(() => jest.restoreAllMocks());

describe("Admin banidos — o cabecalho conta o servidor, nao a pagina", () => {
  it("imprime o `total` do resolver, nao o tamanho da pagina", async () => {
    installFetch({ items: [ban(1), ban(2)], total: 340 });
    render(<BanidosPage />);
    // O testid existe desde o loading; o que se espera e o texto do estado
    // pronto, entao a espera e pelo conteudo.
    await waitFor(() => {
      const header = screen.getByTestId("banidos-total");
      expect(header.textContent).toContain("340 ban(s) ativo(s)");
      // E deixa explicito quanto esta na tela — sem isso o 340 vira promessa.
      expect(header.textContent).toContain("mostrando 2");
    });
  });

  it("navega por offset em vez de esconder o resto da lista", async () => {
    const { calls } = installFetch({ items: [ban(1), ban(2)], total: 340 });
    render(<BanidosPage />);
    const resumo = await screen.findByTestId("banidos-paginacao-resumo");
    expect(resumo.textContent).toContain("de 340");

    fireEvent.click(screen.getByText("Proxima →"));
    await waitFor(() => {
      const last = calls[calls.length - 1];
      const input = (last?.variables as { input: Record<string, number> })
        ?.input;
      expect(input.offset).toBeGreaterThan(0);
      // limit cravado em 100 era o outro lado do mesmo defeito.
      expect(input.limit).toBeLessThanOrEqual(100);
    });
  });

  it("trocar o filtro volta pra primeira pagina", async () => {
    const { calls } = installFetch({ items: [ban(1), ban(2)], total: 340 });
    render(<BanidosPage />);
    await screen.findByTestId("banidos-paginacao-resumo");

    fireEvent.click(screen.getByText("Proxima →"));
    await waitFor(() => {
      const input = (calls[calls.length - 1]?.variables as {
        input: Record<string, unknown>;
      })?.input;
      expect(input.offset).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByText("Todos"));
    await waitFor(() => {
      const input = (calls[calls.length - 1]?.variables as {
        input: Record<string, unknown>;
      })?.input;
      expect(input.activeOnly).toBe(false);
      expect(input.offset).toBe(0);
    });
  });
});
