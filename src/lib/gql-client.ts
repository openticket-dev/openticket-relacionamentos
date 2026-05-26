/**
 * Lightweight GraphQL client (fetch-based, no Apollo).
 * Wave: DNA-30 · feat/ot-r-dna-30-perguntas-onboarding-2026-05-14
 *
 * Roda contra api gateway via /api proxy (configurado em next.config.ts).
 * Pretende ser pequeno suficiente pra nao adicionar Apollo no bundle.
 */

export interface GqlError {
  message: string;
  extensions?: Record<string, unknown>;
}

export interface GqlResponse<T> {
  data?: T;
  errors?: GqlError[];
}

export class GqlClientError extends Error {
  constructor(message: string, public readonly errors?: GqlError[]) {
    super(message);
    this.name = 'GqlClientError';
  }
}

/**
 * Executa query/mutation GraphQL.
 *
 * Path: /api/graphql (relativo). Em dev sera proxy-rewritten via next.config.ts
 * (NEXT_PUBLIC_API_BASE -> http://localhost:4000) pra evitar CORS.
 * Cookies sao enviados (credentials: include).
 */
export async function gqlRequest<T = unknown>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch('/api/graphql', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok && res.status !== 400) {
    throw new GqlClientError(`HTTP ${res.status}: ${res.statusText}`);
  }

  const json: GqlResponse<T> = await res.json();

  if (json.errors && json.errors.length > 0) {
    throw new GqlClientError(
      json.errors.map((e) => e.message).join('; '),
      json.errors,
    );
  }

  if (!json.data) {
    throw new GqlClientError('No data returned');
  }

  return json.data;
}
