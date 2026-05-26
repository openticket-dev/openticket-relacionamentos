import { Heart, Mail } from "lucide-react";

export const metadata = {
  title: "Empresas — relacionamentos — OpenTicket",
  description: "Plataforma B2B OpenTicket relacionamentos — parcerias comerciais.",
};

export default function EmpresasPage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <section className="mx-auto max-w-4xl px-6 py-20">
        <div className="flex items-center gap-4 mb-6">
          <div className="rounded-2xl p-3" style={{ background: "#d946ef22", color: "#d946ef" }}>
            <Heart className="w-12 h-12" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-neutral-400">Empresas relacionamentos</p>
            <h1 className="text-4xl font-bold">B2B no relacionamentos</h1>
          </div>
        </div>
        <p className="text-lg text-neutral-300 mb-12 max-w-2xl">
          Plataforma B2B OpenTicket para o setor de relacionamentos. Catálogo de
          parcerias, integrações e contratos comerciais em construção.
        </p>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8">
          <h2 className="text-xl font-semibold mb-2">Em construção</h2>
          <p className="text-neutral-400 mb-6">
            Catálogo B2B em desenvolvimento. Entre em contato com nosso time
            comercial para discutir parcerias estratégicas no setor de relacionamentos.
          </p>
          <a
            href="mailto:comercial-relac@openticket.com.br"
            className="inline-flex items-center gap-2 rounded-lg px-5 py-3 font-medium transition"
            style={{ background: "#d946ef", color: "#000" }}
          >
            <Mail className="w-4 h-4" />
            Falar com comercial
          </a>
        </div>
      </section>
    </main>
  );
}
