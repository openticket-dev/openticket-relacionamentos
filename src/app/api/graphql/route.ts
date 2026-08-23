import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";

const GATEWAY_URL =
  process.env.GRAPHQL_GATEWAY_URL ||
  process.env.API_GATEWAY_URL_GRAPHQL ||
  "http://localhost:4400/graphql";

function base64url(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf-8") : input;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Synthesize a HS256 JWT from the cookie/session payload.
 *
 * The api-core `GqlAuthGuard` only verifies the signature when
 * `JWT_SECRET` / `SUPABASE_JWT_SECRET` is set on the gateway. In dev that
 * secret is not configured, so the guard accepts any well-formed JWT and
 * normalizes the payload for downstream resolvers. We synthesize from the
 * upstream JWT payload to guarantee a fresh 1h token regardless of the
 * original Keycloak access_token TTL (5-15 min).
 */
function synthesizeJwt(payload: Record<string, unknown>): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(
    JSON.stringify({
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  );
  // SEC-01/SEC-05: fail closed instead of signing with a public fallback secret
  // (a shared well-known secret makes the backend accept forged tokens).
  const secret = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    throw new Error(
      "JWT_SECRET/SUPABASE_JWT_SECRET is not configured — refusing to synthesize an auth token (fail-closed).",
    );
  }
  const signature = base64url(
    createHmac("sha256", secret).update(`${header}.${body}`).digest(),
  );
  return `${header}.${body}.${signature}`;
}

/**
 * Tries to resolve a NextAuth session by calling the shell's
 * `/api/auth/session` endpoint with the same cookies the request brought in.
 * Both the shell and this app share NEXTAUTH_SECRET and the cookie is scoped
 * to `.openticket.com.br`, so the call is same-origin from the user's
 * perspective (path-based routing through the shell on staging/prod).
 *
 * Returns the user object (with email/role/companyId) or null. No deps added —
 * just plain fetch + cookie passthrough.
 */
async function fetchNextAuthSession(
  req: NextRequest,
): Promise<Record<string, unknown> | null> {
  try {
    const cookie = req.headers.get("cookie") || "";
    if (!cookie || !/next-auth\.session-token/.test(cookie)) return null;
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const host =
      req.headers.get("x-forwarded-host") ||
      req.headers.get("host") ||
      "dev.openticket.com.br";
    const sessionUrl = `${proto}://${host}/api/auth/session`;
    const r = await fetch(sessionUrl, { headers: { cookie } });
    if (!r.ok) return null;
    const j = (await r.json()) as { user?: Record<string, unknown> };
    return j?.user ?? null;
  } catch {
    return null;
  }
}

const MY_COMPANIES_QUERY = `
  query MyCompaniesProxy($profileId: String!) {
    myCompanies(profileId: $profileId) {
      companyId
    }
  }
`;

/**
 * FIX-44 (port do openticket-shell) — cache do VINCULO usuario<->empresa,
 * chaveado por `profileId::companyId`. Sem ele cada request company-scoped
 * pagaria +1 round-trip ao gateway.
 */
type ResolvedMembership = { belongs: boolean; resolvedAt: number };
const companyMembershipCache = new Map<string, ResolvedMembership>();
const COMPANY_MEMBERSHIP_TTL_MS = 5 * 60 * 1000; // 5 min

/**
 * O usuario tem vinculo ATIVO com esta empresa?
 *
 * Fonte de verdade: o resolver `myCompanies` do gateway — identity-bound (ele
 * valida `sub == profileId`, api-core `core.resolver.ts:170-174`) e so devolve
 * as empresas onde o perfil tem vinculo. Logo a resposta nao pode ser forjada
 * pelo cliente.
 *
 * Degradacao: `myCompanies` fora do ar NAO pode virar "pertence". Em erro de
 * rede / nao-200 / resposta sem `data` devolvemos o ULTIMO valor conhecido do
 * cache quando existe (nao derruba quem ja estava navegando) e, so na ausencia
 * dele, `false` -> o chamador cai pro companyId da sessao (ou null). Falhar
 * desse jeito custa tela vazia; falhar pro outro lado custa tenant alheio.
 *
 * So o veredito AUTORITATIVO (veio `data.myCompanies`) entra no cache — assim a
 * proxima request re-tenta em vez de congelar um `false` de indisponibilidade.
 */
async function userBelongsToCompany(
  profileId: string,
  companyId: string,
  identityAuthHeader: string,
): Promise<boolean> {
  const cacheKey = `${profileId}::${companyId}`;
  const cached = companyMembershipCache.get(cacheKey);
  if (cached && Date.now() - cached.resolvedAt < COMPANY_MEMBERSHIP_TTL_MS) {
    return cached.belongs;
  }
  try {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: identityAuthHeader,
      },
      body: JSON.stringify({
        query: MY_COMPANIES_QUERY,
        variables: { profileId },
      }),
    });
    if (!res.ok) return cached?.belongs ?? false;
    const json = (await res.json()) as {
      data?: { myCompanies?: Array<{ companyId: string }> };
    };
    const companies = json?.data?.myCompanies;
    // Erro GraphQL / data nula = indisponibilidade, NAO "nao pertence".
    if (!Array.isArray(companies)) return cached?.belongs ?? false;
    const belongs = companies.some((c) => c?.companyId === companyId);
    companyMembershipCache.set(cacheKey, { belongs, resolvedAt: Date.now() });
    return belongs;
  } catch {
    return cached?.belongs ?? false;
  }
}

