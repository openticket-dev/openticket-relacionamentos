// Relacionamentos — Chat Configurações
// Sprint M8-2. Silenciar, bloqueados, deletar conversa, leitura, online status.

"use client";

import Link from "next/link";
import { useState } from "react";

export default function ChatConfigPage() {
  const [showOnlineStatus, setShowOnlineStatus] = useState(true);
  const [readReceipts, setReadReceipts] = useState(true);
  const [muteAll, setMuteAll] = useState(false);
  const [autoTranslate, setAutoTranslate] = useState(false);

  // SEED: vazio. W-R-5 ligara queryBlockedUsers().
  const blockedUsers: { id: string; name: string }[] = [];

  return (
    <main className="min-h-screen max-w-2xl mx-auto p-4">
      <header className="flex items-center gap-3 mb-6">
        <Link
          href="/chat"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Conversas
        </Link>
        <h1 className="font-semibold text-xl">Configurações do Chat</h1>
      </header>

      <section className="space-y-1 mb-8">
        <h2 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-3">
          Privacidade
        </h2>

        <div className="flex items-center justify-between p-4 rounded-lg border border-border">
          <div>
            <p className="font-medium text-sm">Mostrar quando estou online</p>
            <p className="text-xs text-muted-foreground">
              Outros usuarios verao seu status em tempo real
            </p>
          </div>
          <button
            onClick={() => setShowOnlineStatus(!showOnlineStatus)}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              showOnlineStatus ? "bg-fuchsia-600" : "bg-muted"
            }`}
            role="switch"
            aria-checked={showOnlineStatus}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                showOnlineStatus ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between p-4 rounded-lg border border-border">
          <div>
            <p className="font-medium text-sm">Confirmacao de leitura</p>
            <p className="text-xs text-muted-foreground">
              Mostrar quando leu mensagens (e ver quando leram as suas)
            </p>
          </div>
          <button
            onClick={() => setReadReceipts(!readReceipts)}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              readReceipts ? "bg-fuchsia-600" : "bg-muted"
            }`}
            role="switch"
            aria-checked={readReceipts}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                readReceipts ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </section>

      <section className="space-y-1 mb-8">
        <h2 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-3">
          Notificacoes
        </h2>

        <div className="flex items-center justify-between p-4 rounded-lg border border-border">
          <div>
            <p className="font-medium text-sm">Silenciar todas as conversas</p>
            <p className="text-xs text-muted-foreground">
              Voce ainda recebera as mensagens, sem som
            </p>
          </div>
          <button
            onClick={() => setMuteAll(!muteAll)}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              muteAll ? "bg-fuchsia-600" : "bg-muted"
            }`}
            role="switch"
            aria-checked={muteAll}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                muteAll ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between p-4 rounded-lg border border-border">
          <div>
            <p className="font-medium text-sm">Traducao automatica</p>
            <p className="text-xs text-muted-foreground">
              Premium: traduz mensagens em tempo real
            </p>
          </div>
          <button
            onClick={() => setAutoTranslate(!autoTranslate)}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              autoTranslate ? "bg-fuchsia-600" : "bg-muted"
            }`}
            role="switch"
            aria-checked={autoTranslate}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                autoTranslate ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-3">
          Bloqueados ({blockedUsers.length})
        </h2>
        {blockedUsers.length === 0 ? (
          <div className="p-6 text-center rounded-lg border border-dashed border-border">
            <p className="text-sm text-muted-foreground">
              Nenhum usuario bloqueado.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Bloqueios feitos em conversas aparecem aqui.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden">
            {blockedUsers.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between p-4"
              >
                <span className="text-sm">{u.name}</span>
                <button className="text-xs text-fuchsia-600 hover:text-fuchsia-700 font-medium">
                  Desbloquear
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-t border-border pt-6">
        <h2 className="text-xs font-semibold uppercase text-red-600 tracking-wider mb-3">
          Zona de risco
        </h2>
        <button className="w-full p-4 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900/30">
          Limpar histórico de todas as conversas
        </button>
      </section>
    </main>
  );
}
