"use client";

// Apollo Client v4 — usa subpath imports (compat next 16 + webpack)
// Pattern alinhado com openticket-varejo/src/lib/apollo/client.ts
//
// GraphQL endpoint: /api/graphql é proxied pro api-gateway (next.config.ts rewrites
// → API_GATEWAY_URL). Em dev local, fallback pra http://localhost:4000/graphql.
//
// Sprint RELAC-W-R-0: setup base. Waves W-R-1..8 vao wire mutations/queries em cima.

import { ApolloClient, InMemoryCache, HttpLink } from "@apollo/client/index.js";

let _client: ApolloClient | null = null;

export function getApolloClient(): ApolloClient {
  if (_client) return _client;

  const uri =
    process.env.NEXT_PUBLIC_GRAPHQL_URL ||
    (typeof window !== "undefined" ? "/api/graphql" : "http://localhost:4000/graphql");

  _client = new ApolloClient({
    link: new HttpLink({
      uri,
      // Cookies da sessao NextAuth — proxy /api/auth via next.config rewrites
      credentials: "include",
    }),
    cache: new InMemoryCache(),
    // J9 (V5 OPS, 2026-05-28): errorPolicy:'all' aplicado preventivamente nos
    // 3 verbos via defaultOptions — equivalente, em nível de client default,
    // ao pattern aplicado por call site em openticket-igreja PR#48,
    // gastronomia PR#41, esportes PR#31 e varejo PR#46. Quando as waves
    // W-R-1..8 introduzirem useQuery em screens reais, herdam errorPolicy:'all'
    // automaticamente — não precisa repetir por call site. Override apenas
    // se 'none' (strict) for explicitamente desejado num call específico.
    defaultOptions: {
      watchQuery: { fetchPolicy: "cache-and-network", errorPolicy: "all" },
      query: { fetchPolicy: "network-only", errorPolicy: "all" },
      mutate: { errorPolicy: "all" },
    },
  });

  return _client;
}
