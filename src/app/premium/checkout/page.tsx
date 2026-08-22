// Relacionamentos — Premium Checkout (D5 tiers B2C)
// Par FE do backend openticket-api PR#661. Wireado ao backend real
// (apps/core/src/dating-billing) via /api/graphql.
//   - startPremiumCheckout(plan: DatingPlanTier) → assinatura GOLD/PLATINUM
//   - buyBoostCheckout                           → boost de perfil (24h, avulso)
//
// PREÇO: vem de datingPlansCatalog (fonte única, mata o hardcode de R$). Sem o
// BE D5 no ar, cai na tabela canônica (degrade honesto — cultura#68).
//
// GUARDRAIL DE DINHEIRO: a cobrança REAL passa pelo Asaas SANDBOX atrás do gate
// de produção DATING_BILLING_LIVE (default FECHADO). O resultado traz
// `billingMode` (PRODUCTION | SANDBOX | UNCONFIGURED) e a UI mostra o estado
// HONESTO. NÃO existe paywall fake: nada vira Premium sem cobrança confirmada, e
// sem chave o backend devolve UNCONFIGURED.
//
// As mutations são user-scoped (owner do JWT): o método (PIX/cartão/boleto) é
// coletado no checkout hospedado do Asaas, cujo `invoiceUrl` volta no resultado.

"use client";

import Link from "next/link";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { GqlClientError } from "@/lib/gql-client";
import {
  buyBoostCheckout,
  loadPlansCatalog,
  startPremiumCheckout,
} from "@/lib/dating-billing-client";
import {
  FALLBACK_PLANS_CATALOG,
  formatBRL,
  planKindToTier,
  type DatingCheckoutResult,
  type DatingPlanCatalogItem,
} from "@/lib/dating-plans";

type PlanParam = "gold" | "platinum" | "boost";

/** slug da URL → plan do catálogo (GOLD/PLATINUM/BOOST). */
function planParamToCatalogPlan(p: PlanParam): string {
  if (p === "boost") return "BOOST";
  if (p === "platinum") return "PLATINUM";
  return "GOLD";
}

