// Relacionamentos — Verificacao de perfil (anti-fake)
// Fluxo de verificacao via Datavalid (SERPRO): CPF + selfie → CPF_FACIAL match.
//
// WIRE (feat/relacion-verificar-premium): antes esta tela era stub client-only
// (setTimeout fingindo aprovacao). Agora chama o backend REAL
// `submitDatavalidVerification(input:{cpf, selfieBase64})` — VerificationResolver
// (apps/relacionamentos/src/resolvers/verification.resolver.ts), que roda o
// DatavalidService.verifySelfieVsGov e, se APPROVED, flipa
// RelationshipProfile.verified=true no VerificationService.
//
// DEGRADE HONESTO (zero-mock): se o servidor NAO tem credencial Datavalid, o
// DatavalidService lanca DatavalidConfigError → vira GraphQL error → cai no
// catch e mostramos o erro real. NUNCA marcamos aprovado sem a checagem
// government-grade. REJECTED (selfie nao bate com o CPF) tambem e mostrado
// honestamente — nada de falso-positivo.

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { gqlRequest, GqlClientError } from "@/lib/gql-client";

type Step = "intro" | "cpf" | "selfie" | "review" | "done";

type VerifyState = {
  step: Step;
  cpf: string;
  selfieCaptured: boolean;
  selfieBase64: string | null;
  selfiePreview: string | null;
  errors: string[];
};

type VerificationResult = {
  ok: boolean;
  status?: string | null;
  verificationId?: string | null;
};

const INITIAL: VerifyState = {
  step: "intro",
  cpf: "",
  selfieCaptured: false,
  selfieBase64: null,
  selfiePreview: null,
  errors: [],
};

const SUBMIT_DATAVALID_VERIFICATION = /* GraphQL */ `
  mutation SubmitDatavalidVerification($input: SubmitDatavalidVerificationInput!) {
    submitDatavalidVerification(input: $input) {
      ok
      status
      verificationId
    }
  }
`;

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

