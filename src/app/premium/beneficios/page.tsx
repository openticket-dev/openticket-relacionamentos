// Relacionamentos — Premium Beneficios (D5 tiers B2C)
//
// TELA QUE MENTE (corrigido). Ate aqui esta pagina carregava uma const local
// `BENEFITS: Benefit[]` com a matriz inteira de Free/Gold/Platinum escrita a
// mao: 8 beneficios x 3 colunas de valor, cravados no JSX. Era uma SEGUNDA
// verdade sobre o que o cliente compra, paralela ao catalogo do backend
// (datingPlansCatalog -> entitlements) que a /premium ja consome. E as duas
// nao batiam:
//   - a linha "Boost" dizia "Seu perfil aparece pra mais gente por 30 minutos";
//     o item do proprio catalogo deste repo e `boost_24h` / "Perfil em destaque
//     por 24h". A tela que vende Boost anunciava 30 minutos pra um produto de
//     24h — numero errado na tela de conversao;
//   - a linha "Super-likes" vendia "3x mais chance de match", estatistica que
//     nao sai de medicao nenhuma e nao existe em lugar nenhum do contrato.
// Alem do erro atual, uma matriz cravada mente por construcao no dia em que o
// backend mudar um limite: a tela continuaria anunciando o valor velho.
//
// Agora a matriz e DERIVADA do mesmo lugar que a /premium usa:
// loadPlansCatalog() -> entitlements de cada tier -> entitlementRows() (helper
// puro, ja coberto por src/lib/__tests__/dating-plans.test.ts). O tier ativo
// segue de myDatingEntitlements com fail-closed em Free. Quando o catalogo ao
// vivo nao responde, o degrade e declarado na tela (banner) em vez de silencioso,
// e tier sem entitlements no catalogo vira "—", nunca um valor inventado.

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  loadMyEntitlements,
  loadPlansCatalog,
} from "@/lib/dating-billing-client";
import {
  entitlementRows,
  type DatingPlanCatalogItem,
} from "@/lib/dating-plans";

type Tier = "free" | "gold" | "platinum";

/** Icone + explicacao por linha. Texto de UI SEM numero: todo numero da tela
 *  vem dos entitlements do catalogo, nunca daqui. */
const ROW_COPY: Record<string, { icon: string; desc: string }> = {
  "Likes por dia": {
    icon: "❤",
    desc: "Quantos perfis voce pode curtir por dia",
  },
  "Super-likes por dia": {
    icon: "⭐",
    desc: "Mostra interesse forte pra quem voce curtiu",
  },
  "Boost por mes": {
    icon: "🚀",
    desc: "Quantos destaques de perfil o plano inclui por mes",
  },
  "Ver quem te curtiu": {
    icon: "👀",
    desc: "Lista de perfis que ja te curtiram, sem precisar de match",
  },
  "Filtros avancados": {
    icon: "🎚",
    desc: "Filtre por interesses, valores, profissao e mais",
  },
  "Mensagens sem match": {
    icon: "💬",
    desc: "Mandar mensagem antes de o match acontecer",
  },
  "Modo incognito": {
    icon: "🥷",
    desc: "Apareca apenas pra perfis que voce ja curtiu",
  },
  "Sem anuncios": {
    icon: "🚫",
    desc: "Experiencia sem interrupcao de anuncio",
  },
};

/** Valor de uma celula. `null` = o catalogo nao trouxe entitlements do tier. */
function cellText(value: boolean | string | null): string {
  if (value === null) return "—";
  if (value === true) return "Sim";
  if (value === false) return "—";
  return value;
}

interface MatrixRow {
  label: string;
  icon: string;
  desc: string;
  free: boolean | string | null;
  gold: boolean | string | null;
  platinum: boolean | string | null;
}

/** Zipa entitlementRows dos tres tiers numa matriz de comparacao. */
function buildMatrix(catalog: DatingPlanCatalogItem[]): MatrixRow[] {
  const byPlan = new Map(catalog.map((c) => [c.plan, c]));
  const rowsFor = (plan: string) => {
    const ent = byPlan.get(plan)?.entitlements ?? null;
    return ent ? entitlementRows(ent) : null;
  };
  const free = rowsFor("FREE");
  const gold = rowsFor("GOLD");
  const platinum = rowsFor("PLATINUM");

  // A ordem/rotulo das linhas sao os do helper — a tela nao reordena nem
  // renomeia nada que o contrato define.
  const skeleton = free ?? gold ?? platinum;
  if (!skeleton) return [];

  return skeleton.map((row, i) => {
    const copy = ROW_COPY[row.label] ?? { icon: "•", desc: "" };
    return {
      label: row.label,
      icon: copy.icon,
      desc: copy.desc,
      free: free?.[i]?.value ?? null,
      gold: gold?.[i]?.value ?? null,
      platinum: platinum?.[i]?.value ?? null,
    };
  });
}

