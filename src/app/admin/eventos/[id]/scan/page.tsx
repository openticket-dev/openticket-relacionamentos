/**
 * /admin/eventos/[id]/scan — Tela de scan do QR na porta (REL-G5).
 *
 * Staff da porta escaneia o QR do convite pareado (mutation checkInPartnerEventByQr):
 *  - Camera via BarcodeDetector nativo do browser (zero dependencia nova);
 *    quando a API nao existe (Safari/Firefox antigos), fica o input manual —
 *    degrade honesto, nunca camera fake.
 *  - Sucesso mostra convidado + MESA atribuida por compatibilidade DNA.
 *
 * Auth: cookies `credentials: include`; tenant (companyId) SEMPRE do JWT no
 * backend — o client nao manda companyId. Zero-mock em todos os estados.
 */

"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Camera, CameraOff, QrCode } from "lucide-react";
import { gqlRequest, GqlClientError } from "@/lib/gql-client";

// Nome com prefixo da vertical de proposito: `checkInByQr` puro ja pertence ao
// subgraph healthcare (PR #909) — dois subgraphs com o mesmo root field quebram
// a composicao do gateway.
const CHECKIN_MUTATION = /* GraphQL */ `
  mutation CheckInPartnerEventByQr($input: CheckInPartnerEventByQrInput!) {
    checkInPartnerEventByQr(input: $input) {
      ok
      pendingReason
      checkin {
        id
        eventId
        profileId
        profileDisplayName
        status
        checkedInAt
        tableNumber
        tableScore
      }
    }
  }
`;

interface CheckinResult {
  ok: boolean;
  pendingReason: string | null;
  checkin: {
    id: string;
    eventId: string;
    profileId: string;
    profileDisplayName: string | null;
    status: string;
    checkedInAt: string | null;
    tableNumber: number | null;
    tableScore: number | null;
  } | null;
}

// BarcodeDetector ainda nao esta no lib.dom do TS — tipagem minima local.
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (opts?: {
  formats?: string[];
}) => BarcodeDetectorLike;

function getBarcodeDetectorCtor(): BarcodeDetectorCtor | null {
  if (typeof window === "undefined") return null;
  const ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor })
    .BarcodeDetector;
  return ctor ?? null;
}

type SubmitState = "idle" | "submitting" | "success" | "error";

