import { NextResponse } from "next/server";

/**
 * Liveness probe do serviço Railway `web-relacionamentos`.
 *
 * Por que existe: o painel do Railway só carimba o veredito do BUILD. Sem
 * `healthcheckPath` configurado ele nunca mais confere se o processo responde —
 * foi assim que `web-servicos` ficou 12 dias devolvendo 502 exibindo SUCCESS.
 * Esta rota é o alvo do healthcheck; a raiz do app não serve porque o app roda
 * sob `basePath` (`next.config.ts:5`, `NEXT_PUBLIC_BASE_PATH=/relacionamentos`)
 * e devolve 404 em `/`.
 *
 * É LIVENESS, não readiness: responde 200 porque o processo Node está de pé e
 * servindo. Não checa banco, gateway GraphQL nem cookie de sessão — este app é
 * um front Next que fala com o gateway por rewrite/BFF, e um healthcheck que
 * afirma dependência que não mede mente pior do que não existir.
 *
 * `force-dynamic` impede que o `next build` pré-renderize a resposta e congele
 * `timestamp`/`commitSha` no artefato.
 *
 * Espelha `openticket-admin:src/app/api/health/route.ts` (origin/staging), que
 * já responde 200 hoje — mesmo formato de corpo, só muda `service`.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "openticket-relacionamentos",
    environment:
      process.env.RAILWAY_ENVIRONMENT_NAME ??
      process.env.NEXT_PUBLIC_APP_ENV ??
      process.env.NODE_ENV ??
      "unknown",
    commitSha:
      process.env.RAILWAY_GIT_COMMIT_SHA ??
      process.env.SOURCE_COMMIT ??
      "unknown",
    timestamp: new Date().toISOString(),
  });
}
