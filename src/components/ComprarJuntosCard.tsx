/**
 * ComprarJuntosCard — REL-G1: encontro com ingresso pareado.
 *
 * Card unico usado em DUAS telas:
 *   - /encontros   -> um card por encontro que esta bookado no OT
 *                     (PartnerEvent.ticketingEventId != null)
 *   - /chat/[id]   -> mesmo card, com o casal ja fixado pelo match da conversa
 *
 * WIRE_REAL: dados via GraphQL do subgraph relacionamentos (gateway federado):
 *   Q pairedTicketQuote(input)        preco do lote REAL + assentos adjacentes
 *   M createPairedTicketOrder(input)  1 pedido, 2 ingressos lado a lado
 *
 * ZERO MOCK
 *   - Nenhum preco, assento ou nome e inventado no client: tudo vem da quote.
 *   - Encontro sem ticketing no OT (`NOT_TICKETED`) NAO some nem finge: mostra
 *     a linha honesta e, quando existe, o link do parceiro.
 *   - Pagamento env-OFF (sem ASAAS_API_KEY no backend) devolve o pedido
 *     `pending` com `pendingReason` — renderizamos o motivo, nunca um botao de
 *     pagar que nao paga.
 *
 * A quote so e buscada quando o usuario ABRE o card (lazy): em /encontros ha
 * dezenas de encontros na tela e cada quote consulta lote + assentos no backend.
 */

"use client";

import { useCallback, useState } from "react";

const PAIRED_QUOTE_QUERY = /* GraphQL */ `
  query PairedTicketQuote($input: PairedTicketQuoteInput!) {
    pairedTicketQuote(input: $input) {
      partnerEventId
      ticketingEventId
      eventName
      eventDate
      batchId
      tierName
      unitPrice
      subtotal
      serviceFee
      totalAmount
      quantity
      seatMapAvailable
      previewSeats
      previewSeatSector
      available
      unavailableReason
      options {
        matchId
        partnerProfileId
        partnerDisplayName
        partnerAvatarUrl
        matchedAt
        alreadyPurchased
        existingPairedOrderId
      }
    }
  }
`;

const CREATE_PAIRED_ORDER_MUTATION = /* GraphQL */ `
  mutation CreatePairedTicketOrder($input: CreatePairedTicketOrderInput!) {
    createPairedTicketOrder(input: $input) {
      id
      ticketOrderId
      matchId
      partnerEventId
      ticketingEventId
      eventName
      partnerProfileId
      status
      seats
      seatSector
      totalAmount
      checkoutUrl
      pixQrCode
      pixQrCodeImage
      pendingReason
      createdAt
    }
  }
`;

export interface PairedTicketOption {
  matchId: string;
  partnerProfileId: string;
  partnerDisplayName: string | null;
  partnerAvatarUrl: string | null;
  matchedAt: string;
  alreadyPurchased: boolean;
  existingPairedOrderId: string | null;
}

export interface PairedTicketQuote {
  partnerEventId: string;
  ticketingEventId: string | null;
  eventName: string | null;
  eventDate: string | null;
  batchId: string | null;
  tierName: string | null;
  unitPrice: number;
  subtotal: number;
  serviceFee: number;
  totalAmount: number;
  quantity: number;
  seatMapAvailable: boolean;
  previewSeats: string[];
  previewSeatSector: string | null;
  available: boolean;
  unavailableReason: string | null;
  options: PairedTicketOption[];
}

export interface PairedTicketOrderResult {
  id: string;
  ticketOrderId: string | null;
  matchId: string;
  partnerEventId: string;
  ticketingEventId: string;
  eventName: string | null;
  partnerProfileId: string;
  status: string;
  seats: string[];
  seatSector: string | null;
  totalAmount: number;
  checkoutUrl: string | null;
  pixQrCode: string | null;
  pixQrCodeImage: string | null;
  pendingReason: string | null;
  createdAt: string;
}

async function gql<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch("/api/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as {
    data?: T;
    errors?: { message: string }[];
  };
  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors[0]?.message ?? "GraphQL error");
  }
  if (!json.data) throw new Error("Sem dados na resposta");
  return json.data;
}

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Motivos que o backend devolve em `unavailableReason` (contrato REL-G1). */
const UNAVAILABLE_LABEL: Record<string, string> = {
  NOT_TICKETED: "Este encontro nao vende ingresso pelo OpenTicket.",
  EVENT_NOT_FOUND: "O evento de ingresso deste encontro nao esta mais ativo.",
  NO_BATCH_AVAILABLE:
    "Nenhum lote ativo com 2 ingressos livres para este encontro.",
  SEATS_SOLD_OUT: "Nao ha 2 assentos lado a lado livres neste evento.",
  PAIRED_STORAGE_UNAVAILABLE:
    "Compra pareada indisponivel no momento. Tente de novo em instantes.",
};

