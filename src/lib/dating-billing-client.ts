// Relacionamentos B2C — wrappers de rede da monetização D5.
//
// Cada leitura retorna { data, degraded }: `degraded=true` significa que o
// backend D5 (openticket-api PR#661) ainda não está no ar OU o user não está
// logado — nesse caso caímos no catálogo canônico / FREE (fail-closed), SEM
// nunca inventar premium. As mutations propagam o erro pra UI tratar honesto.

import { gqlRequest } from "@/lib/gql-client";
import {
  BUY_BOOST_CHECKOUT,
  CANCEL_PREMIUM,
  DATING_PLANS_CATALOG,
  FALLBACK_PLANS_CATALOG,
  FREE_ENTITLEMENTS,
  MY_DATING_ENTITLEMENTS,
  MY_DATING_SUBSCRIPTION,
  START_PREMIUM_CHECKOUT,
  type DatingCheckoutResult,
  type DatingEntitlements,
  type DatingPlanCatalogItem,
  type DatingPlanTier,
  type DatingSubscription,
} from "@/lib/dating-plans";

export interface Degradable<T> {
  data: T;
  /** true = veio do fallback local (BE D5 offline ou sem sessão). */
  degraded: boolean;
}

/** Catálogo público (fonte única de preço). Degrade → tabela canônica local. */
export async function loadPlansCatalog(): Promise<
  Degradable<DatingPlanCatalogItem[]>
> {
  try {
    const res = await gqlRequest<{ datingPlansCatalog: DatingPlanCatalogItem[] }>(
      DATING_PLANS_CATALOG,
    );
    const items = res.datingPlansCatalog;
    if (!Array.isArray(items) || items.length === 0) {
      return { data: FALLBACK_PLANS_CATALOG, degraded: true };
    }
    return { data: items, degraded: false };
  } catch {
    return { data: FALLBACK_PLANS_CATALOG, degraded: true };
  }
}

/** Entitlements do tier ativo. Fail-closed → FREE quando não dá pra confirmar. */
export async function loadMyEntitlements(): Promise<
  Degradable<DatingEntitlements>
> {
  try {
    const res = await gqlRequest<{ myDatingEntitlements: DatingEntitlements | null }>(
      MY_DATING_ENTITLEMENTS,
    );
    if (!res.myDatingEntitlements) {
      return { data: FREE_ENTITLEMENTS, degraded: true };
    }
    return { data: res.myDatingEntitlements, degraded: false };
  } catch {
    return { data: FREE_ENTITLEMENTS, degraded: true };
  }
}

/** Assinatura do user (já existia no gateway). Degrade → null (assume FREE). */
export async function loadMySubscription(): Promise<
  Degradable<DatingSubscription | null>
> {
  try {
    const res = await gqlRequest<{ myDatingSubscription: DatingSubscription | null }>(
      MY_DATING_SUBSCRIPTION,
    );
    return { data: res.myDatingSubscription ?? null, degraded: false };
  } catch {
    return { data: null, degraded: true };
  }
}

/** Inicia checkout de assinatura no tier pedido. Propaga erro pra UI. */
export async function startPremiumCheckout(
  plan: DatingPlanTier,
): Promise<DatingCheckoutResult> {
  const res = await gqlRequest<{ startPremiumCheckout: DatingCheckoutResult }>(
    START_PREMIUM_CHECKOUT,
    { plan },
  );
  return res.startPremiumCheckout;
}

/** Compra avulsa de Boost 24h. Propaga erro pra UI. */
export async function buyBoostCheckout(): Promise<DatingCheckoutResult> {
  const res = await gqlRequest<{ buyBoostCheckout: DatingCheckoutResult }>(
    BUY_BOOST_CHECKOUT,
  );
  return res.buyBoostCheckout;
}

/** Cancela premium (downgrade pro Free). Propaga erro pra UI. */
export async function cancelPremium(): Promise<DatingSubscription | null> {
  const res = await gqlRequest<{ cancelPremium: DatingSubscription | null }>(
    CANCEL_PREMIUM,
  );
  return res.cancelPremium ?? null;
}
