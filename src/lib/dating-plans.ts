// Relacionamentos B2C (Camaleão) — modelo de planos/entitlements D5.
//
// FONTE DE VERDADE do backend: openticket-api PR#661
// (feat/relacion-b2c-tiers-staging). Este módulo espelha o CONTRATO do BE:
//   - query datingPlansCatalog  → catálogo público (fonte única de preço)
//   - query myDatingEntitlements → entitlements do tier ativo
//   - query myDatingSubscription → assinatura do user (já existia)
//   - mutation startPremiumCheckout(plan: DatingPlanTier)
//   - mutation cancelPremium
//   - mutation buyBoostCheckout
//
// É PURO de propósito (zero imports, zero fetch/DOM): as constantes/ helpers
// são unit-testáveis sem harness de browser. Os wrappers de rede vivem em
// `dating-billing-client.ts`.
//
// DEGRADE HONESTO (cultura#68): enquanto o BE D5 não mergeia, o gateway não
// conhece `datingPlansCatalog`/`myDatingEntitlements`/`startPremiumCheckout(plan:)`.
// O front cai pra estas constantes canônicas (mesmos preços do BE) e falha
// fechado nos gates de feature (FREE), sem NUNCA fingir premium.

// ── Tipos-espelho do contrato GraphQL ──────────────────────────────

/** Plano normalizado (linhas legadas plan='PREMIUM' são lidas como GOLD). */
export type NormalizedPlan = "FREE" | "GOLD" | "PLATINUM";

/** Tier COMPRÁVEL do checkout de assinatura (arg do startPremiumCheckout). */
export type DatingPlanTier = "GOLD" | "PLATINUM";

/** Item avulso/tier do catálogo público. BOOST é compra avulsa, não assinatura. */
export type CatalogPlanKind = "FREE" | "GOLD" | "PLATINUM" | "BOOST";

export type PlanCycle = "NONE" | "MONTHLY" | "ONE_OFF";

export interface DatingEntitlements {
  plan: string; // FREE | GOLD | PLATINUM
  isPremium: boolean;
  likesPerDay: number | null; // null = ilimitado
  superLikesPerDay: number;
  boostsPerMonth: number;
  seeWhoLiked: boolean;
  advancedFilters: boolean;
  messagesWithoutMatch: boolean;
  incognito: boolean;
  noAds: boolean;
}

export interface DatingPlanCatalogItem {
  id: string; // free | gold_monthly | platinum_monthly | boost_24h
  plan: string; // FREE | GOLD | PLATINUM | BOOST
  label: string;
  priceBRL: number;
  cycle: string; // NONE | MONTHLY | ONE_OFF
  description: string;
  entitlements: DatingEntitlements | null; // null pro item BOOST
}

export interface DatingSubscription {
  id: string;
  userId?: string;
  plan: string; // FREE | GOLD | PLATINUM (PREMIUM legado normaliza p/ GOLD)
  status: string; // FREE | PENDING | ACTIVE | PAST_DUE | CANCELED | EXPIRED
  isPremium: boolean;
  asaasSubscriptionId?: string | null;
  startedAt?: string | null;
  expiresAt?: string | null;
  updatedAt?: string | null;
}

export interface DatingProfileBoost {
  id: string;
  status: string;
  isActive: boolean;
  expiresAt?: string | null;
}

export interface DatingCheckoutResult {
  created: boolean;
  billingMode: string; // PRODUCTION | SANDBOX | UNCONFIGURED
  message: string;
  asaasId?: string | null;
  invoiceUrl?: string | null;
  subscription?: DatingSubscription | null;
  boost?: DatingProfileBoost | null;
}

// ── Matriz de entitlements por tier (espelha entitlementsForPlan do BE) ──

export const FREE_ENTITLEMENTS: DatingEntitlements = {
  plan: "FREE",
  isPremium: false,
  likesPerDay: 10,
  superLikesPerDay: 1,
  boostsPerMonth: 0,
  seeWhoLiked: false,
  advancedFilters: false,
  messagesWithoutMatch: false,
  incognito: false,
  noAds: false,
};

