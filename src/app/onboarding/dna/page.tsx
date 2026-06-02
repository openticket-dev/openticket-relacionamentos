/**
 * Onboarding DNA — 30 perguntas Big Five expandido (paginado 5 por tela).
 * Wave: DNA-30 · feat/ot-r-dna-30-perguntas-onboarding-2026-05-14
 *
 * Fluxo:
 *  1. /onboarding/dna -> consent screen
 *  2. 6 telas (5 perguntas cada) -> progress bar + a11y aria-label
 *  3. Submit -> POST graphql submitDNA -> redirect /onboarding/dna/resultado
 *
 * A11y:
 *  - Cada Likert e fieldset+legend (radio group semanticamente correto)
 *  - aria-valuemax/now/min na progress bar
 *  - Botoes voltar/avancar com aria-label explicito
 *  - Foco automatico no primeiro radio de cada pagina
 *  - Keyboard: 1-5 setam resposta da pergunta com foco
 */

"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DNA_QUESTIONS,
  DNA_DIMENSION_LABELS,
  QUESTIONS_PER_PAGE,
  TOTAL_PAGES,
  type DnaDimension,
} from "@/lib/dna-questions";
import { gqlRequest, GqlClientError } from "@/lib/gql-client";

type AnswerMap = Record<string, number>;

const SUBMIT_DNA_MUTATION = /* GraphQL */ `
  mutation SubmitDNA($input: SubmitDNAInput!) {
    submitDNA(input: $input) {
      id
      profileId
      computedTraits
      completedAt
    }
  }
`;

function pageQuestions(page: number) {
  const start = page * QUESTIONS_PER_PAGE;
  return DNA_QUESTIONS.slice(start, start + QUESTIONS_PER_PAGE);
}

const LIKERT_LABELS: { value: number; label: string }[] = [
  { value: 1, label: "Discordo totalmente" },
  { value: 2, label: "Discordo" },
  { value: 3, label: "Neutro" },
  { value: 4, label: "Concordo" },
  { value: 5, label: "Concordo totalmente" },
];

