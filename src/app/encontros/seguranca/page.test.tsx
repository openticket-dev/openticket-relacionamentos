// FIX-23 — a tela de panico nao pode prometer socorro que o backend nao entrega.
//
// Prova exigida (perfil com ZERO contatos de emergencia, seed de safetyTips
// NAO rodado — safetyTips/safePlaces voltam vazios):
//   1) O link "Ligar 190" existe SEM clicar em nada e SEM depender do seed.
//   2) Depois de acionar o panico, a tela NAO diz que contatos "serao
//      acionados" e DIZ que nenhum contato foi notificado.
//
// Por que isso importa: no backend o triggerPanic so faz panicEvent.create com
// status PENDING; `panicEvent` nao e lido por nenhum dispatcher e
// `contactsNotified` e um COUNT de contatos cadastrados, nao de avisados
// (openticket-api .../resolvers/user-perfil-extras.resolver.ts:145-173).
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SegurancaEncontrosPage from "./page";

interface GqlCall {
  query: string;
  variables?: Record<string, unknown>;
}

function installFetch(opts: {
  panic?: {
    ok: boolean;
    persisted: boolean;
    panicEventId: string | null;
    pendingReason: string | null;
  };
} = {}) {
  const calls: GqlCall[] = [];
  const fn = jest.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string) as GqlCall;
    calls.push(body);

    // Seed do safety-center NAO rodou: dicas, locais e canais de ajuda vazios.
    if (body.query.includes("safetyTips")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { safetyTips: [] } }),
      } as Response;
    }
    if (body.query.includes("safePlaces")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { safePlaces: [] } }),
      } as Response;
    }
    // Sem sessao de localizacao ativa.
    if (body.query.includes("myLocationShareSession")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { myLocationShareSession: null } }),
      } as Response;
    }
    if (body.query.includes("triggerPanic")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            triggerPanic:
              opts.panic ?? {
                ok: true,
                persisted: true,
                panicEventId: "panic-evt-0001",
                pendingReason: null,
              },
          },
        }),
      } as Response;
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ data: {} }),
    } as Response;
  });
  global.fetch = fn as unknown as typeof fetch;
  return { calls };
}

beforeEach(() => {
  // Sem geolocation no jsdom: getCoords resolve null (best-effort, por design).
  Object.defineProperty(globalThis, "navigator", {
    value: { ...globalThis.navigator, geolocation: undefined },
    configurable: true,
  });
});

afterEach(() => jest.restoreAllMocks());

describe("Central de seguranca — copy honesta do panico (FIX-23)", () => {
  it("mostra 190/180/100 sem clicar em nada e sem depender do seed", async () => {
    installFetch();
    render(<SegurancaEncontrosPage />);

    // (A) Autoridade publica hardcoded: existe mesmo com safetyTips = [].
    const l190 = await screen.findByRole("link", { name: /Ligar 190/i });
    expect(l190).toHaveAttribute("href", "tel:190");
    expect(screen.getByRole("link", { name: /Ligar 180/i })).toHaveAttribute(
      "href",
      "tel:180",
    );
    expect(screen.getByRole("link", { name: /Ligar 100/i })).toHaveAttribute(
      "href",
      "tel:100",
    );

    // Prova que o seed realmente nao rodou — o bloco veio do codigo, nao do BE.
    await screen.findByText(/Nenhum canal de ajuda cadastrado ainda/i);
  });

  it("nao promete acionar contatos no cabecalho do panico", () => {
    installFetch();
    render(<SegurancaEncontrosPage />);

    expect(
      screen.queryByText(/Aciona seus contatos de emergencia/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        /Nao aciona a policia e nao envia mensagem para ninguem/i,
      ),
    ).toBeInTheDocument();
  });

  it("apos acionar o panico, diz que ninguem foi notificado (nao 'serao acionados')", async () => {
    installFetch();
    render(<SegurancaEncontrosPage />);

    fireEvent.click(screen.getByRole("button", { name: /Acionar panico/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Nenhum contato foi notificado automaticamente/i),
      ).toBeInTheDocument();
    });
    // A mentira antiga nao pode voltar.
    expect(screen.queryByText(/serao acionados/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/receberam o alerta/i)).not.toBeInTheDocument();
    // Id do evento aparece: e o registro forense, e a unica coisa que ocorreu.
    expect(screen.getByText(/panic-evt-0001/)).toBeInTheDocument();
    // E o socorro real continua a 1 toque.
    expect(
      screen.getByRole("link", { name: /Ligar 190 agora/i }),
    ).toHaveAttribute("href", "tel:190");
  });

  it("quando o backend NAO persiste, nao diz que registrou", async () => {
    installFetch({
      panic: {
        ok: true,
        persisted: false,
        panicEventId: null,
        pendingReason: "SCHEMA_MIGRATION_PENDING",
      },
    });
    render(<SegurancaEncontrosPage />);

    fireEvent.click(screen.getByRole("button", { name: /Acionar panico/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/ainda nao registrado/i),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Nenhum contato foi notificado automaticamente/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/SCHEMA_MIGRATION_PENDING/)).toBeInTheDocument();
  });
});
