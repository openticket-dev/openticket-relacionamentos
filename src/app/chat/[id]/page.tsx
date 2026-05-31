// Relacionamentos — Chat (per-match)
// W4-REDO: WIRE_REAL — mensagens via GraphQL messagesInConversation
// (ConversationResolver) + envio via mutation sendMessage. `id` da rota e o
// conversationId (RelacConversation.id, vindo de /chat). Alinhamento (fromMe)
// resolvido comparando senderId com myMatchProfile.profileId (== user.sub).
// Zero-mock: sem conversa fake; estados loading/ready/empty/error reais.
//
// NOTA de contrato (RelacMessage entity): { id conversationId senderId content
// createdAt readAt } — o gateway so trafega texto. GIF/audio/foto sao TODO de
// upload (R2) numa wave futura; por ora o envio e text-only (honesto).

"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, use } from "react";

const MESSAGES_QUERY = /* GraphQL */ `
  query MessagesInConversation($input: ListMessagesInput!) {
    messagesInConversation(input: $input) {
      id
      conversationId
      senderId
      content
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
      createdAt
      readAt
    }
  }
`;

interface RelacMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  readAt: string | null;
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
  const bottomRef = useRef<HTMLDivElement>(null);

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
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {m.content}
                  </p>
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

      <form
        onSubmit={handleSendText}
        className="p-4 border-t border-border flex gap-2"
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Mensagem..."
          className="flex-1 px-4 py-2 border border-border rounded-full bg-background"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          className="px-6 py-2 rounded-full bg-fuchsia-600 text-white font-medium hover:bg-fuchsia-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sending ? "..." : "Enviar"}
        </button>
      </form>
    </main>
  );
}
