// Relacionamentos — Perfil (dashboard view)
// N100 (2026-06-04): wireado ao backend real. myMatchProfile (gateway federado)
// é a fonte de verdade — zero localStorage. Mostra preview do que aparece pros
// matches: foto, nome, idade, cidade, bio, prompts, interesses + completude.

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SUBVERTICALS } from "@/lib/subverticals";
import { gqlRequest, GqlClientError } from "@/lib/gql-client";

type Prompt = { question: string; answer: string };
type Photo = { id: string; url: string; isPrimary: boolean; position: number };

type MyMatchProfile = {
  id: string;
  profileId: string;
  displayName?: string | null;
  bio?: string | null;
  declaredAge?: number | null;
  city?: string | null;
  interestedIn?: string[] | null;
  interests?: string[] | null;
  prompts?: Prompt[] | null;
  photos?: Photo[] | null;
  completeness?: number | null;
  verified?: boolean | null;
  premium?: boolean | null;
};

const MY_MATCH_PROFILE = /* GraphQL */ `
  query MyMatchProfile {
    myMatchProfile {
      id
      profileId
      displayName
      bio
      declaredAge
      city
      interestedIn
      interests
      prompts { question answer }
      photos { id url isPrimary position }
      completeness
      verified
      premium
    }
  }
`;

export default function PerfilPage() {
  const [profile, setProfile] = useState<MyMatchProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await gqlRequest<{ myMatchProfile: MyMatchProfile | null }>(
          MY_MATCH_PROFILE,
        );
        if (alive) setProfile(data.myMatchProfile);
      } catch (e) {
        if (alive)
          setError(
            e instanceof GqlClientError
              ? e.message
              : "Não foi possível carregar seu perfil.",
          );
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const interestChips = (profile?.interests ?? []).map((slug) => {
    const sv = SUBVERTICALS.find((s) => s.slug === slug);
    return { slug, label: sv ? sv.label : slug, emoji: sv ? sv.emoji : "•" };
  });

  // TELA QUE MENTE (corrigido): era `profile?.completeness ?? 0`, e o bloco de
  // completude renderiza ACIMA dos estados de loading/erro/vazio. Enquanto
  // carregava, e principalmente quando a query FALHAVA, a tela afirmava
  // "Completude do perfil: 0%" com a barra zerada pra quem tem o perfil
  // cheio. Sem numero confirmado o bloco nao mostra numero nenhum.
  const completeness =
    typeof profile?.completeness === "number" ? profile.completeness : null;
  const coverPhoto =
    profile?.photos?.find((p) => p.isPrimary)?.url ??
    profile?.photos?.[0]?.url ??
    null;

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Meu perfil</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Preview do que aparece pros matches.
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link
            href="/perfil/editar"
            className="px-3 py-1.5 rounded-lg bg-fuchsia-600 text-white hover:bg-fuchsia-700"
          >
            Editar
          </Link>
          <Link
            href="/perfil/verificar"
            className="px-3 py-1.5 rounded-lg border border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/30"
          >
            ✓ Verificar
          </Link>
        </div>
      </header>

      {/* Completeness */}
      <section className="mb-6 p-4 rounded-xl border border-border bg-muted/30">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            {completeness != null
              ? `Completude do perfil: ${completeness}%`
              : loading
                ? "Completude do perfil: calculando..."
                : "Completude do perfil: nao disponivel"}
          </span>
          {/* TELA QUE MENTE (corrigido): dizia "Perfil completo recebe ate 3x
              mais matches". O "3x" nao sai de medicao nenhuma — nao ha metrica
              de conversao por completude neste app, e completude nem sequer e
              fator do ranking (os pesos reais estao em /admin/algoritmo:
              diversidade, subvertical, mesmo evento, premium, perfil novo,
              decaimento de visto, atividade — completude nao esta la). Ficou a
              frase que e verdadeira por construcao: e o que os outros veem. */}
          <span className="text-xs text-muted-foreground">
            E isto que os outros veem do seu perfil
          </span>
        </div>
        {completeness != null ? (
          <div
            className="h-2 rounded-full bg-muted overflow-hidden"
            role="progressbar"
            aria-valuenow={completeness}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full bg-fuchsia-600 transition-all"
              style={{ width: `${completeness}%` }}
            />
          </div>
        ) : (
          <div className="h-2 rounded-full bg-muted overflow-hidden" />
        )}
      </section>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Carregando perfil...
        </div>
      ) : error ? (
        <div className="text-center py-12 border border-red-200 dark:border-red-900/50 rounded-2xl bg-red-50/50 dark:bg-red-950/20">
          <p className="text-3xl mb-2">⚠️</p>
          <p className="font-medium">Erro ao carregar perfil</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
      ) : !profile || !profile.displayName ? (
        <div className="text-center py-12 border border-border rounded-2xl bg-muted/30">
          <p className="text-3xl mb-2">👤</p>
          <p className="font-medium">Voce ainda nao montou seu perfil</p>
          <p className="text-sm text-muted-foreground mt-1">
            Comece adicionando nome, fotos, bio e prompts.
          </p>
          <Link
            href="/perfil/editar"
            className="inline-block mt-4 px-5 py-2 rounded-lg bg-fuchsia-600 text-white font-medium hover:bg-fuchsia-700"
          >
            Criar perfil
          </Link>
        </div>
      ) : (
        <article className="rounded-2xl border border-border overflow-hidden">
          <div className="h-56 bg-gradient-to-br from-fuchsia-300 via-rose-300 to-amber-300 dark:from-fuchsia-900/40 dark:via-rose-900/40 dark:to-amber-900/40 flex items-center justify-center">
            {coverPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverPhoto}
                alt={profile.displayName ?? "Foto de perfil"}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-7xl opacity-30">👤</span>
            )}
          </div>
          <div className="p-6 space-y-4">
            <header>
              <h2 className="text-2xl font-semibold flex items-center gap-2">
                {profile.displayName}
                {profile.declaredAge ? (
                  <span className="text-muted-foreground">
                    , {profile.declaredAge}
                  </span>
                ) : null}
                {profile.verified ? (
                  <span
                    className="text-blue-500 text-base"
                    title="Perfil verificado"
                  >
                    ✓
                  </span>
                ) : null}
                {profile.premium ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                    Premium
                  </span>
                ) : null}
              </h2>
              {profile.city && (
                <p className="text-sm text-muted-foreground">{profile.city}</p>
              )}
            </header>

            {profile.bio && (
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {profile.bio}
              </p>
            )}

            {/* Galeria de fotos */}
            {profile.photos && profile.photos.length > 1 && (
              <div className="grid grid-cols-3 gap-2">
                {profile.photos.slice(1).map((p) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={p.id}
                    src={p.url}
                    alt="Foto"
                    className="aspect-square w-full object-cover rounded-lg border border-border"
                  />
                ))}
              </div>
            )}

            {profile.prompts && profile.prompts.length > 0 && (
              <div className="space-y-3">
                {profile.prompts
                  .filter((p) => p.answer.trim())
                  .map((p, i) => (
                    <div
                      key={`${p.question}-${i}`}
                      className="rounded-lg border border-border p-3 bg-muted/30"
                    >
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        {p.question}
                      </p>
                      <p className="text-sm">{p.answer}</p>
                    </div>
                  ))}
              </div>
            )}

            {interestChips.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Interesses
                </p>
                <div className="flex flex-wrap gap-2">
                  {interestChips.map((it) => (
                    <span
                      key={it.slug}
                      className="text-xs bg-muted px-2 py-1 rounded-full"
                    >
                      {it.emoji} {it.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </article>
      )}
    </main>
  );
}
