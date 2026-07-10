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

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const json = Buffer.from(
      parts[1].replace(/-/g, "+").replace(/_/g, "/"),
      "base64",
    ).toString("utf-8");
    return JSON.parse(json);
  } catch {
    return null;
  }
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
 * Auth strategy mirrors the openticket-eventos proxy:
 *  - Tier 1: `ot_access_token` httpOnly cookie set on login → synth JWT.
 *  - Tier 2: NextAuth session from the shell (`/api/auth/session`) → synth JWT.
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

    // Tenant claim from the client-readable cookie set by /negocios after a
    // company pick. This is the active-company shim (mirrors openticket-shell
    // and the varejo useCompanyId fix PR #55):
    //
    // A SUPER_ADMIN (CEO / OpenTicket staff) has `companyId === null` in the
    // NextAuth session and in the `ot_access_token` JWT, because their scope is
    // global, not tied to one company. They pick the active company in
    // /negocios, which writes the non-httpOnly `ot_company_id` cookie. Without
    // reading that cookie here, the synthesized JWT carried `companyId: null`
    // and every company-scoped query returned 0 rows / "sem empresa vinculada".
    //
    // SECURITY (multi-tenant): the cookie only ever takes effect as a FALLBACK
    // when the token/session has no companyId of its own (i.e. SUPER_ADMIN). A
    // regular tenant user keeps their session companyId untouched — the cookie
    // never overrides a real session scope, so no cross-tenant leakage.
    const cookieCompanyId = cookieStore.get("ot_company_id")?.value || null;

    // Tier 1: own auth cookie set by the shell on the shared domain.
    const otToken =
      cookieStore.get("ot_access_token")?.value ||
      cookieStore.get("ot_session")?.value ||
      cookieStore.get("ot_token")?.value;

    if (otToken) {
      const decoded = decodeJwtPayload(otToken);
      if (decoded?.email) {
        const synth = synthesizeJwt({
          sub: (decoded.sub as string) || (decoded.email as string),
          email: decoded.email,
          name: decoded.name || null,
          role: decoded.role || "USER",
          companyId: (decoded.companyId as string) || cookieCompanyId,
        });
        authHeader = `Bearer ${synth}`;
      } else {
        // Token isn't a decodable JWT (could be opaque) — pass through raw.
        authHeader = `Bearer ${otToken}`;
      }
    }

    // Tier 2: NextAuth session from the shell (login flow when the user logged
    // in via /login and there is no ot_access_token).
    if (!authHeader) {
      const session = await fetchNextAuthSession(req);
      if (session && (session.email || session.id)) {
        const synth = synthesizeJwt({
          sub: (session.id as string) || (session.email as string),
          email: session.email ?? null,
          name: session.name ?? null,
          role: (session.role as string) || "USER",
          companyId: (session.companyId as string) || cookieCompanyId,
        });
        authHeader = `Bearer ${synth}`;
      }
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
