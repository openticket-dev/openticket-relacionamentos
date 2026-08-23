/**
 * @jest-environment node
 */

/**
 * FIX-44 (port do openticket-shell a630ab82) — o BFF `/api/graphql` de
 * relacionamentos so pode aceitar o cookie `ot_company_id` se o usuario TIVER
 * vinculo com aquela empresa.
 *
 * Contexto medido (2026-08-23, staging):
 *  - o cookie e escrito CLIENT-SIDE via `document.cookie`
 *    (`src/app/empresas/page.tsx:181` e `:262`), sem httpOnly;
 *  - `route.ts:173` (pre-fix) fazia `companyId: session.companyId || cookieCompanyId`
 *    e mandava isso pro `synthesizeJwt`, que assina com JWT_SECRET. Ou seja: o
 *    backend recebia uma afirmacao de tenant ASSINADA POR NOS a partir de algo
 *    digitado no devtools, e `assertCompanyAccess(user, X)` passava porque
 *    `user.companyId` ja era X;
 *  - `route.ts:153-154` (pre-fix) fazia o mesmo com `role` e `companyId` vindos
 *    de `ot_access_token`, um cookie que NENHUM servidor da frota emite
 *    (0 sites de escrita em relacionamentos/eventos/shell) — logo, forjavel.
 *
 * A trava: `myCompanies` (identity-bound no gateway — valida `sub == profileId`)
 * decide. Sem vinculo -> `companyId: null`, o mesmo estado de quem nunca passou
 * pelo picker de empresa. O BFF nao emite 403: ele e nao-autoritativo por
 * desenho, quem nega acesso e o backend. O que ele nao pode e ASSINAR a mentira.
 *
 * A prova le o `Authorization` REPASSADO ao gateway e decodifica o payload do
 * JWT — e exatamente o valor que o backend vai confiar.
 *
 * FALHA no codigo antigo: os casos "cross-tenant" e "ot_access_token forjado"
 * viam `company-vitima` / `SUPER_ADMIN` no payload assinado.
 */
import { NextRequest } from "next/server";

const cookieJar: Record<string, string> = {};
jest.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar[name] !== undefined ? { name, value: cookieJar[name] } : undefined,
  }),
}));

const GATEWAY_URL = "http://localhost:4400/graphql";

type FetchCall = { url: string; init: RequestInit };

/** Payload do JWT HS256 que o proxy assinou (base64url do 2o segmento). */
function decodeJwtPayload(authHeader: string): Record<string, unknown> {
  const token = authHeader.replace(/^Bearer\s+/, "");
  const body = token.split(".")[1];
  return JSON.parse(Buffer.from(body, "base64url").toString("utf-8"));
}

