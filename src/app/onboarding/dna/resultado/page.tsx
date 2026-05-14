/**
 * Onboarding DNA — Resultado.
 * Wave: DNA-30 · feat/ot-r-dna-30-perguntas-onboarding-2026-05-14
 *
 * Mostra os 5 traits computados (Big Five) com barras horizontais.
 * Linka pra /buscar onde o feed ja vai usar match score baseado em DNA.
 */

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DNA_DIMENSION_LABELS, type DnaDimension } from "@/lib/dna-questions";
import { gqlRequest, GqlClientError } from "@/lib/gql-client";

const MY_DNA_QUERY = /* GraphQL */ `
  query MyDNA {
    myDNA {
      id
      computedTraits
      completedAt
    }
  }
`;

interface MyDnaResponse {
  myDNA: {
    id: string;
    computedTraits: Record<DnaDimension, number>;
    completedAt: string;
  } | null;
}

const DIMENSION_DESCRIPTIONS: Record<DnaDimension, string> = {
  OPENNESS:
    "Curiosidade, criatividade, abertura pra experiências novas. Pesa em compatibilidade pra parceiros que curtem viagens, arte, ideias.",
  CONSCIENTIOUSNESS:
    "Organização, disciplina, foco em objetivos. Pesa em compatibilidade pra parceiros que valorizam planejamento e responsabilidade.",
  EXTRAVERSION:
    "Sociabilidade, energia, prazer em estar com pessoas. Define se você curte parceiros pra noites animadas ou pra noites quietas.",
  AGREEABLENESS:
    "Empatia, cooperação, paciência. Indicador chave de compatibilidade em conflito — empatas se encontram.",
  NEUROTICISM:
    "Estabilidade emocional (escala invertida — quanto menor, mais estável). Define se você lida bem ou mal com pressão e mudanças.",
};

export default function DnaResultadoPage() {
  const [loading, setLoading] = useState(true);
  const [traits, setTraits] = useState<Record<DnaDimension, number> | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await gqlRequest<MyDnaResponse>(MY_DNA_QUERY);
        if (cancelled) return;
        if (!data.myDNA) {
          setError(
            "Você ainda não respondeu o questionário. Comece pelo onboarding.",
          );
          setLoading(false);
          return;
        }
        setTraits(data.myDNA.computedTraits);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof GqlClientError) {
          setError(err.message);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Erro ao carregar seu DNA.");
        }
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen px-6 py-12">
        <div className="max-w-2xl mx-auto">
          <p className="text-zinc-400" aria-live="polite">
            Calculando seu DNA...
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen px-6 py-12">
        <div className="max-w-2xl mx-auto space-y-4">
          <div
            role="alert"
            className="rounded-lg border border-red-700/50 bg-red-950/20 p-4 text-sm text-red-300"
          >
            {error}
          </div>
          <Link
            href="/onboarding/dna"
            className="inline-block px-5 py-3 rounded-lg bg-fuchsia-600 text-white"
          >
            Refazer questionário
          </Link>
        </div>
      </main>
    );
  }

  if (!traits) return null;

  const dims: DnaDimension[] = [
    "OPENNESS",
    "CONSCIENTIOUSNESS",
    "EXTRAVERSION",
    "AGREEABLENESS",
    "NEUROTICISM",
  ];

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="max-w-2xl mx-auto space-y-8">
        <header className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Seu DNA</h1>
          <p className="text-zinc-400">
            Os 5 traços que vão pesar nos seus matches.
          </p>
        </header>

        <ul className="space-y-5">
          {dims.map((d) => {
            const v = traits[d] ?? 0;
            const pct = Math.round(v * 100);
            return (
              <li key={d} className="space-y-2">
                <div className="flex justify-between items-baseline">
                  <h2 className="font-semibold">{DNA_DIMENSION_LABELS[d]}</h2>
                  <span className="text-sm text-fuchsia-300 font-mono">
                    {pct}%
                  </span>
                </div>
                <div
                  role="meter"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pct}
                  aria-label={`${DNA_DIMENSION_LABELS[d]}: ${pct}%`}
                  className="h-3 rounded-full bg-zinc-800 overflow-hidden"
                >
                  <div
                    className="h-full bg-gradient-to-r from-fuchsia-600 to-purple-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-sm text-zinc-400">
                  {DIMENSION_DESCRIPTIONS[d]}
                </p>
              </li>
            );
          })}
        </ul>

        <div className="flex gap-3 pt-4">
          <Link
            href="/onboarding/dna"
            className="px-5 py-3 rounded-lg border border-zinc-700 text-zinc-200 hover:bg-zinc-900 transition-colors"
          >
            Refazer
          </Link>
          <Link
            href="/buscar"
            className="px-6 py-3 rounded-lg bg-fuchsia-600 text-white font-medium hover:bg-fuchsia-700 transition-colors"
          >
            Ver matches compatíveis
          </Link>
        </div>
      </div>
    </main>
  );
}
