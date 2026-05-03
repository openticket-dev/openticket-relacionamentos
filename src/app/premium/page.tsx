// Relacionamentos — Premium Overview (Sprint M8-2)
// Pricing tiers (free/gold/platinum) + comparativo de features.
// W-R-7 ligara queryUserSubscription via Apollo.

"use client";

import Link from "next/link";
import { useState } from "react";

type Tier = "free" | "gold" | "platinum";

type Plan = {
  id: Tier;
  name: string;
  priceMonthly: number;
  priceAnnual: number;
  highlight?: boolean;
  badge?: string;
  features: { label: string; included: boolean | string }[];
};

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    priceAnnual: 0,
    features: [
      { label: "Likes por dia", included: "10" },
      { label: "Super-likes por dia", included: "1" },
      { label: "Boost por mes", included: false },
      { label: "Ver quem te curtiu", included: false },
      { label: "Filtros avancados", included: false },
      { label: "Mensagens sem match", included: false },
      { label: "Modo incognito", included: false },
      { label: "Sem anuncios", included: false },
    ],
  },
  {
    id: "gold",
    name: "Gold",
    priceMonthly: 29.9,
    priceAnnual: 239.0,
    highlight: true,
    badge: "Mais popular",
    features: [
      { label: "Likes por dia", included: "Ilimitados" },
      { label: "Super-likes por dia", included: "5" },
      { label: "Boost por mes", included: "1x" },
      { label: "Ver quem te curtiu", included: true },
      { label: "Filtros avancados", included: true },
      { label: "Mensagens sem match", included: false },
      { label: "Modo incognito", included: false },
      { label: "Sem anuncios", included: true },
    ],
  },
  {
    id: "platinum",
    name: "Platinum",
    priceMonthly: 59.9,
    priceAnnual: 479.0,
    features: [
      { label: "Likes por dia", included: "Ilimitados" },
      { label: "Super-likes por dia", included: "10" },
      { label: "Boost por mes", included: "5x" },
      { label: "Ver quem te curtiu", included: true },
      { label: "Filtros avancados", included: true },
      { label: "Mensagens sem match", included: true },
      { label: "Modo incognito", included: true },
      { label: "Sem anuncios", included: true },
    ],
  },
];

export default function PremiumPage() {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  // W-R-7: substituir por queryUserSubscription()
  const currentTier: Tier = "free";

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <header className="text-center mb-8">
        <Link
          href="/perfil"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Perfil
        </Link>
        <h1 className="text-3xl font-bold mt-4 bg-gradient-to-r from-fuchsia-600 to-rose-500 bg-clip-text text-transparent">
          Spaceship Premium
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
          Mais matches, mais visibilidade, mais controle. Cancele quando quiser.
        </p>
      </header>

      <div className="flex justify-center mb-8">
        <div className="inline-flex p-1 rounded-full border border-border bg-muted/50">
          <button
            onClick={() => setBilling("monthly")}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              billing === "monthly"
                ? "bg-background shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            Mensal
          </button>
          <button
            onClick={() => setBilling("annual")}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              billing === "annual"
                ? "bg-background shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            Anual <span className="text-xs text-fuchsia-600">-33%</span>
          </button>
        </div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentTier;
          const price =
            billing === "monthly" ? plan.priceMonthly : plan.priceAnnual;
          const periodLabel = billing === "monthly" ? "/ mes" : "/ ano";

          return (
            <div
              key={plan.id}
              className={`relative p-6 rounded-2xl border-2 ${
                plan.highlight
                  ? "border-fuchsia-500 shadow-lg shadow-fuchsia-500/20"
                  : "border-border"
              }`}
            >
              {plan.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-fuchsia-600 text-white text-xs font-semibold">
                  {plan.badge}
                </span>
              )}

              <h3 className="text-2xl font-bold">{plan.name}</h3>
              <div className="mt-4 mb-6">
                {price === 0 ? (
                  <p className="text-4xl font-bold">Gratis</p>
                ) : (
                  <p>
                    <span className="text-4xl font-bold">
                      R$ {price.toFixed(2).replace(".", ",")}
                    </span>
                    <span className="text-sm text-muted-foreground ml-1">
                      {periodLabel}
                    </span>
                  </p>
                )}
              </div>

              <ul className="space-y-2 mb-6">
                {plan.features.map((f) => (
                  <li key={f.label} className="flex items-start gap-2 text-sm">
                    <span
                      className={
                        f.included
                          ? "text-green-600 flex-shrink-0"
                          : "text-muted-foreground/50 flex-shrink-0"
                      }
                    >
                      {f.included ? "✓" : "—"}
                    </span>
                    <span className={!f.included ? "text-muted-foreground/60" : ""}>
                      {f.label}
                      {typeof f.included === "string" && (
                        <span className="font-semibold text-fuchsia-600 ml-1">
                          ({f.included})
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div className="w-full text-center py-2.5 rounded-full bg-muted text-sm font-semibold">
                  Plano atual
                </div>
              ) : (
                <Link
                  href={`/premium/checkout?plan=${plan.id}&billing=${billing}`}
                  className={`block w-full text-center py-2.5 rounded-full font-semibold transition-colors ${
                    plan.highlight
                      ? "bg-fuchsia-600 text-white hover:bg-fuchsia-700"
                      : "bg-foreground text-background hover:opacity-90"
                  }`}
                >
                  {plan.id === "free" ? "Voltar ao gratis" : "Assinar"}
                </Link>
              )}
            </div>
          );
        })}
      </section>

      <div className="text-center text-sm text-muted-foreground">
        <p>
          Pagamento via Asaas (Marketplace).{" "}
          <Link
            href="/premium/beneficios"
            className="text-fuchsia-600 hover:text-fuchsia-700 font-medium"
          >
            Ver detalhes dos beneficios
          </Link>
        </p>
        <p className="mt-2 text-xs">
          Cancele a qualquer momento. Sem multa. Reembolso de 7 dias garantido.
        </p>
      </div>
    </main>
  );
}