/** Motivos que o backend devolve em `pendingReason` apos criar o pedido. */
const PENDING_LABEL: Record<string, string> = {
  ASAAS_NOT_CONFIGURED:
    "Pedido criado e assentos reservados. O pagamento online esta desligado neste ambiente — combine o acerto com o organizador.",
  BUYER_CPF_MISSING:
    "Pedido criado e assentos reservados, mas falta o CPF no seu perfil para gerar a cobranca.",
  PAYMENT_GATEWAY_ERROR:
    "Pedido criado e assentos reservados, mas a cobranca falhou. Tente gerar o pagamento de novo.",
  ALREADY_CREATED: "Voces ja tinham um pedido pareado para este encontro.",
};

type CardState = "idle" | "loading" | "ready" | "error";

export function ComprarJuntosCard({
  partnerEventId,
  partnerEventTitle,
  externalUrl,
  fixedMatchId,
  defaultOpen = false,
}: {
  partnerEventId: string;
  partnerEventTitle: string;
  /** Link do parceiro — unica saida quando o encontro nao vende pelo OT. */
  externalUrl?: string | null;
  /** Casal ja definido (uso no /chat/[id]); sem ele o usuario escolhe. */
  fixedMatchId?: string | null;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [state, setState] = useState<CardState>("idle");
  const [quote, setQuote] = useState<PairedTicketQuote | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(
    fixedMatchId ?? null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [order, setOrder] = useState<PairedTicketOrderResult | null>(null);

  const loadQuote = useCallback(async () => {
    setState("loading");
    setErrorMessage(null);
    try {
      const data = await gql<{ pairedTicketQuote: PairedTicketQuote }>(
        PAIRED_QUOTE_QUERY,
        { input: { partnerEventId } },
      );
      const q = data.pairedTicketQuote;
      setQuote(q);
      // Sem casal fixado, pre-seleciona o match mais recente ainda nao comprado.
      if (!fixedMatchId) {
        const firstFree = q.options.find((o) => !o.alreadyPurchased);
        setSelectedMatchId(firstFree?.matchId ?? q.options[0]?.matchId ?? null);
      }
      setState("ready");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Falha ao carregar a cotacao",
      );
      setState("error");
    }
  }, [partnerEventId, fixedMatchId]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && state === "idle") void loadQuote();
  };

  const submit = async () => {
    if (!selectedMatchId || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const data = await gql<{
        createPairedTicketOrder: PairedTicketOrderResult;
      }>(CREATE_PAIRED_ORDER_MUTATION, {
        input: { matchId: selectedMatchId, partnerEventId },
      });
      setOrder(data.createPairedTicketOrder);
      // Re-cota: assentos e disponibilidade mudaram com esta compra.
      void loadQuote();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Falha ao criar o pedido pareado",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const selectedOption =
    quote?.options.find((o) => o.matchId === selectedMatchId) ?? null;

  return (
    <section className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/5 overflow-hidden">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-fuchsia-500/10 transition-colors"
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold">
            Comprar juntos
          </span>
          <span className="block text-[11px] opacity-70 truncate">
            2 ingressos lado a lado — {partnerEventTitle}
          </span>
        </span>
        <span aria-hidden className="text-xs opacity-70">
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-fuchsia-500/20">
          {state === "loading" && (
            <div role="status" aria-live="polite" className="space-y-2 pt-2">
              <div className="h-4 w-2/3 rounded bg-fuchsia-500/10 animate-pulse" />
              <div className="h-4 w-1/2 rounded bg-fuchsia-500/10 animate-pulse" />
              <div className="h-9 w-full rounded bg-fuchsia-500/10 animate-pulse" />
            </div>
          )}

          {state === "error" && (
            <div role="alert" className="pt-2">
              <p className="text-sm text-rose-400">{errorMessage}</p>
              <button
                type="button"
                onClick={() => void loadQuote()}
                className="mt-2 px-3 py-1.5 text-xs rounded-lg border border-rose-500/50 hover:bg-rose-500/10"
              >
                Tentar de novo
              </button>
            </div>
          )}

          {state === "ready" && quote && (
            <>
              {/* Encontro sem ticketing no OT / sem lote / sem assento */}
              {!quote.available && (
                <div className="pt-2">
                  <p className="text-sm opacity-80">
                    {UNAVAILABLE_LABEL[quote.unavailableReason ?? ""] ??
                      "Compra pareada indisponivel para este encontro."}
                  </p>
                  {quote.unavailableReason === "NOT_TICKETED" && externalUrl && (
                    <a
                      href={externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-2 text-xs text-fuchsia-300 hover:text-fuchsia-200 underline"
                    >
                      Ir para o site do parceiro
                    </a>
                  )}
                </div>
              )}

              {quote.available && (
                <>
                  {/* Preco real do lote + taxa (motor unico da frota) */}
                  <dl className="text-xs space-y-1 pt-2">
                    <div className="flex justify-between gap-4">
                      <dt className="opacity-70">
                        {quote.tierName ?? "Ingresso"} ×{quote.quantity}
                      </dt>
                      <dd className="font-mono">{BRL.format(quote.subtotal)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="opacity-70">Taxa de servico</dt>
                      <dd className="font-mono">
                        {BRL.format(quote.serviceFee)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4 pt-1 border-t border-fuchsia-500/20">
                      <dt className="font-semibold">Total do casal</dt>
                      <dd className="font-mono font-semibold">
                        {BRL.format(quote.totalAmount)}
                      </dd>
                    </div>
                  </dl>

                  {/* Assentos */}
                  <p className="text-xs opacity-80">
                    {quote.seatMapAvailable && quote.previewSeats.length === 2
                      ? `Assentos lado a lado: ${quote.previewSeats[0]} e ${quote.previewSeats[1]}`
                      : "Este evento nao tem mapa de assentos — os 2 ingressos saem no mesmo pedido, sem lugar marcado."}
                  </p>

                  {/* Escolha do casal (so quando nao veio do chat) */}
                  {!fixedMatchId && (
                    <div className="space-y-1">
                      <label
                        htmlFor={`paired-match-${partnerEventId}`}
                        className="block text-xs opacity-70"
                      >
                        Com quem voce vai
                      </label>
                      {quote.options.length === 0 ? (
                        <p className="text-xs opacity-80">
                          Voce ainda nao tem match ativo. Da um match e volta
                          aqui para comprar os dois ingressos juntos.
                        </p>
                      ) : (
                        <select
                          id={`paired-match-${partnerEventId}`}
                          value={selectedMatchId ?? ""}
                          onChange={(e) => setSelectedMatchId(e.target.value)}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-fuchsia-500/30 bg-background"
                        >
                          {quote.options.map((o) => (
                            <option key={o.matchId} value={o.matchId}>
                              {(o.partnerDisplayName ??
                                `Match ${o.matchId.slice(0, 8)}`) +
                                (o.alreadyPurchased ? " — ja comprado" : "")}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}

                  {selectedOption?.alreadyPurchased && (
                    <p className="text-xs opacity-80">
                      Voces ja tem um pedido pareado para este encontro. Comprar
                      de novo devolve o mesmo pedido, sem cobranca duplicada.
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => void submit()}
                    disabled={!selectedMatchId || submitting}
                    className="w-full px-4 py-2.5 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitting
                      ? "Reservando os dois lugares..."
                      : `Comprar juntos — ${BRL.format(quote.totalAmount)}`}
                  </button>

                  {submitError && (
                    <p className="text-xs text-rose-400" role="alert">
                      {submitError}
                    </p>
                  )}
                </>
              )}

              {/* Resultado da compra */}
              {order && (
                <div className="rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10 p-3 space-y-2">
                  <p className="text-sm font-semibold">
                    Pedido pareado criado
                    {order.ticketOrderId
                      ? ` · #${order.ticketOrderId.slice(0, 8)}`
                      : ""}
                  </p>
                  <p className="text-xs opacity-80">
                    {order.seats.length === 2
                      ? `Assentos reservados: ${order.seats[0]} e ${order.seats[1]}`
                      : "2 ingressos no mesmo pedido (evento sem lugar marcado)."}
                  </p>
                  <p className="text-xs opacity-80">
                    Status: {order.status} · Total{" "}
                    {BRL.format(order.totalAmount)}
                  </p>

                  {order.checkoutUrl && (
                    <a
                      href={order.checkoutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block px-3 py-1.5 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-xs font-semibold"
                    >
                      Pagar agora
                    </a>
                  )}

                  {order.pixQrCodeImage && (
                    <div className="space-y-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`data:image/png;base64,${order.pixQrCodeImage}`}
                        alt="QR Code PIX do pedido pareado"
                        className="w-40 h-40 rounded bg-white p-1"
                      />
                      {order.pixQrCode && (
                        <code className="block text-[10px] break-all opacity-70">
                          {order.pixQrCode}
                        </code>
                      )}
                    </div>
                  )}

                  {order.pendingReason && (
                    <p className="text-xs opacity-80">
                      {PENDING_LABEL[order.pendingReason] ??
                        `Pendencia: ${order.pendingReason}`}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

export default ComprarJuntosCard;
