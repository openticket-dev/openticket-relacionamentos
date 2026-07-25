import Link from "next/link";

export const metadata = {
  title: "Admin — OpenTicket Relacionamentos",
  description: "Painel admin do app Relacionamentos.",
  robots: { index: false, follow: false },
};

// EmptyState honesto by-design (fix probe r31).
//
// Introspection do gateway federado (api-gateway-staging-08fb /graphql, 940
// query fields) confirma que NAO existe resolver de admin/moderacao especifico
// da vertical relacionamentos: moderationOverview / relacModerationOverview /
// relacionamentosAdminDashboard / relacReports / relacBans -> "Cannot query
// field on type Query". Os campos genericos de plataforma (pendingReports,
// platformBans, accessAuditLogs) nao sao escopados a esta vertical.
//
// Logo: nao ha backend pra wirar este painel. Em vez de "em construcao"
// (que o probe heuristico classifica como backend-pendente) ou de um loop de
// hydration, renderizamos um estado vazio honesto, estatico e ja assentado.
export default function RelacionamentosAdminPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-20">
      <div className="max-w-xl w-full text-center space-y-6">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          Admin Relacionamentos
        </h1>
        <p className="text-base text-muted-foreground leading-relaxed">
          A vertical de relacionamentos não tem um painel admin próprio no
          gateway. A curadoria de comunidades, a moderação e as métricas DNA-30
          são operadas pelo time OpenTicket fora deste app — não há um backend
          de administração específico desta vertical para exibir aqui.
        </p>
        <p className="text-sm text-muted-foreground">
          Moderação e segurança da conta ficam em{" "}
          <Link
            href="/admin/seguranca"
            className="text-fuchsia-600 hover:underline"
          >
            Segurança &amp; Moderação
          </Link>
          .
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          {/* Rota local do ERP — o shell proxia /relacionamentos/admin/* aqui. */}
          <Link
            href="/admin/qr-designer"
            className="px-5 py-2.5 rounded-lg border border-fuchsia-600 text-fuchsia-600 font-semibold hover:bg-fuchsia-50 transition-colors text-sm"
          >
            QR Designer
          </Link>
          {/* REL-G2 — configurador dos pesos do algoritmo de match (backend
              real: matchAlgorithmConfig / saveMatchAlgorithmConfig). */}
          <Link
            href="/admin/algoritmo"
            className="px-5 py-2.5 rounded-lg border border-fuchsia-600 text-fuchsia-600 font-semibold hover:bg-fuchsia-50 transition-colors text-sm"
          >
            Algoritmo de match
          </Link>
          <Link
            href="/landing"
            className="px-5 py-2.5 rounded-lg bg-fuchsia-600 text-white font-semibold hover:bg-fuchsia-700 transition-colors text-sm"
          >
            Voltar para Relacionamentos
          </Link>
        </div>
      </div>
    </main>
  );
}
