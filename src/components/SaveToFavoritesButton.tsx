// Relacionamentos — SaveToFavoritesButton (REL-S6, card 02.5)
// Botao "salvar perfil" reutilizado no explore (/buscar/explore) e no perfil
// publico (/perfil/[id]). Salva na lista default "Pessoas para conhecer" no
// clique; o caret (▾) abre um menu com as listas do usuario (carregadas sob
// demanda via minhasListas) pra escolher uma lista especifica.
//
// Zero-mock: estados reais idle/saving/saved/error; sem fake data. O dono/tenant
// vem do JWT no backend (anti-IDOR) — o front so manda targetProfileId + listId.

"use client";

import { useState } from "react";

const SALVAR_FAVORITO_MUTATION = /* GraphQL */ `
  mutation SalvarFavorito($targetProfileId: String!, $listId: String) {
    salvarFavorito(targetProfileId: $targetProfileId, listId: $listId) {
      id
      listId
    }
  }
`;

const MINHAS_LISTAS_QUERY = /* GraphQL */ `
  query MinhasListasPicker {
    minhasListas {
      id
      name
      isDefault
      entryCount
    }
  }
`;

interface FavoriteListLite {
  id: string;
  name: string;
  isDefault: boolean;
  entryCount: number;
}

type SaveState = "idle" | "saving" | "saved" | "error";

async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
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
  if (!json.data) throw new Error("Resposta vazia do servidor");
  return json.data;
}

interface SaveToFavoritesButtonProps {
  targetProfileId: string;
  /** Rotulo curto quando ainda nao salvo. Default "Salvar". */
  label?: string;
  className?: string;
  onSaved?: (listId: string) => void;
}

export function SaveToFavoritesButton({
  targetProfileId,
  label = "Salvar",
  className,
  onSaved,
}: SaveToFavoritesButtonProps) {
  const [state, setState] = useState<SaveState>("idle");
  const [savedListName, setSavedListName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [lists, setLists] = useState<FavoriteListLite[] | null>(null);
  const [listsLoading, setListsLoading] = useState(false);

  async function save(listId: string | null, listName: string | null) {
    setState("saving");
    setErrorMsg(null);
    setMenuOpen(false);
    try {
      const data = await gql<{ salvarFavorito: { id: string; listId: string } }>(
        SALVAR_FAVORITO_MUTATION,
        { targetProfileId, listId },
      );
      setSavedListName(listName ?? "Pessoas para conhecer");
      setState("saved");
      onSaved?.(data.salvarFavorito.listId);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Falha ao salvar");
      setState("error");
    }
  }

  async function openMenu() {
    const next = !menuOpen;
    setMenuOpen(next);
    if (next && lists === null && !listsLoading) {
      setListsLoading(true);
      try {
        const data = await gql<{ minhasListas: FavoriteListLite[] }>(
          MINHAS_LISTAS_QUERY,
        );
        setLists(data.minhasListas ?? []);
      } catch {
        setLists([]);
      } finally {
        setListsLoading(false);
      }
    }
  }

  const isSaved = state === "saved";

  return (
    <div className={`relative inline-flex ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => save(null, null)}
        disabled={state === "saving"}
        aria-label={isSaved ? `Salvo em ${savedListName}` : `Salvar perfil em favoritos`}
        className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm rounded-l-lg border transition-colors disabled:opacity-60 ${
          isSaved
            ? "bg-fuchsia-600 text-white border-fuchsia-600 hover:bg-fuchsia-700"
            : state === "error"
              ? "border-rose-700 text-rose-300 hover:bg-rose-900/30"
              : "border-border hover:bg-accent"
        }`}
      >
        {state === "saving" ? (
          <span className="animate-pulse">Salvando…</span>
        ) : isSaved ? (
          <span>★ Salvo</span>
        ) : state === "error" ? (
          <span>Tentar de novo</span>
        ) : (
          <span>☆ {label}</span>
        )}
      </button>
      <button
        type="button"
        onClick={openMenu}
        aria-label="Escolher lista"
        aria-expanded={menuOpen}
        disabled={state === "saving"}
        className={`inline-flex items-center px-2 py-2 text-sm rounded-r-lg border border-l-0 transition-colors disabled:opacity-60 ${
          isSaved
            ? "bg-fuchsia-600 text-white border-fuchsia-600 hover:bg-fuchsia-700"
            : "border-border hover:bg-accent"
        }`}
      >
        ▾
      </button>

      {menuOpen && (
        <div
          className="absolute z-20 top-full right-0 mt-1 w-56 rounded-xl border border-border bg-background shadow-lg p-1"
          role="menu"
        >
          <p className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
            Salvar em
          </p>
          {listsLoading && (
            <div className="px-3 py-2 text-sm text-muted-foreground" role="status">
              Carregando listas…
            </div>
          )}
          {!listsLoading && lists && lists.length === 0 && (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              Nenhuma lista ainda.
            </div>
          )}
          {!listsLoading &&
            lists &&
            lists.map((l) => (
              <button
                key={l.id}
                type="button"
                role="menuitem"
                onClick={() => save(l.id, l.name)}
                className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-accent flex items-center justify-between gap-2"
              >
                <span className="truncate">
                  {l.isDefault ? "⭐ " : ""}
                  {l.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {l.entryCount}
                </span>
              </button>
            ))}
          <a
            href="/favoritos"
            className="block px-3 py-2 mt-1 text-xs text-fuchsia-600 hover:underline border-t border-border"
          >
            Gerenciar listas →
          </a>
        </div>
      )}

      {state === "error" && errorMsg && (
        <span className="absolute top-full left-0 mt-1 text-[11px] text-rose-400 whitespace-nowrap">
          {errorMsg}
        </span>
      )}
    </div>
  );
}
