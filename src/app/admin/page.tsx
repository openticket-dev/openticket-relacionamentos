import Link from "next/link";

export const metadata = {
  title: "Admin — OpenTicket Relacionamentos",
  description: "Painel admin do app Relacionamentos.",
  robots: { index: false, follow: false },
};

export default function RelacionamentosAdminPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-20">
      <div className="max-w-xl w-full text-center space-y-6">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          Admin Relacionamentos
        </h1>
        <p className="text-base text-muted-foreground leading-relaxed">
          O painel admin (curadoria de comunidades, moderação, métricas
          DNA-30 e segurança) está em construção. Por enquanto, ações
          administrativas seguem sob aprovação manual do time OpenTicket.
        </p>
        <div className="flex justify-center gap-3 pt-2">
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
