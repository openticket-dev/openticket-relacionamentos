/**
 * @jest-environment node
 */

/**
 * Prova da liveness probe que o Railway vai bater em `web-relacionamentos`.
 *
 * Contexto: o painel do Railway só carimba o veredito do BUILD. Sem
 * `healthcheckPath` ele nunca reconfere o processo — `web-servicos` ficou 12
 * dias em 502 exibindo SUCCESS. Ligar o healthcheck exige uma rota que devolva
 * 200; a raiz não serve porque o app roda sob `basePath` (`next.config.ts:5`).
 *
 * FALHA no código antigo: sem `src/app/api/health/route.ts` o import abaixo
 * quebra em "Cannot find module" — o teste não passa por acidente.
 */
import { GET } from "./route";

describe("GET /api/health (liveness do web-relacionamentos)", () => {
  it("responde 200", async () => {
    const res = GET();
    expect(res.status).toBe(200);
  });

  it("devolve JSON identificando o serviço", async () => {
    const res = GET();
    expect(res.headers.get("content-type")).toMatch(/application\/json/);

    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.service).toBe("openticket-relacionamentos");
    // timestamp precisa ser um instante real, não string fixa.
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
  });

  it("é liveness pura: não faz I/O de rede", () => {
    const spy = jest.spyOn(globalThis, "fetch");
    GET();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
