// Relacionamentos — Verificacao de perfil (anti-fake)
// Sprint M8-1 → wire real: fluxo verificacao via Datavalid (CPF + selfie).
// Backend: submitDatavalidVerification(input:{cpf,selfieBase64}) — subgraph
// relacionamentos, ja em origin/staging. Datavalid (SERPRO) faz o match
// CPF-vs-selfie + liveness do lado dele; a UI so coleta CPF + 1 selfie real.
// Zero mock: a selfie e uma imagem real (base64), a chamada e a mutation real.

"use client";

import Link from "next/link";
import { useState } from "react";
import { gqlRequest, GqlClientError } from "@/lib/gql-client";

type Step = "intro" | "cpf" | "selfie" | "review" | "done";

type VerifyState = {
  step: Step;
  cpf: string;
  /** Selfie real capturada, base64 SEM prefixo data-URI (formato do backend). */
  selfieBase64: string | null;
  /** Data-URI da selfie, so pra preview local. */
  selfiePreview: string | null;
  errors: string[];
};

// submitDatavalidVerification — retorna SubmitVerificationResult { ok, verificationId, status }.
// status: 'APPROVED' quando Datavalid confirma; 'REJECTED' quando nao bate / liveness falha.
const SUBMIT_DATAVALID = /* GraphQL */ `
  mutation SubmitDatavalidVerification($input: SubmitDatavalidVerificationInput!) {
    submitDatavalidVerification(input: $input) {
      ok
      status
      verificationId
    }
  }
`;

type DatavalidResult = {
  ok: boolean;
  status?: string | null;
  verificationId?: string | null;
};

const INITIAL: VerifyState = {
  step: "intro",
  cpf: "",
  selfieBase64: null,
  selfiePreview: null,
  errors: [],
};

function maskCpf(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

function isValidCpfFormat(cpf: string): boolean {
  return cpf.replace(/\D/g, "").length === 11;
}

/** Le um File de imagem e devolve { dataUri, base64 } (base64 sem o prefixo). */
function readImageAsBase64(
  file: File,
): Promise<{ dataUri: string; base64: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Falha ao ler a imagem."));
    reader.onload = () => {
      const dataUri = String(reader.result || "");
      const comma = dataUri.indexOf(",");
      const base64 = comma >= 0 ? dataUri.slice(comma + 1) : "";
      if (!base64) {
        reject(new Error("Imagem vazia."));
        return;
      }
      resolve({ dataUri, base64 });
    };
    reader.readAsDataURL(file);
  });
}

