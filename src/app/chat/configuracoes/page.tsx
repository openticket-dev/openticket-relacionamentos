// Relacionamentos — Chat Configurações
// Sprint M8-2. Silenciar, bloqueados, deletar conversa, leitura, online status.
//
// WIRE_REAL: preferencias persistidas no subgraph relacionamentos via gateway
// federado (/api/graphql). Auth + anti-IDOR sao server-side — o resolver deriva
// o profileId/companyId do JWT (user.sub), nunca confia em id vindo do client.
//   - relationshipPreferences (query)        -> hidrata os toggles
//   - updateRelationshipPreferences (mutation)-> persiste cada mudanca
//   - myBlockedProfiles (query)              -> lista de bloqueados real
//   - unblockProfile (mutation)              -> desbloquear
// Mapeamento dos toggles -> campos reais do backend:
//   showOnlineStatus -> RelationshipPreferences.showOnlineStatus
//   muteAll          -> !notificationOptIn  (silenciar = opt-out de notificacao)
//   readReceipts     -> metadata.readReceipts (Json persistido)
//   autoTranslate    -> metadata.autoTranslate (Json persistido)
// "Limpar historico de todas as conversas": NAO ha mutation no backend pra esse
// bulk-delete cross-conversation. Em vez de fingir, fica honesto-desabilitado
// com motivo (zero-mock).

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const PREFERENCES_QUERY = /* GraphQL */ `
  query ChatConfigPreferences {
    relationshipPreferences {
      id
      showOnlineStatus
      notificationOptIn
      metadata
    }
    myBlockedProfiles {
      id
      blockedId
      createdAt
    }
  }
`;

const UPDATE_PREFERENCES_MUTATION = /* GraphQL */ `
  mutation UpdateChatPreferences($input: UpdatePreferencesInputDto!) {
    updateRelationshipPreferences(input: $input) {
      id
      showOnlineStatus
      notificationOptIn
      metadata
    }
  }
`;

const UNBLOCK_MUTATION = /* GraphQL */ `
  mutation UnblockFromChatConfig($input: BlockProfileInput!) {
    unblockProfile(input: $input) {
      unblocked
    }
  }
`;

interface PreferencesData {
  id: string;
  showOnlineStatus: boolean;
  notificationOptIn: boolean;
  metadata: Record<string, unknown> | null;
}

interface BlockedProfile {
  id: string;
  blockedId: string;
  createdAt: string;
}