/**
 * Resolve o companyId que entra no JWT que ESTE servidor assina.
 *
 * Precedencia preservada do codigo anterior: o escopo derivado no servidor
 * (`session.companyId`, vindo do callback de sessao do NextAuth no shell) vence;
 * o cookie so entra como FALLBACK — e agora so quando `myCompanies` comprova o
 * vinculo. Sem vinculo -> null, exatamente o estado de quem nunca passou pelo
 * picker de empresa.
 */
async function resolveEffectiveCompanyId(args: {
  sessionCompanyId: string | null;
  cookieCompanyId: string | null;
  profileId: string | null;
  identityAuthHeader: () => string | null;
}): Promise<string | null> {
  const { sessionCompanyId, cookieCompanyId, profileId } = args;
  if (sessionCompanyId) return sessionCompanyId;
  if (!cookieCompanyId || !profileId) return null;
  const identityAuth = args.identityAuthHeader();
  if (!identityAuth) return null;
  const belongs = await userBelongsToCompany(
    profileId,
    cookieCompanyId,
    identityAuth,
  );
  if (belongs) return cookieCompanyId;
  console.warn(
    "[api/graphql] FIX-44: cookie ot_company_id rejeitado (sem vinculo)",
    { profileId, cookieCompanyId },
  );
  return null;
}

