// Relacionamentos — Admin Banidos (Sprint M8-2)
// Lista de usuarios banidos com motivo, duracao, moderador, evidencia.
// W-R-6 ligara queryBannedUsers + mutationUnban.

"use client";

import Link from "next/link";
import { useState } from "react";

type BanType = "temp" | "permanent";

type BannedUser = {
  id: string;
  userName: string;
  userId: string;
  reason: string;
  banType: BanType;
  expiresAt?: number;
  bannedAt: number;
  bannedBy: string;
  evidenceReportIds: string[];
};

// SEED vazio — W-R-6 conecta queryBannedUsers().
const BANNED: BannedUser[] = [];

export default function BanidosPage() {
  const [users, setUsers] = useState<BannedUser[]>(BANNED);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<BanType | "all">("all");

  const filtered = users.filter((u) => {
    const matchSearch = u.userName.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || u.banType === filter;
    return matchSearch && matchFilter;
  });

  const unban = (id: string) => {
    // W-R-6: mutation unbanUser(id, reason)
    if (confirm("Confirmar desbloqueio? Acao sera logada em Auditoria.")) {
      setUsers((prev) => prev.filter((u) => u.id !== id));
    }
  };

  const formatExpiry = (u: BannedUser) => {
    if (u.banType === "permanent") return "Permanente";
    if (!u.expiresAt) return "—";
    const diff = u.expiresAt - Date.now();
    if (diff < 0) return "Expirado";
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return `${days}d restantes`;
  };

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <header className="mb-6">
        <Link
          href="/admin/seguranca"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Seguranca
        </Link>
        <h1 className="text-2xl font-semibold mt-2">Usuarios Banidos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {users.length} usuario(s) banido(s). Desbloqueios sao logados.
        </p>
      </header>

      <div className="flex gap-3 mb-6 flex-wrap items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome..."
          className="flex-1 min-w-[200px] px-4 py-2 border border-border rounded-lg bg-background text-sm"
        />
        <div className="flex gap-2">
          {(["all", "temp", "permanent"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k as BanType | "all")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                filter === k
                  ? "bg-fuchsia-600 text-white"
                  : "bg-muted hover:bg-accent"
              }`}
            >
              {k === "all" ? "Todos" : k === "temp" ? "Temporario" : "Permanente"}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-12 text-center rounded-lg border border-dashed border-border">
          <p className="text-4xl mb-3">🤝</p>
          <p className="font-semibold mb-1">
            {users.length === 0
              ? "Nenhum usuario banido"
              : "Nenhum resultado"}
          </p>
          <p className="text-sm text-muted-foreground">
            {users.length === 0
              ? "Comunidade limpa por enquanto. Bans aparecem aqui apos resolucao de denuncias."
              : "Nenhum usuario bate com busca/filtro."}
          </p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Usuario</th>
                <th className="text-left p-3 font-medium">Motivo</th>
                <th className="text-left p-3 font-medium">Tipo</th>
                <th className="text-left p-3 font-medium">Expiracao</th>
                <th className="text-left p-3 font-medium">Moderador</th>
                <th className="text-left p-3 font-medium">Banido em</th>
                <th className="text-left p-3 font-medium">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="p-3">
                    <p className="font-medium">{u.userName}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {u.userId}
                    </p>
                  </td>
                  <td className="p-3 max-w-xs truncate">{u.reason}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        u.banType === "permanent"
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                          : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                      }`}
                    >
                      {u.banType === "permanent" ? "Permanente" : "Temporario"}
                    </span>
                  </td>
                  <td className="p-3 text-xs">{formatExpiry(u)}</td>
                  <td className="p-3 text-xs">{u.bannedBy}</td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {new Date(u.bannedAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => unban(u.id)}
                      className="px-3 py-1 rounded text-xs bg-fuchsia-600 text-white hover:bg-fuchsia-700"
                    >
                      Desbanir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
