// Relacionamentos — Chat (per-match)
// W4-REDO: WIRE_REAL — mensagens via GraphQL messagesInConversation
// (ConversationResolver) + envio via mutation sendMessage. `id` da rota e o
// conversationId (RelacConversation.id, vindo de /chat). Alinhamento (fromMe)
// resolvido comparando senderId com myMatchProfile.profileId (== user.sub).
// Zero-mock: sem conversa fake; estados loading/ready/empty/error reais.
//
// Onda I (s6) CHAT MEDIA: anexo de foto/audio/gif via R2 (presigned PUT).
//   Fluxo: prepareMessageUpload (mutation) -> PUT bytes direto no R2 ->
//   sendMessage com attachmentUrl/Type/Mime. Render inline por tipo. O backend
//   modera o anexo (attachmentStatus PENDING ate liberar).
//
// REL-G1 (2026-07-25) COMPRAR JUNTOS: a conversa ganha o card de encontro com
//   ingresso pareado. A rota entrega o conversationId; o matchId (que a compra
//   pareada exige) sai de `myConversations`, que ja expoe `matchId` por
//   conversa. Encontros listados via `partnerEvents`, filtrados aos que estao
//   bookados no OT (ticketingEventId != null). O bloco carrega SOZINHO: se
//   falhar, o chat continua funcionando normalmente.

"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, use } from "react";
import { ComprarJuntosCard } from "@/components/ComprarJuntosCard";

const MESSAGES_QUERY = /* GraphQL */ `
  query MessagesInConversation($input: ListMessagesInput!) {
    messagesInConversation(input: $input) {
      id
      conversationId
      senderId
      content
      attachmentUrl
      attachmentType
      attachmentMime
      attachmentStatus
      ephemeral
      expiresAt
      viewOnce
      viewedAt
      attachmentPurgedAt
      createdAt
      readAt
    }
  }
`;

const MY_PROFILE_QUERY = /* GraphQL */ `
  query MyMatchProfileId {
    myMatchProfile {
      profileId
    }
  }
`;

const SEND_MESSAGE_MUTATION = /* GraphQL */ `
  mutation SendMessage($input: SendMessageInput!) {
    sendMessage(input: $input) {
      id
      conversationId
      senderId
      content
      attachmentUrl
      attachmentType
      attachmentMime
      attachmentStatus
      ephemeral
      expiresAt
      viewOnce
      viewedAt
      attachmentPurgedAt
      createdAt
      readAt
    }
  }
`;

// REL-S7 — foto temporaria. O receiver abriu o anexo efemero: marca viewedAt e,
// se viewOnce, dispara o purge REAL do binario no R2 (o backend devolve
// attachmentUrl null + attachmentPurgedAt).
const MARK_MEDIA_VIEWED_MUTATION = /* GraphQL */ `
  mutation MarkMediaViewed($input: MarkMediaViewedInput!) {
    markMediaViewed(input: $input) {
      id
      attachmentUrl
      attachmentMime
      attachmentStatus
      viewedAt
      attachmentPurgedAt
    }
  }
`;

const PREPARE_UPLOAD_MUTATION = /* GraphQL */ `
  mutation PrepareMessageUpload($input: PrepareMessageUploadInput!) {
    prepareMessageUpload(input: $input) {
      key
      uploadUrl
      attachmentUrl
      attachmentType
      attachmentMime
    }
  }
`;

// REL-G1 — conversationId -> matchId (a compra pareada e por MATCH, nao por
// conversa). `myConversations` ja devolve os dois ids; nao ha query dedicada e
// nao vamos inventar uma no client.
const MY_CONVERSATIONS_QUERY = /* GraphQL */ `
  query MyConversationsForPaired {
    myConversations {
      id
      matchId
    }
  }
`;

// REL-G1 — encontros curados; so os com ticketingEventId vendem pelo OT.
const PARTNER_EVENTS_QUERY = /* GraphQL */ `
  query PartnerEventsForPaired($input: PartnerEventsInput) {
    partnerEvents(input: $input) {
      id
      title
      startsAt
      externalUrl
      ticketingEventId
    }
  }
`;

