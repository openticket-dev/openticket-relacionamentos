"use client";

/**
 * OnboardingGate — torna o onboarding de perfil OBRIGATÓRIO ao entrar na
 * vertical Relacionamentos. Montado no layout: nas rotas de consumidor
 * (hub, buscar, matches, chat, encontros, premium), checa se o usuário já tem
 * perfil de match (myMatchProfile). Se não tiver, redireciona pro wizard
 * /onboarding/perfil. Landing, /onboarding/*, /perfil e /admin ficam fora do
 * gate (pra não criar loop e permitir editar/criar). Renderiza null.
 */

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { gqlRequest } from "@/lib/gql-client";

const GATED = ["/hub", "/buscar", "/matches", "/chat", "/encontros", "/premium"];
const PROFILE_Q = /* GraphQL */ `query GateMatchProfile { myMatchProfile { id } }`;

// Sessão de página: uma vez confirmado que há perfil, não re-checa em cada nav.
let confirmed = false;

export function OnboardingGate() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!pathname || confirmed) return;
    const gated = GATED.some((p) => pathname === p || pathname.startsWith(p + "/"));
    if (!gated) return;

    let alive = true;
    (async () => {
      try {
        const data = await gqlRequest<{ myMatchProfile: { id: string } | null }>(
          PROFILE_Q,
        );
        if (!alive) return;
        if (data.myMatchProfile) {
          confirmed = true;
        } else {
          router.replace("/onboarding/perfil");
        }
      } catch {
        /* sem sessão / erro de rede → não bloqueia: a própria tela trata auth */
      }
    })();
    return () => {
      alive = false;
    };
  }, [pathname, router]);

  return null;
}

export default OnboardingGate;