export default function VerificarPerfilPage() {
  const [state, setState] = useState<VerifyState>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<DatavalidResult | null>(null);

  const setStep = (step: Step) => setState((s) => ({ ...s, step, errors: [] }));

  const handleCpfSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidCpfFormat(state.cpf)) {
      setState((s) => ({ ...s, errors: ["CPF deve ter 11 digitos."] }));
      return;
    }
    setStep("selfie");
  };

  const handleSelfieFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { dataUri, base64 } = await readImageAsBase64(file);
      setState((s) => ({
        ...s,
        selfieBase64: base64,
        selfiePreview: dataUri,
        errors: [],
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        errors: [
          err instanceof Error ? err.message : "Nao foi possivel ler a selfie.",
        ],
      }));
    }
  };

  const submitVerification = async () => {
    if (!state.selfieBase64) {
      setState((s) => ({
        ...s,
        errors: ["Capture uma selfie antes de enviar."],
      }));
      return;
    }
    setSubmitting(true);
    setState((s) => ({ ...s, errors: [] }));
    try {
      const data = await gqlRequest<{
        submitDatavalidVerification: DatavalidResult;
      }>(SUBMIT_DATAVALID, {
        input: {
          cpf: state.cpf.replace(/\D/g, ""),
          selfieBase64: state.selfieBase64,
        },
      });
      const res = data.submitDatavalidVerification;
      setResult(res);
      if (res.ok && res.status === "APPROVED") {
        setStep("done");
      } else {
        // Degradacao honesta: Datavalid rejeitou (CPF-vs-selfie ou liveness).
        setState((s) => ({
          ...s,
          errors: [
            "Verificacao nao aprovada. Confira o CPF e tire a selfie ao vivo (foto antiga e rejeitada). Tente de novo.",
          ],
        }));
      }
    } catch (err) {
      setState((s) => ({
        ...s,
        errors: [
          err instanceof GqlClientError
            ? err.message
            : "Nao foi possivel enviar a verificacao. Tente de novo.",
        ],
      }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen p-6 max-w-2xl mx-auto">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <span className="text-blue-500">✓</span> Verificar perfil
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Anti-fake via Datavalid. Aumenta confianca e desbloqueia recursos.
          </p>
        </div>
        <Link
          href="/perfil"
          className="text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-accent"
        >
          Voltar
        </Link>
      </header>

      {/* Anti-fake banner */}
      <div className="mb-6 p-4 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30">
        <div className="flex gap-3">
          <span className="text-2xl">🛡️</span>
          <div className="text-sm">
            <p className="font-medium text-blue-900 dark:text-blue-100">
              Verificacao Datavalid
            </p>
            <p className="text-blue-800 dark:text-blue-200 mt-1">
              Conferimos CPF + selfie liveness (Datavalid / SERPRO). Reduz
              perfis fake. Seus dados ficam criptografados em transito e voce
              pode revogar a qualquer momento.
            </p>
          </div>
        </div>
      </div>

      {/* Step indicator */}
      <ol className="flex items-center gap-2 mb-6 text-xs">
        {(["cpf", "selfie", "review", "done"] as Step[]).map((s, i) => {
          const stepIdx = ["intro", "cpf", "selfie", "review", "done"].indexOf(
            state.step,
          );
          const myIdx = ["intro", "cpf", "selfie", "review", "done"].indexOf(s);
          const reached = stepIdx >= myIdx;
          return (
            <li
              key={s}
              className={`flex-1 h-1.5 rounded-full ${reached ? "bg-blue-500" : "bg-muted"}`}
              aria-current={state.step === s ? "step" : undefined}
            >
              <span className="sr-only">
                Etapa {i + 1}: {s}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Step bodies */}
      {state.step === "intro" && (
        <section className="rounded-2xl border border-border p-6">
          <h2 className="font-semibold text-lg mb-2">Como funciona</h2>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal pl-5 mb-4">
            <li>Voce informa seu CPF (criptografado em transito).</li>
            <li>Voce tira uma selfie ao vivo (liveness check).</li>
            <li>
              A gente verifica via Datavalid (Receita Federal + biometria).
            </li>
            <li>
              Em caso positivo, seu perfil ganha selo ✓ visivel pros matches.
            </li>
          </ol>
          <button
            type="button"
            onClick={() => setStep("cpf")}
            className="px-5 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
          >
            Comecar
          </button>
        </section>
      )}

      {state.step === "cpf" && (
        <form
          onSubmit={handleCpfSubmit}
          className="rounded-2xl border border-border p-6 space-y-4"
        >
          <h2 className="font-semibold text-lg">Informe seu CPF</h2>
          <p className="text-sm text-muted-foreground">
            Usado apenas pra verificacao Datavalid. Nao aparece em lugar nenhum
            do app.
          </p>
          <label className="block">
            <span className="text-xs text-muted-foreground">CPF</span>
            <input
              type="text"
              inputMode="numeric"
              value={maskCpf(state.cpf)}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  cpf: e.target.value.replace(/\D/g, ""),
                  errors: [],
                }))
              }
              placeholder="000.000.000-00"
              className="mt-1 w-full px-3 py-2 border border-border rounded-lg bg-background"
              maxLength={14}
              required
            />
          </label>
          {state.errors.length > 0 && (
            <ul className="text-xs text-rose-600 dark:text-rose-400">
              {state.errors.map((er) => (
                <li key={er}>· {er}</li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
            >
              Proximo
            </button>
            <button
              type="button"
              onClick={() => setStep("intro")}
              className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-accent"
            >
              Voltar
            </button>
          </div>
        </form>
      )}

      {state.step === "selfie" && (
        <section className="rounded-2xl border border-border p-6 space-y-4">
          <h2 className="font-semibold text-lg">Selfie ao vivo</h2>
          <p className="text-sm text-muted-foreground">
            Posicione o rosto no centro. Nao use foto antiga — a checagem de
            liveness do Datavalid rejeita.
          </p>

          <label className="block cursor-pointer">
            <div className="aspect-square max-w-xs mx-auto rounded-2xl border-2 border-dashed border-border bg-muted/40 flex items-center justify-center overflow-hidden">
              {state.selfiePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={state.selfiePreview}
                  alt="Selfie capturada"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-6xl opacity-30">📷</span>
              )}
            </div>
            <input
              type="file"
              accept="image/*"
              capture="user"
              onChange={handleSelfieFile}
              className="sr-only"
            />
            <span className="mt-3 block text-center text-sm font-medium text-blue-600 dark:text-blue-400">
              {state.selfiePreview ? "Trocar selfie" : "Abrir camera / escolher"}
            </span>
          </label>

          {state.errors.length > 0 && (
            <ul className="text-xs text-rose-600 dark:text-rose-400 text-center">
              {state.errors.map((er) => (
                <li key={er}>· {er}</li>
              ))}
            </ul>
          )}

          <div className="flex gap-2 justify-center">
            <button
              type="button"
              onClick={() => setStep("review")}
              disabled={!state.selfieBase64}
              className="px-5 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              Continuar
            </button>
            <button
              type="button"
              onClick={() => setStep("cpf")}
              className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-accent"
            >
              Voltar
            </button>
          </div>
        </section>
      )}

      {state.step === "review" && (
        <section className="rounded-2xl border border-border p-6 space-y-4">
          <h2 className="font-semibold text-lg">Revisar e enviar</h2>
          <dl className="text-sm space-y-2">
            <div className="flex justify-between border-b border-border pb-2">
              <dt className="text-muted-foreground">CPF</dt>
              <dd>{maskCpf(state.cpf)}</dd>
            </div>
            <div className="flex justify-between items-center border-b border-border pb-2">
              <dt className="text-muted-foreground">Selfie</dt>
              <dd className="flex items-center gap-2">
                {state.selfiePreview ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={state.selfiePreview}
                      alt="Selfie"
                      className="w-8 h-8 rounded object-cover"
                    />
                    <span>✓ capturada</span>
                  </>
                ) : (
                  "✗ nao capturada"
                )}
              </dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">
            Ao enviar, autorizo Datavalid a verificar meus dados conforme
            Politica de Privacidade.
          </p>
          {state.errors.length > 0 && (
            <ul className="text-xs text-rose-600 dark:text-rose-400">
              {state.errors.map((er) => (
                <li key={er}>· {er}</li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={submitVerification}
              disabled={submitting || !state.selfieBase64}
              className="px-5 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Enviando..." : "Enviar verificacao"}
            </button>
            <button
              type="button"
              onClick={() => setStep("selfie")}
              disabled={submitting}
              className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-accent"
            >
              Voltar
            </button>
          </div>
        </section>
      )}

      {state.step === "done" && (
        <section className="rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 p-6 text-center">
          <p className="text-5xl mb-3">✓</p>
          <h2 className="font-semibold text-lg text-emerald-900 dark:text-emerald-100">
            Perfil verificado
          </h2>
          <p className="text-sm text-emerald-800 dark:text-emerald-200 mt-2">
            Datavalid confirmou seu CPF + selfie. Seu perfil ja recebeu o selo ✓
            visivel pros matches.
          </p>
          {result?.verificationId && (
            <p className="text-xs text-muted-foreground mt-3">
              Protocolo: <code>{result.verificationId}</code>
            </p>
          )}
          <Link
            href="/perfil"
            className="inline-block mt-4 px-5 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700"
          >
            Voltar pro perfil
          </Link>
        </section>
      )}
    </main>
  );
}
