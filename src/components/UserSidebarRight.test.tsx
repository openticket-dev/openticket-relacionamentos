// Sidebar do usuario — os tres contadores.
//
// Ate 04/09/2026 as tres linhas eram os literais 0/0/0 no JSX, e a sidebar
// renderiza em TODA rota nao publica (AppShell -> src/app/layout.tsx). Este
// arquivo trava a regressao: os numeros tem que sair do gateway, o estado de
// carregando nao pode mostrar zero, e sem sessao a tela nao inventa metrica.
import { render, screen, waitFor } from "@testing-library/react";
import {
  UserSidebarRight,
  countLikesToday,
  countOpenConversations,
} from "./UserSidebarRight";

type GqlCall = { query: string; variables?: Record<string, unknown> };

interface FakeSummary {
  myMatchProfile: unknown;
  myMatches: unknown[];
  myLikes: unknown[];
  myConversations: unknown[];
}

function installFetch(resp: { ok: true; data: FakeSummary } | { ok: false }) {
  const calls: GqlCall[] = [];
  const fn = jest.fn(async (_url: string, init: RequestInit) => {
    calls.push(JSON.parse(init.body as string) as GqlCall);
    if (!resp.ok) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ errors: [{ message: "Unauthorized" }] }),
      } as Response;
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ data: resp.data }),
    } as Response;
  });
  global.fetch = fn as unknown as typeof fetch;
  return { fn, calls };
}

function isoToday(hour: number): string {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

const PROFILE = {
  id: "rel-1",
  displayName: "Ana",
  city: "Sao Paulo",
  declaredAge: 31,
  participatesInDating: true,
};

afterEach(() => jest.restoreAllMocks());

describe("UserSidebarRight — contadores reais", () => {
  it("mostra os numeros do gateway, nao zeros cravados", async () => {
    installFetch({
      ok: true,
      data: {
        myMatchProfile: PROFILE,
        myMatches: [{ id: "m1" }, { id: "m2" }, { id: "m3" }],
        myLikes: [
          { id: "l1", createdAt: isoToday(9) },
          { id: "l2", createdAt: isoToday(11) },
          { id: "l3", createdAt: isoDaysAgo(3) },
        ],
        myConversations: [
          { id: "c1", archivedAt: null, blockedAt: null },
          { id: "c2", archivedAt: isoDaysAgo(1), blockedAt: null },
          { id: "c3", archivedAt: null, blockedAt: isoDaysAgo(2) },
          { id: "c4", archivedAt: null, blockedAt: null },
        ],
      },
    });

    render(<UserSidebarRight />);

    // 3 matches; 2 dos 3 likes sao de hoje; 2 das 4 conversas seguem abertas.
    await waitFor(() => {
      expect(screen.getByText("Matches ativos").nextSibling).toHaveTextContent(
        "3",
      );
    });
    expect(screen.getByText("Curtidas hoje").nextSibling).toHaveTextContent(
      "2",
    );
    expect(
      screen.getByText("Conversas abertas").nextSibling,
    ).toHaveTextContent("2");
    // O nome tambem para de ser placeholder.
    expect(screen.getByText(/Ana/)).toBeInTheDocument();
  });

  it("enquanto carrega nao mostra 0 — mostra reticencias", async () => {
    installFetch({
      ok: true,
      data: {
        myMatchProfile: PROFILE,
        myMatches: [],
        myLikes: [],
        myConversations: [],
      },
    });

    render(<UserSidebarRight />);

    // Antes do fetch resolver: reticencias. Zero aqui seria numero inventado —
    // e era exatamente o que a versao antiga mostrava, para sempre.
    expect(screen.getByText("Matches ativos").nextSibling).toHaveTextContent(
      "…",
    );

    // Deixa o fetch assentar pra nao vazar setState fora de act().
    await waitFor(() =>
      expect(screen.getByText("Matches ativos").nextSibling).toHaveTextContent(
        "0",
      ),
    );
  });

  it("sem sessao: nenhuma metrica na tela, so o convite de login", async () => {
    installFetch({ ok: false });

    render(<UserSidebarRight />);

    await waitFor(() => {
      expect(
        screen.getByText(/Seu resumo aparece depois do login/),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText("Matches ativos")).not.toBeInTheDocument();
    expect(screen.queryByText("Curtidas hoje")).not.toBeInTheDocument();
  });

  it("pergunta ao gateway as quatro fontes numa query so", async () => {
    const { calls } = installFetch({
      ok: true,
      data: {
        myMatchProfile: PROFILE,
        myMatches: [],
        myLikes: [],
        myConversations: [],
      },
    });

    render(<UserSidebarRight />);

    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    const q = calls[0].query;
    expect(q).toContain("myMatches");
    expect(q).toContain("myLikes");
    expect(q).toContain("myConversations");
    expect(q).toContain("myMatchProfile");
  });
});

describe("contagem honesta na borda da janela do backend", () => {
  it("janela cheia so de hoje vira 100+, nao 100 seco", () => {
    const cheia = Array.from({ length: 100 }, (_, i) => ({
      id: `l${i}`,
      createdAt: isoToday(8),
    }));
    expect(countLikesToday(cheia)).toEqual({ value: 100, atLeast: true });
  });

  it("janela cheia com like de ontem dentro dela conta exato", () => {
    const mista = [
      ...Array.from({ length: 40 }, (_, i) => ({
        id: `hoje${i}`,
        createdAt: isoToday(8),
      })),
      ...Array.from({ length: 60 }, (_, i) => ({
        id: `ontem${i}`,
        createdAt: isoDaysAgo(1),
      })),
    ];
    expect(countLikesToday(mista)).toEqual({ value: 40, atLeast: false });
  });

  it("conversa arquivada ou bloqueada nao conta como aberta", () => {
    expect(
      countOpenConversations([
        { id: "a", archivedAt: null, blockedAt: null },
        { id: "b", archivedAt: "2026-01-01T00:00:00.000Z", blockedAt: null },
        { id: "c", archivedAt: null, blockedAt: "2026-01-01T00:00:00.000Z" },
      ]),
    ).toEqual({ value: 1, atLeast: false });
  });

  it("createdAt invalido nao entra na conta de hoje", () => {
    expect(countLikesToday([{ id: "x", createdAt: "nao-e-data" }])).toEqual({
      value: 0,
      atLeast: false,
    });
  });
});
