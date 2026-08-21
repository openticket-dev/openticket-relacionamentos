// F4 (2026-08-21) — fim do beco sem saida do contato de emergencia.
//
// O que estes testes travam:
//  1. /encontros/seguranca mandava "Cadastre contatos" pra /perfil/editar, que
//     nao tem NENHUM campo de contato (so bio/prompts/interesses). O usuario
//     clicava e nao tinha onde cadastrar.
//  2. A tela nova carrega myEmergencyContacts ANTES de salvar. A mutation
//     setEmergencyContacts e replace-set transacional (safety.service.ts:798-812):
//     salvar 1 contato sem ter carregado a lista APAGA os anteriores.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ContatosEmergenciaPage from "./page";
import SegurancaPage from "../../encontros/seguranca/page";

type GqlCall = { query: string; variables?: Record<string, unknown> };

/** fetch fake que responde por nome de operacao. */
function installFetch(
  handler: (call: GqlCall) => Record<string, unknown>,
): { calls: GqlCall[] } {
  const calls: GqlCall[] = [];
  global.fetch = jest.fn(async (_url: string, init: RequestInit) => {
    const call = JSON.parse(init.body as string) as GqlCall;
    calls.push(call);
    return {
      ok: true,
      status: 200,
      json: async () => ({ data: handler(call) }),
    } as Response;
  }) as unknown as typeof fetch;
  return { calls };
}

afterEach(() => jest.restoreAllMocks());

describe("Contatos de emergencia — F4", () => {
  it("o CTA de /encontros/seguranca aponta pra rota que TEM campo de contato", async () => {
    installFetch((c) => {
      if (c.query.includes("myLocationShareSession")) {
        return {
          myLocationShareSession: {
            id: "s1",
            status: "ACTIVE",
            contactsNotified: 0,
            lastLocationHash: null,
            startedAt: new Date().toISOString(),
            lastPingAt: null,
            expiresAt: null,
          },
        };
      }
      if (c.query.includes("safetyTips")) return { safetyTips: [] };
      if (c.query.includes("safePlaces")) return { safePlaces: [] };
      return {};
    });

    render(<SegurancaPage />);

    const cta = await screen.findByRole("link", { name: /cadastre contatos/i });
    // Antes: "/perfil/editar" — pagina sem nenhum input de contato.
    expect(cta).toHaveAttribute("href", "/perfil/contatos-emergencia");
  });

  it("a rota nova tem os campos que /perfil/editar nunca teve", async () => {
    installFetch(() => ({ myEmergencyContacts: [] }));
    render(<ContatosEmergenciaPage />);

    expect(await screen.findByLabelText(/nome do contato/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/telefone do contato/i)).toBeInTheDocument();
  });

  it("carrega myEmergencyContacts ao montar e lista o que ja existe", async () => {
    const { calls } = installFetch(() => ({
      myEmergencyContacts: [
        { name: "Ana", phone: "+5511999990001", relation: "irma" },
      ],
    }));
    render(<ContatosEmergenciaPage />);

    expect(await screen.findByText("Ana")).toBeInTheDocument();
    expect(
      calls.some((c) => c.query.includes("myEmergencyContacts")),
    ).toBe(true);
  });

  it("salvar 1 contato manda o SET COMPLETO — nao apaga quem ja estava la", async () => {
    const { calls } = installFetch((c) => {
      if (c.query.includes("myEmergencyContacts")) {
        return {
          myEmergencyContacts: [
            { name: "Ana", phone: "+5511999990001", relation: "irma" },
          ],
        };
      }
      return {
        setEmergencyContacts: {
          ok: true,
          persisted: true,
          pendingReason: null,
          accepted: 2,
        },
      };
    });

    render(<ContatosEmergenciaPage />);
    await screen.findByText("Ana");

    fireEvent.change(screen.getByLabelText(/nome do contato/i), {
      target: { value: "Bia" },
    });
    fireEvent.change(screen.getByLabelText(/telefone do contato/i), {
      target: { value: "+5511999990002" },
    });
    fireEvent.click(screen.getByRole("button", { name: /salvar contato/i }));

    await waitFor(() => {
      expect(
        calls.some((c) => c.query.includes("setEmergencyContacts")),
      ).toBe(true);
    });

    const mutation = calls.find((c) =>
      c.query.includes("setEmergencyContacts"),
    );
    const sent = (mutation?.variables?.input as {
      contacts: Array<{ name: string; phone: string }>;
    }).contacts;

    // O replace-set recebe os DOIS. Se a tela nao tivesse carregado a lista,
    // aqui iria so a Bia e a Ana seria soft-deletada em silencio.
    expect(sent).toHaveLength(2);
    expect(sent.map((c) => c.name)).toEqual(["Ana", "Bia"]);
    expect(await screen.findByText("Bia")).toBeInTheDocument();
  });

  it("recusa apagar o ultimo contato com motivo — o backend exige min 1", async () => {
    const { calls } = installFetch(() => ({
      myEmergencyContacts: [
        { name: "Ana", phone: "+5511999990001", relation: null },
      ],
    }));

    render(<ContatosEmergenciaPage />);
    fireEvent.click(await screen.findByRole("button", { name: /remover ana/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /pelo menos 1/i,
    );
    // Nao chamou a mutation com lista vazia (o backend responderia 400).
    expect(
      calls.some((c) => c.query.includes("setEmergencyContacts")),
    ).toBe(false);
    expect(screen.getByText("Ana")).toBeInTheDocument();
  });
});
