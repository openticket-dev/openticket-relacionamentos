// QA100-REL-06 — GATE da curadoria de eventos para solteiros.
//
// O defeito: `partnerEvents` (catalogo publico) filtra `approved: true` e nada
// no sistema conseguia criar evento nem ligar esse flag. O filtro casava com
// zero linha POR CONSTRUCAO, e por tabela: "Eventos curados" vazio, bloco
// "comprar juntos" do chat invisivel, ComprarJuntosCard de /encontros idem —
// a venda de ingresso pareado nao tinha como acontecer. O backend de escrita
// nasceu em 04/09 e ficou sem nenhuma tela chamando.
//
// Este gate FALHA no codigo antigo pelo motivo mais simples: a rota
// src/app/admin/eventos/page.tsx nao existia, entao o import nem resolve.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CuradoriaEventosPage from "./page";

type GqlCall = { query: string; variables?: Record<string, unknown> };

const PENDENTE = {
  id: "evt-0001",
  title: "Speed dating de sexta",
  kind: "SPEED_DATING",
  city: "Sao Paulo",
  state: "SP",
  startsAt: "2026-10-10T22:00:00.000Z",
  capacity: 40,
  externalUrl: null,
  ticketingEventId: null,
  partnerName: "Bar do Zé",
  approved: false,
};

const PUBLICADO = {
  ...PENDENTE,
  id: "evt-0002",
  title: "Jantar às cegas",
  kind: "DINNER",
  ticketingEventId: "tk-9",
  approved: true,
};

function installFetch(opts: {
  items?: unknown[];
  total?: number;
  pendingCount?: number;
  mutationError?: string;
}) {
  const calls: GqlCall[] = [];
  const fn = jest.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string) as GqlCall;
    calls.push(body);
    const reply = (data: unknown) =>
      ({ ok: true, status: 200, json: async () => ({ data }) }) as Response;

    if (
      body.query.includes("approvePartnerEvent") ||
      body.query.includes("unapprovePartnerEvent")
    ) {
      if (opts.mutationError) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ errors: [{ message: opts.mutationError }] }),
        } as Response;
      }
      return reply({
        approvePartnerEvent: { id: "evt-0001", approved: true },
        unapprovePartnerEvent: { id: "evt-0002", approved: false },
      });
    }
    if (body.query.includes("archivePartnerEvent")) {
      return reply({
        archivePartnerEvent: { archived: true, eventId: "evt-0001" },
      });
    }
    if (body.query.includes("createPartnerEvent")) {
      return reply({
        createPartnerEvent: {
          id: "evt-novo",
          title: "Novo",
          approved: false,
        },
      });
    }
    const items = opts.items ?? [];
    return reply({
      curatorPartnerEvents: {
        items,
        total: opts.total ?? items.length,
        pendingCount: opts.pendingCount ?? 0,
      },
    });
  });
  global.fetch = fn as unknown as typeof fetch;
  return { calls };
}

function ultima(calls: GqlCall[], trecho: string) {
  return [...calls].reverse().find((c) => c.query.includes(trecho));
}

afterEach(() => jest.restoreAllMocks());