export default function DnaOnboardingPage() {
  const router = useRouter();
  const [consentGiven, setConsentGiven] = useState(false);
  const [page, setPage] = useState(-1); // -1 = consent screen
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstRadioRef = useRef<HTMLInputElement | null>(null);

  // Pagina alterada: foco no primeiro radio
  useEffect(() => {
    if (page >= 0 && firstRadioRef.current) {
      firstRadioRef.current.focus();
    }
  }, [page]);

  const currentQuestions = page >= 0 ? pageQuestions(page) : [];
  const answeredOnPage = currentQuestions.filter((q) => answers[q.id]).length;
  const canAdvance = answeredOnPage === currentQuestions.length;
  const isLastPage = page === TOTAL_PAGES - 1;
  const totalAnswered = Object.keys(answers).length;
  const overallProgress = page < 0 ? 0 : Math.round((totalAnswered / 30) * 100);

  function setAnswer(questionId: string, value: number) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  // Keyboard: 1-5 setam resposta da pergunta com foco
  function handleKeyDown(e: React.KeyboardEvent<HTMLFieldSetElement>, qid: string) {
    const num = parseInt(e.key, 10);
    if (num >= 1 && num <= 5) {
      e.preventDefault();
      setAnswer(qid, num);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const answersInput = Object.entries(answers).map(([qid, v]) => ({
        questionId: qid,
        value: v,
      }));
      if (answersInput.length !== 30) {
        throw new Error(`Precisa de 30 respostas. Voce respondeu ${answersInput.length}.`);
      }
      await gqlRequest(SUBMIT_DNA_MUTATION, {
        input: { answers: answersInput, consentGranted: true },
      });
      router.push("/onboarding/dna/resultado");
    } catch (err) {
      if (err instanceof GqlClientError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Erro desconhecido ao salvar suas respostas.");
      }
      setSubmitting(false);
    }
  }

  // ---- CONSENT SCREEN ----
  if (page === -1) {
    return (
      <main className="min-h-screen px-6 py-12">
        <div className="max-w-2xl mx-auto space-y-6">
          <h1 className="text-4xl font-bold tracking-tight">
            Conheça seu DNA de relacionamento
          </h1>
          <p className="text-lg text-muted-foreground">
            30 perguntas, 5 minutos. A gente usa suas respostas pra calcular
            compatibilidade real com outros perfis — baseado em ciência (Big
            Five expandido).
          </p>

          <div className="rounded-lg border border-fuchsia-700/40 bg-fuchsia-950/20 p-5 space-y-3">
            <h2 className="font-semibold text-fuchsia-300">
              O que você precisa saber (LGPD)
            </h2>
            <ul className="text-sm space-y-2 text-fuchsia-100/80 list-disc pl-5">
              <li>Suas respostas individuais ficam privadas — ninguem ve.</li>
              <li>
                A gente computa 5 dimensões agregadas (abertura, organização,
                extroversão, empatia, estabilidade emocional) e USA só esses
                números pra match.
              </li>
              <li>
                Personalidade é dado sensível (LGPD Art. 11). Pedimos consent
                explícito antes de guardar.
              </li>
              <li>
                Você pode revogar e deletar tudo a qualquer hora em
                /perfil/editar.
              </li>
            </ul>
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consentGiven}
              onChange={(e) => setConsentGiven(e.target.checked)}
              className="mt-1.5 size-5"
              aria-label="Concordo com o processamento de dados de personalidade"
            />
            <span className="text-sm">
              Concordo com o processamento dos meus dados de personalidade pra
              calcular compatibilidade nos matches. Entendi que posso revogar
              esse consentimento a qualquer momento.
            </span>
          </label>

          <div className="flex gap-3 pt-2">
            <Link
              href="/landing"
              className="px-5 py-3 rounded-lg border border-[#2a2342] text-[#ece9f5] hover:bg-[#13101f] transition-colors"
            >
              Agora não
            </Link>
            <button
              type="button"
              disabled={!consentGiven}
              onClick={() => setPage(0)}
              className="px-6 py-3 rounded-lg bg-fuchsia-600 text-white font-medium hover:bg-fuchsia-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Começar (5 min)
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ---- QUESTION SCREENS ----
  return (
    <main className="min-h-screen px-6 py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-[#9a93b5]">
            <span>
              Tela {page + 1} de {TOTAL_PAGES}
            </span>
            <span>{overallProgress}% completo</span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={overallProgress}
            aria-label="Progresso do questionário"
            className="h-2 rounded-full bg-[#2a2342] overflow-hidden"
          >
            <div
              className="h-full bg-fuchsia-500 transition-all"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>

        {/* Questions */}
        <ol className="space-y-8" start={page * QUESTIONS_PER_PAGE + 1}>
          {currentQuestions.map((q, idxInPage) => {
            const globalIdx = page * QUESTIONS_PER_PAGE + idxInPage + 1;
            return (
              <li key={q.id} className="space-y-3">
                <fieldset
                  className="space-y-3"
                  onKeyDown={(e) => handleKeyDown(e, q.id)}
                >
                  <legend className="space-y-1">
                    <span className="text-xs text-fuchsia-400 font-mono">
                      {globalIdx}/30 · {DNA_DIMENSION_LABELS[q.dimension]}
                    </span>
                    <span className="block text-lg font-medium">{q.text}</span>
                  </legend>

                  <div
                    role="radiogroup"
                    aria-label={`Resposta para ${q.text}`}
                    className="grid grid-cols-5 gap-2"
                  >
                    {LIKERT_LABELS.map((opt, optIdx) => {
                      const selected = answers[q.id] === opt.value;
                      return (
                        <label
                          key={opt.value}
                          className={`flex flex-col items-center gap-1 p-3 rounded-lg border cursor-pointer transition-colors ${
                            selected
                              ? "border-fuchsia-500 bg-fuchsia-950/40"
                              : "border-[#2a2342] hover:border-[#6f6790]"
                          }`}
                        >
                          <input
                            ref={
                              idxInPage === 0 && optIdx === 0
                                ? firstRadioRef
                                : null
                            }
                            type="radio"
                            name={q.id}
                            value={opt.value}
                            checked={selected}
                            onChange={() => setAnswer(q.id, opt.value)}
                            className="sr-only"
                            aria-label={opt.label}
                          />
                          <span className="text-xl font-bold">{opt.value}</span>
                          <span className="text-[10px] text-center text-[#9a93b5] leading-tight">
                            {opt.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              </li>
            );
          })}
        </ol>

        {/* Error */}
        {error ? (
          <div
            role="alert"
            className="rounded-lg border border-red-700/50 bg-red-950/20 p-4 text-sm text-red-300"
          >
            {error}
          </div>
        ) : null}

        {/* Nav */}
        <div className="flex justify-between gap-3 pt-4">
          <button
            type="button"
            onClick={() => {
              if (page === 0) setPage(-1);
              else setPage(page - 1);
            }}
            disabled={submitting}
            className="px-5 py-3 rounded-lg border border-[#2a2342] text-[#ece9f5] hover:bg-[#13101f] transition-colors disabled:opacity-40"
            aria-label="Voltar"
          >
            Voltar
          </button>
          {!isLastPage ? (
            <button
              type="button"
              disabled={!canAdvance || submitting}
              onClick={() => setPage(page + 1)}
              className="px-6 py-3 rounded-lg bg-fuchsia-600 text-white font-medium hover:bg-fuchsia-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Avançar para próxima tela"
            >
              Avançar ({answeredOnPage}/{currentQuestions.length})
            </button>
          ) : (
            <button
              type="button"
              disabled={!canAdvance || submitting || totalAnswered !== 30}
              onClick={handleSubmit}
              className="px-6 py-3 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Finalizar questionário"
            >
              {submitting
                ? "Salvando..."
                : `Finalizar (${totalAnswered}/30)`}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
