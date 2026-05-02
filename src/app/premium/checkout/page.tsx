// Relacionamentos — Premium Checkout (Sprint M8-2)
// Checkout via Asaas Marketplace. PIX + Cartao + Boleto.
// W-R-7 ligara mutationCreateAsaasCheckout.

"use client";

import Link from "next/link";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

type PaymentMethod = "pix" | "credit_card" | "boleto";

type PlanSummary = {
  name: string;
  price: number;
  period: string;
};

const PLAN_PRICES: Record<string, Record<string, PlanSummary>> = {
  gold: {
    monthly: { name: "Gold Mensal", price: 29.9, period: "mes" },
    annual: { name: "Gold Anual", price: 239.0, period: "ano" },
  },
  platinum: {
    monthly: { name: "Platinum Mensal", price: 59.9, period: "mes" },
    annual: { name: "Platinum Anual", price: 479.0, period: "ano" },
  },
};

function CheckoutContent() {
  const searchParams = useSearchParams();
  const planId = searchParams.get("plan") || "gold";
  const billing = searchParams.get("billing") || "monthly";
  const plan = PLAN_PRICES[planId]?.[billing] ?? PLAN_PRICES.gold.monthly;

  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [email, setEmail] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!acceptedTerms) {
      setError("Voce precisa aceitar os termos pra continuar.");
      return;
    }
    if (!email.includes("@")) {
      setError("Email invalido.");
      return;
    }
    setSubmitting(true);
    // W-R-7: mutationCreateAsaasCheckout({ planId, billing, method, email })
    // → redireciona pra Asaas hosted checkout
    setTimeout(() => {
      setSubmitting(false);
      setError("Checkout Asaas ainda nao conectado. Aguardando W-R-7.");
    }, 1200);
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
            <h2 className="font-semibold mb-3">1. Seu email</h2>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full px-4 py-2 border border-border rounded-lg bg-background"
            />
          </section>

          <section>
            <h2 className="font-semibold mb-3">2. Forma de pagamento</h2>
            <div className="space-y-2">
              {(
                [
                  { id: "pix", label: "PIX", desc: "Aprovacao imediata", icon: "⚡" },
                  {
                    id: "credit_card",
                    label: "Cartao de credito",
                    desc: "Visa, Master, Elo, Hiper, Amex",
                    icon: "💳",
                  },
                  {
                    id: "boleto",
                    label: "Boleto bancario",
                    desc: "Compensacao em 1-3 dias uteis",
                    icon: "🧾",
                  },
                ] as const
              ).map((m) => (
                <label
                  key={m.id}
                  className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    method === m.id
                      ? "border-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-950/20"
                      : "border-border hover:border-muted-foreground/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="method"
                    value={m.id}
                    checked={method === m.id}
                    onChange={() => setMethod(m.id as PaymentMethod)}
                    className="sr-only"
                  />
                  <span className="text-2xl">{m.icon}</span>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{m.label}</p>
                    <p className="text-xs text-muted-foreground">{m.desc}</p>
                  </div>
                  {method === m.id && (
                    <span className="text-fuchsia-600 font-bold">✓</span>
                  )}
                </label>
              ))}
            </div>
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
        </div>

        <aside className="space-y-4">
          <div className="p-5 rounded-lg border border-border bg-card sticky top-6">
            <h3 className="font-semibold mb-3">Resumo</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plano</span>
                <span className="font-medium">{plan.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>R$ {plan.price.toFixed(2).replace(".", ",")}</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between font-bold">
                <span>Total</span>
                <span className="text-fuchsia-600">
                  R$ {plan.price.toFixed(2).replace(".", ",")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                Cobrado a cada {plan.period}.
              </p>
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full mt-4 py-2.5 rounded-full bg-fuchsia-600 text-white font-semibold hover:bg-fuchsia-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Processando..." : "Confirmar e pagar"}
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
