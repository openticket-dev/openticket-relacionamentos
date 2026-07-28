/**
 * /encontros — Encontros e eventos parceiros com Sparkles Constellation 3D.
 *
 * Cada evento aparece como sparkle na constelacao 3D no topo (linha temporal).
 * Lista abaixo mostra detalhes texto. Heart de relacionamentos + constelacao
 * = "voces estao construindo uma historia juntos".
 *
 * WIRE_REAL: dados via GraphQL partnerEvents (gateway federado). O gateway NAO
 * expoe `myEncontros`; `partnerEvents` e a query real de encontros/eventos
 * parceiros (speed dating, retiros, jantares, workshops) do vertical B2B2C.
 * Zero-mock: estados loading/ready/empty/error; sem fake data inventada.
 *
 * REL-G1 (2026-07-25): encontro bookado no OT (PartnerEvent.ticketingEventId
 * != null) ganha o card "comprar juntos" — 1 pedido com 2 ingressos lado a
 * lado pro casal de um match. A query passa a pedir `ticketingEventId` porque
 * e ele que decide se o card aparece; encontro sem ticketing segue so com o
 * link do parceiro, como antes.
 *
 * Stack: Next 16 App Router + R3F 9 (Tier 3).
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  SparklesConstellation3D,
  type EncontroPoint,
} from "@/components/SparklesConstellation3D";
import { ComprarJuntosCard } from "@/components/ComprarJuntosCard";

// Contrato (introspection PartnerEvent): { id title kind description city state
//   startsAt endsAt partnerName imageUrl externalUrl tags ... }
const PARTNER_EVENTS_QUERY = /* GraphQL */ `
  query PartnerEvents($input: PartnerEventsInput) {
    partnerEvents(input: $input) {
      id
      title
      kind
      city
      state
      startsAt
      endsAt
      partnerName
      externalUrl
      ticketingEventId
    }
  }
`;

type PartnerEventKind =
  | "SPEED_DATING"
  | "RETREAT"
  | "PARTY"
  | "DINNER"
  | "WORKSHOP"
  | "OTHER";

interface PartnerEvent {
  id: string;
  title: string;
  kind: PartnerEventKind;
  city: string | null;
  state: string | null;
  startsAt: string;
  endsAt: string | null;
  partnerName: string | null;
  externalUrl: string | null;
  /** REL-G1: != null => encontro vende ingresso pelo OT (card comprar juntos). */
  ticketingEventId: string | null;
}

type LoadState = "loading" | "ready" | "empty" | "error";

async function fetchPartnerEvents(limit: number): Promise<PartnerEvent[]> {
  const res = await fetch("/api/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: PARTNER_EVENTS_QUERY,
      variables: { input: { limit } },
    }),
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const json = (await res.json()) as {
    data?: { partnerEvents: PartnerEvent[] | null };
    errors?: { message: string }[];
  };
  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors[0]?.message ?? "GraphQL error");
  }
  return json.data?.partnerEvents ?? [];
}

const KIND_LABEL: Record<PartnerEventKind, string> = {
  SPEED_DATING: "Speed dating",
  RETREAT: "Retiro",
  PARTY: "Festa",
  DINNER: "Jantar",
  WORKSHOP: "Workshop",
  OTHER: "Encontro",
};