/**
 * POST /api/graphql
 *
 * Same-origin Next.js proxy that forwards GraphQL requests to the federation
 * gateway. The gateway's `relacionamentos` subgraph rejects every query with
 * `Missing or invalid authentication. Provide a valid Authorization Bearer
 * JWT.` unless an `Authorization: Bearer <JWT>` header is present. The browser
 * Apollo client / fetch only carries the NextAuth session cookie, so without
 * this proxy the entire vertical returns DOWNSTREAM_SERVICE_ERROR.
 *
 * Auth strategy (pos FIX-44 — so identidade derivada no SERVIDOR e assinada):
 *  - Tier 1: sessao NextAuth do shell (`/api/auth/session`) -> synth JWT, com o
 *    cookie `ot_company_id` aceito somente sob vinculo comprovado em
 *    `myCompanies`.
 *  - Tier 2: `ot_access_token` -> passthrough CRU (nao e verificavel aqui, e
 *    nenhum servidor da frota o emite; quem valida assinatura e o backend).
 *  - Tier 3: passthrough of an Authorization header brought by the client.
 *
 * NOTE: this route handler takes precedence over the `/api/:path*` rewrite in
 * next.config.ts, so only `/api/graphql` is intercepted here; the remaining
 * `/api/*` paths keep proxying to the gateway directly.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const cookieStore = await cookies();

    let authHeader: string | null = null;

    // FIX-44 (port do openticket-shell a630ab82) — o cookie `ot_company_id` e
    // PEDIDO, nao FATO.
    //
    // Ele e escrito CLIENT-SIDE (`src/app/empresas/page.tsx:181` e `:262`, via
    // `document.cookie`) e nao e httpOnly. Ate aqui ele entrava direto no
    // payload do JWT que ESTE servidor assina com JWT_SECRET — ou seja, o
    // backend recebia uma AFIRMACAO de tenant assinada por nos com base em algo
    // que o atacante digitou no devtools, e todo `assertCompanyAccess(user, X)`
    // passava porque `user.companyId` JA era X.
    //
    // Agora ele so e honrado quando `myCompanies` (identity-bound no gateway)
    // lista aquela empresa pro perfil da sessao — ver resolveEffectiveCompanyId.
    //
    // NAO emitimos 403 de proposito: este BFF e nao-autoritativo por desenho;
    // quem nega acesso e o backend. O que ele nao pode mais fazer e ASSINAR a
    // mentira.
    const cookieCompanyId = cookieStore.get("ot_company_id")?.value || null;

    // Tier 1 (FIX-44): sessao NextAuth do shell — a UNICA identidade derivada
    // no SERVIDOR, e por isso a unica que este proxy assina. Passou a vir antes
    // do `ot_access_token` justamente porque aquele cookie e forjavel: com a
    // ordem antiga, plantar um `ot_access_token` qualquer bastava pra desviar a
    // request da sessao real.
    {
      const session = await fetchNextAuthSession(req);
      if (session && (session.email || session.id)) {
        const profileId = (session.id as string) || null;
        const sub = profileId || (session.email as string);
        const role = (session.role as string) || "USER";
        // JWT SO-IDENTIDADE (companyId null) pra autenticar a chamada interna
        // deste proxy ao gateway. Memoizado: no maximo 1 assinatura extra por
        // request, e so quando ha cookie a verificar.
        let identityJwtMemo: string | null = null;
        const identityAuthHeader = (): string | null => {
          if (!profileId) return null;
          try {
            if (!identityJwtMemo) {
              identityJwtMemo = synthesizeJwt({
                sub: profileId,
                email: session.email ?? null,
                name: session.name ?? null,
                role,
                companyId: null,
              });
            }
            return `Bearer ${identityJwtMemo}`;
          } catch {
            // synthesizeJwt e fail-closed sem JWT_SECRET.
            return null;
          }
        };
        const companyId = await resolveEffectiveCompanyId({
          sessionCompanyId: (session.companyId as string) || null,
          cookieCompanyId,
          profileId,
          identityAuthHeader,
        });
        const synth = synthesizeJwt({
          sub,
          email: session.email ?? null,
          name: session.name ?? null,
          role,
          companyId,
        });
        authHeader = `Bearer ${synth}`;
      }
    }

    // Tier 2: cookie de acesso legado, so quando nao ha sessao.
    const otToken =
      cookieStore.get("ot_access_token")?.value ||
      cookieStore.get("ot_session")?.value ||
      cookieStore.get("ot_token")?.value;

    if (!authHeader && otToken) {
      // FIX-44 / SEC-01: `ot_access_token` chega SEM verificacao de assinatura —
      // e nenhum servidor da frota o emite (0 sites de escrita medidos em
      // openticket-relacionamentos, openticket-eventos e openticket-shell em
      // 2026-08-23), entao todo valor presente aqui foi posto pelo cliente.
      // Sintetizar um JWT assinado a partir dele transformava este proxy num
      // signing oracle: `sub`, `role` e `companyId` forjados no devtools saiam
      // daqui assinados com JWT_SECRET e o backend confiava.
      //
      // Passa CRU: quem valida assinatura e o GqlAuthGuard do gateway. Token
      // legitimo (se algum dia voltar a existir) segue funcionando; token
      // forjado morre no backend em vez de ser abencoado aqui. So a identidade
      // derivada no servidor (sessao NextAuth, Tier 1) volta a ser assinada.
      authHeader = `Bearer ${otToken}`;
    }

    // Tier 3: passthrough — clients that bring their own JWT.
    if (!authHeader) {
      const passthrough = req.headers.get("authorization");
      if (passthrough) authHeader = passthrough;
    }

    const xUserInfo = req.headers.get("x-user-info");

    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...(xUserInfo ? { "x-user-info": xUserInfo } : {}),
      },
      body,
    });

    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[api/graphql] Gateway proxy error:", err);
    return NextResponse.json(
      { errors: [{ message: "Gateway unreachable" }] },
      { status: 502 },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
