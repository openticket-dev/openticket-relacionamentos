"use client";

// RelacionamentosApolloProvider — wrapper client component pro ApolloProvider.
// Pattern alinhado com openticket-varejo/src/lib/apollo/Provider.tsx.
//
// Wrapado no RootLayout (src/app/layout.tsx) pra disponibilizar Apollo client
// em toda a arvore de rotas (perfil, matches, buscar, chat, premium, admin).
//
// Sprint RELAC-W-R-0 (pre-req W-R-1..8).

import { ApolloProvider } from "@apollo/client/react/index.js";
import { ReactNode, useMemo } from "react";
import { getApolloClient } from "./client";

export function RelacionamentosApolloProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => getApolloClient(), []);
  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}
