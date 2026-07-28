// Relacionamentos — /favoritos (REL-S6, card 02.5)
// Favoritos & Listas do usuario: lista default "Pessoas para conhecer" + listas
// custom. Criar, renomear, remover favorito, mover entre listas.
//
// WIRE_REAL: minhasListas + salvar/remover/mover/renomear/criar via GraphQL no
// gateway federado. Zero-mock: estados loading/ready/empty/error; sem fake data.
// Os favoritos trazem targetProfileId real (o backend nao junta displayName);
// a UI linka pro /perfil/[id] + /chat sem inventar nome/idade.

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const MINHAS_LISTAS_QUERY = /* GraphQL */ `
  query MinhasListas {
    minhasListas {
      id
      name
      isDefault
      sortOrder
      entryCount
      entries {
        id
        targetProfileId
        listId
        note
        createdAt
      }
    }
  }
`;

const CRIAR_LISTA = /* GraphQL */ `
  mutation CriarLista($name: String!) {
    criarLista(name: $name) { id }
  }
`;

const RENOMEAR_LISTA = /* GraphQL */ `
  mutation RenomearLista($listId: String!, $name: String!) {
    renomearLista(listId: $listId, name: $name) { id }
  }
`;

const REMOVER_FAVORITO = /* GraphQL */ `
  mutation RemoverFavorito($targetProfileId: String!) {
    removerFavorito(targetProfileId: $targetProfileId) { id deleted }
  }
`;

const MOVER_FAVORITO = /* GraphQL */ `
  mutation MoverFavorito($targetProfileId: String!, $toListId: String!) {
    moverFavorito(targetProfileId: $targetProfileId, toListId: $toListId) { id listId }
  }
`;

interface FavoriteEntry {
  id: string;
  targetProfileId: string;
  listId: string;
  note: string | null;
  createdAt: string;
}

interface FavoriteList {
  id: string;
  name: string;
  isDefault: boolean;
  sortOrder: number;
  entryCount: number;
  entries: FavoriteEntry[];
}

type LoadState = "loading" | "ready" | "empty" | "error";

async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors[0]?.message ?? "GraphQL error");
  }
  if (!json.data) throw new Error("Resposta vazia do servidor");
  return json.data;
}

function shortId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

