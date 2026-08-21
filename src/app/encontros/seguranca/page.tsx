/**
 * /encontros/seguranca — Central de seguranca de encontros (REL-S8 · W10).
 *
 * Card 02.3 "Encontros com Seguranca". Reune num so lugar os recursos de
 * seguranca do usuario:
 *   - Botao de panico (ja real: mutation triggerPanic).
 *   - Compartilhe sua localizacao ao vivo durante o encontro (startLocationShare
 *     / updateLocationShare / stopLocationShare), ligado aos contatos de
 *     emergencia ja wired (contactsNotified).
 *   - Dicas de seguranca (query safetyTips — PREPARACAO/DURANTE/ONLINE).
 *   - Locais seguros (query safePlaces).
 *   - Central de ajuda (query safetyTips — categoria AJUDA, com CTA tel:/link).
 *
 * Zero-mock: todo dado vem do gateway federado relacionamentos. Estados
 * loading/ready/empty/error honestos por secao — sem fake data. LGPD: a
 * localizacao vai pro backend (lat/lng), o app so exibe o estado da sessao.
 *
 * Stack: Next 16 App Router (client component) + gqlRequest (fetch, sem Apollo).
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  Navigation,
  MapPin,
  LifeBuoy,
  Lightbulb,
  Phone,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { gqlRequest } from "@/lib/gql-client";

// ---------------------------------------------------------------------------
// GraphQL documents
// ---------------------------------------------------------------------------

const SAFETY_TIPS_QUERY = /* GraphQL */ `
  query SafetyTips {
    safetyTips {
      id
      category
      title
      body
      icon
      ctaLabel
      ctaHref
      orderIndex
    }
  }
`;

const SAFE_PLACES_QUERY = /* GraphQL */ `
  query SafePlaces {
    safePlaces {
      id
      name
      kind
      description
      address
      city
      state
      phone
      hours
      verified
    }
  }
`;

const MY_SESSION_QUERY = /* GraphQL */ `
  query MyLocationShareSession {
    myLocationShareSession {
      id
      status
      contactsNotified
      lastLocationHash
      startedAt
      lastPingAt
      expiresAt
    }
  }
`;

const TRIGGER_PANIC_MUTATION = /* GraphQL */ `
  mutation TriggerPanic($input: TriggerPanicInput) {
    triggerPanic(input: $input) {
      ok
      persisted
      panicEventId
      contactsRegistered
      contactsNotified
      deliveryFailed
      pendingReason
    }
  }
`;

const START_SHARE_MUTATION = /* GraphQL */ `
  mutation StartLocationShare($input: StartLocationShareInput) {
    startLocationShare(input: $input) {
      ok
      persisted
      sessionId
      status
      contactsNotified
      pendingReason
    }
  }
`;

const STOP_SHARE_MUTATION = /* GraphQL */ `
  mutation StopLocationShare {
    stopLocationShare {
      ok
      persisted
      sessionId
      status
      contactsNotified
      pendingReason
    }
  }
`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SafetyTip {
  id: string;
  category: string;
  title: string;
  body: string;
  icon: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  orderIndex: number;
}

interface SafePlace {
  id: string;
  name: string;
  kind: string;
  description: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  hours: string | null;
  verified: boolean;
}

interface LocationShareSession {
  id: string;
  status: string;
  contactsNotified: number;
  lastLocationHash: string | null;
  startedAt: string;
  lastPingAt: string | null;
  expiresAt: string | null;
}

interface PanicResult {
  ok: boolean;
  persisted: boolean;
  panicEventId: string | null;
  /** Contatos de emergencia ativos no momento do disparo. */
  contactsRegistered: number | null;
  /** Contatos com ENTREGA confirmada. So isso pinta o check verde (F3). */
  contactsNotified: number | null;
  deliveryFailed: number | null;
  pendingReason: string | null;
}

interface ShareResult {
  ok: boolean;
  persisted: boolean;
  sessionId: string | null;
  status: string;
  contactsNotified: number;
  pendingReason: string | null;
}

type SectionState = "loading" | "ready" | "empty" | "error";

const KIND_LABEL: Record<string, string> = {
  POLICE: "Delegacia",
  HOSPITAL: "Hospital",
  PUBLIC_VENUE: "Local publico",
  PHARMACY_24H: "Farmacia 24h",
  SHOPPING: "Shopping",
  OTHER: "Outro",
};

const TIP_GROUP_LABEL: Record<string, string> = {
  PREPARACAO: "Antes do encontro",
  DURANTE: "Durante o encontro",
  ONLINE: "Seguranca online",
};

