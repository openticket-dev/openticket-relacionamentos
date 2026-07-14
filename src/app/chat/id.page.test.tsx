// Fluxo CRITICO: chat 1:1 (mensagens do match).
// Carrega myMatchProfile + messagesInConversation via /api/graphql e envia com
// sendMessage(input:{conversationId,content}). Assercoes reais: query com o
// conversationId da rota, estado vazio, render de mensagem, e envio disparando
// a mutation certa. A rota usa React 19 `use(params)`, entao envolvo em Suspense.
import { Suspense } from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import ChatPage from "./[id]/page";

type GqlCall = { query: string; variables?: Record<string, unknown> };

function installFetch(opts: {
  messages?: unknown[];
  myProfileId?: string | null;
  sent?: Record<string, unknown>;
}) {
  const calls: GqlCall[] = [];
  const fn = jest.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string) as GqlCall;
    calls.push(body);
    if (body.query.includes("MyMatchProfileId") || body.query.includes("myMatchProfile")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: { myMatchProfile: opts.myProfileId ? { profileId: opts.myProfileId } : null },
        }),
      } as Response;
    }
    if (body.query.includes("messagesInConversation")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { messagesInConversation: opts.messages ?? [] } }),
      } as Response;
    }
    if (body.query.includes("sendMessage")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { sendMessage: opts.sent } }),
      } as Response;
    }
    return { ok: true, status: 200, json: async () => ({ data: {} }) } as Response;
  });
  global.fetch = fn as unknown as typeof fetch;
  return { fn, calls };
}

// React 19 `use(params)` suspende no primeiro render; resolvemos o promise
// dentro de act pra o Suspense liberar antes das assercoes.
async function renderChat(id: string) {
  const params = Promise.resolve({ id });
  let utils!: ReturnType<typeof render>;
  await act(async () => {
    utils = render(
      <Suspense fallback={<div>carregando…</div>}>
        <ChatPage params={params} />
      </Suspense>,
    );
  });
  // Libera o Suspense (use(params)) e o Promise.all de load() do chat.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  return utils;
}

const MSG = {
  id: "msg-1",
  conversationId: "conv-abc",
  senderId: "them",
  content: "oi tudo bem?",
  attachmentUrl: null,
  attachmentType: null,
  attachmentMime: null,
  attachmentStatus: null,
  createdAt: "2026-01-01T10:00:00.000Z",
  readAt: null,
};

afterEach(() => jest.restoreAllMocks());

describe("Chat 1:1 (fluxo de mensagens)", () => {
  it("busca as mensagens da conversa passando o conversationId da rota", async () => {
    const { calls } = installFetch({ messages: [] });
    await renderChat("conv-abc");

    await waitFor(() => {
      const q = calls.find((c) => c.query.includes("messagesInConversation"));
      expect(q).toBeDefined();
      expect(q!.variables).toEqual({ input: { conversationId: "conv-abc", limit: 100 } });
    });
  });

  it("mostra o estado vazio quando nao ha mensagens", async () => {
    installFetch({ messages: [] });
    await renderChat("conv-abc");
    expect(await screen.findByText(/Nenhuma mensagem ainda/)).toBeInTheDocument();
  });

  it("renderiza a mensagem existente vinda do backend", async () => {
    installFetch({ messages: [MSG], myProfileId: "me" });
    await renderChat("conv-abc");
    expect(await screen.findByText("oi tudo bem?")).toBeInTheDocument();
  });

  it("enviar dispara sendMessage com conversationId + content e limpa o campo", async () => {
    const { calls } = installFetch({
      messages: [],
      sent: { ...MSG, id: "msg-new", senderId: "me", content: "ola!" },
    });
    await renderChat("conv-abc");
    await screen.findByText(/Nenhuma mensagem ainda/);

    const input = screen.getByPlaceholderText("Mensagem...") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "ola!" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() => {
      const send = calls.find((c) => c.query.includes("sendMessage"));
      expect(send).toBeDefined();
      expect(send!.variables).toEqual({ input: { conversationId: "conv-abc", content: "ola!" } });
    });
    expect(await screen.findByText("ola!")).toBeInTheDocument();
    expect(input.value).toBe("");
  });

  it("mostra erro de carregamento quando o backend devolve GraphQL error", async () => {
    const fn = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ errors: [{ message: "FORBIDDEN" }] }),
    })) as unknown as typeof fetch;
    global.fetch = fn;
    await renderChat("conv-abc");
    expect(await screen.findByText(/Nao foi possivel carregar a conversa/)).toBeInTheDocument();
  });
});