export default function AdminEventoScanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: eventId } = use(params);
  const [token, setToken] = useState("");
  const [state, setState] = useState<SubmitState>("idle");
  const [result, setResult] = useState<CheckinResult["checkin"]>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Camera / BarcodeDetector
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const detectorSupported = getBarcodeDetectorCtor() !== null;

  async function submit(rawToken: string) {
    const value = rawToken.trim();
    if (!value) return;
    setState("submitting");
    setErrorMessage(null);
    setResult(null);
    try {
      const data = await gqlRequest<{
        checkInPartnerEventByQr: CheckinResult;
      }>(CHECKIN_MUTATION, { input: { qrToken: value } });
      const res = data.checkInPartnerEventByQr;
      if (!res.ok) {
        setState("error");
        setErrorMessage(
          res.pendingReason === "PARTNER_EVENT_CHECKIN_TABLE_PENDING_MIGRATION"
            ? "Check-in ainda nao esta ativo neste ambiente (migration pendente)."
            : (res.pendingReason ?? "Check-in nao concluido"),
        );
        return;
      }
      setResult(res.checkin);
      setState("success");
      setToken("");
    } catch (err) {
      const msg =
        err instanceof GqlClientError || err instanceof Error
          ? err.message
          : "Falha no check-in";
      setErrorMessage(msg);
      setState("error");
    }
  }

  function stopCamera() {
    scanningRef.current = false;
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    setCameraOn(false);
  }

  async function startCamera() {
    const Ctor = getBarcodeDetectorCtor();
    if (!Ctor) return;
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
      const video = videoRef.current;
      if (!video) {
        stopCamera();
        return;
      }
      video.srcObject = stream;
      await video.play();

      const detector = new Ctor({ formats: ["qr_code"] });
      scanningRef.current = true;
      const tick = async () => {
        if (!scanningRef.current || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0 && codes[0].rawValue) {
            const raw = codes[0].rawValue;
            stopCamera();
            setToken(raw);
            await submit(raw);
            return;
          }
        } catch {
          // frame ainda nao pronto — segue o loop
        }
        if (scanningRef.current) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    } catch (err) {
      stopCamera();
      setCameraError(
        err instanceof Error ? err.message : "Camera indisponivel",
      );
    }
  }

  useEffect(() => {
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const guestName =
    result?.profileDisplayName ??
    (result ? `Perfil ${result.profileId.slice(0, 10)}…` : "");

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-xl px-4 sm:px-6 py-8">
        <header className="mb-6">
          <Link
            href={`/admin/eventos/${encodeURIComponent(eventId)}`}
            className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-200 mb-3"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao painel
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <QrCode className="h-6 w-6 text-fuchsia-400" />
            Scan na porta
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Escaneie o QR do convite pareado — o check-in atribui a mesa por
            compatibilidade DNA.
          </p>
        </header>

        {/* Camera (BarcodeDetector nativo) */}
        <section className="mb-6 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4">
          {detectorSupported ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold">Camera</p>
                <button
                  type="button"
                  onClick={() => (cameraOn ? stopCamera() : startCamera())}
                  className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800"
                >
                  {cameraOn ? (
                    <>
                      <CameraOff className="h-4 w-4" /> Parar
                    </>
                  ) : (
                    <>
                      <Camera className="h-4 w-4" /> Ligar camera
                    </>
                  )}
                </button>
              </div>
              <video
                ref={videoRef}
                muted
                playsInline
                className={`w-full rounded-xl bg-black ${cameraOn ? "block" : "hidden"}`}
                aria-label="Preview da camera pra leitura do QR"
              />
              {!cameraOn && (
                <p className="text-xs text-neutral-500">
                  Ligue a camera pra ler o QR automaticamente, ou cole o token
                  abaixo.
                </p>
              )}
              {cameraError && (
                <p className="text-xs text-rose-300 mt-2" role="alert">
                  {cameraError}
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-neutral-500">
              Este navegador nao tem leitor de QR nativo (BarcodeDetector).
              Use o campo abaixo pra digitar/colar o token do convite.
            </p>
          )}
        </section>

        {/* Entrada manual */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(token);
          }}
          className="mb-6 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4"
        >
          <label
            htmlFor="qr-token"
            className="block text-sm font-semibold mb-2"
          >
            Token do convite
          </label>
          <div className="flex gap-2">
            <input
              id="qr-token"
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="otrel://checkin/… ou token puro"
              autoComplete="off"
              className="flex-1 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm placeholder:text-neutral-600 focus:outline-none focus:border-fuchsia-600"
            />
            <button
              type="submit"
              disabled={state === "submitting" || token.trim().length === 0}
              className="rounded-lg bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-50 px-4 py-2 text-sm font-semibold text-white"
            >
              {state === "submitting" ? "Entrando…" : "Check-in"}
            </button>
          </div>
        </form>

        {/* Resultado */}
        {state === "success" && result && (
          <div
            className="rounded-2xl border border-emerald-800 bg-emerald-950/30 p-6 text-center"
            role="status"
            aria-live="polite"
          >
            <p className="text-sm text-emerald-300 mb-1">Check-in confirmado</p>
            <p className="text-xl font-bold mb-2">{guestName}</p>
            {result.tableNumber != null ? (
              <p className="text-3xl font-extrabold text-fuchsia-300">
                Mesa {result.tableNumber}
              </p>
            ) : (
              <p className="text-sm text-neutral-400">Sem mesa atribuida</p>
            )}
            {result.tableScore != null && (
              <p className="text-xs text-neutral-400 mt-2">
                Compatibilidade DNA com a mesa:{" "}
                {Math.round(result.tableScore * 100)}%
              </p>
            )}
          </div>
        )}

        {state === "error" && (
          <div
            className="rounded-2xl border border-rose-800 bg-rose-950/30 p-6 text-center"
            role="alert"
          >
            <p className="text-sm font-semibold text-rose-200 mb-1">
              Check-in nao realizado
            </p>
            <p className="text-xs text-rose-300">{errorMessage}</p>
          </div>
        )}
      </div>
    </main>
  );
}
