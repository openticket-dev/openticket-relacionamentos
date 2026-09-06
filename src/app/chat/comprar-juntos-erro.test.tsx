// QA100-REL-04 — GATE do bloco "comprar juntos" dentro do chat.
//
// O defeito: o `catch` do ComprarJuntosSection era mudo. Ele zerava matchId e
// events, e o componente caia no mesmo `return null` do caso legitimo "nao ha
// encontro com ingresso". Query quebrada e ausencia de evento produziam a
// MESMA tela — o bloco que move dinheiro podia estar fora do ar por semanas
// sem gerar um unico sinal na interface.
//
// Este gate FALHA no codigo antigo: com as duas queries do bloco devolvendo
// erro, a tela antiga nao renderiza nada e o testid nao existe.
import { Suspense } from "react";
import { render, screen, act, waitFor } from "@testing-library/react";
import ChatPage from "./[id]/page";

type GqlCall = { query: string; variables?: Record<string, unknown> };

/**
 * Chat carrega normalmente; SO as duas queries do bloco de ingresso pareado
 * (myConversations e partnerEvents) falham. E exatamente o cenario que ficava
 * invisivel.
 */
function installFetch() {
  const calls: GqlCall[] = [];
  const fn = jest.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string) as GqlCall;
    calls.push(body);
    if (
      body.query.includes("myConversations") ||
      body.query.includes("partnerEvents")
    ) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          errors: [{ message: "Gateway indisponivel para partnerEvents" }],
        }),
      } as Response;
    }
    if (body.query.includes("myMatchProfile")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { myMatchProfile: { profileId: "me" } } }),
      } as Response;
    }
    if (body.query.includes("messagesInConversation")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { messagesInConversation: [] } }),
      } as Response;
    }
    return { ok: true, status: 200, json: async () => ({ data: {} }) } as Response;
  });
  global.fetch = fn as unknown as typeof fetch;
  return { calls };
}

async function renderChat(id: string) {
  const params = Promise.resolve({ id });
  await act(async () => {
    render(
      <Suspense fallback={<div>carregando…</div>}>
        <ChatPage params={params} />
      </Suspense>,
    );
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

afterEach(() => jest.restoreAllMocks());

describe("Chat — bloco de ingresso pareado nao pode falhar em silencio", () => {
  it("query quebrada vira aviso na tela, nao tela identica a 'nao ha evento'", async () => {
    installFetch();
    await renderChat("conv-abc");
    await waitFor(() => {
      expect(screen.getByTestId("comprar-juntos-erro")).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Não foi possível carregar a sugestão de ingresso/),
    ).toBeInTheDocument();
    // E o motivo verdadeiro, nao um texto generico.
    expect(
      screen.getByText(/Gateway indisponivel para partnerEvents/),
    ).toBeInTheDocument();
  });

  it("o erro do bloco lateral nao derruba o chat", async () => {
    installFetch();
    await renderChat("conv-abc");
    await waitFor(() => {
      expect(screen.getByTestId("comprar-juntos-erro")).toBeInTheDocument();
    });
    // O campo de escrever mensagem continua de pe.
    expect(
      screen.getByPlaceholderText(/mensagem/i),
    ).toBeInTheDocument();
  });
});
