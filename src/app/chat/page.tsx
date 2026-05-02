// Relacionamentos — Lista de conversas
// Sprint M8-2 (FECHA M8). Apollo Client + queries reais virao em W-R-5.
// Honest empty state quando nao houver conversas.

"use client";

import Link from "next/link";
import { useState } from "react";

type Conversation = {
  id: string;
  matchName: string;
  lastMessage: string;
  lastTs: number;
  unreadCount: number;
  online: boolean;
};

// SEED: empty array por enquanto. W-R-5 ligara queryConversations().
const SEED_CONVERSATIONS: Conversation[] = [];

export default function ChatListPage() {
  const [search, setSearch] = useState("");
  const [conversations] = useState<Conversation[]>(SEED_CONVERSATIONS);

  const filtered = conversations.filter((c) =>
    c.matchName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className="min-h-screen max-w-2xl mx-auto">
      <header className="sticky top-0 bg-background/95 backdrop-blur border-b border-border p-4 z-10">
        <div className="flex items-center justify-between mb-3">
          <Link
            href="/matches"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Matches
          </Link>
          <h1 className="font-semibold">Conversas</h1>
          <Link
            href="/chat/configuracoes"
            className="text-sm text-fuchsia-600 hover:text-fuchsia-700"
          >
            Config
          </Link>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar conversa..."
          className="w-full px-4 py-2 border border-border rounded-full bg-background text-sm"
        />
      </header>

      <div className="bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-900/30 p-3">
        <p className="text-xs text-amber-800 dark:text-amber-200">
          Lembrete de seguranca: nunca compartilhe dados pessoais (CPF, endereco, senhas) ou
          codigos de WhatsApp em conversas. Em caso de assedio, denuncie pelo botao de cada perfil.
        </p>
      </div>

      <section className="divide-y divide-border">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-4xl mb-3">💬</p>
            <p className="font-semibold mb-1">Nenhuma conversa ainda</p>
            <p className="text-sm text-muted-foreground">
              {conversations.length === 0
                ? "Quando alguem virar match, a conversa aparece aqui."
                : "Nenhuma conversa bate com a busca."}
            </p>
            <Link
              href="/matches"
              className="inline-block mt-6 px-6 py-2 rounded-full bg-fuchsia-600 text-white text-sm font-medium hover:bg-fuchsia-700"
            >
              Ver matches
            </Link>
          </div>
        ) : (
          filtered.map((c) => (
            <Link
              key={c.id}
              href={`/chat/${c.id}`}
              className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-fuchsia-300 to-rose-400" />
                {c.online && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-background" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-semibold truncate">{c.matchName}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(c.lastTs).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {c.lastMessage}
                </p>
              </div>
              {c.unreadCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-fuchsia-600 text-white text-xs font-semibold">
                  {c.unreadCount}
                </span>
              )}
            </Link>
          ))
        )}
      </section>
    </main>
  );
}
