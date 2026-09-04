// Relacionamentos — UserSidebarRight (M8 sprint)
// CEO order (OT-LEGACY-MIGRATION-MASTER-PLAN-2026-05-02): relacionamentos NAO
// tem admin tradicional. Modelo eh "catalogo de empresas/coaches B2B2C com
// sidebar usuario direita + camaleao a esquerda".
//
// Status: sticky right-aligned sidebar para rotas autenticadas.
//
// 2026-09-04 — CONTADOR QUE NAO CONTAVA. Ate aqui as tres linhas de "Status"
// eram os literais 0, 0 e 0 no JSX, atras de um "TODO: W-R-2 GraphQL
// myMatches". Nao era componente isolado: AppShell.tsx e importado por
// src/app/layout.tsx, entao os tres zeros renderizavam em TODA rota nao
// publica — o usuario com 4 matches lia "Matches ativos 0". Numero fixo que
// se apresenta como metrica e mentira sobre estado, nao placeholder.
//
// Agora as tres saem do gateway federado, na mesma via do resto do app
// (gqlRequest -> /api/graphql, cookie do usuario):
//   Curtidas hoje    -> myLikes (profile-extras.resolver.ts:263), filtrado
//                       por createdAt >= meia-noite local.
//   Matches ativos   -> myMatches (match.resolver.ts:58), sem limite.
//   Conversas abertas-> myConversations (rollout-6.resolver.ts:91), contando
//                       so as que nao estao arquivadas nem bloqueadas.
//
// JANELA: myLikes e myConversations tem limit maximo 100 no backend
// (MyLikesFilterSchema:51, MyConversationsSchema:25). Quando a janela satura,
// o numero sai com "+" — 100+ e verdade, 100 seco seria chute.
//
// ESTADOS: enquanto carrega mostra "…", nunca 0. Sem sessao/erro o bloco todo
// vira uma linha honesta com link de login em vez de metrica inventada.
//
// PERFIL: o bloco de identidade tambem parou de ser placeholder — nome, idade
// e cidade vem de myMatchProfile. Sem perfil criado, o CTA e criar o perfil.
//
// TOGGLES: "Visivel publicamente" grava de verdade via setDatingParticipation
// (profile-extras.resolver.ts:727) — e o opt-in que o discovery.service.ts:351
// exige pra te por no pool. O switch "Notificacoes" SAIU: nao existe mutation
// de preferencia de notificacao em apps/relacionamentos, entao ele era um
// controle que nunca salvou. Zero-mock: controle sem backend nao fica na tela.
//
// IMPORTANTE (fix probe r31): nada de "Carregando..." perene. Todo caminho do
// fetch resolve (try/catch), entao o estado assenta e o probe de hydration do
// shell nao classifica a rota como hydration_timeout.

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { gqlRequest } from "@/lib/gql-client";

const WINDOW_LIMIT = 100;

const SUMMARY_QUERY = /* GraphQL */ `
  query UserSidebarSummary($window: Int!) {
    myMatchProfile {
      id
      displayName
      city
      declaredAge
      participatesInDating
    }
    myMatches {
      id
    }
    myLikes(input: { limit: $window }) {
      id
      createdAt
    }
    myConversations(input: { limit: $window }) {
      id
      archivedAt
      blockedAt
    }
  }
`;

const SET_PARTICIPATION = /* GraphQL */ `
  mutation SetDatingParticipation($participate: Boolean!) {
    setDatingParticipation(participate: $participate)
  }
`;

interface SummaryProfile {
  id: string;
  displayName: string | null;
  city: string | null;
  declaredAge: number | null;
  participatesInDating: boolean | null;
}

interface SummaryConversation {
  id: string;
  archivedAt: string | null;
  blockedAt: string | null;
}

interface SummaryData {
  myMatchProfile: SummaryProfile | null;
  myMatches: { id: string }[] | null;
  myLikes: { id: string; createdAt: string }[] | null;
  myConversations: SummaryConversation[] | null;
}

/** Contagem + se a janela do backend saturou (numero real e >= o mostrado). */
interface Counted {
  value: number;
  atLeast: boolean;
}

type LoadState = "loading" | "ready" | "error";

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Likes DADOS hoje. A janela traz os 100 mais recentes em ordem decrescente:
 * se algum deles ja e de ontem, o corte de hoje esta inteiro dentro dela e a
 * contagem e exata. So quando os 100 sao de hoje o total real pode ser maior.
 */
export function countLikesToday(
  likes: { createdAt: string }[] | null,
): Counted {
  const list = likes ?? [];
  const floor = startOfToday();
  const today = list.filter((l) => {
    const t = new Date(l.createdAt).getTime();
    return !Number.isNaN(t) && t >= floor;
  }).length;
  return { value: today, atLeast: today >= WINDOW_LIMIT };
}

/**
 * Conversas abertas = nem arquivada nem bloqueada. Se a janela veio cheia,
 * pode haver conversa aberta fora dela — o numero sai como "N+".
 */
export function countOpenConversations(
  conversations: SummaryConversation[] | null,
): Counted {
  const list = conversations ?? [];
  const open = list.filter(
    (c) => c.archivedAt == null && c.blockedAt == null,
  ).length;
  return { value: open, atLeast: list.length >= WINDOW_LIMIT };
}

function formatCount(c: Counted): string {
  return c.atLeast ? `${c.value}+` : String(c.value);
}

interface UserSidebarRightProps {
  className?: string;
}