export default function FavoritosPage() {
  const [state, setState] = useState<LoadState>("loading");
  const [lists, setLists] = useState<FavoriteList[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // criar lista
  const [newListName, setNewListName] = useState("");
  // renomear
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await gql<{ minhasListas: FavoriteList[] }>(MINHAS_LISTAS_QUERY);
      const l = data.minhasListas ?? [];
      setLists(l);
      const total = l.reduce((acc, x) => acc + (x.entryCount ?? 0), 0);
      setState(total === 0 ? "empty" : "ready");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Falha ao carregar");
      setState("error");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    (async () => {
      if (cancelled) return;
      await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const totalFavoritos = useMemo(
    () => lists.reduce((acc, l) => acc + (l.entryCount ?? 0), 0),
    [lists],
  );

  async function runAction(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setActionError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Falha na acao");
    } finally {
      setBusy(null);
    }
  }

  async function handleCriarLista(e: React.FormEvent) {
    e.preventDefault();
    const name = newListName.trim();
    if (!name) return;
    await runAction("criar", async () => {
      await gql(CRIAR_LISTA, { name });
      setNewListName("");
    });
  }

  async function handleRenomear(listId: string) {
    const name = renameValue.trim();
    if (!name) {
      setRenamingId(null);
      return;
    }
    await runAction(`rename-${listId}`, async () => {
      await gql(RENOMEAR_LISTA, { listId, name });
      setRenamingId(null);
      setRenameValue("");
    });
  }

  const isBusy = busy !== null;

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Favoritos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {state === "ready" || state === "empty"
            ? `${totalFavoritos} ${totalFavoritos === 1 ? "pessoa salva" : "pessoas salvas"} em ${lists.length} ${lists.length === 1 ? "lista" : "listas"}.`
            : "Suas listas de pessoas para conhecer."}
        </p>
      </header>

      {/* Criar lista */}
      {(state === "ready" || state === "empty") && (
        <form onSubmit={handleCriarLista} className="flex gap-2 mb-6">
          <input
            type="text"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            placeholder="Nova lista (ex: Amizades, Networking)…"
            maxLength={120}
            className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-sm"
            aria-label="Nome da nova lista"
          />
          <button
            type="submit"
            disabled={!newListName.trim() || busy === "criar"}
            className="px-4 py-2 rounded-lg bg-fuchsia-600 text-white text-sm font-medium hover:bg-fuchsia-700 disabled:opacity-60"
          >
            {busy === "criar" ? "Criando…" : "+ Criar lista"}
          </button>
        </form>
      )}

      {actionError && (
        <div
          className="mb-4 px-4 py-2 text-sm rounded-lg border border-rose-800 bg-rose-950/20 text-rose-300"
          role="alert"
        >
          {actionError}
        </div>
      )}

      {/* Loading */}
      {state === "loading" && (
        <ul className="space-y-3" role="status" aria-live="polite">
          {[1, 2].map((i) => (
            <li
              key={i}
              className="h-28 rounded-xl border border-border bg-muted/30 animate-pulse"
            />
          ))}
        </ul>
      )}

      {/* Error */}
      {state === "error" && (
        <div
          className="text-center py-12 border border-rose-800 rounded-xl bg-rose-950/20"
          role="alert"
        >
          <p className="font-medium text-rose-300">
            Nao foi possivel carregar seus favoritos
          </p>
          <p className="text-sm text-rose-400/80 mt-2">{errorMessage}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 text-sm rounded-lg border border-rose-700 hover:bg-rose-900/40"
          >
            Tentar de novo
          </button>
        </div>
      )}

      {/* Empty — 0 favoritos (as listas existem, mas nenhuma pessoa salva) */}
      {state === "empty" && (
        <div className="text-center py-12 border border-border rounded-xl bg-muted/30">
          <p className="text-3xl mb-2">⭐</p>
          <p className="font-medium">Nenhum favorito ainda</p>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
            Sua lista <strong>Pessoas para conhecer</strong> esta pronta. Salve
            perfis no explorar e eles aparecem aqui.
          </p>
          <Link
            href="/buscar/explore"
            className="mt-4 inline-block px-5 py-2 rounded-lg bg-fuchsia-600 text-white text-sm font-medium hover:bg-fuchsia-700"
          >
            Explorar perfis
          </Link>
        </div>
      )}

      {/* Ready */}
      {state === "ready" && (
        <div className="space-y-6">
          {lists.map((list) => (
            <section
              key={list.id}
              className="border border-border rounded-2xl overflow-hidden"
            >
              <header className="flex items-center justify-between gap-2 px-4 py-3 bg-muted/40 border-b border-border">
                {renamingId === list.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRenomear(list.id);
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      maxLength={120}
                      className="flex-1 px-2 py-1 border border-border rounded bg-background text-sm"
                      aria-label="Novo nome da lista"
                    />
                    <button
                      onClick={() => handleRenomear(list.id)}
                      disabled={busy === `rename-${list.id}`}
                      className="text-xs px-2 py-1 rounded bg-fuchsia-600 text-white hover:bg-fuchsia-700 disabled:opacity-60"
                    >
                      Salvar
                    </button>
                    <button
                      onClick={() => setRenamingId(null)}
                      className="text-xs px-2 py-1 rounded border border-border hover:bg-accent"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <>
                    <h2 className="font-semibold flex items-center gap-2">
                      {list.isDefault && <span title="Lista padrao">⭐</span>}
                      {list.name}
                      <span className="text-xs font-normal text-muted-foreground">
                        ({list.entryCount})
                      </span>
                    </h2>
                    <button
                      onClick={() => {
                        setRenamingId(list.id);
                        setRenameValue(list.name);
                      }}
                      className="text-xs px-2 py-1 rounded border border-border hover:bg-accent"
                      aria-label={`Renomear lista ${list.name}`}
                    >
                      ✎ Renomear
                    </button>
                  </>
                )}
              </header>

              {list.entries.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground text-center">
                  Lista vazia — salve perfis aqui pelo botao ▾ no explorar.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {list.entries.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-fuchsia-500/30 to-rose-500/30 flex items-center justify-center text-sm font-semibold shrink-0">
                        {entry.targetProfileId.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          Perfil {shortId(entry.targetProfileId)}
                        </p>
                        {entry.note && (
                          <p className="text-xs text-muted-foreground truncate">
                            {entry.note}
                          </p>
                        )}
                      </div>
                      <Link
                        href={`/perfil/${entry.targetProfileId}`}
                        className="text-xs px-2 py-1 rounded-lg border border-border hover:bg-accent shrink-0"
                      >
                        Ver
                      </Link>
                      {/* Mover pra outra lista */}
                      {lists.length > 1 && (
                        <select
                          aria-label="Mover para outra lista"
                          value={entry.listId}
                          disabled={isBusy}
                          onChange={(e) => {
                            const toListId = e.target.value;
                            if (toListId !== entry.listId) {
                              runAction(`move-${entry.id}`, () =>
                                gql(MOVER_FAVORITO, {
                                  targetProfileId: entry.targetProfileId,
                                  toListId,
                                }),
                              );
                            }
                          }}
                          className="text-xs px-2 py-1 rounded-lg border border-border bg-background shrink-0 max-w-[120px]"
                        >
                          {lists.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.name}
                            </option>
                          ))}
                        </select>
                      )}
                      <button
                        onClick={() =>
                          runAction(`remove-${entry.id}`, () =>
                            gql(REMOVER_FAVORITO, {
                              targetProfileId: entry.targetProfileId,
                            }),
                          )
                        }
                        disabled={busy === `remove-${entry.id}`}
                        aria-label="Remover dos favoritos"
                        className="text-xs px-2 py-1 rounded-lg border border-rose-800 text-rose-300 hover:bg-rose-900/30 disabled:opacity-60 shrink-0"
                      >
                        Remover
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