/** Um JWT NAO assinado, do jeito que um atacante monta no devtools. */
function forgedToken(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o), "utf-8").toString("base64url");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}.assinatura-invalida`;
}

/** Separa a chamada interna (myCompanies) da chamada REPASSADA do cliente. */
function forwardedCall(calls: FetchCall[]): FetchCall {
  const forwarded = calls.filter(
    (c) =>
      c.url === GATEWAY_URL &&
      !String(c.init.body ?? "").includes("MyCompaniesProxy"),
  );
  expect(forwarded).toHaveLength(1);
  return forwarded[0];
}

function sessionOf(profileId: string, extra: Record<string, unknown> = {}) {
  return {
    id: profileId,
    email: `${profileId}@openticket.test`,
    name: "Usuario A",
    role: "USER",
    companyId: null,
    ...extra,
  };
}

function buildReq(): NextRequest {
  return new NextRequest("http://localhost:4214/api/graphql", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "dev.openticket.com.br",
      cookie: "next-auth.session-token=abc",
    },
    body: JSON.stringify({ query: "query Scoped { matchesByCompany { id } }" }),
  });
}

/**
 * Mocka as 3 rotas de rede que o handler toca: a sessao do shell, o resolver
 * `myCompanies` e o repasse da query do cliente.
 */
function mockNetwork(opts: {
  session: Record<string, unknown> | null;
  myCompanies: Array<{ companyId: string }> | "network-error";
}): FetchCall[] {
  const calls: FetchCall[] = [];
  global.fetch = jest.fn(async (url: unknown, init: RequestInit = {}) => {
    const u = String(url);
    calls.push({ url: u, init });
    if (u.includes("/api/auth/session")) {
      return new Response(JSON.stringify({ user: opts.session }), {
        status: opts.session ? 200 : 401,
        headers: { "content-type": "application/json" },
      });
    }
    if (String(init.body ?? "").includes("MyCompaniesProxy")) {
      if (opts.myCompanies === "network-error") throw new Error("ECONNREFUSED");
      return new Response(
        JSON.stringify({ data: { myCompanies: opts.myCompanies } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ data: { ok: true } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return calls;
}

async function loadRoute() {
  // resetModules por caso: o cache de vinculo do modulo e in-process.
  jest.resetModules();
  return (await import("./route")) as typeof import("./route");
}

describe("POST /api/graphql — vinculo do cookie ot_company_id (FIX-44)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    for (const k of Object.keys(cookieJar)) delete cookieJar[k];
    process.env.JWT_SECRET = "test-secret-fix-44";
    process.env.GRAPHQL_GATEWAY_URL = GATEWAY_URL;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("REJEITA o cookie de um tenant onde o usuario NAO tem vinculo (cross-tenant)", async () => {
    cookieJar.ot_company_id = "company-vitima";
    const calls = mockNetwork({
      session: sessionOf("profile-A"),
      myCompanies: [{ companyId: "company-A" }],
    });

    const { POST } = await loadRoute();
    const res = await POST(buildReq());
    expect(res.status).toBe(200);

    const headers = forwardedCall(calls).init.headers as Record<string, string>;
    expect(decodeJwtPayload(headers.Authorization).companyId).toBeNull();
  });

  it("ACEITA o cookie quando myCompanies confirma o vinculo (sem regressao no picker)", async () => {
    cookieJar.ot_company_id = "company-B";
    const calls = mockNetwork({
      session: sessionOf("profile-A"),
      myCompanies: [{ companyId: "company-A" }, { companyId: "company-B" }],
    });

    const { POST } = await loadRoute();
    await POST(buildReq());

    const headers = forwardedCall(calls).init.headers as Record<string, string>;
    expect(decodeJwtPayload(headers.Authorization).companyId).toBe("company-B");
  });

  it("escopo derivado no servidor vence o cookie e dispensa o round-trip", async () => {
    cookieJar.ot_company_id = "company-vitima";
    const calls = mockNetwork({
      session: sessionOf("profile-A", { companyId: "company-real" }),
      myCompanies: [{ companyId: "company-real" }],
    });

    const { POST } = await loadRoute();
    await POST(buildReq());

    const headers = forwardedCall(calls).init.headers as Record<string, string>;
    expect(decodeJwtPayload(headers.Authorization).companyId).toBe("company-real");
    expect(
      calls.filter((c) => String(c.init.body ?? "").includes("MyCompaniesProxy")),
    ).toHaveLength(0);
  });

  it("gateway fora do ar e sem cache: degrada pra null (fail-closed), nao pro cookie", async () => {
    cookieJar.ot_company_id = "company-vitima";
    const calls = mockNetwork({
      session: sessionOf("profile-A"),
      myCompanies: "network-error",
    });

    const { POST } = await loadRoute();
    const res = await POST(buildReq());
    expect(res.status).toBe(200);

    const headers = forwardedCall(calls).init.headers as Record<string, string>;
    expect(decodeJwtPayload(headers.Authorization).companyId).toBeNull();
  });

  it("ot_access_token forjado nao vira JWT assinado por nos (nem role, nem companyId)", async () => {
    cookieJar.ot_access_token = forgedToken({
      sub: "profile-VITIMA",
      email: "vitima@openticket.test",
      role: "SUPER_ADMIN",
      companyId: "company-vitima",
    });
    const calls = mockNetwork({
      session: sessionOf("profile-A"),
      myCompanies: [{ companyId: "company-A" }],
    });

    const { POST } = await loadRoute();
    await POST(buildReq());

    const headers = forwardedCall(calls).init.headers as Record<string, string>;
    const payload = decodeJwtPayload(headers.Authorization);
    // A sessao (identidade derivada no servidor) e quem manda.
    expect(payload.sub).toBe("profile-A");
    expect(payload.role).toBe("USER");
    expect(payload.companyId).toBeNull();
  });

  it("sem sessao, o ot_access_token so passa CRU — este proxy nao o assina", async () => {
    const forjado = forgedToken({
      sub: "profile-VITIMA",
      email: "vitima@openticket.test",
      role: "SUPER_ADMIN",
      companyId: "company-vitima",
    });
    cookieJar.ot_access_token = forjado;
    const calls = mockNetwork({ session: null, myCompanies: [] });

    const { POST } = await loadRoute();
    await POST(buildReq());

    const headers = forwardedCall(calls).init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${forjado}`);
    // assinatura intacta = invalida: quem rejeita e o GqlAuthGuard, nao nos.
    expect(headers.Authorization.split(".")[2]).toBe("assinatura-invalida");
  });

  it("cacheia o vinculo por profileId::companyId — 2 requests, 1 so myCompanies", async () => {
    cookieJar.ot_company_id = "company-A";
    const calls = mockNetwork({
      session: sessionOf("profile-A"),
      myCompanies: [{ companyId: "company-A" }],
    });

    const { POST } = await loadRoute();
    await POST(buildReq());
    await POST(buildReq());

    expect(
      calls.filter((c) => String(c.init.body ?? "").includes("MyCompaniesProxy")),
    ).toHaveLength(1);
  });
});