export function UserSidebarRight({ className }: UserSidebarRightProps) {
  const [state, setState] = useState<LoadState>("loading");
  const [data, setData] = useState<SummaryData | null>(null);
  const [visibility, setVisibility] = useState<boolean | null>(null);
  const [savingVisibility, setSavingVisibility] = useState(false);
  const [visibilityError, setVisibilityError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await gqlRequest<SummaryData>(SUMMARY_QUERY, {
          window: WINDOW_LIMIT,
        });
        if (cancelled) return;
        setData(res);
        setVisibility(res.myMatchProfile?.participatesInDating ?? null);
        setState("ready");
      } catch {
        if (cancelled) return;
        // Sem sessao (ou gateway fora): estado honesto, sem numero fake.
        setState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleVisibility = useCallback(
    async (next: boolean) => {
      setSavingVisibility(true);
      setVisibilityError(null);
      const previous = visibility;
      setVisibility(next);
      try {
        const res = await gqlRequest<{ setDatingParticipation: boolean }>(
          SET_PARTICIPATION,
          { participate: next },
        );
        // O resolver devolve o valor EFETIVAMENTE persistido: false sem gravar
        // nada quando o RelationshipProfile ainda nao existe.
        if (res.setDatingParticipation !== next) {
          setVisibility(res.setDatingParticipation);
          setVisibilityError(
            "Crie seu perfil antes de mudar a visibilidade.",
          );
        }
      } catch {
        setVisibility(previous);
        setVisibilityError("Nao deu pra salvar. Tente de novo.");
      } finally {
        setSavingVisibility(false);
      }
    },
    [visibility],
  );

  const profile = data?.myMatchProfile ?? null;
  const likesToday = countLikesToday(data?.myLikes ?? null);
  const openChats = countOpenConversations(data?.myConversations ?? null);
  const matches = data?.myMatches?.length ?? 0;

  const metric = (label: string, text: string) => (
    <div className="flex justify-between">
      <span className="text-[hsl(var(--muted-foreground))]">{label}</span>
      <span className="font-medium">{text}</span>
    </div>
  );

  return (
    <aside
      className={`sticky top-4 right-0 w-72 h-[calc(100vh-2rem)] p-4 bg-[hsl(var(--muted))]/50 backdrop-blur-md rounded-l-xl border-l border-[hsl(var(--border))] animate-in slide-in-from-right duration-300 ${className ?? ""}`}
      aria-label="Painel do usuario"
    >
      <div className="space-y-6 overflow-y-auto h-full pr-1">
        {/* Section: Perfil quick info */}
        <section>
          <h3 className="text-sm font-semibold mb-2">Meu Perfil</h3>
          <div className="text-xs text-[hsl(var(--muted-foreground))]">
            {state === "loading" && <span>Carregando seus dados…</span>}
            {state === "error" && (
              <span>Entre na sua conta para ver seus dados.</span>
            )}
            {state === "ready" && profile && (
              <span>
                {profile.displayName ?? "Perfil sem nome"}
                {profile.declaredAge != null && `, ${profile.declaredAge}`}
                {profile.city && ` · ${profile.city}`}
              </span>
            )}
            {state === "ready" && !profile && (
              <span>Voce ainda nao criou seu perfil de namoro.</span>
            )}
          </div>
          <Link
            href={state === "ready" && !profile ? "/onboarding" : "/perfil"}
            className="mt-2 inline-block text-xs text-fuchsia-600 hover:underline"
          >
            {state === "ready" && !profile
              ? "Criar perfil →"
              : "Editar perfil →"}
          </Link>
        </section>

        {/* Section: Status match — numeros do gateway, nunca literais */}
        <section>
          <h3 className="text-sm font-semibold mb-2">Status</h3>
          {state === "error" ? (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Seu resumo aparece depois do login.
            </p>
          ) : (
            <div className="space-y-1 text-xs">
              {metric(
                "Curtidas hoje",
                state === "loading" ? "…" : formatCount(likesToday),
              )}
              {metric(
                "Matches ativos",
                state === "loading" ? "…" : String(matches),
              )}
              {metric(
                "Conversas abertas",
                state === "loading" ? "…" : formatCount(openChats),
              )}
            </div>
          )}
        </section>

        {/* Section: Favoritos (REL-S6) — acesso rapido as listas do usuario */}
        <section>
          <h3 className="text-sm font-semibold mb-2">Favoritos</h3>
          <Link
            href="/favoritos"
            className="flex items-center gap-2 text-xs text-fuchsia-600 hover:underline"
          >
            ⭐ Minhas listas de pessoas →
          </Link>
        </section>

        {/* Section: Preferencias — so o que grava de verdade */}
        <section>
          <h3 className="text-sm font-semibold mb-2">Preferencias</h3>
          <div className="space-y-2 text-xs">
            <label className="flex items-center justify-between cursor-pointer">
              <span>Visivel no discovery</span>
              <input
                type="checkbox"
                checked={visibility === true}
                disabled={state !== "ready" || savingVisibility}
                onChange={(e) => void toggleVisibility(e.target.checked)}
                className="rounded accent-fuchsia-600 disabled:opacity-40"
                aria-label="Alternar participacao no discovery"
              />
            </label>
          </div>
          {visibilityError && (
            <p className="mt-2 text-[10px] text-rose-600">{visibilityError}</p>
          )}
          <p className="mt-2 text-[10px] text-[hsl(var(--muted-foreground))]">
            Desligado, seu perfil sai do feed de quem procura.
          </p>
        </section>

        {/* Section: Privacy */}
        <section>
          <h3 className="text-sm font-semibold mb-2">Privacidade</h3>
          <div className="space-y-1">
            <Link
              href="/perfil"
              className="block text-xs text-fuchsia-600 hover:underline"
            >
              Gerenciar privacidade →
            </Link>
            <Link
              href="/admin/seguranca"
              className="block text-xs text-fuchsia-600 hover:underline"
            >
              Seguranca da conta →
            </Link>
          </div>
        </section>
      </div>
    </aside>
  );
}