// MIMEs aceitos pelo backend (CHAT_ATTACHMENT_MIME em conversation.service.ts).
const ACCEPTED_MIME =
  "image/jpeg,image/png,image/webp,image/avif,image/gif,audio/webm,audio/mp4,audio/mpeg,audio/ogg,audio/wav";
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10MB

interface RelacMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  attachmentUrl: string | null;
  attachmentType: string | null;
  attachmentMime: string | null;
  attachmentStatus: string | null;
  // REL-S7 — foto temporaria (midia efemera).
  ephemeral?: boolean | null;
  expiresAt?: string | null;
  viewOnce?: boolean | null;
  viewedAt?: string | null;
  attachmentPurgedAt?: string | null;
  createdAt: string;
  readAt: string | null;
}

interface PrepareUploadResult {
  key: string;
  uploadUrl: string;
  attachmentUrl: string;
  attachmentType: string;
  attachmentMime: string;
}

type LoadState = "loading" | "ready" | "empty" | "error";

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
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const json = (await res.json()) as {
    data?: T;
    errors?: { message: string }[];
  };
  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors[0]?.message ?? "GraphQL error");
  }
  if (!json.data) throw new Error("No data returned");
  return json.data;
}

export default function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: conversationId } = use(params);
  const [messages, setMessages] = useState<RelacMessage[]>([]);
  const [myProfileId, setMyProfileId] = useState<string | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  // REL-S7 — foto temporaria. Flags aplicadas ao PROXIMO anexo enviado.
  const [ephemeralNext, setEphemeralNext] = useState(false);
  const [viewOnceNext, setViewOnceNext] = useState(false);
  // Ids de anexos view-once ja revelados NESTA sessao — mantem a <img> na tela
  // mesmo depois do purge server-side (o backend zera a URL; o browser segura os
  // bytes ja baixados). No reload volta como "foto expirada".
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const [meRes, msgRes] = await Promise.all([
        gql<{ myMatchProfile: { profileId: string } | null }>(MY_PROFILE_QUERY),
        gql<{ messagesInConversation: RelacMessage[] | null }>(MESSAGES_QUERY, {
          input: { conversationId, limit: 100 },
        }),
      ]);
      setMyProfileId(meRes.myMatchProfile?.profileId ?? null);
      const items = msgRes.messagesInConversation ?? [];
      const sorted = [...items].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      setMessages(sorted);
      setState(sorted.length === 0 ? "empty" : "ready");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Falha ao carregar mensagens";
      setErrorMessage(msg);
      setState("error");
    }
  }, [conversationId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await gql<{ sendMessage: RelacMessage }>(
        SEND_MESSAGE_MUTATION,
        { input: { conversationId, content } },
      );
      setMessages((prev) => [...prev, res.sendMessage]);
      setDraft("");
      if (state === "empty") setState("ready");
    } catch (err) {
      setSendError(
        err instanceof Error ? err.message : "Falha ao enviar mensagem",
      );
    } finally {
      setSending(false);
    }
  };

  // Anexo: 1) prepareMessageUpload -> presigned PUT R2; 2) PUT bytes direto no
  // R2; 3) sendMessage com a attachmentUrl. Zero-mock: se o backend nao tem R2
  // configurado, prepareMessageUpload retorna erro NOT_IMPLEMENTED e mostramos.
  const handleAttachment = async (file: File) => {
    if (uploading || sending) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setSendError("Anexo grande demais (max 10MB).");
      return;
    }
    setUploading(true);
    setSendError(null);
    try {
      // 1) Pede a URL pre-assinada (scoped por conversa, anti-IDOR no backend).
      const prep = await gql<{ prepareMessageUpload: PrepareUploadResult }>(
        PREPARE_UPLOAD_MUTATION,
        { input: { conversationId, contentType: file.type } },
      );
      const { uploadUrl, attachmentUrl, attachmentType, attachmentMime } =
        prep.prepareMessageUpload;

      // 2) Sobe os bytes direto pro R2 (sem proxy de bytes pelo server).
      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": attachmentMime },
        body: file,
      });
      if (!put.ok) {
        throw new Error(`Falha no upload pro storage (HTTP ${put.status}).`);
      }

      // 3) Envia a mensagem com o anexo (content opcional vai junto se houver).
      // REL-S7: marca a foto como temporaria (ephemeral) e/ou visualizacao unica
      // (viewOnce). viewOnce implica ephemeral no backend. A expiracao acontece
      // no backend (o binario some do R2), nao so escondida aqui.
      const res = await gql<{ sendMessage: RelacMessage }>(
        SEND_MESSAGE_MUTATION,
        {
          input: {
            conversationId,
            content: draft.trim() || undefined,
            attachmentUrl,
            attachmentType,
            attachmentMime,
            ephemeral: ephemeralNext || viewOnceNext,
            viewOnce: viewOnceNext,
          },
        },
      );
      setMessages((prev) => [...prev, res.sendMessage]);
      setDraft("");
      // Reseta as flags de efemero apos o envio (nao "gruda" no proximo anexo).
      setEphemeralNext(false);
      setViewOnceNext(false);
      if (state === "empty") setState("ready");
    } catch (err) {
      setSendError(
        err instanceof Error ? err.message : "Falha ao enviar anexo",
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // REL-S7 — o receiver abriu uma foto view-once. Revela localmente (guarda os
  // bytes na tela) e dispara markMediaViewed, que purga o binario no R2. Chamado
  // no onLoad da <img> pra garantir que os bytes ja foram baixados antes do purge.
  const handleMarkViewed = useCallback(async (messageId: string) => {
    try {
      const res = await gql<{ markMediaViewed: Partial<RelacMessage> }>(
        MARK_MEDIA_VIEWED_MUTATION,
        { input: { messageId } },
      );
      // Merge SO os campos de estado (viewedAt/purged/status) — NAO sobrescreve
      // attachmentUrl local com null, senao a <img> revelada sumiria na hora.
      const patch = res.markMediaViewed;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                viewedAt: patch.viewedAt ?? m.viewedAt,
                attachmentPurgedAt:
                  patch.attachmentPurgedAt ?? m.attachmentPurgedAt,
                attachmentStatus: patch.attachmentStatus ?? m.attachmentStatus,
              }
            : m,
        ),
      );
    } catch (err) {
      setSendError(
        err instanceof Error ? err.message : "Falha ao abrir a foto",
      );
    }
  }, []);

  const revealViewOnce = useCallback((messageId: string) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      next.add(messageId);
      return next;
    });
  }, []);

  return (
    <main className="min-h-screen flex flex-col max-w-2xl mx-auto">
      <header className="flex items-center gap-3 p-4 border-b border-border">
        <Link
          href="/chat"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ←
        </Link>
        <div className="flex items-center gap-3 flex-1">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-fuchsia-300 to-rose-400" />
          </div>
          <div>
            <h1 className="font-semibold">Conversa</h1>
            <p className="text-xs text-muted-foreground font-mono">
              {conversationId.slice(0, 8)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/denuncias/nova?target=${conversationId}`}
            className="text-xs text-muted-foreground hover:text-red-600"
            title="Denunciar"
          >
            🚨
          </Link>
          <Link
            href="/chat/configuracoes"
            className="text-xs text-muted-foreground hover:text-foreground"
            title="Configurações"
          >
            ⚙
          </Link>
        </div>
      </header>

      <div className="bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-900/30 px-4 py-2">
        <p className="text-[11px] text-amber-800 dark:text-amber-200 text-center">
          Nunca compartilhe codigos de WhatsApp, CPF, senhas ou dados bancarios.
        </p>
      </div>

      {/* REL-G1 — sugestao de encontro com ingresso pareado pro casal desta
          conversa. Carrega sozinho e some quando nao ha nada real pra oferecer. */}
      <ComprarJuntosSection conversationId={conversationId} />

      <section className="flex-1 p-4 space-y-3 overflow-y-auto min-h-[400px]">
        {/* Loading */}
        {state === "loading" &&
          [1, 2, 3].map((i) => (
            <div
              key={i}
              className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}
            >
              <div className="h-10 w-40 rounded-2xl bg-muted/40 animate-pulse" />
            </div>
          ))}

        {/* Error */}
        {state === "error" && (
          <div
            className="text-center py-10 border border-rose-800 rounded-xl bg-rose-950/20"
            role="alert"
          >
            <p className="font-medium text-rose-300">
              Nao foi possivel carregar a conversa
            </p>
            <p className="text-sm text-rose-400/80 mt-2">{errorMessage}</p>
            <button
              onClick={() => load()}
              className="mt-4 px-4 py-2 text-sm rounded-lg border border-rose-700 hover:bg-rose-900/40"
            >
              Tentar de novo
            </button>
          </div>
        )}

        {/* Empty */}
        {state === "empty" && (
          <div className="text-center py-10 text-muted-foreground">
            <p className="text-3xl mb-2">👋</p>
            <p className="text-sm">
              Nenhuma mensagem ainda. Mande a primeira.
            </p>
          </div>
        )}

        {/* Ready */}
        {(state === "ready" || (state === "empty" && messages.length > 0)) &&
          messages.map((m) => {
            const fromMe = myProfileId != null && m.senderId === myProfileId;
            return (
              <div
                key={m.id}
                className={`flex ${fromMe ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                    fromMe
                      ? "bg-fuchsia-600 text-white"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {(m.attachmentUrl || m.attachmentType) && (
                    <Attachment
                      message={m}
                      fromMe={fromMe}
                      revealed={revealedIds.has(m.id)}
                      onReveal={revealViewOnce}
                      onViewed={handleMarkViewed}
                    />
                  )}
                  {m.content && (
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {m.content}
                    </p>
                  )}
                  <div
                    className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                      fromMe ? "text-fuchsia-100" : "text-muted-foreground"
                    }`}
                  >
                    <span>
                      {new Date(m.createdAt).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {fromMe && <span>{m.readAt ? "✓✓" : "✓"}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        <div ref={bottomRef} />
      </section>

      {sendError && (
        <p className="px-4 pb-1 text-xs text-rose-400" role="alert">
          {sendError}
        </p>
      )}

      {/* REL-S7 — modo foto temporaria. Aplica ao PROXIMO anexo. viewOnce
          (ver uma vez) implica temporaria. */}
      <div className="px-4 pt-2 flex flex-wrap gap-2 items-center border-t border-border">
        <span className="text-[11px] text-muted-foreground">Foto:</span>
        <button
          type="button"
          onClick={() => {
            const next = !ephemeralNext;
            setEphemeralNext(next);
            if (!next) setViewOnceNext(false);
          }}
          aria-pressed={ephemeralNext}
          disabled={uploading}
          className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors disabled:opacity-50 ${
            ephemeralNext
              ? "bg-fuchsia-600 text-white border-fuchsia-600"
              : "border-border text-muted-foreground hover:bg-accent"
          }`}
          title="A foto some do servidor depois de um tempo (24h por padrao)"
        >
          ⏳ Temporária
        </button>
        <button
          type="button"
          onClick={() => {
            const next = !viewOnceNext;
            setViewOnceNext(next);
            if (next) setEphemeralNext(true);
          }}
          aria-pressed={viewOnceNext}
          disabled={uploading}
          className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors disabled:opacity-50 ${
            viewOnceNext
              ? "bg-fuchsia-600 text-white border-fuchsia-600"
              : "border-border text-muted-foreground hover:bg-accent"
          }`}
          title="A foto é apagada do servidor assim que o outro abre (visualização única)"
        >
          👁 Ver uma vez
        </button>
        {(ephemeralNext || viewOnceNext) && (
          <span className="text-[10px] text-fuchsia-500">
            {viewOnceNext
              ? "some ao ser aberta"
              : "some do servidor em 24h"}
          </span>
        )}
      </div>

      <form
        onSubmit={handleSendText}
        className="p-4 border-t-0 flex gap-2 items-center"
      >
        {/* Anexo: foto / audio / gif via R2 (presigned PUT). */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_MIME}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleAttachment(f);
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || sending}
          title="Anexar foto, audio ou GIF"
          aria-label="Anexar foto, audio ou GIF"
          className="px-3 py-2 rounded-full border border-border hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed text-lg"
        >
          {uploading ? "⏳" : "📎"}
        </button>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Mensagem..."
          className="flex-1 px-4 py-2 border border-border rounded-full bg-background"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending || uploading}
          className="px-6 py-2 rounded-full bg-fuchsia-600 text-white font-medium hover:bg-fuchsia-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sending ? "..." : "Enviar"}
        </button>
      </form>
    </main>
  );
}

/**
 * REL-G1 — bloco "comprar juntos" dentro da conversa.
 *
 * Resolve o matchId da conversa (via `myConversations`) e lista os encontros
 * que REALMENTE vendem ingresso pelo OT (`ticketingEventId != null`). Cada um
 * vira um ComprarJuntosCard ja com o casal fixado — o usuario nao precisa
 * escolher com quem vai, e a conversa que diz.
 *
 * Some por completo (render null) quando nao ha matchId ou nao ha encontro
 * bookado: nada de card vazio prometendo o que nao existe. Erro aqui NAO
 * derruba o chat — e um bloco lateral, carregado de forma independente.
 */
function ComprarJuntosSection({
  conversationId,
}: {
  conversationId: string;
}) {
  const [matchId, setMatchId] = useState<string | null>(null);
  const [events, setEvents] = useState<
    Array<{
      id: string;
      title: string;
      startsAt: string;
      externalUrl: string | null;
      ticketingEventId: string | null;
    }>
  >([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [convRes, evtRes] = await Promise.all([
          gql<{ myConversations: Array<{ id: string; matchId: string }> | null }>(
            MY_CONVERSATIONS_QUERY,
          ),
          gql<{
            partnerEvents: Array<{
              id: string;
              title: string;
              startsAt: string;
              externalUrl: string | null;
              ticketingEventId: string | null;
            }> | null;
          }>(PARTNER_EVENTS_QUERY, { input: { limit: 20 } }),
        ]);
        if (cancelled) return;
        const conv = (convRes.myConversations ?? []).find(
          (c) => c.id === conversationId,
        );
        setMatchId(conv?.matchId ?? null);
        setEvents(
          (evtRes.partnerEvents ?? []).filter((e) => !!e.ticketingEventId),
        );
      } catch {
        // Silencioso de proposito: sem encontro pareado o chat segue igual.
        if (!cancelled) {
          setMatchId(null);
          setEvents([]);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  if (!matchId || events.length === 0) return null;

  return (
    <div className="px-4 py-3 border-b border-border space-y-2">
      <p className="text-[11px] text-muted-foreground">
        Sugestao de encontro — comprem os dois ingressos juntos
      </p>
      {events.slice(0, 3).map((e) => (
        <ComprarJuntosCard
          key={e.id}
          partnerEventId={e.id}
          partnerEventTitle={e.title}
          externalUrl={e.externalUrl}
          fixedMatchId={matchId}
        />
      ))}
    </div>
  );
}

/**
 * Render inline do anexo por tipo. attachmentStatus PENDING mostra um aviso de
 * moderacao (o backend libera apos o classificador). image/gif -> <img>,
 * audio -> <audio controls>.
 *
 * REL-S7 — foto temporaria (midia efemera):
 *  - gone: o backend purgou o binario (attachmentPurgedAt / attachmentUrl null
 *    num anexo efemero) -> placeholder "Foto expirada". A expiracao eh REAL:
 *    o arquivo some do R2, nao eh so escondido aqui.
 *  - viewOnce ainda nao aberta pelo receiver -> gate "Toque para ver (uma vez)".
 *    Ao abrir, a <img> baixa os bytes e no onLoad dispara onViewed -> o backend
 *    apaga o binario. `revealed` segura a foto na tela nesta sessao; no reload
 *    volta como expirada.
 *  - efemera com TTL -> badge de expiracao.
 */
function Attachment({
  message,
  fromMe,
  revealed,
  onReveal,
  onViewed,
}: {
  message: RelacMessage;
  fromMe: boolean;
  revealed: boolean;
  onReveal: (id: string) => void;
  onViewed: (id: string) => void;
}) {
  const {
    id,
    attachmentUrl,
    attachmentType,
    attachmentStatus,
    ephemeral,
    expiresAt,
    viewOnce,
    attachmentPurgedAt,
  } = message;

  const pending = attachmentStatus === "PENDING";
  const isAudio = attachmentType === "audio";

  // Sumiu de verdade: backend purgou (attachmentPurgedAt) ou zerou a URL de um
  // anexo efemero. `revealed` (view-once aberta nesta sessao) tem prioridade e
  // mantem a <img> na tela mesmo apos o purge server-side.
  const gone =
    !revealed && !!ephemeral && (attachmentPurgedAt != null || !attachmentUrl);

  if (gone) {
    return (
      <div className="mb-1.5 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-4 text-center">
        <p className="text-2xl leading-none">🫥</p>
        <p className="text-[11px] text-muted-foreground mt-1">Foto expirada</p>
      </div>
    );
  }

  // View-once ainda nao aberta pelo receiver: mostra o gate.
  const viewOnceGate =
    !!viewOnce && !fromMe && !revealed && attachmentUrl != null;
  if (viewOnceGate) {
    return (
      <button
        type="button"
        onClick={() => onReveal(id)}
        className="mb-1.5 w-full rounded-lg border border-fuchsia-400/50 bg-fuchsia-500/10 px-3 py-5 text-center hover:bg-fuchsia-500/20 transition-colors"
        title="Visualização única — some do servidor ao abrir"
      >
        <p className="text-2xl leading-none">👁</p>
        <p className="text-[11px] mt-1 font-medium">Toque para ver (uma vez)</p>
      </button>
    );
  }

  if (!attachmentUrl) return null;

  // So dispara o purge quando eh o receiver revelando uma view-once (o onLoad
  // garante que os bytes ja foram baixados antes do backend apagar).
  const revealPurge = !!viewOnce && !fromMe && revealed;

  return (
    <div className="mb-1.5">
      {isAudio ? (
        <audio
          controls
          src={attachmentUrl}
          className="w-full max-w-[260px]"
          preload="metadata"
        />
      ) : (
        /* image | gif */
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={attachmentUrl}
          alt={attachmentType === "gif" ? "GIF" : "Foto"}
          className="rounded-lg max-h-64 w-auto object-cover"
          loading="lazy"
          onLoad={revealPurge ? () => onViewed(id) : undefined}
        />
      )}
      {pending && (
        <p className="text-[10px] opacity-80 mt-0.5">⏳ Em moderacao</p>
      )}
      {ephemeral && (
        <EphemeralBadge
          viewOnce={!!viewOnce}
          expiresAt={expiresAt ?? null}
          revealed={revealed}
        />
      )}
    </div>
  );
}

/** Rotulo do estado efemero: visualizacao unica ou countdown de expiracao. */
function EphemeralBadge({
  viewOnce,
  expiresAt,
  revealed,
}: {
  viewOnce: boolean;
  expiresAt: string | null;
  revealed: boolean;
}) {
  if (viewOnce) {
    return (
      <p className="text-[10px] text-fuchsia-500 mt-0.5">
        👁 {revealed ? "vista — apagada do servidor" : "some ao abrir"}
      </p>
    );
  }
  const label = formatRemaining(expiresAt);
  if (!label) return null;
  return <p className="text-[10px] text-fuchsia-500 mt-0.5">⏳ {label}</p>;
}

/** Tempo restante ate a expiracao, em rotulo curto pt-BR. */
function formatRemaining(iso: string | null): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  if (ms <= 0) return "expirando...";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 1) return `expira em ${h}h`;
  if (m >= 1) return `expira em ${m}min`;
  return "expira em <1min";
}