function formatScheduled(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function EncontrosPage() {
  const [state, setState] = useState<LoadState>("loading");
  const [events, setEvents] = useState<PartnerEvent[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const items = await fetchPartnerEvents(50);
        if (cancelled) return;
        if (items.length === 0) {
          setEvents([]);
          setState("empty");
          return;
        }
        setEvents(items);
        setState("ready");
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof Error ? err.message : "Falha ao carregar encontros";
        setErrorMessage(msg);
        setState("error");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const constellationPoints: EncontroPoint[] = events.map((e) => ({
    id: e.id,
    timestampMs: new Date(e.startsAt).getTime(),
    energy: 0.7,
  }));

  return (
    <main className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Encontros</h1>
            <p className="text-sm text-zinc-400 mt-1">
              Encontros e eventos parceiros em 3D. Cada estrela = um evento.
            </p>
          </div>
          <Link
            href="/encontros/seguranca"
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-fuchsia-800 bg-fuchsia-950/40 text-sm font-semibold text-fuchsia-200 hover:bg-fuchsia-900/50 transition-colors"
          >
            Central de seguranca
          </Link>
        </header>

        {/* Loading */}
        {state === "loading" && (
          <div
            className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8"
            role="status"
            aria-live="polite"
          >
            <div className="h-80 w-full rounded-xl bg-zinc-800/30 animate-pulse mb-4" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-16 rounded-lg bg-zinc-800/30 animate-pulse"
                />
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {state === "error" && (
          <div
            className="rounded-2xl border border-rose-800 bg-rose-950/30 p-8 text-center"
            role="alert"
          >
            <p className="text-lg font-semibold mb-1">
              Nao foi possivel carregar seus encontros
            </p>
            <p className="text-sm text-rose-300 mb-4">{errorMessage}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-block px-4 py-2 rounded-lg bg-rose-700 hover:bg-rose-600 text-sm font-medium"
            >
              Tentar de novo
            </button>
          </div>
        )}

        {/* Empty */}
        {state === "empty" && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
            {/* Constelacao vazia gera 1 sparkle de boas-vindas */}
            <SparklesConstellation3D
              points={[
                {
                  id: "welcome",
                  timestampMs: Date.now(),
                  energy: 0.5,
                },
              ]}
              ariaLabel="Constelacao vazia — proximos encontros vao aparecer aqui"
              className="h-64 w-full bg-gradient-to-br from-fuchsia-950/30 via-purple-950/20 to-zinc-950"
            />
            <div className="p-8 text-center">
              <p className="text-lg font-semibold mb-1">
                Nenhum encontro disponivel ainda
              </p>
              <p className="text-sm text-zinc-400 mb-5">
                Quando parceiros publicarem encontros e eventos na sua regiao,
                eles vao aparecer aqui como estrelas conectadas.
              </p>
              <Link
                href="/matches"
                className="inline-block px-5 py-2.5 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-700 text-sm font-semibold transition-colors"
              >
                Ver matches
              </Link>
            </div>
          </div>
        )}

        {/* Ready */}
        {state === "ready" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-zinc-800 overflow-hidden bg-gradient-to-br from-fuchsia-950/30 via-purple-950/20 to-zinc-950">
              <SparklesConstellation3D
                points={constellationPoints}
                ariaLabel={`Constelacao 3D com ${events.length} encontros conectados`}
                className="h-80 w-full bg-transparent border-0"
              />
            </div>

            <ul className="space-y-3" aria-label="Lista de encontros">
              {events.map((e) => (
                <li
                  key={e.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{e.title}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {e.partnerName ? `${e.partnerName} · ` : ""}
                        {[e.city, e.state].filter(Boolean).join("/")}
                        {e.city || e.state ? " · " : ""}
                        {formatScheduled(e.startsAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <KindBadge kind={e.kind} />
                      {e.externalUrl && (
                        <a
                          href={e.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-fuchsia-300 hover:text-fuchsia-200 underline"
                        >
                          Detalhes
                        </a>
                      )}
                    </div>
                  </div>

                  {/* REL-G1 — so aparece quando o encontro esta bookado no OT.
                      A cotacao (preco/assentos) e buscada ao ABRIR o card. */}
                  {e.ticketingEventId && (
                    <ComprarJuntosCard
                      partnerEventId={e.id}
                      partnerEventTitle={e.title}
                      externalUrl={e.externalUrl}
                    />
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}

function KindBadge({ kind }: { kind: PartnerEventKind }) {
  const cls: Record<PartnerEventKind, string> = {
    SPEED_DATING: "bg-fuchsia-950 text-fuchsia-200 border-fuchsia-800",
    RETREAT: "bg-emerald-950 text-emerald-200 border-emerald-800",
    PARTY: "bg-purple-950 text-purple-200 border-purple-800",
    DINNER: "bg-amber-950 text-amber-200 border-amber-800",
    WORKSHOP: "bg-sky-950 text-sky-200 border-sky-800",
    OTHER: "bg-zinc-800 text-zinc-300 border-zinc-700",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold border ${cls[kind] ?? cls.OTHER}`}
    >
      {KIND_LABEL[kind] ?? "Encontro"}
    </span>
  );
}
