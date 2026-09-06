// QA100-REL-06 (porta) — GATE do link para a curadoria.
//
// Rota que existe e ninguem acha e o defeito PLT-13 catalogado na plataforma:
// /configuracoes/pagamentos funciona ha meses e as 3 unicas ocorrencias do
// caminho no repo sao autorreferencia da propria pagina. A curadoria nao pode
// nascer assim. Este gate FALHA no codigo antigo: nao ha link nenhum para
// /admin/eventos no hub de administracao.
import { render, screen, waitFor } from "@testing-library/react";
import SegurancaOverviewPage from "./page";

function installFetch() {
  const fn = jest.fn(async () => {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          platformReports: { total: 0 },
          platformBans: { total: 0 },
          panicMetrics: null,
          panicAuditLog: { items: [] },
        },
      }),
    } as Response;
  });
  global.fetch = fn as unknown as typeof fetch;
}

afterEach(() => jest.restoreAllMocks());

describe("Hub de administracao — a curadoria tem porta", () => {
  it("linka /admin/eventos", async () => {
    installFetch();
    render(<SegurancaOverviewPage />);
    await waitFor(() => {
      expect(screen.getByTestId("link-curadoria-eventos")).toHaveAttribute(
        "href",
        "/admin/eventos",
      );
    });
  });
});
