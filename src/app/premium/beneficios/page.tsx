// Relacionamentos — Premium Beneficios (Sprint M8-2)
// Detalhamento dos beneficios por tier (boost, super-likes, ver curtidas, modo incognito).
// W-R-7 ligara queryUserSubscription pra mostrar o que o user tem ativo.

"use client";

import Link from "next/link";

type Tier = "free" | "gold" | "platinum";

type Benefit = {
  id: string;
  title: string;
  icon: string;
  desc: string;
  freeValue: string;
  goldValue: string;
  platinumValue: string;
};

const BENEFITS: Benefit[] = [
  {
    id: "likes",
    title: "Likes",
    icon: "❤",
    desc: "Quantos perfis voce pode curtir por dia",
    freeValue: "10 / dia",
    goldValue: "Ilimitados",
    platinumValue: "Ilimitados",
  },
  {
    id: "superlikes",
    title: "Super-likes",
    icon: "⭐",
    desc: "Mostra interesse forte. 3x mais chance de match",
    freeValue: "1 / dia",
    goldValue: "5 / dia",
    platinumValue: "10 / dia",
  },
  {
    id: "boost",
    title: "Boost",
    icon: "🚀",
    desc: "Seu perfil aparece pra mais gente por 30 minutos",
    freeValue: "—",
    goldValue: "1 / mes",
    platinumValue: "5 / mes",
  },
  {
    id: "see_likes",
    title: "Ver quem te curtiu",
    icon: "👀",
    desc: "Lista de perfis que ja te deram like (sem precisar de match)",
    freeValue: "—",
    goldValue: "Sim",
    platinumValue: "Sim",
  },
  {
    id: "filters",
    title: "Filtros avancados",
    icon: "🎚",
    desc: "Filtre por interesses, valores, profissao, signo, etc.",
    freeValue: "Basicos",
    goldValue: "Avancados",
    platinumValue: "Avancados",
  },
  {
    id: "msg_no_match",
    title: "Mensagem sem match",
    icon: "💬",
    desc: "Envie 1 mensagem por semana antes do match (super-message)",
    freeValue: "—",
    goldValue: "—",
    platinumValue: "1 / semana",
  },
  {
    id: "incognito",
    title: "Modo incognito",
    icon: "🥷",
    desc: "Apareca apenas pra perfis que voce ja curtiu",
    freeValue: "—",
    goldValue: "—",
    platinumValue: "Sim",
  },
  {
    id: "no_ads",
    title: "Sem anuncios",
    icon: "🚫",
    desc: "Experiencia limpa, sem interrupcoes",
    freeValue: "Tem ads",
    goldValue: "Sem ads",
    platinumValue: "Sem ads",
  },
];

export default function BeneficiosPage() {
  // W-R-7: substituir por queryUserSubscription()
  const currentTier = "free" as Tier;

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto">
      <header className="mb-6">
        <Link
          href="/premium"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Planos
        </Link>
        <h1 className="text-2xl font-semibold mt-2">Beneficios detalhados</h1>
        <p className="text-sm text-muted-foreground mt-1">
          O que cada plano inclui. Seu plano atual:{" "}
          <span className="font-semibold capitalize">{currentTier}</span>
        </p>
      </header>

      <div className="space-y-3">
        {BENEFITS.map((b) => (
          <div
            key={b.id}
            className="p-5 rounded-lg border border-border bg-card"
          >
            <div className="flex items-start gap-4 mb-4">
              <span className="text-3xl">{b.icon}</span>
              <div>
                <h3 className="font-semibold">{b.title}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {b.desc}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className={`p-3 rounded-lg text-center ${currentTier === "free" ? "bg-fuchsia-50 dark:bg-fuchsia-950/20 border border-fuchsia-200 dark:border-fuchsia-900/30" : "bg-muted/30"}`}>
                <p className="text-xs text-muted-foreground uppercase">Free</p>
                <p className="font-semibold text-sm mt-1">{b.freeValue}</p>
              </div>
              <div className={`p-3 rounded-lg text-center ${currentTier === "gold" ? "bg-fuchsia-50 dark:bg-fuchsia-950/20 border border-fuchsia-200 dark:border-fuchsia-900/30" : "bg-muted/30"}`}>
                <p className="text-xs text-muted-foreground uppercase">Gold</p>
                <p className="font-semibold text-sm mt-1">{b.goldValue}</p>
              </div>
              <div className={`p-3 rounded-lg text-center ${currentTier === "platinum" ? "bg-fuchsia-50 dark:bg-fuchsia-950/20 border border-fuchsia-200 dark:border-fuchsia-900/30" : "bg-muted/30"}`}>
                <p className="text-xs text-muted-foreground uppercase">
                  Platinum
                </p>
                <p className="font-semibold text-sm mt-1">{b.platinumValue}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 p-6 rounded-2xl bg-gradient-to-br from-fuchsia-600 to-rose-500 text-white text-center">
        <h2 className="text-xl font-bold">Pronto pra ter mais matches?</h2>
        <p className="text-sm mt-2 opacity-90">
          Faca upgrade e descubra quem ja te curtiu.
        </p>
        <Link
          href="/premium"
          className="inline-block mt-4 px-6 py-2.5 rounded-full bg-white text-fuchsia-600 font-semibold hover:bg-white/90"
        >
          Escolher plano
        </Link>
      </div>
    </main>
  );
}