export default function BeneficiosPage() {
  // Tier ativo real (myDatingEntitlements). Fail-closed → "free".
  const [currentTier, setCurrentTier] = useState<Tier>("free");
  const [rows, setRows] = useState<MatrixRow[]>([]);
  const [boostItem, setBoostItem] = useState<DatingPlanCatalogItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [catalogDegraded, setCatalogDegraded] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [ent, cat] = await Promise.all([
        loadMyEntitlements(),
        loadPlansCatalog(),
      ]);
      if (!alive) return;
      const plan = ent.data.plan?.toLowerCase();
      setCurrentTier(plan === "gold" || plan === "platinum" ? plan : "free");
      setRows(buildMatrix(cat.data));
      setBoostItem(cat.data.find((c) => c.plan === "BOOST") ?? null);
      setCatalogDegraded(cat.degraded);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const colClass = (tier: Tier) =>
    `p-3 rounded-lg text-center ${
      currentTier === tier
        ? "bg-fuchsia-50 dark:bg-fuchsia-950/20 border border-fuchsia-200 dark:border-fuchsia-900/30"
        : "bg-muted/30"
    }`;

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

      {catalogDegraded && !loading && (
        <div className="mb-6 text-xs p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-amber-800 dark:text-amber-300">
          Nao consegui ler o catalogo ao vivo agora — a tabela abaixo e a
          canonica deste app. Confirme os limites na tela de planos antes de
          assinar.
        </div>
      )}

      {loading ? (
        <div className="space-y-3" role="status" aria-live="polite">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-32 rounded-lg border border-border bg-muted/30 animate-pulse"
            />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="p-8 text-center rounded-lg border border-dashed border-border">
          <p className="font-medium">Comparativo indisponivel</p>
          <p className="text-sm text-muted-foreground mt-1">
            O catalogo nao devolveu os beneficios de nenhum plano. Prefiro nao
            mostrar uma tabela do que mostrar uma errada — os precos e o que
            cada plano inclui estao na tela de planos.
          </p>
          <Link
            href="/premium"
            className="inline-block mt-4 px-5 py-2 rounded-lg bg-fuchsia-600 text-white text-sm font-medium hover:bg-fuchsia-700"
          >
            Ver planos
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((b) => (
            <div
              key={b.label}
              className="p-5 rounded-lg border border-border bg-card"
            >
              <div className="flex items-start gap-4 mb-4">
                <span className="text-3xl" aria-hidden>
                  {b.icon}
                </span>
                <div>
                  <h3 className="font-semibold">{b.label}</h3>
                  {b.desc && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {b.desc}
                    </p>
                  )}
                  {/* Duracao do Boost: a descricao vem do proprio item do
                      catalogo, nao de um numero escrito nesta pagina. */}
                  {b.label === "Boost por mes" && boostItem && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {boostItem.label}: {boostItem.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className={colClass("free")}>
                  <p className="text-xs text-muted-foreground uppercase">
                    Free
                  </p>
                  <p className="font-semibold text-sm mt-1">
                    {cellText(b.free)}
                  </p>
                </div>
                <div className={colClass("gold")}>
                  <p className="text-xs text-muted-foreground uppercase">
                    Gold
                  </p>
                  <p className="font-semibold text-sm mt-1">
                    {cellText(b.gold)}
                  </p>
                </div>
                <div className={colClass("platinum")}>
                  <p className="text-xs text-muted-foreground uppercase">
                    Platinum
                  </p>
                  <p className="font-semibold text-sm mt-1">
                    {cellText(b.platinum)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 p-6 rounded-2xl bg-gradient-to-br from-fuchsia-600 to-rose-500 text-white text-center">
        <h2 className="text-xl font-bold">Quer ver quem ja te curtiu?</h2>
        <p className="text-sm mt-2 opacity-90">
          Os planos pagos liberam a lista de quem curtiu seu perfil.
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
