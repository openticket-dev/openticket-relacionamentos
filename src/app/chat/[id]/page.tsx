// Relacionamentos — Chat (per-match)
// Wave: W-R-9 (initial scaffold). W-R-5 ligara socket.io realtime + persistencia.
// Input funcional: usuario escreve, mensagem aparece local.

"use client";

import Link from "next/link";
import { useState, use } from "react";

type ChatMessage = {
  id: string;
  body: string;
  fromMe: boolean;
  ts: number;
};

const SEED_MESSAGES: ChatMessage[] = [
  {
    id: "seed-1",
    body: "Mensagem placeholder — historico real virá em W-R-5 (socket.io + persistencia).",
    fromMe: false,
    ts: Date.now() - 60_000 * 5,
  },
];

export default function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [messages, setMessages] = useState<ChatMessage[]>(SEED_MESSAGES);
  const [draft, setDraft] = useState("");

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    // W-R-5: substituir por socket.io emit + mutation sendMessage
    setMessages((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        body: draft.trim(),
        fromMe: true,
        ts: Date.now(),
      },
    ]);
    setDraft("");
  };

  return (
    <main className="min-h-screen flex flex-col max-w-2xl mx-auto">
      <header className="flex items-center gap-3 p-4 border-b border-border">
        <Link
          href="/matches"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Voltar
        </Link>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-fuchsia-300 to-rose-400" />
          <div>
            <h1 className="font-semibold">Chat com match {id}</h1>
            <p className="text-xs text-muted-foreground">
              Realtime sera ligado em W-R-5
            </p>
          </div>
        </div>
      </header>

      <section className="flex-1 p-4 space-y-3 overflow-y-auto min-h-[400px]">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.fromMe ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                m.fromMe
                  ? "bg-fuchsia-600 text-white"
                  : "bg-muted text-foreground"
              }`}
            >
              <p className="text-sm">{m.body}</p>
              <p
                className={`text-[10px] mt-1 ${
                  m.fromMe ? "text-fuchsia-100" : "text-muted-foreground"
                }`}
              >
                {new Date(m.ts).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ))}
      </section>

      <form
        onSubmit={handleSend}
        className="p-4 border-t border-border flex gap-2"
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Escreva uma mensagem..."
          className="flex-1 px-4 py-2 border border-border rounded-full bg-background"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="px-6 py-2 rounded-full bg-fuchsia-600 text-white font-medium hover:bg-fuchsia-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Enviar
        </button>
      </form>
    </main>
  );
}
