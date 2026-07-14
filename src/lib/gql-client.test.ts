// Testes do cliente GraphQL fetch-based — o caminho usado pelo checkout premium
// (fluxo de DINHEIRO) e pelo chat. Assercoes reais sobre contrato de rede:
// path, method, credentials, body, e tratamento de erro/vazio.
import { gqlRequest, GqlClientError } from "./gql-client";

describe("gqlRequest (cliente do checkout premium / chat)", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function mockFetch(status: number, jsonBody: unknown) {
    const fn = jest.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      statusText: `HTTP ${status}`,
      json: async () => jsonBody,
    });
    global.fetch = fn as unknown as typeof fetch;
    return fn;
  }

  it("posta em /api/graphql com credentials:include e body query+variables", async () => {
    const fetchMock = mockFetch(200, { data: { ok: true } });
    await gqlRequest("query Ping { ok }", { a: 1 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/graphql");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    const body = JSON.parse(init.body);
    expect(body.query).toBe("query Ping { ok }");
    expect(body.variables).toEqual({ a: 1 });
  });

  it("retorna data quando o backend responde com sucesso", async () => {
    mockFetch(200, { data: { startPremiumCheckout: { created: true } } });
    const data = await gqlRequest<{ startPremiumCheckout: { created: boolean } }>(
      "mutation { startPremiumCheckout { created } }",
    );
    expect(data.startPremiumCheckout.created).toBe(true);
  });

  it("lanca GqlClientError com a mensagem quando ha errors[] (200 com erro GraphQL)", async () => {
    mockFetch(200, { errors: [{ message: "UNAUTHENTICATED" }] });
    await expect(gqlRequest("mutation { startPremiumCheckout { created } }")).rejects.toThrow(
      GqlClientError,
    );
    await expect(gqlRequest("mutation { x }")).rejects.toThrow("UNAUTHENTICATED");
  });

  it("nao trata 400 como erro de rede (deixa passar pra ler errors do corpo)", async () => {
    mockFetch(400, { errors: [{ message: "Bad input" }] });
    await expect(gqlRequest("mutation { x }")).rejects.toThrow("Bad input");
  });

  it("lanca em HTTP nao-ok (ex.: 500) antes de olhar o corpo", async () => {
    mockFetch(500, {});
    await expect(gqlRequest("query { x }")).rejects.toThrow("HTTP 500");
  });

  it("lanca 'No data returned' quando o backend responde sem data e sem errors", async () => {
    mockFetch(200, {});
    await expect(gqlRequest("query { x }")).rejects.toThrow("No data returned");
  });
});