export const GOLD_ENTITLEMENTS: DatingEntitlements = {
  plan: "GOLD",
  isPremium: true,
  likesPerDay: null,
  superLikesPerDay: 5,
  boostsPerMonth: 1,
  seeWhoLiked: true,
  advancedFilters: true,
  messagesWithoutMatch: false,
  incognito: false,
  noAds: true,
};

export const PLATINUM_ENTITLEMENTS: DatingEntitlements = {
  plan: "PLATINUM",
  isPremium: true,
  likesPerDay: null,
  superLikesPerDay: 10,
  boostsPerMonth: 5,
  seeWhoLiked: true,
  advancedFilters: true,
  messagesWithoutMatch: true,
  incognito: true,
  noAds: true,
};

/** PREMIUM legado = GOLD; PLATINUM = PLATINUM; resto = FREE (espelha normalizeDatingPlan). */
export function normalizeDatingPlan(plan: string | null | undefined): NormalizedPlan {
  if (plan === "PLATINUM") return "PLATINUM";
  if (plan === "GOLD" || plan === "PREMIUM") return "GOLD";
  return "FREE";
}

/**
 * Entitlements por tier — espelha entitlementsForPlan do BE.
 * Plano pago mas NÃO ativo (isPremium=false) cai pra FREE (não vaza feature paga).
 */
export function entitlementsForPlan(
  plan: string,
  isPremium: boolean,
): DatingEntitlements {
  const normalized = normalizeDatingPlan(plan);
  switch (isPremium ? normalized : "FREE") {
    case "PLATINUM":
      return PLATINUM_ENTITLEMENTS;
    case "GOLD":
      return GOLD_ENTITLEMENTS;
    default:
      return FREE_ENTITLEMENTS;
  }
}

// ── Catálogo canônico (fallback do degrade honesto) ────────────────
// Mesmos preços/estrutura do plansCatalog() do BE. Preço ao vivo, quando o BE
// D5 sobe, vem de datingPlansCatalog (env-overridable no padrão W-R-6).

export const FALLBACK_PLANS_CATALOG: DatingPlanCatalogItem[] = [
  {
    id: "free",
    plan: "FREE",
    label: "Free",
    priceBRL: 0,
    cycle: "NONE",
    description: "Curtidas limitadas por dia. Sem cobrança.",
    entitlements: FREE_ENTITLEMENTS,
  },
  {
    id: "gold_monthly",
    plan: "GOLD",
    label: "Gold",
    priceBRL: 29.9,
    cycle: "MONTHLY",
    description:
      "Curtidas ilimitadas, ver quem curtiu, filtros avançados, sem anúncios.",
    entitlements: GOLD_ENTITLEMENTS,
  },
  {
    id: "platinum_monthly",
    plan: "PLATINUM",
    label: "Platinum",
    priceBRL: 59.9,
    cycle: "MONTHLY",
    description:
      "Tudo do Gold + mensagem sem match, modo incógnito, 5 boosts/mês.",
    entitlements: PLATINUM_ENTITLEMENTS,
  },
  {
    id: "boost_24h",
    plan: "BOOST",
    label: "Boost 24h",
    priceBRL: 9.9,
    cycle: "ONE_OFF",
    description: "Perfil em destaque por 24h (compra avulsa).",
    entitlements: null,
  },
];

// ── Helpers puros ──────────────────────────────────────────────────