// Tenta obter a geolocalizacao do browser (opcional, best-effort).
function getCoords(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 },
    );
  });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SegurancaEncontrosPage() {
  // Tips
  const [tipsState, setTipsState] = useState<SectionState>("loading");
  const [tips, setTips] = useState<SafetyTip[]>([]);

  // Safe places
  const [placesState, setPlacesState] = useState<SectionState>("loading");
  const [places, setPlaces] = useState<SafePlace[]>([]);

  // Location share session
  const [session, setSession] = useState<LocationShareSession | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  // Panic
  const [panicBusy, setPanicBusy] = useState(false);
  const [panicResult, setPanicResult] = useState<PanicResult | null>(null);
  const [panicError, setPanicError] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    try {
      const data = await gqlRequest<{
        myLocationShareSession: LocationShareSession | null;
      }>(MY_SESSION_QUERY);
      setSession(data.myLocationShareSession ?? null);
    } catch {
      // Sessao e opcional — silencia (estado = sem sessao ativa).
      setSession(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadTips() {
      setTipsState("loading");
      try {
        const data = await gqlRequest<{ safetyTips: SafetyTip[] }>(
          SAFETY_TIPS_QUERY,
        );
        if (cancelled) return;
        const items = data.safetyTips ?? [];
        setTips(items);
        setTipsState(items.length === 0 ? "empty" : "ready");
      } catch {
        if (!cancelled) setTipsState("error");
      }
    }

    async function loadPlaces() {
      setPlacesState("loading");
      try {
        const data = await gqlRequest<{ safePlaces: SafePlace[] }>(
          SAFE_PLACES_QUERY,
        );
        if (cancelled) return;
        const items = data.safePlaces ?? [];
        setPlaces(items);
        setPlacesState(items.length === 0 ? "empty" : "ready");
      } catch {
        if (!cancelled) setPlacesState("error");
      }
    }

    loadTips();
    loadPlaces();
    loadSession();

    return () => {
      cancelled = true;
    };
  }, [loadSession]);

  const handlePanic = useCallback(async () => {
    setPanicBusy(true);
    setPanicError(null);
    setPanicResult(null);
    try {
      const coords = await getCoords();
      const input: Record<string, unknown> = {};
      if (coords) {
        input.lat = coords.lat;
        input.lng = coords.lng;
      }
      const data = await gqlRequest<{ triggerPanic: PanicResult }>(
        TRIGGER_PANIC_MUTATION,
        { input },
      );
      setPanicResult(data.triggerPanic);
    } catch (err) {
      setPanicError(
        err instanceof Error ? err.message : "Falha ao acionar o panico",
      );
    } finally {
      setPanicBusy(false);
    }
  }, []);

  const handleStartShare = useCallback(async () => {
    setShareBusy(true);
    setShareMsg(null);
    try {
      const coords = await getCoords();
      const input: Record<string, unknown> = {};
      if (coords) {
        input.lat = coords.lat;
        input.lng = coords.lng;
      }
      const data = await gqlRequest<{ startLocationShare: ShareResult }>(
        START_SHARE_MUTATION,
        { input },
      );
      const r = data.startLocationShare;
      if (r.pendingReason) {
        setShareMsg(
          "Compartilhamento ainda nao disponivel neste ambiente (backend em migracao).",
        );
      } else {
        setShareMsg(null);
      }
      await loadSession();
    } catch (err) {
      setShareMsg(
        err instanceof Error ? err.message : "Falha ao compartilhar localizacao",
      );
    } finally {
      setShareBusy(false);
    }
  }, [loadSession]);

  const handleStopShare = useCallback(async () => {
    setShareBusy(true);
    setShareMsg(null);
    try {
      await gqlRequest<{ stopLocationShare: ShareResult }>(STOP_SHARE_MUTATION);
      await loadSession();
    } catch (err) {
      setShareMsg(
        err instanceof Error ? err.message : "Falha ao encerrar o compartilhamento",
      );
    } finally {
      setShareBusy(false);
    }
  }, [loadSession]);

  const dicas = tips.filter((t) => t.category !== "AJUDA");
  const ajuda = tips.filter((t) => t.category === "AJUDA");
  const dicaGroups = ["PREPARACAO", "DURANTE", "ONLINE"].filter((g) =>
    dicas.some((t) => t.category === g),
  );
  const shareActive = session?.status === "ACTIVE";

  return (
    <main className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Header */}
        <header>
          <Link
            href="/encontros"
            className="text-xs text-zinc-400 hover:text-zinc-200"
          >
            ← Encontros
          </Link>
          <h1 className="text-3xl font-bold mt-2 flex items-center gap-2">
            <ShieldAlert className="h-7 w-7 text-fuchsia-400" />
            Central de seguranca
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Seus recursos de seguranca para encontros — botao de panico,
            compartilhamento de localizacao, dicas, locais seguros e ajuda.
          </p>
        </header>

        {/* Panico */}
        <section
          className="rounded-2xl border border-rose-800 bg-rose-950/30 p-6"
          aria-label="Botao de panico"
        >
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-rose-400" />
            Emergencia
          </h2>
          <p className="text-sm text-rose-200/80 mt-1 mb-4">
            Aciona seus contatos de emergencia e registra o alerta com sua
            localizacao. Use so em situacao de risco real.
          </p>
          <button
            type="button"
            onClick={handlePanic}
            disabled={panicBusy}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-base font-bold transition-colors flex items-center justify-center gap-2"
          >
            {panicBusy ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" /> Acionando…
              </>
            ) : (
              <>
                <ShieldAlert className="h-5 w-5" /> Acionar panico
              </>
            )}
          </button>
          {panicResult &&
            /* F3 (2026-08-21): o check verde exige ENTREGA confirmada.
               Antes ele aparecia sempre, com um "serao acionados" no futuro do
               preterito — e contactsNotified vinha de um count() de contatos
               CADASTRADOS, entao a tela dizia "acionados" sem provider de SMS
               nenhum configurado. */
            ((panicResult.contactsNotified ?? 0) > 0 ? (
              <p className="text-sm text-emerald-300 mt-3 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                {panicResult.contactsNotified} contato(s) acionado(s) com
                confirmacao de envio.
                {(panicResult.deliveryFailed ?? 0) > 0
                  ? ` ${panicResult.deliveryFailed} falhou(ram).`
                  : ""}
              </p>
            ) : (
              <p
                className="text-sm text-amber-300 mt-3 flex items-start gap-1.5"
                role="alert"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Alerta registrado, mas{" "}
                  <strong>nenhum contato foi acionado</strong>.
                  {(panicResult.contactsRegistered ?? 0) === 0 ? (
                    <>
                      {" "}
                      Voce nao tem contato de emergencia cadastrado —{" "}
                      <Link
                        href="/perfil/contatos-emergencia"
                        className="text-fuchsia-300 underline"
                      >
                        cadastre agora
                      </Link>
                      .
                    </>
                  ) : (
                    " O envio falhou. Em risco imediato, ligue 190."
                  )}
                </span>
              </p>
            ))}
          {panicError && (
            <p className="text-sm text-rose-300 mt-3" role="alert">
              {panicError}
            </p>
          )}
        </section>

        {/* Compartilhe sua localizacao */}
        <section
          className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6"
          aria-label="Compartilhe sua localizacao"
        >
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Navigation className="h-5 w-5 text-fuchsia-400" />
            Compartilhe sua localizacao
          </h2>
          <p className="text-sm text-zinc-400 mt-1 mb-4">
            Durante o encontro, mantenha uma sessao de localizacao ao vivo. Seus
            contatos de emergencia sabem onde voce esta.
          </p>

          {shareActive ? (
            <div className="rounded-xl border border-emerald-800 bg-emerald-950/30 p-4">
              <p className="text-sm font-semibold text-emerald-300 flex items-center gap-1.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                Compartilhando localizacao
              </p>
              <p className="text-xs text-zinc-400 mt-2">
                {session?.contactsNotified ?? 0} contato(s) de emergencia no
                escopo desta sessao.
                {session?.contactsNotified === 0 && (
                  <>
                    {" "}
                    <Link
                      href="/perfil/contatos-emergencia"
                      className="text-fuchsia-300 underline"
                    >
                      Cadastre contatos
                    </Link>{" "}
                    para que alguem seja avisado.
                  </>
                )}
              </p>
              <button
                type="button"
                onClick={handleStopShare}
                disabled={shareBusy}
                className="mt-3 px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 disabled:opacity-60 text-sm font-medium"
              >
                {shareBusy ? "Encerrando…" : "Encerrar compartilhamento"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleStartShare}
              disabled={shareBusy}
              className="px-5 py-2.5 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-60 text-sm font-semibold transition-colors flex items-center gap-2"
            >
              {shareBusy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Iniciando…
                </>
              ) : (
                <>
                  <Navigation className="h-4 w-4" /> Compartilhar localizacao
                </>
              )}
            </button>
          )}
          {shareMsg && (
            <p className="text-xs text-amber-300 mt-3">{shareMsg}</p>
          )}
        </section>

        {/* Dicas de seguranca */}
        <section aria-label="Dicas de seguranca">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
            <Lightbulb className="h-5 w-5 text-amber-400" />
            Dicas de seguranca
          </h2>
          {tipsState === "loading" && <SkeletonCards />}
          {tipsState === "error" && (
            <EmptyBox text="Nao foi possivel carregar as dicas agora." />
          )}
          {(tipsState === "empty" ||
            (tipsState === "ready" && dicas.length === 0)) && (
            <EmptyBox text="Nenhuma dica disponivel ainda." />
          )}
          {tipsState === "ready" && dicas.length > 0 && (
            <div className="space-y-5">
              {dicaGroups.map((group) => (
                <div key={group}>
                  <h3 className="text-xs uppercase tracking-wide text-zinc-500 mb-2">
                    {TIP_GROUP_LABEL[group] ?? group}
                  </h3>
                  <ul className="space-y-2">
                    {dicas
                      .filter((t) => t.category === group)
                      .map((t) => (
                        <li
                          key={t.id}
                          className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"
                        >
                          <p className="font-semibold text-sm">{t.title}</p>
                          <p className="text-sm text-zinc-400 mt-1">{t.body}</p>
                          {t.ctaLabel && t.ctaHref && (
                            <Link
                              href={t.ctaHref}
                              className="inline-block mt-2 text-xs font-medium text-fuchsia-300 hover:text-fuchsia-200 underline"
                            >
                              {t.ctaLabel}
                            </Link>
                          )}
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Locais seguros */}
        <section aria-label="Locais seguros">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
            <MapPin className="h-5 w-5 text-sky-400" />
            Locais seguros
          </h2>
          {placesState === "loading" && <SkeletonCards />}
          {placesState === "error" && (
            <EmptyBox text="Nao foi possivel carregar os locais seguros agora." />
          )}
          {placesState === "empty" && (
            <EmptyBox text="Nenhum local seguro cadastrado na sua regiao ainda." />
          )}
          {placesState === "ready" && (
            <ul className="space-y-2">
              {places.map((p) => (
                <li
                  key={p.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-sm">{p.name}</p>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border border-sky-800 bg-sky-950 text-sky-200 shrink-0">
                      {KIND_LABEL[p.kind] ?? p.kind}
                    </span>
                  </div>
                  {p.description && (
                    <p className="text-sm text-zinc-400 mt-1">{p.description}</p>
                  )}
                  <p className="text-xs text-zinc-500 mt-2">
                    {[p.address, [p.city, p.state].filter(Boolean).join("/")]
                      .filter(Boolean)
                      .join(" · ")}
                    {p.hours ? ` · ${p.hours}` : ""}
                  </p>
                  {p.phone && (
                    <a
                      href={`tel:${p.phone}`}
                      className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-fuchsia-300 hover:text-fuchsia-200 underline"
                    >
                      <Phone className="h-3.5 w-3.5" /> {p.phone}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Central de ajuda */}
        <section aria-label="Central de ajuda">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
            <LifeBuoy className="h-5 w-5 text-emerald-400" />
            Central de ajuda
          </h2>
          {tipsState === "loading" && <SkeletonCards />}
          {tipsState === "error" && (
            <EmptyBox text="Nao foi possivel carregar os canais de ajuda agora." />
          )}
          {tipsState !== "loading" && tipsState !== "error" && ajuda.length === 0 && (
            <EmptyBox text="Nenhum canal de ajuda cadastrado ainda." />
          )}
          {ajuda.length > 0 && (
            <ul className="space-y-2">
              {ajuda.map((t) => (
                <li
                  key={t.id}
                  className="rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-4 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">{t.title}</p>
                    <p className="text-sm text-zinc-400 mt-1">{t.body}</p>
                  </div>
                  {t.ctaLabel && t.ctaHref && (
                    <a
                      href={t.ctaHref}
                      className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold"
                    >
                      <Phone className="h-4 w-4" /> {t.ctaLabel}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

function SkeletonCards() {
  return (
    <div className="space-y-2" role="status" aria-live="polite">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-16 rounded-xl bg-zinc-800/30 animate-pulse"
        />
      ))}
    </div>
  );
}

function EmptyBox({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 text-center">
      <p className="text-sm text-zinc-400">{text}</p>
    </div>
  );
}
