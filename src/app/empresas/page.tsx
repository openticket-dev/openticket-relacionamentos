import { Heart } from "lucide-react";

export const metadata = {
  title: "Empresas — relacionamentos — OpenTicket",
  description: "A vertical relacionamentos do OpenTicket não opera por catálogo de empresas.",
};

/**
 * Empty-state honesto by-design.
 *
 * A vertical `relacionamentos` NÃO tem archetype de empresa no backend — não é
 * um marketplace de estabelecimentos como gastronomia/varejo/esportes/healthcare.
 * Não há `companiesByArchetype` para consultar aqui, então renderizamos um
 * estado vazio honesto em vez de inventar dado (zero-mock).
 */
export default function EmpresasPage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <section className="mx-auto max-w-3xl px-6 py-20">
        <div className="flex items-center gap-4 mb-8">
          <div className="rounded-2xl p-3" style={{ background: "#d946ef22", color: "#d946ef" }}>
            <Heart className="w-12 h-12" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-neutral-400">Empresas relacionamentos</p>
            <h1 className="text-4xl font-bold">Sem catálogo de empresas</h1>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8">
          <p className="text-neutral-300 leading-relaxed">
            A vertical de relacionamentos do OpenTicket é uma experiência voltada para
            pessoas, não um catálogo de estabelecimentos. Por isso não existe uma listagem
            de empresas aqui — diferente de gastronomia, varejo, esportes ou saúde.
          </p>
          <p className="mt-4 text-sm text-neutral-500">
            Esta página não é um catálogo em construção: por desenho, esta vertical não
            opera por empresas cadastradas.
          </p>
        </div>
      </section>
    </main>
  );
}