/** Banner honesto do estado de billing devolvido pelo backend. */
function BillingStateNote({ result }: { result: DatingCheckoutResult }) {
  const isSandbox = result.billingMode === "SANDBOX";
  const isUnconfigured = result.billingMode === "UNCONFIGURED";

  const tone = result.created
    ? "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-800 dark:border-fuchsia-900/40 dark:bg-fuchsia-950/20 dark:text-fuchsia-200"
    : "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200";

  return (
    <div role="status" className={`mt-4 rounded-lg border px-4 py-3 text-sm ${tone}`}>
      {isSandbox && (
        <p className="font-semibold">Modo teste (sandbox) — sem dinheiro real</p>
      )}
      {isUnconfigured && (
        <p className="font-semibold">Pagamento ainda não configurado</p>
      )}
      <p className="opacity-90">{result.message}</p>
      {result.invoiceUrl && (
        <a
          href={result.invoiceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block font-medium underline hover:opacity-80"
        >
          {isSandbox ? "Abrir cobrança de teste (Asaas sandbox)" : "Abrir pagamento (Asaas)"}
        </a>
      )}
    </div>
  );
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  // Aceita ?plan=gold|platinum|boost. Legado: ?type=boost.
  const rawPlan = (searchParams.get("plan") || "").toLowerCase();
  const legacyBoost = searchParams.get("type") === "boost";
  const planParam: PlanParam =
    rawPlan === "boost" || legacyBoost
      ? "boost"
      : rawPlan === "platinum"
        ? "platinum"
        : "gold";

  const isBoost = planParam === "boost";
  const catalogPlan = planParamToCatalogPlan(planParam);

  // Preço/label vêm do catálogo (fonte única). Fallback canônico enquanto carrega
  // ou se o BE D5 não estiver no ar.
  const [catalog, setCatalog] = useState<DatingPlanCatalogItem[]>(
    FALLBACK_PLANS_CATALOG,
  );
  const [priceDegraded, setPriceDegraded] = useState(false);

  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DatingCheckoutResult | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const cat = await loadPlansCatalog();
      if (!alive) return;
      setCatalog(cat.data);
      setPriceDegraded(cat.degraded);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const item =
    catalog.find((c) => c.plan === catalogPlan) ??
    FALLBACK_PLANS_CATALOG.find((c) => c.plan === catalogPlan)!;
  const period = item.cycle === "ONE_OFF" ? "24h" : "mês";
  const cta = isBoost ? "Turbinar perfil" : `Assinar ${item.label}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!acceptedTerms) {
      setError("Voce precisa aceitar os termos pra continuar.");
      return;
    }
    setSubmitting(true);
    try {
      if (isBoost) {
        setResult(await buyBoostCheckout());
      } else {
        const tier = planKindToTier(catalogPlan);
        if (!tier) {
          throw new Error("Plano invalido pra checkout de assinatura.");
        }
        setResult(await startPremiumCheckout(tier));
      }
    } catch (err) {
      if (err instanceof GqlClientError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Nao foi possivel iniciar o checkout. Tente novamente.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <header className="mb-6">
        <Link
          href="/premium"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Planos
        </Link>
        <h1 className="text-2xl font-semibold mt-2">
          {isBoost ? "Comprar Boost" : "Finalizar Assinatura"}
        </h1>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <section>
            <h2 className="font-semibold mb-2">Pagamento via Asaas</h2>
            <p className="text-sm text-muted-foreground">
              Ao confirmar, geramos uma cobrança no Asaas e abrimos o checkout
              seguro onde você escolhe a forma de pagamento (PIX, cartão de
              crédito ou boleto). Você só vira {item.label} depois do pagamento
              ser confirmado — nada é ativado antes disso.
            </p>
          </section>

          <section>
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Li e aceito os{" "}
                {/*
                  Termos e politica sao documentos UNICOS da OpenTicket e vivem
                  no shell (openticket-shell src/app/termos/page.tsx e
                  src/app/privacidade/page.tsx). <a> puro de proposito: next/link
                  prefixaria o basePath /relacionamentos e cairia em 404, que era
                  exatamente o bug — os dois destinos antigos, sob o prefixo
                  "landing", nunca existiram neste app (so ha landing/page.tsx).
                */}
                <a
                  href="/termos"
                  className="text-fuchsia-600 hover:text-fuchsia-700 underline"
                >
                  termos de uso
                </a>{" "}
                e a{" "}
                <a
                  href="/privacidade"
                  className="text-fuchsia-600 hover:text-fuchsia-700 underline"
                >
                  politica de privacidade
                </a>
                . Entendo que posso cancelar a qualquer momento.
              </span>
            </label>
          </section>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {result && <BillingStateNote result={result} />}
        </div>

        <aside className="space-y-4">
          <div className="p-5 rounded-lg border border-border bg-card sticky top-6">
            <h3 className="font-semibold mb-3">Resumo</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {isBoost ? "Produto" : "Plano"}
                </span>
                <span className="font-medium">{item.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatBRL(item.priceBRL)}</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between font-bold">
                <span>Total</span>
                <span className="text-fuchsia-600">
                  {formatBRL(item.priceBRL)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                {isBoost
                  ? "Compra avulsa · perfil em destaque por 24h."
                  : `Cobrado a cada ${period}.`}
              </p>
              {priceDegraded && (
                <p className="text-xs text-amber-700 dark:text-amber-400 pt-1">
                  Preço da tabela oficial — cobrança ao vivo conecta com o
                  backend D5.
                </p>
              )}
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full mt-4 py-2.5 rounded-full bg-fuchsia-600 text-white font-semibold hover:bg-fuchsia-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Processando..." : cta}
            </button>

            <p className="text-xs text-center text-muted-foreground mt-3">
              Pagamento seguro via Asaas
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen p-6 text-sm text-muted-foreground">
          Carregando...
        </main>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
