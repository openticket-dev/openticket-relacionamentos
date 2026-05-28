// Relacionamentos — Chat (per-match) — REFINADO Sprint M8-2
// Adicionado: tipos de mensagem (text, gif, audio, foto), estado online, status enviada/lida,
// banner de seguranca, botao denunciar/bloquear, indicacao de subscription Apollo (W-R-5).

"use client";

import Link from "next/link";
import { useState, use, useRef } from "react";

type MessageKind = "text" | "gif" | "audio" | "photo";

type ChatMessage = {
  id: string;
  kind: MessageKind;
  body: string;
  mediaUrl?: string;
  fromMe: boolean;
  ts: number;
  status: "sending" | "sent" | "delivered" | "read";
};

const SEED_MESSAGES: ChatMessage[] = [
  {
    id: "seed-1",
    kind: "text",
    body: "Oi! Tudo bem? Vi que voce gosta de yoga, pratica ha muito tempo?",
    fromMe: false,
    ts: Date.now() - 60_000 * 30,
    status: "read",
  },
  {
    id: "seed-2",
    kind: "text",
    body: "Tudo otimo! Comecei ha 2 anos, ja virou rotina. E voce?",
    fromMe: true,
    ts: Date.now() - 60_000 * 25,
    status: "read",
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
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [recording, setRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sendMessage = (kind: MessageKind, body: string, mediaUrl?: string) => {
    const newMsg: ChatMessage = {
      id: `local-${Date.now()}`,
      kind,
      body,
      mediaUrl,
      fromMe: true,
      ts: Date.now(),
      status: "sending",
    };
    setMessages((prev) => [...prev, newMsg]);
    // W-R-5: substituir por subscription Apollo + mutation sendMessage
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) => (m.id === newMsg.id ? { ...m, status: "sent" } : m))
      );
    }, 500);
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    sendMessage("text", draft.trim());
    setDraft("");
  };

  const handleSendGif = (gifUrl: string) => {
    sendMessage("gif", "[GIF]", gifUrl);
    setShowAttachMenu(false);
  };

  const handleSendPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    sendMessage("photo", "[Foto]", url);
    setShowAttachMenu(false);
  };

  const handleToggleAudio = () => {
    if (!recording) {
      setRecording(true);
      // W-R-5: MediaRecorder API + upload R2
    } else {
      setRecording(false);
      sendMessage("audio", "[Audio 0:08]", "audio-placeholder");
    }
  };

  const statusIcon = (s: ChatMessage["status"]) => {
    if (s === "sending") return "⏳";
    if (s === "sent") return "✓";
    if (s === "delivered") return "✓✓";
    return "✓✓";
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
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-background" />
          </div>
          <div>
            <h1 className="font-semibold">Match {id}</h1>
            <p className="text-xs text-muted-foreground">Online agora</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/denuncias/nova?target=${id}`}
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
              {m.kind === "text" && <p className="text-sm">{m.body}</p>}
              {m.kind === "gif" && m.mediaUrl && (
                <div className="-mx-2 -my-1">
                  <div className="w-48 h-32 rounded-lg bg-gradient-to-br from-purple-300 to-pink-300 flex items-center justify-center text-xs">
                    GIF placeholder
                  </div>
                </div>
              )}
              {m.kind === "photo" && m.mediaUrl && (
                <div className="-mx-2 -my-1">
                  <div className="w-48 h-48 rounded-lg bg-gradient-to-br from-blue-300 to-cyan-300 flex items-center justify-center text-xs">
                    Foto enviada
                  </div>
                </div>
              )}
              {m.kind === "audio" && (
                <div className="flex items-center gap-2 min-w-[180px]">
                  <button className="text-lg">▶</button>
                  <div className="flex-1 h-1 bg-white/30 rounded-full">
                    <div className="h-1 bg-white/60 rounded-full w-0" />
                  </div>
                  <span className="text-xs">{m.body.replace("[Audio ", "").replace("]", "")}</span>
                </div>
              )}
              <div
                className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                  m.fromMe ? "text-fuchsia-100" : "text-muted-foreground"
                }`}
              >
                <span>
                  {new Date(m.ts).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                {m.fromMe && <span>{statusIcon(m.status)}</span>}
              </div>
            </div>
          </div>
        ))}
      </section>

      {showAttachMenu && (
        <div className="border-t border-border p-3 flex gap-3 justify-around bg-muted/30">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center gap-1 text-xs"
          >
            <span className="w-12 h-12 rounded-full bg-blue-500 text-white flex items-center justify-center text-xl">📷</span>
            Foto
          </button>
          <button
            onClick={() => handleSendGif("gif-placeholder")}
            className="flex flex-col items-center gap-1 text-xs"
          >
            <span className="w-12 h-12 rounded-full bg-purple-500 text-white flex items-center justify-center text-xl">🎬</span>
            GIF
          </button>
          <button
            onClick={handleToggleAudio}
            className="flex flex-col items-center gap-1 text-xs"
          >
            <span className={`w-12 h-12 rounded-full ${recording ? "bg-red-500 animate-pulse" : "bg-green-500"} text-white flex items-center justify-center text-xl`}>
              🎤
            </span>
            {recording ? "Gravando" : "Audio"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleSendPhoto}
          />
        </div>
      )}

      <form
        onSubmit={handleSendText}
        className="p-4 border-t border-border flex gap-2"
      >
        <button
          type="button"
          onClick={() => setShowAttachMenu(!showAttachMenu)}
          className="px-3 py-2 rounded-full text-muted-foreground hover:text-foreground"
          title="Anexar"
        >
          {showAttachMenu ? "✕" : "+"}
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
          disabled={!draft.trim()}
          className="px-6 py-2 rounded-full bg-fuchsia-600 text-white font-medium hover:bg-fuchsia-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Enviar
        </button>
      </form>
    </main>
  );
}