describe("Curadoria de eventos — a fila que destrava o catalogo", () => {
  it("abre na fila de pendentes, que e a que trava o catalogo", async () => {
    const { calls } = installFetch({ items: [PENDENTE], pendingCount: 7 });
    render(<CuradoriaEventosPage />);
    await waitFor(() => {
      const call = ultima(calls, "curatorPartnerEvents");
      expect(call).toBeDefined();
      const input = (call?.variables as { input: Record<string, unknown> })
        ?.input;
      expect(input.approved).toBe(false);
      expect(input.offset).toBe(0);
      expect(input.limit).toBeLessThanOrEqual(100);
    });
    await waitFor(() => {
      expect(screen.getByTestId("curadoria-pendentes").textContent).toContain(
        "7",
      );
    });
  });

  it("publicar chama approvePartnerEvent com o id do evento", async () => {
    const { calls } = installFetch({ items: [PENDENTE], pendingCount: 1 });
    render(<CuradoriaEventosPage />);
    fireEvent.click(await screen.findByText("Publicar"));
    await waitFor(() => {
      const call = ultima(calls, "approvePartnerEvent");
      expect(call?.variables).toEqual({ input: { eventId: "evt-0001" } });
    });
  });

  it("evento publicado oferece tirar do ar, nao publicar de novo", async () => {
    const { calls } = installFetch({ items: [PUBLICADO], pendingCount: 0 });
    render(<CuradoriaEventosPage />);
    fireEvent.click(await screen.findByText("Tirar do ar"));
    expect(screen.queryByText("Publicar")).toBeNull();
    await waitFor(() => {
      const call = ultima(calls, "unapprovePartnerEvent");
      expect(call?.variables).toEqual({ input: { eventId: "evt-0002" } });
    });
  });

  it("cadastro manda o enum do gateway e a data em ISO", async () => {
    const { calls } = installFetch({ items: [PENDENTE], pendingCount: 1 });
    render(<CuradoriaEventosPage />);
    fireEvent.click(await screen.findByText("Cadastrar evento"));
    fireEvent.change(screen.getByPlaceholderText("Speed dating de sexta"), {
      target: { value: "Retiro de carnaval" },
    });
    fireEvent.change(screen.getByDisplayValue("Speed dating"), {
      target: { value: "RETREAT" },
    });
    fireEvent.change(
      screen.getByLabelText(/Início/) as HTMLInputElement,
      { target: { value: "2026-11-20T19:30" } },
    );
    fireEvent.click(screen.getByText("Cadastrar"));
    await waitFor(() => {
      const call = ultima(calls, "createPartnerEvent");
      const input = (call?.variables as { input: Record<string, unknown> })
        ?.input;
      expect(input.title).toBe("Retiro de carnaval");
      expect(input.kind).toBe("RETREAT");
      expect(typeof input.startsAt).toBe("string");
      expect(String(input.startsAt)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      // Campos opcionais vazios nao podem ir: o Zod do resolver rejeita "".
      expect(input).not.toHaveProperty("city");
      expect(input).not.toHaveProperty("externalUrl");
    });
  });

  it("link relativo do parceiro e barrado antes de sair do browser", async () => {
    const { calls } = installFetch({ items: [PENDENTE], pendingCount: 1 });
    render(<CuradoriaEventosPage />);
    fireEvent.click(await screen.findByText("Cadastrar evento"));
    fireEvent.change(screen.getByPlaceholderText("Speed dating de sexta"), {
      target: { value: "Festa teste" },
    });
    fireEvent.change(
      screen.getByLabelText(/Início/) as HTMLInputElement,
      { target: { value: "2026-11-20T19:30" } },
    );
    fireEvent.change(screen.getByPlaceholderText("https://"), {
      target: { value: "/parceiro/festa" },
    });
    fireEvent.click(screen.getByText("Cadastrar"));
    expect(
      await screen.findByText(/precisa começar com http/i),
    ).toBeInTheDocument();
    expect(ultima(calls, "createPartnerEvent")).toBeUndefined();
  });

  it("erro de mutation aparece na tela em vez de sumir", async () => {
    installFetch({
      items: [PENDENTE],
      pendingCount: 1,
      mutationError: "SUPER_ADMIN role required",
    });
    render(<CuradoriaEventosPage />);
    fireEvent.click(await screen.findByText("Publicar"));
    expect(
      await screen.findByText(/SUPER_ADMIN role required/),
    ).toBeInTheDocument();
  });

  it("a pagina mostra o total do servidor, nao o tamanho da pagina", async () => {
    installFetch({ items: [PENDENTE], total: 91, pendingCount: 91 });
    render(<CuradoriaEventosPage />);
    await waitFor(() => {
      expect(
        screen.getByTestId("curadoria-paginacao-resumo").textContent,
      ).toContain("de 91");
    });
  });
});