/** "R$ 29,90" | "Grátis" (0). */
export function formatBRL(value: number): string {
  if (value === 0) return "Grátis";
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

/** Rank pra comparar tiers (FREE<GOLD<PLATINUM). BOOST não é tier → -1. */
export function tierRank(plan: string): number {
  switch (normalizeDatingPlan(plan)) {
    case "PLATINUM":
      return 2;
    case "GOLD":
      return 1;
    default:
      return plan === "BOOST" ? -1 : 0;
  }
}

/** Converte o kind do catálogo no enum DatingPlanTier do checkout. FREE/BOOST → null. */
export function planKindToTier(plan: string): DatingPlanTier | null {
  const normalized = normalizeDatingPlan(plan);
  if (normalized === "GOLD") return "GOLD";
  if (normalized === "PLATINUM") return "PLATINUM";
  return null;
}

export type CtaKind = "current" | "subscribe" | "upgrade" | "downgrade";

/** Rótulo/ação do botão de um plano-alvo dado o plano atual do usuário. */
export function planCta(currentPlan: string, targetPlan: string): {
  kind: CtaKind;
  label: string;
} {
  const current = normalizeDatingPlan(currentPlan);
  const target = normalizeDatingPlan(targetPlan);
  if (current === target) return { kind: "current", label: "Plano atual" };
  const rc = tierRank(current);
  const rt = tierRank(target);
  if (rt > rc) {
    return {
      kind: current === "FREE" ? "subscribe" : "upgrade",
      label: current === "FREE" ? "Assinar" : "Fazer upgrade",
    };
  }
  // downgrade (inclui volta pro Free)
  return {
    kind: "downgrade",
    label: target === "FREE" ? "Voltar ao grátis" : "Fazer downgrade",
  };
}

/** Linhas de comparação de features derivadas dos entitlements (single source). */
export function entitlementRows(
  e: DatingEntitlements,
): { label: string; value: boolean | string }[] {
  return [
    { label: "Likes por dia", value: e.likesPerDay === null ? "Ilimitados" : String(e.likesPerDay) },
    { label: "Super-likes por dia", value: String(e.superLikesPerDay) },
    { label: "Boost por mes", value: e.boostsPerMonth === 0 ? false : `${e.boostsPerMonth}x` },
    { label: "Ver quem te curtiu", value: e.seeWhoLiked },
    { label: "Filtros avancados", value: e.advancedFilters },
    { label: "Mensagens sem match", value: e.messagesWithoutMatch },
    { label: "Modo incognito", value: e.incognito },
    { label: "Sem anuncios", value: e.noAds },
  ];
}

// ── Documentos GraphQL (nomes EXATOS do contrato BE#661) ────────────

const ENTITLEMENTS_FIELDS = `
  plan
  isPremium
  likesPerDay
  superLikesPerDay
  boostsPerMonth
  seeWhoLiked
  advancedFilters
  messagesWithoutMatch
  incognito
  noAds
`;

export const DATING_PLANS_CATALOG = /* GraphQL */ `
  query DatingPlansCatalog {
    datingPlansCatalog {
      id
      plan
      label
      priceBRL
      cycle
      description
      entitlements {${ENTITLEMENTS_FIELDS}}
    }
  }
`;

export const MY_DATING_ENTITLEMENTS = /* GraphQL */ `
  query MyDatingEntitlements {
    myDatingEntitlements {${ENTITLEMENTS_FIELDS}}
  }
`;

export const MY_DATING_SUBSCRIPTION = /* GraphQL */ `
  query MyDatingSubscription {
    myDatingSubscription {
      id
      userId
      plan
      status
      isPremium
      asaasSubscriptionId
      startedAt
      expiresAt
      updatedAt
    }
  }
`;

export const START_PREMIUM_CHECKOUT = /* GraphQL */ `
  mutation StartPremiumCheckout($plan: DatingPlanTier) {
    startPremiumCheckout(plan: $plan) {
      created
      billingMode
      message
      asaasId
      invoiceUrl
      subscription {
        id
        plan
        status
        isPremium
        expiresAt
      }
    }
  }
`;

export const CANCEL_PREMIUM = /* GraphQL */ `
  mutation CancelPremium {
    cancelPremium {
      id
      plan
      status
      isPremium
    }
  }
`;

export const BUY_BOOST_CHECKOUT = /* GraphQL */ `
  mutation BuyBoostCheckout {
    buyBoostCheckout {
      created
      billingMode
      message
      asaasId
      invoiceUrl
      boost {
        id
        status
        isActive
        expiresAt
      }
    }
  }
`;
