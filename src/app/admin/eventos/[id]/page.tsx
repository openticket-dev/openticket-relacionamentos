/**
 * /admin/eventos/[id] — Painel do evento presencial (REL-G5).
 *
 * Lista de check-ins (convites INVITED + presentes CHECKED_IN) e MAPA DE MESAS
 * do PartnerEvent: mesas atribuidas por compatibilidade DNA no check-in da
 * porta (backend partnerEventCheckins / checkInPartnerEventByQr — subgraph relacionamentos).
 *
 * Auth: cookies `credentials: include` (JWT OWNER/ADMIN no gateway resolve o
 * tenant — companyId NUNCA sai do client). Zero-mock: estados loading/ready/
 * empty/error reais; sem convite => estado vazio honesto.
 *
 * Stack: Next 16 App Router (client page, use(params) igual /perfil/[id]).
 */

"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { QrCode, RefreshCw, Users } from "lucide-react";
import { gqlRequest, GqlClientError } from "@/lib/gql-client";

const CHECKINS_QUERY = /* GraphQL */ `
  query PartnerEventCheckins($input: PartnerEventCheckinsInput!) {
    partnerEventCheckins(input: $input) {
      id
      eventId
      profileId
      pairedProfileId
      status
      invitedAt
      checkedInAt
      tableNumber
      tableScore
      profileDisplayName
    }
  }
`;

/** Assentos por mesa — espelha TABLE_SIZE do backend (partner-event-checkin.service). */
const TABLE_SIZE = 4;

interface CheckinRow {
  id: string;
  eventId: string;
  profileId: string;
  pairedProfileId: string | null;
  status: "INVITED" | "CHECKED_IN" | "CANCELLED";
  invitedAt: string;
  checkedInAt: string | null;
  tableNumber: number | null;
  tableScore: number | null;
  profileDisplayName: string | null;
}

type LoadState = "loading" | "ready" | "empty" | "error";

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function guestLabel(c: CheckinRow): string {
  return c.profileDisplayName ?? `Perfil ${c.profileId.slice(0, 10)}…`;
}