type LoadState = "loading" | "ready" | "error";

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
  if (!res.ok && res.status !== 400) {
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

export default function ChatConfigPage() {
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [showOnlineStatus, setShowOnlineStatus] = useState(true);
  const [readReceipts, setReadReceipts] = useState(true);
  const [muteAll, setMuteAll] = useState(false);
  const [autoTranslate, setAutoTranslate] = useState(false);

  const [blockedUsers, setBlockedUsers] = useState<BlockedProfile[]>([]);

  // Snapshot do metadata atual pra nao perder outras chaves ao dar patch.
  const [metadata, setMetadata] = useState<Record<string, unknown>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const data = await gql<{
          relationshipPreferences: PreferencesData | null;
          myBlockedProfiles: BlockedProfile[];
        }>(PREFERENCES_QUERY);
        if (cancelled) return;
        const prefs = data.relationshipPreferences;
        if (prefs) {
          setShowOnlineStatus(prefs.showOnlineStatus);
          setMuteAll(!prefs.notificationOptIn);
          const md = (prefs.metadata ?? {}) as Record<string, unknown>;
          setMetadata(md);
          setReadReceipts(md.readReceipts !== false);
          setAutoTranslate(md.autoTranslate === true);
        }
        setBlockedUsers(data.myBlockedProfiles ?? []);
        setState("ready");
      } catch (err) {
        if (cancelled) return;
        setErrorMessage(
          err instanceof Error ? err.message : "Falha ao carregar configuracoes",
        );
        setState("error");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persiste um patch de preferencia. Aplica otimista; reverte no erro.
  const persist = useCallback(
    async (
      patch: {
        showOnlineStatus?: boolean;
        notificationOptIn?: boolean;
        metadata?: Record<string, unknown>;
      },
      revert: () => void,
    ) => {
      setSaveError(null);
      setSaving(true);
      try {
        await gql<{ updateRelationshipPreferences: PreferencesData }>(
          UPDATE_PREFERENCES_MUTATION,
          { input: patch },
        );
        if (patch.metadata) setMetadata(patch.metadata);
      } catch (err) {
        revert();
        setSaveError(
          err instanceof Error ? err.message : "Nao foi possivel salvar",
        );
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  const toggleOnline = () => {
    const next = !showOnlineStatus;
    setShowOnlineStatus(next);
    persist({ showOnlineStatus: next }, () => setShowOnlineStatus(!next));
  };

  const toggleMute = () => {
    const next = !muteAll;
    setMuteAll(next);
    // mute = opt-OUT de notificacao
    persist({ notificationOptIn: !next }, () => setMuteAll(!next));
  };

  const toggleReadReceipts = () => {
    const next = !readReceipts;
    setReadReceipts(next);
    const md = { ...metadata, readReceipts: next };
    persist({ metadata: md }, () => setReadReceipts(!next));
  };

  const toggleAutoTranslate = () => {
    const next = !autoTranslate;
    setAutoTranslate(next);
    const md = { ...metadata, autoTranslate: next };
    persist({ metadata: md }, () => setAutoTranslate(!next));
  };

  const handleUnblock = async (block: BlockedProfile) => {
    const prev = blockedUsers;
    setBlockedUsers((list) => list.filter((b) => b.id !== block.id));
    try {
      const data = await gql<{ unblockProfile: { unblocked: boolean } }>(
        UNBLOCK_MUTATION,
        { input: { blockedProfileId: block.blockedId } },
      );
      if (!data.unblockProfile?.unblocked) {
        setBlockedUsers(prev);
        setSaveError("Nao foi possivel desbloquear. Tente novamente.");
      }
    } catch (err) {
      setBlockedUsers(prev);
      setSaveError(
        err instanceof Error ? err.message : "Falha ao desbloquear",
      );
    }
  };

  function Toggle({
    on,
    onClick,
    label,
    desc,
  }: {
    on: boolean;
    onClick: () => void;
    label: string;
    desc: string;
  }) {
    return (
      <div className="flex items-center justify-between p-4 rounded-lg border border-border">
        <div>
          <p className="font-medium text-sm">{label}</p>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
        <button
          onClick={onClick}
          disabled={saving || state !== "ready"}
          className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${
            on ? "bg-fuchsia-600" : "bg-muted"
          }`}
          role="switch"
          aria-checked={on}
          aria-label={label}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
              on ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
    );
  }

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

      {state === "loading" && (
        <div
          className="space-y-3"
          role="status"
          aria-live="polite"
          aria-label="Carregando configuracoes"
        >
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-16 rounded-lg border border-border bg-muted/30 animate-pulse"
            />
          ))}
        </div>
      )}

      {state === "error" && (
        <div
          className="text-center py-12 border border-rose-800 rounded-2xl bg-rose-950/20"
          role="alert"
        >
          <p className="font-medium text-rose-300">
            Nao foi possivel carregar as configuracoes
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

      {state === "ready" && (
        <>
          {saveError && (
            <div
              className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-sm text-red-700 dark:text-red-300"
              role="alert"
            >
              {saveError}
            </div>
          )}

          <section className="space-y-1 mb-8">
            <h2 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-3">
              Privacidade
            </h2>
            <Toggle
              on={showOnlineStatus}
              onClick={toggleOnline}
              label="Mostrar quando estou online"
              desc="Outros usuarios verao seu status em tempo real"
            />
            <Toggle
              on={readReceipts}
              onClick={toggleReadReceipts}
              label="Confirmacao de leitura"
              desc="Mostrar quando leu mensagens (e ver quando leram as suas)"
            />
          </section>

          <section className="space-y-1 mb-8">
            <h2 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-3">
              Notificacoes
            </h2>
            <Toggle
              on={muteAll}
              onClick={toggleMute}
              label="Silenciar todas as conversas"
              desc="Voce ainda recebera as mensagens, sem som"
            />
            <Toggle
              on={autoTranslate}
              onClick={toggleAutoTranslate}
              label="Traducao automatica"
              desc="Premium: traduz mensagens em tempo real"
            />
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
                    <span className="text-sm font-mono truncate" title={u.blockedId}>
                      {u.blockedId}
                    </span>
                    <button
                      onClick={() => handleUnblock(u)}
                      className="text-xs text-fuchsia-600 hover:text-fuchsia-700 font-medium ml-3 shrink-0"
                    >
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
            {/* Honesto-desabilitado: o backend ainda nao expoe uma mutation pra
                limpar o historico de TODAS as conversas. Em vez de fingir
                sucesso (zero-mock), deixamos desabilitado com o motivo. Apagar
                conversa individual continua disponivel dentro de cada chat. */}
            <button
              type="button"
              disabled
              aria-disabled="true"
              title="Indisponivel: sem endpoint de limpeza em massa no backend ainda."
              className="w-full p-4 text-left text-sm text-muted-foreground rounded-lg border border-border opacity-60 cursor-not-allowed"
            >
              Limpar histórico de todas as conversas
            </button>
            <p className="text-xs text-muted-foreground mt-2">
              Indisponivel por enquanto. Para apagar uma conversa especifica,
              use a opcao dentro do proprio chat.
            </p>
          </section>
        </>
      )}
    </main>
  );
}
