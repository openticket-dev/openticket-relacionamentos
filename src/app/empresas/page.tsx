// /empresas — index estatico do microfrontend relacionamentos.
// Yuri Phase 4 — placeholder honesto enquanto o catalogo de empresas nao existe.
// Subdomain shell roteia dev.openticket.com.br/relacionamentos/empresas para este path.
// Quando houver listagem real, troca o <Tier2Hero> + empty-state por um grid de companies.

import type { Metadata } from "next";
import Link from "next/link";

const ACCENT = "#d946ef";
const CONTACT_EMAIL = "comercial-relac@openticket.com.br";

export const metadata: Metadata = {
  title: "Empresas · OpenTicket Relacionamentos",
  description:
    "Catalogo de marcas, comunidades e operacoes B2C de relacionamento na plataforma OpenTicket.",
  openGraph: {
    title: "Empresas · OpenTicket Relacionamentos",
    description:
      "Catalogo de marcas, comunidades e operacoes B2C de relacionamento na plataforma OpenTicket.",
    type: "website",
    locale: "pt_BR",
    siteName: "OpenTicket Relacionamentos",
  },
};

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 21s-7.5-4.5-9.5-9.5C1.4 8.6 3.5 5 7 5c2 0 3.5 1 5 3 1.5-2 3-3 5-3 3.5 0 5.6 3.6 4.5 6.5C19.5 16.5 12 21 12 21z" />
    </svg>
  );
}

function Tier2Hero() {
  return (
    <section
      className="relative overflow-hidden border-b"
      style={{
        background: `linear-gradient(135deg, ${ACCENT}10 0%, transparent 60%)`,
        borderColor: `${ACCENT}33`,
      }}
    >
      <div className="max-w-6xl mx-auto px-6 py-16 sm:py-20">
        <div className="flex items-center gap-3 mb-6">
          <div
            className="flex items-center justify-center w-12 h-12 rounded-xl"
            style={{ background: `${ACCENT}22`, color: ACCENT }}
          >
            <HeartIcon className="w-6 h-6" />
          </div>
          <span
            className="text-sm font-semibold uppercase tracking-wider"
            style={{ color: ACCENT }}
          >
            OpenTicket Relacionamentos
          </span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight max-w-3xl">
          Empresas que operam com a gente
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
          Marcas, comunidades, eventos e operacoes B2C — toda a galera que usa
          OpenTicket pra conectar gente.
        </p>
      </div>
    </section>
  );
}

export default function EmpresasIndexPage() {
  return (
    <main className="min-h-screen">
      <Tier2Hero />

      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-6"
          style={{ background: `${ACCENT}1a`, color: ACCENT }}
        >
          <HeartIcon className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-semibold">
          Catalogo publico em construcao
        </h2>
        <p className="mt-3 text-muted-foreground">
          Ainda nao temos uma listagem publica de empresas de relacionamentos.
          Se voce e operador ou marca e quer aparecer aqui, fala com o time
          comercial — a gente cadastra na proxima janela de onboarding.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=Quero%20entrar%20no%20catalogo%20de%20empresas%20%C2%B7%20Relacionamentos`}
            className="inline-flex items-center px-6 py-3 rounded-lg text-white font-medium transition-colors"
            style={{ background: ACCENT }}
          >
            Falar com comercial
          </a>
          <Link
            href="/"
            className="inline-flex items-center px-6 py-3 rounded-lg border border-border font-medium hover:bg-accent transition-colors"
          >
            Voltar ao inicio
          </Link>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          Contato direto:{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="underline underline-offset-2"
          >
            {CONTACT_EMAIL}
          </a>
        </p>
      </section>
    </main>
  );
}