export default function AdminEventoPainelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: eventId } = use(params);
  const [state, setState] = useState<LoadState>("loading");
  const [rows, setRows] = useState<CheckinRow[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (silent: boolean) => {
      if (!silent) setState("loading");
      else setRefreshing(true);
      try {
        const data = await gqlRequest<{
          partnerEventCheckins: CheckinRow[];
        }>(CHECKINS_QUERY, { input: { eventId } });
        const items = data.partnerEventCheckins ?? [];
        setRows(items);
        setState(items.length === 0 ? "empty" : "ready");
        setErrorMessage(null);
      } catch (err) {
        const msg =
          err instanceof GqlClientError || err instanceof Error
            ? err.message
            : "Falha ao carregar check-ins";
        setErrorMessage(msg);
        setState("error");
      } finally {
        setRefreshing(false);
      }
    },
    [eventId],
  );

  useEffect(() => {
    load(false);
    // Porta viva: atualiza a cada 15s sem piscar a tela.
    const t = setInterval(() => load(true), 15000);
    return () => clearInterval(t);
  }, [load]);

  const checkedIn = rows.filter((r) => r.status === "CHECKED_IN");
  const invited = rows.filter((r) => r.status === "INVITED");

  // Mapa de mesas: agrupa CHECKED_IN por tableNumber.
  const tables = new Map<number, CheckinRow[]>();
  for (const r of checkedIn) {
    if (r.tableNumber == null) continue;
    const list = tables.get(r.tableNumber) ?? [];
    list.push(r);
    tables.set(r.tableNumber, list);
  }
  const tableNumbers = Array.from(tables.keys()).sort((a, b) => a - b);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-neutral-400">
              Painel do evento
            </p>
            <h1 className="text-2xl font-bold">Check-ins e mesas</h1>
            <p className="text-xs text-neutral-500 mt-1">
              Evento {eventId} · mesas atribuidas por compatibilidade DNA
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => load(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-900 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
              Atualizar
            </button>
            <Link
              href={`/admin/eventos/${encodeURIComponent(eventId)}/scan`}
              className="inline-flex items-center gap-2 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-700 px-4 py-2 text-sm font-semibold text-white"
            >
              <QrCode className="h-4 w-4" />
              Scan na porta
            </Link>
          </div>
        </header>

        {state === "loading" && (
          <div
            className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8"
            role="status"
            aria-live="polite"
          >
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-14 rounded-lg bg-neutral-800/40 animate-pulse"
                />
              ))}
            </div>
          </div>
        )}

        {state === "error" && (
          <div
            className="rounded-2xl border border-rose-800 bg-rose-950/30 p-8 text-center"
            role="alert"
          >
            <p className="text-lg font-semibold mb-1">
              Nao foi possivel carregar o painel
            </p>
            <p className="text-sm text-rose-300 mb-4">{errorMessage}</p>
            <button
              type="button"
              onClick={() => load(false)}
              className="inline-block px-4 py-2 rounded-lg bg-rose-700 hover:bg-rose-600 text-sm font-medium"
            >
              Tentar de novo
            </button>
          </div>
        )}

        {state === "empty" && (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-10 text-center">
            <Users className="mx-auto h-10 w-10 text-neutral-600 mb-3" />
            <p className="text-lg font-semibold mb-1">
              Nenhum convite pra este evento ainda
            </p>
            <p className="text-sm text-neutral-400">
              Quando convidados gerarem o QR de entrada (convite pareado), eles
              aparecem aqui — e viram mesa no check-in da porta.
            </p>
          </div>
        )}

        {state === "ready" && (
          <div className="space-y-8">
            {/* Resumo */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-center">
                <p className="text-2xl font-bold">{rows.length}</p>
                <p className="text-xs text-neutral-400">Convites</p>
              </div>
              <div className="rounded-xl border border-emerald-900 bg-emerald-950/30 p-4 text-center">
                <p className="text-2xl font-bold text-emerald-300">
                  {checkedIn.length}
                </p>
                <p className="text-xs text-neutral-400">Presentes</p>
              </div>
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-center">
                <p className="text-2xl font-bold">{tableNumbers.length}</p>
                <p className="text-xs text-neutral-400">Mesas abertas</p>
              </div>
            </div>

            {/* Mapa de mesas */}
            <section aria-label="Mapa de mesas">
              <h2 className="text-lg font-semibold mb-3">Mapa de mesas</h2>
              {tableNumbers.length === 0 ? (
                <p className="text-sm text-neutral-500 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
                  Ninguem sentou ainda — a primeira pessoa a passar na porta
                  abre a mesa 1.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {tableNumbers.map((n) => {
                    const seats = tables.get(n) ?? [];
                    return (
                      <div
                        key={n}
                        className="rounded-xl border border-fuchsia-900/60 bg-neutral-900/40 p-4"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-semibold">Mesa {n}</p>
                          <span className="text-[11px] text-neutral-400">
                            {seats.length}/{TABLE_SIZE} lugares
                          </span>
                        </div>
                        <ul className="space-y-1.5">
                          {seats.map((s) => (
                            <li
                              key={s.id}
                              className="flex items-center justify-between gap-2 text-sm"
                            >
                              <span className="truncate">{guestLabel(s)}</span>
                              {s.tableScore != null && (
                                <span
                                  className="shrink-0 text-[11px] font-semibold text-fuchsia-300"
                                  title="Compatibilidade DNA com a mesa na chegada"
                                >
                                  {Math.round(s.tableScore * 100)}%
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Lista de check-ins */}
            <section aria-label="Lista de check-ins">
              <h2 className="text-lg font-semibold mb-3">
                Check-ins ({checkedIn.length}) e convites ({invited.length})
              </h2>
              <ul className="space-y-2">
                {rows.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{guestLabel(c)}</p>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {c.status === "CHECKED_IN"
                          ? `Entrou ${fmtTime(c.checkedInAt)}`
                          : `Convidado ${fmtTime(c.invitedAt)}`}
                        {c.pairedProfileId ? " · convite pareado" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {c.status === "CHECKED_IN" && c.tableNumber != null && (
                        <span className="text-xs rounded-full border border-fuchsia-800 bg-fuchsia-950 text-fuchsia-200 px-2 py-1 font-semibold">
                          Mesa {c.tableNumber}
                        </span>
                      )}
                      <span
                        className={`text-[11px] rounded-full px-2 py-1 font-semibold border ${
                          c.status === "CHECKED_IN"
                            ? "bg-emerald-950 text-emerald-200 border-emerald-800"
                            : c.status === "CANCELLED"
                              ? "bg-rose-950 text-rose-200 border-rose-800"
                              : "bg-neutral-800 text-neutral-300 border-neutral-700"
                        }`}
                      >
                        {c.status === "CHECKED_IN"
                          ? "Presente"
                          : c.status === "CANCELLED"
                            ? "Cancelado"
                            : "Convidado"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
