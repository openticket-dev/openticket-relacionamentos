// Specs do modelo de planos/entitlements D5 (par do backend openticket-api PR#661).
// Roda no harness jest da vertical (relacionamentos#33: jest + ts-jest). Cobre o
// CONTRATO puro que o front espelha do BE: catálogo canônico (fonte única de
// preço), matriz de entitlements por tier, normalização de plano legado e os
// helpers de CTA/upgrade-downgrade. Zero rede — só lógica pura.

import {
  FALLBACK_PLANS_CATALOG,
  FREE_ENTITLEMENTS,
  GOLD_ENTITLEMENTS,
  PLATINUM_ENTITLEMENTS,
  entitlementRows,
  entitlementsForPlan,
  formatBRL,
  normalizeDatingPlan,
  planCta,
  planKindToTier,
  tierRank,
} from "../dating-plans";

describe("catálogo canônico D5 (fonte única de preço)", () => {
  it("expõe 4 itens com preços 0 / 29,90 / 59,90 / 9,90", () => {
    const byPlan = Object.fromEntries(
      FALLBACK_PLANS_CATALOG.map((c) => [c.plan, c]),
    );
    expect(byPlan.FREE.priceBRL).toBe(0);
    expect(byPlan.GOLD.priceBRL).toBe(29.9);
    expect(byPlan.PLATINUM.priceBRL).toBe(59.9);
    expect(byPlan.BOOST.priceBRL).toBe(9.9);
  });

  it("Boost é one-off e não carrega entitlements (não é tier)", () => {
    const boost = FALLBACK_PLANS_CATALOG.find((c) => c.plan === "BOOST")!;
    expect(boost.cycle).toBe("ONE_OFF");
    expect(boost.entitlements).toBeNull();
  });

  it("assinaturas são MONTHLY e Gold expõe seeWhoLiked", () => {
    const gold = FALLBACK_PLANS_CATALOG.find((c) => c.plan === "GOLD")!;
    expect(gold.cycle).toBe("MONTHLY");
    expect(gold.entitlements?.seeWhoLiked).toBe(true);
  });
});

describe("entitlementsForPlan — nega feature acima do tier", () => {
  it("FREE nega tudo, likes limitados, sem boost", () => {
    const e = entitlementsForPlan("FREE", false);
    expect(e).toEqual(FREE_ENTITLEMENTS);
    expect(e.seeWhoLiked).toBe(false);
    expect(e.likesPerDay).toBe(10);
    expect(e.boostsPerMonth).toBe(0);
  });

  it("GOLD libera seeWhoLiked/filtros mas NEGA mensagem-sem-match e incógnito", () => {
    const e = entitlementsForPlan("GOLD", true);
    expect(e).toEqual(GOLD_ENTITLEMENTS);
    expect(e.seeWhoLiked).toBe(true);
    expect(e.advancedFilters).toBe(true);
    expect(e.likesPerDay).toBeNull();
    expect(e.messagesWithoutMatch).toBe(false);
    expect(e.incognito).toBe(false);
  });

  it("PLATINUM libera tudo do Gold + mensagem-sem-match + incógnito + 5 boosts", () => {
    const e = entitlementsForPlan("PLATINUM", true);
    expect(e).toEqual(PLATINUM_ENTITLEMENTS);
    expect(e.messagesWithoutMatch).toBe(true);
    expect(e.incognito).toBe(true);
    expect(e.boostsPerMonth).toBe(5);
    expect(e.superLikesPerDay).toBe(10);
  });

  it("plano pago mas NÃO ativo (isPremium=false) cai pra FREE — não vaza feature paga", () => {
    const e = entitlementsForPlan("PLATINUM", false);
    expect(e.plan).toBe("FREE");
    expect(e.seeWhoLiked).toBe(false);
  });
});

describe("normalizeDatingPlan — PREMIUM legado = GOLD", () => {
  it("mapeia PREMIUM→GOLD, PLATINUM→PLATINUM, desconhecido→FREE", () => {
    expect(normalizeDatingPlan("PREMIUM")).toBe("GOLD");
    expect(normalizeDatingPlan("GOLD")).toBe("GOLD");
    expect(normalizeDatingPlan("PLATINUM")).toBe("PLATINUM");
    expect(normalizeDatingPlan("FREE")).toBe("FREE");
    expect(normalizeDatingPlan("qualquer")).toBe("FREE");
    expect(normalizeDatingPlan(null)).toBe("FREE");
  });
});

describe("tierRank — ordenação de tiers", () => {
  it("FREE < GOLD < PLATINUM; BOOST não é tier (-1)", () => {
    expect(tierRank("FREE")).toBe(0);
    expect(tierRank("GOLD")).toBe(1);
    expect(tierRank("PLATINUM")).toBe(2);
    expect(tierRank("BOOST")).toBe(-1);
    // legado
    expect(tierRank("PREMIUM")).toBe(1);
  });
});

describe("planKindToTier — arg do startPremiumCheckout", () => {
  it("GOLD/PLATINUM viram o enum; FREE/BOOST → null", () => {
    expect(planKindToTier("GOLD")).toBe("GOLD");
    expect(planKindToTier("PLATINUM")).toBe("PLATINUM");
    expect(planKindToTier("PREMIUM")).toBe("GOLD");
    expect(planKindToTier("FREE")).toBeNull();
    expect(planKindToTier("BOOST")).toBeNull();
  });
});

describe("planCta — upgrade / downgrade / atual", () => {
  it("Free vendo Gold = Assinar (subscribe)", () => {
    expect(planCta("FREE", "GOLD")).toEqual({
      kind: "subscribe",
      label: "Assinar",
    });
  });

  it("Gold vendo Platinum = upgrade", () => {
    expect(planCta("GOLD", "PLATINUM").kind).toBe("upgrade");
  });

  it("Platinum vendo Gold = downgrade", () => {
    expect(planCta("PLATINUM", "GOLD").kind).toBe("downgrade");
  });

  it("Gold vendo Free = downgrade (Voltar ao grátis)", () => {
    expect(planCta("GOLD", "FREE")).toEqual({
      kind: "downgrade",
      label: "Voltar ao grátis",
    });
  });

  it("mesmo plano = current", () => {
    expect(planCta("GOLD", "GOLD").kind).toBe("current");
  });
});

describe("formatBRL", () => {
  it("formata BRL com vírgula; 0 = Grátis", () => {
    expect(formatBRL(29.9)).toBe("R$ 29,90");
    expect(formatBRL(59.9)).toBe("R$ 59,90");
    expect(formatBRL(9.9)).toBe("R$ 9,90");
    expect(formatBRL(0)).toBe("Grátis");
  });
});

describe("entitlementRows — deriva comparação dos entitlements", () => {
  it("Free: likes 10, sem boost (false), sem ver-quem-curtiu", () => {
    const rows = Object.fromEntries(
      entitlementRows(FREE_ENTITLEMENTS).map((r) => [r.label, r.value]),
    );
    expect(rows["Likes por dia"]).toBe("10");
    expect(rows["Boost por mes"]).toBe(false);
    expect(rows["Ver quem te curtiu"]).toBe(false);
  });

  it("Platinum: likes Ilimitados, 5x boost, incógnito true", () => {
    const rows = Object.fromEntries(
      entitlementRows(PLATINUM_ENTITLEMENTS).map((r) => [r.label, r.value]),
    );
    expect(rows["Likes por dia"]).toBe("Ilimitados");
    expect(rows["Boost por mes"]).toBe("5x");
    expect(rows["Modo incognito"]).toBe(true);
  });
});
