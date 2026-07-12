// Fluxo CRITICO DE DINHEIRO: checkout premium.
// startPremiumCheckout (R$ 39,90/mes) e buyBoostCheckout (R$ 9,90/24h) via
// /api/graphql. Guardrail honesto: nada vira Premium sem cobranca real; o
// backend devolve billingMode (PRODUCTION|SANDBOX|UNCONFIGURED) e a UI mostra.
// Assercoes reais: preco correto, bloqueio sem aceite de termos, mutation certa
// por tipo, e banner honesto do estado de billing.
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CheckoutPage from "./page";

type GqlCall = { query: string; variables?: Record<string, unknown> };

function installFetch(result: Record<string, unknown>) {
  const calls: GqlCall[] = [];
  const fn = jest.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string) as GqlCall;
    calls.push(body);
    const op = body.query.includes("buyBoostCheckout")
      ? "buyBoostCheckout"
      : "startPremiumCheckout";
    return {
      ok: true,
      status: 200,
      json: async () => ({ data: { [op]: result } }),
    } as Response;
  });
  global.fetch = fn as unknown as typeof fetch;
  return { fn, calls };
}

const SANDBOX_RESULT = {
  created: true,
  billingMode: "SANDBOX",
  message: "Cobranca de teste criada.",
  asaasId: "pay_123",
  invoiceUrl: "https://sandbox.asaas.com/i/pay_123",
};

afterEach(() => jest.restoreAllMocks());

describe("Checkout premium (fluxo de dinheiro)", () => {
  it("renderiza o plano Premium com preco R$ 39,90", async () => {
    installFetch(SANDBOX_RESULT);
    render(<CheckoutPage />);
    expect(await screen.findByRole("button", { name: "Assinar Premium" })).toBeInTheDocument();
    expect(screen.getAllByText("R$ 39,90").length).toBeGreaterThan(0);
  });

  it("bloqueia o checkout se os termos nao forem aceitos (nao chama o backend)", async () => {
    const { fn } = installFetch(SANDBOX_RESULT);
    render(<CheckoutPage />);
    const cta = await screen.findByRole("button", { name: "Assinar Premium" });

    fireEvent.click(cta);

    expect(await screen.findByText(/aceitar os termos/i)).toBeInTheDocument();
    expect(fn).not.toHaveBeenCalled();
  });

  it("com termos aceitos, dispara startPremiumCheckout e mostra o banner honesto de sandbox", async () => {
    const { calls } = installFetch(SANDBOX_RESULT);
    render(<CheckoutPage />);
    await screen.findByRole("button", { name: "Assinar Premium" });

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Assinar Premium" }));

    await waitFor(() => {
      expect(calls.some((c) => c.query.includes("startPremiumCheckout"))).toBe(true);
    });
    expect(await screen.findByText(/Modo teste \(sandbox\)/)).toBeInTheDocument();
    expect(screen.getByText("Cobranca de teste criada.")).toBeInTheDocument();
    // Link honesto pra cobranca real do Asaas (nao paywall fake).
    expect(
      screen.getByRole("link", { name: /Abrir cobran/ }),
    ).toHaveAttribute("href", SANDBOX_RESULT.invoiceUrl);
  });

  it("mostra estado UNCONFIGURED quando o backend nao tem chave de pagamento", async () => {
    installFetch({
      created: false,
      billingMode: "UNCONFIGURED",
      message: "Pagamento nao configurado.",
      asaasId: null,
      invoiceUrl: null,
    });
    render(<CheckoutPage />);
    await screen.findByRole("button", { name: "Assinar Premium" });

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Assinar Premium" }));

    expect(await screen.findByText(/Pagamento ainda n[aã]o configurado/)).toBeInTheDocument();
  });

  it("com ?type=boost usa o produto Boost (R$ 9,90) e a mutation buyBoostCheckout", async () => {
    (globalThis as any).__setSearchParams("type=boost");
    const { calls } = installFetch({ ...SANDBOX_RESULT });
    render(<CheckoutPage />);
    const cta = await screen.findByRole("button", { name: "Turbinar perfil" });
    expect(screen.getAllByText("R$ 9,90").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(cta);

    await waitFor(() => {
      expect(calls.some((c) => c.query.includes("buyBoostCheckout"))).toBe(true);
    });
  });
});