export default function VerificarPerfilPage() {
  const [state, setState] = useState<VerifyState>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const setStep = (step: Step) => setState((s) => ({ ...s, step, errors: [] }));

  const stopCamera = () => {
    const s = streamRef.current;
    if (s) {
      s.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  // Liga a camera real quando o usuario chega no passo "selfie".
  useEffect(() => {
    if (state.step !== "selfie") return;
    let cancelled = false;
    let localStream: MediaStream | null = null;
    setCameraError(null);
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setCameraError(
            "Camera nao disponivel neste dispositivo. Use o envio de foto abaixo.",
          );
          return;
        }
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        localStream = s;
        streamRef.current = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          await videoRef.current.play().catch(() => {});
        }
      } catch {
        setCameraError(
          "Nao consegui acessar a camera (permissao negada?). Use o envio de foto abaixo.",
        );
      }
    })();
    return () => {
      cancelled = true;
      if (localStream) localStream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [state.step]);

  // Garante que a camera desliga se o componente desmontar.
  useEffect(() => stopCamera, []);

  const handleCpfSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidCpfFormat(state.cpf)) {
      setState((s) => ({ ...s, errors: ["CPF deve ter 11 digitos."] }));
      return;
    }
    setStep("selfie");
  };

  const applySelfie = (dataUrl: string) => {
    const base64 = dataUrl.split(",")[1] ?? "";
    if (!base64) {
      setState((s) => ({
        ...s,
        errors: ["Nao consegui ler a imagem. Tente novamente."],
      }));
      return;
    }
    stopCamera();
    setState((s) => ({
      ...s,
      selfieCaptured: true,
      selfieBase64: base64,
      selfiePreview: dataUrl,
      errors: [],
      step: "review",
    }));
  };

  const captureSelfie = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) {
      setState((s) => ({
        ...s,
        errors: ["Camera ainda nao esta pronta. Aguarde um instante."],
      }));
      return;
    }
    // Downscale pra manter o payload base64 razoavel (max 640px de largura).
    const maxW = 640;
    const scale = Math.min(1, maxW / video.videoWidth);
    const w = Math.round(video.videoWidth * scale);
    const h = Math.round(video.videoHeight * scale);
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setState((s) => ({
        ...s,
        errors: ["Falha ao capturar. Tente novamente."],
      }));
      return;
    }
    ctx.drawImage(video, 0, 0, w, h);
    applySelfie(canvas.toDataURL("image/jpeg", 0.85));
  };

  const handleFileSelfie = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () =>
      applySelfie(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () =>
      setState((s) => ({ ...s, errors: ["Falha ao ler o arquivo."] }));
    reader.readAsDataURL(file);
  };

  const submitVerification = async () => {
    if (!state.selfieBase64) {
      setState((s) => ({
        ...s,
        errors: ["Capture ou envie uma selfie antes de enviar."],
      }));
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const data = await gqlRequest<{
        submitDatavalidVerification: VerificationResult;
      }>(SUBMIT_DATAVALID_VERIFICATION, {
        input: { cpf: state.cpf, selfieBase64: state.selfieBase64 },
      });
      setResult(data.submitDatavalidVerification);
      setStep("done");
    } catch (err) {
      // DatavalidConfigError (sem credencial no servidor) chega como GraphQL
      // error. Degrade honesto: nunca aprova sem a checagem real.
      setSubmitError(
        err instanceof GqlClientError
          ? err.message
          : "Nao foi possivel enviar a verificacao agora. Tente novamente.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const approved = Boolean(
    result?.ok && (result?.status ?? "").toUpperCase() === "APPROVED",
  );

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
              Conferimos CPF + selfie liveness (CPF_FACIAL / SERPRO). Reduz
              perfis fake. Seus dados ficam criptografados e voce pode revogar a
              qualquer momento.
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
            liveness / CPF_FACIAL rejeita.
          </p>
          <div className="aspect-square max-w-xs mx-auto rounded-2xl border-2 border-border bg-muted/40 overflow-hidden flex items-center justify-center">
            {cameraError ? (
              <span className="text-6xl opacity-30">📷</span>
            ) : (
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />
          {cameraError && (
            <p className="text-xs text-center text-amber-600 dark:text-amber-400">
              {cameraError}
            </p>
          )}
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
              onClick={captureSelfie}
              disabled={Boolean(cameraError)}
              className="px-5 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Capturar selfie
            </button>
            <label className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-accent cursor-pointer">
              Enviar foto
              <input
                type="file"
                accept="image/*"
                capture="user"
                onChange={handleFileSelfie}
                className="hidden"
              />
            </label>
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
          {state.selfiePreview && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={state.selfiePreview}
              alt="Selfie capturada"
              className="w-28 h-28 rounded-xl object-cover border border-border mx-auto"
            />
          )}
          <dl className="text-sm space-y-2">
            <div className="flex justify-between border-b border-border pb-2">
              <dt className="text-muted-foreground">CPF</dt>
              <dd>{maskCpf(state.cpf)}</dd>
            </div>
            <div className="flex justify-between border-b border-border pb-2">
              <dt className="text-muted-foreground">Selfie</dt>
              <dd>{state.selfieCaptured ? "✓ capturada" : "✗ nao capturada"}</dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">
            Ao enviar, autorizo o Datavalid (SERPRO) a comparar minha selfie com
            a base do meu CPF, conforme a Politica de Privacidade. Se o servico
            nao estiver configurado, avisamos aqui — nada e aprovado sem a
            checagem real.
          </p>
          {submitError && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-sm text-amber-800 dark:text-amber-200">
              {submitError}
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={submitVerification}
              disabled={submitting}
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
              Refazer selfie
            </button>
          </div>
        </section>
      )}

      {state.step === "done" && approved && (
        <section className="rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 p-6 text-center">
          <p className="text-5xl mb-3">✓</p>
          <h2 className="font-semibold text-lg text-emerald-900 dark:text-emerald-100">
            Perfil verificado
          </h2>
          <p className="text-sm text-emerald-800 dark:text-emerald-200 mt-2">
            Selfie confirmada contra o seu CPF. Seu perfil agora tem o selo ✓
            visivel pros matches.
          </p>
          {result?.verificationId && (
            <p className="text-xs text-muted-foreground mt-3">
              Protocolo: {result.verificationId}
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

      {state.step === "done" && !approved && (
        <section className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 p-6 text-center">
          <p className="text-5xl mb-3">✕</p>
          <h2 className="font-semibold text-lg text-rose-900 dark:text-rose-100">
            Verificacao nao aprovada
          </h2>
          <p className="text-sm text-rose-800 dark:text-rose-200 mt-2">
            A selfie nao bateu com a base do seu CPF (status:{" "}
            {result?.status ?? "REJECTED"}). Confira o CPF, tente uma selfie com
            melhor iluminacao e envie de novo.
          </p>
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setSubmitError(null);
              setState((s) => ({
                ...s,
                selfieCaptured: false,
                selfieBase64: null,
                selfiePreview: null,
                step: "selfie",
                errors: [],
              }));
            }}
            className="inline-block mt-4 px-5 py-2 rounded-lg bg-rose-600 text-white font-medium hover:bg-rose-700"
          >
            Tentar de novo
          </button>
        </section>
      )}
    </main>
  );
}
