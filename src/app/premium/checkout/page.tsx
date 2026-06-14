// Relacionamentos — Premium Checkout
// Wireado ao backend real (apps/core/src/dating-billing) via /api/graphql.
//   - startPremiumCheckout → assinatura Premium (R$ 39,90/mês)
//   - buyBoostCheckout     → boost de perfil (R$ 9,90 · 24h, via ?type=boost)
//
// GUARDRAIL DE DINHEIRO (mesmo do fluxo /perfil/premium do shell): a cobrança
// REAL passa pelo Asaas SANDBOX atrás do gate de produção DATING_BILLING_LIVE
// (default FECHADO). O resultado traz `billingMode` (PRODUCTION | SANDBOX |
// UNCONFIGURED) e a UI mostra o estado HONESTO. NÃO existe paywall fake: nada
// vira Premium sem cobrança real, e sem chave o backend devolve UNCONFIGURED.
//
// As mutations são user-scoped (sem args): o backend resolve o profile pela
// sessão. Por isso não há seletor de e-mail / método de pagamento aqui — o
// método (PIX/cartão/boleto) é coletado no checkout hospedado do Asaas, cujo
// link (`invoiceUrl`) é devolvido pelo backend.

"use client";

import Link from "next/link";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { gqlRequest, GqlClientError } from "@/lib/gql-client";

type CheckoutType = "premium" | "boost";

type DatingCheckoutResult = {
  created: boolean;
  billingMode: "PRODUCTION" | "SANDBOX" | "UNCONFIGURED" | string;
  message: string;
  asaasId: string | null;
  invoiceUrl: string | null;
};

type StartPremiumResult = { startPremiumCheckout: DatingCheckoutResult };
type BuyBoostResult = { buyBoostCheckout: DatingCheckoutResult };

const START_PREMIUM_CHECKOUT = /* GraphQL */ `
  mutation StartPremiumCheckout {
    startPremiumCheckout {
      created
      billingMode
      message
      asaasId
      invoiceUrl
      subscription { id plan status isPremium expiresAt }
    }
  }
`;

const BUY_BOOST_CHECKOUT = /* GraphQL */ `
  mutation BuyBoostCheckout {
    buyBoostCheckout {
      created
      billingMode
      message
      asaasId
      invoiceUrl
      boost { id status isActive startedAt expiresAt }
    }
  }
`;

const PRODUCT: Record<
  CheckoutType,
  { name: string; price: number; period: string; cta: string }
> = {
  // Preços travados no backend (PREMIUM_PRICE_BRL / BOOST_PRICE_BRL).
  premium: { name: "Premium", price: 39.9, period: "mês", cta: "Assinar Premium" },
  boost: { name: "Boost de perfil", price: 9.9, period: "24h", cta: "Turbinar perfil" },
};

function brl(v: number): string {
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
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
  // Aceita ?type=boost; default premium. (O link legado ?plan=gold/platinum
  // cai em premium — o backend só tem um plano Premium único.)
  const type: CheckoutType =
    searchParams.get("type") === "boost" ? "boost" : "premium";
  const product = PRODUCT[type];

  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DatingCheckoutResult | null>(null);

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
      if (type === "boost") {
        const data = await gqlRequest<BuyBoostResult>(BUY_BOOST_CHECKOUT);
        setResult(data.buyBoostCheckout);
      } else {
        const data = await gqlRequest<StartPremiumResult>(START_PREMIUM_CHECKOUT);
        setResult(data.startPremiumCheckout);
      }
    } catch (err) {
      if (err instanceof GqlClientError) {
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
        <h1 className="text-2xl font-semibold mt-2">Finalizar Assinatura</h1>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <section>
            <h2 className="font-semibold mb-2">Pagamento via Asaas</h2>
            <p className="text-sm text-muted-foreground">
              Ao confirmar, geramos uma cobrança no Asaas e abrimos o checkout
              seguro onde você escolhe a forma de pagamento (PIX, cartão de
              crédito ou boleto). Você só vira {product.name} depois do pagamento
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
                <Link
                  href="/landing/termos"
                  className="text-fuchsia-600 hover:text-fuchsia-700 underline"
                >
                  termos de uso
                </Link>{" "}
                e a{" "}
                <Link
                  href="/landing/privacidade"
                  className="text-fuchsia-600 hover:text-fuchsia-700 underline"
                >
                  politica de privacidade
                </Link>
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
                <span className="text-muted-foreground">Produto</span>
                <span className="font-medium">{product.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{brl(product.price)}</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between font-bold">
                <span>Total</span>
                <span className="text-fuchsia-600">{brl(product.price)}</span>
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                Cobrado a cada {product.period}.
              </p>
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full mt-4 py-2.5 rounded-full bg-fuchsia-600 text-white font-semibold hover:bg-fuchsia-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Processando..." : product.cta}
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
