// Relacionamentos — Premium / Paywall (D5 tiers B2C)
// Par FE do backend openticket-api PR#661. Preços vêm de datingPlansCatalog
// (fonte única, mata o hardcode); tier atual de myDatingSubscription;
// upgrade/downgrade wireados em startPremiumCheckout / cancelPremium.
// Degrade honesto (cultura#68): sem o BE D5 no ar, cai na tabela canônica e
// falha fechado no tier (nunca finge premium). BE é MENSAL-only — sem toggle
// anual fake (anual é decisão de produto pendente, declarada no PR do BE).

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  cancelPremium as cancelPremiumMutation,
  loadMySubscription,
  loadPlansCatalog,
} from "@/lib/dating-billing-client";
import {
  entitlementRows,
  formatBRL,
  normalizeDatingPlan,
  planCta,
  type DatingPlanCatalogItem,
} from "@/lib/dating-plans";

export default function PremiumPage() {
  const [catalog, setCatalog] = useState<DatingPlanCatalogItem[]>([]);
  const [currentPlan, setCurrentPlan] = useState<string>("FREE");
  const [loading, setLoading] = useState(true);
  const [priceDegraded, setPriceDegraded] = useState(false);
  const [tierUnknown, setTierUnknown] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [cat, sub] = await Promise.all([
      loadPlansCatalog(),
      loadMySubscription(),
    ]);
    setCatalog(cat.data);
    setPriceDegraded(cat.degraded);
    // Tier ativo: só conta como plano pago se isPremium (fail-closed).
    const plan =
      sub.data && sub.data.isPremium
        ? normalizeDatingPlan(sub.data.plan)
        : "FREE";
    setCurrentPlan(plan);
    setTierUnknown(sub.degraded);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDowngradeToFree = useCallback(async () => {
    setNotice(null);
    setCanceling(true);
    try {
      await cancelPremiumMutation();
      setCurrentPlan("FREE");
      setNotice("Assinatura cancelada. Voce voltou pro plano Free.");
    } catch {
      setNotice(
        "Nao foi possivel cancelar agora. O downgrade conecta quando o backend D5 subir.",
      );
    } finally {
      setCanceling(false);
    }
  }, []);

  const subscriptionTiers = catalog.filter((p) => p.plan !== "BOOST");
  const boost = catalog.find((p) => p.plan === "BOOST") ?? null;

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
        <p className="text-xs text-muted-foreground mt-1">Cobranca mensal.</p>
      </header>

      {notice && (
        <div className="mb-6 mx-auto max-w-md text-center text-sm p-3 rounded-lg bg-fuchsia-50 dark:bg-fuchsia-950/20 border border-fuchsia-200 dark:border-fuchsia-900/30">
          {notice}
        </div>
      )}

      {(priceDegraded || tierUnknown) && !loading && (
        <div className="mb-6 mx-auto max-w-2xl text-center text-xs p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-amber-800 dark:text-amber-300">
          {priceDegraded
            ? "Precos e cobranca ao vivo conectam quando o backend de pagamentos (D5) for publicado — a tabela abaixo e a oficial."
            : "Nao consegui confirmar seu plano ativo agora — exibindo como Free ate a checagem conectar."}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-96 rounded-2xl border border-border bg-muted/30 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {subscriptionTiers.map((plan) => {
            const cta = planCta(currentPlan, plan.plan);
            const highlight = plan.plan === "GOLD";
            const rows = plan.entitlements
              ? entitlementRows(plan.entitlements)
              : [];
            const checkoutSlug = plan.plan.toLowerCase(); // gold | platinum | free

            return (
              <div
                key={plan.id}
                className={`relative p-6 rounded-2xl border-2 ${
                  highlight
                    ? "border-fuchsia-500 shadow-lg shadow-fuchsia-500/20"
                    : "border-border"
                }`}
              >
                {highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-fuchsia-600 text-white text-xs font-semibold">
                    Mais popular
                  </span>
                )}

                <h3 className="text-2xl font-bold">{plan.label}</h3>
                <div className="mt-4 mb-6">
                  {plan.priceBRL === 0 ? (
                    <p className="text-4xl font-bold">Gratis</p>
                  ) : (
                    <p>
                      <span className="text-4xl font-bold">
                        {formatBRL(plan.priceBRL)}
                      </span>
                      <span className="text-sm text-muted-foreground ml-1">
                        / mes
                      </span>
                    </p>
                  )}
                </div>

                <ul className="space-y-2 mb-6">
                  {rows.map((f) => (
                    <li
                      key={f.label}
                      className="flex items-start gap-2 text-sm"
                    >
                      <span
                        className={
                          f.value
                            ? "text-green-600 flex-shrink-0"
                            : "text-muted-foreground/50 flex-shrink-0"
                        }
                      >
                        {f.value ? "✓" : "—"}
                      </span>
                      <span
                        className={
                          !f.value ? "text-muted-foreground/60" : ""
                        }
                      >
                        {f.label}
                        {typeof f.value === "string" && (
                          <span className="font-semibold text-fuchsia-600 ml-1">
                            ({f.value})
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>

                {cta.kind === "current" ? (
                  <div className="w-full text-center py-2.5 rounded-full bg-muted text-sm font-semibold">
                    Plano atual
                  </div>
                ) : cta.kind === "downgrade" && plan.plan === "FREE" ? (
                  <button
                    onClick={handleDowngradeToFree}
                    disabled={canceling}
                    className="block w-full text-center py-2.5 rounded-full font-semibold border border-border hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {canceling ? "Processando..." : cta.label}
                  </button>
                ) : (
                  <Link
                    href={`/premium/checkout?plan=${checkoutSlug}`}
                    className={`block w-full text-center py-2.5 rounded-full font-semibold transition-colors ${
                      highlight
                        ? "bg-fuchsia-600 text-white hover:bg-fuchsia-700"
                        : "bg-foreground text-background hover:opacity-90"
                    }`}
                  >
                    {cta.label}
                  </Link>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* 4o item: Boost avulso (compra one-off, nao assinatura) */}
      {!loading && boost && (
        <section className="mb-8 p-5 rounded-2xl border border-border bg-gradient-to-br from-amber-50 to-rose-50 dark:from-amber-950/20 dark:to-rose-950/20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="text-4xl">🚀</span>
            <div>
              <h3 className="font-bold text-lg">{boost.label}</h3>
              <p className="text-sm text-muted-foreground">
                {boost.description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-2xl font-bold">
              {formatBRL(boost.priceBRL)}
            </span>
            <Link
              href="/premium/checkout?plan=boost"
              className="px-5 py-2.5 rounded-full bg-amber-500 text-white font-semibold hover:bg-amber-600 whitespace-nowrap"
            >
              Comprar boost
            </Link>
          </div>
        </section>
      )}

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
