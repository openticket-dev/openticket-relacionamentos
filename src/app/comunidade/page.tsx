/**
 * /comunidade — Comunidade da vertical (grupos + agenda + feed). REL-S4.
 *
 * O item "Comunidade" da sidebar do shell apontava pro /admin (empty-state
 * estatico) com TODO(W-PARALELO-2-P9) cravando este href. Esta page consome
 * as queries REAIS do subgraph relacionamentos via gateway federado:
 *
 *   communityGroups / myCommunityGroups   — grupos com memberCount contado
 *   communityGroupActivities              — agenda por grupo: atividades em
 *                                           grupo + eventos exclusivos
 *                                           (card 02.4, ajuste-imagem 17/07)
 *   communityGroupMembers                 — membros (SO pra quem e membro)
 *   relacionamentosCommunityFeed / createCommunityPost   — feed real com composer
 *   joinCommunityGroup / leaveCommunityGroup
 *
 * Zero-mock: 4 estados (loading/ready/empty/error) por secao; estado vazio
 * vem de query real retornando []. Sem backend/migration aplicada, o
 * resolver degrada pra [] e a page mostra o vazio honesto.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { gqlRequest, GqlClientError } from "@/lib/gql-client";

// ---------------------------------------------------------------------------
// Contratos (espelham entities REL-S4 do subgraph relacionamentos)
// ---------------------------------------------------------------------------

interface CommunityGroup {
  id: string;
  name: string;
  description: string | null;
  city: string | null;
  tags: string[];
  coverUrl: string | null;
  memberCount: number;
  viewerIsMember: boolean;
  createdAt: string;
}

interface CommunityMember {
  id: string;
  profileId: string;
  displayName: string | null;
  role: string;
  joinedAt: string;
}

interface CommunityPost {
  id: string;
  groupId: string | null;
  groupName: string | null;
  authorProfileId: string;
  authorDisplayName: string | null;
  content: string;
  viewerIsAuthor: boolean;
  createdAt: string;
}

type ActivityKind = "ATIVIDADE" | "EVENTO_EXCLUSIVO";

interface CommunityActivity {
  id: string;
  groupId: string;
  kind: ActivityKind;
  title: string;
  description: string | null;
  location: string | null;
  city: string | null;
  startsAt: string;
  endsAt: string | null;
}

const GROUPS_QUERY = /* GraphQL */ `
  query RelComunidadeGroups($limit: Int) {
    communityGroups(limit: $limit) {
      id
      name
      description
      city
      tags
      coverUrl
      memberCount
      viewerIsMember
      createdAt
    }
  }
`;

const FEED_QUERY = /* GraphQL */ `
  query RelComunidadeFeed($input: CommunityFeedInput) {
    relacionamentosCommunityFeed(input: $input) {
      id
      groupId
      groupName
      authorProfileId
      authorDisplayName
      content
      viewerIsAuthor
      createdAt
    }
  }
`;

const ACTIVITIES_QUERY = /* GraphQL */ `
  query RelComunidadeAgenda($groupId: String!, $upcomingOnly: Boolean) {
    communityGroupActivities(groupId: $groupId, upcomingOnly: $upcomingOnly) {
      id
      groupId
      kind
      title
      description
      location
      city
      startsAt
      endsAt
    }
  }
`;

const MEMBERS_QUERY = /* GraphQL */ `
  query RelComunidadeMembros($groupId: String!) {
    communityGroupMembers(groupId: $groupId) {
      id
      profileId
      displayName
      role
      joinedAt
    }
  }
`;

const JOIN_MUTATION = /* GraphQL */ `
  mutation RelComunidadeJoin($groupId: String!) {
    joinCommunityGroup(groupId: $groupId) {
      id
      memberCount
      viewerIsMember
    }
  }
`;

const LEAVE_MUTATION = /* GraphQL */ `
  mutation RelComunidadeLeave($groupId: String!) {
    leaveCommunityGroup(groupId: $groupId) {
      id
      memberCount
      viewerIsMember
    }
  }
`;

const CREATE_POST_MUTATION = /* GraphQL */ `
  mutation RelComunidadePost($input: CreateCommunityPostInput!) {
    createCommunityPost(input: $input) {
      id
      groupId
      groupName
      authorProfileId
      authorDisplayName
      content
      viewerIsAuthor
      createdAt
    }
  }
`;

type LoadState = "loading" | "ready" | "empty" | "error";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isAuthError(err: unknown): boolean {
  const msg =
    err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    msg.includes("unauthorized") ||
    msg.includes("unauthenticated") ||
    msg.includes("forbidden") ||
    msg.includes("http 401") ||
    msg.includes("http 403")
  );
}

const KIND_LABEL: Record<ActivityKind, string> = {
  ATIVIDADE: "Atividade em grupo",
  EVENTO_EXCLUSIVO: "Evento exclusivo",
};

const KIND_CLASS: Record<ActivityKind, string> = {
  ATIVIDADE: "bg-sky-950 text-sky-200 border-sky-800",
  EVENTO_EXCLUSIVO: "bg-amber-950 text-amber-200 border-amber-800",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ComunidadePage() {
  // Grupos
  const [groupsState, setGroupsState] = useState<LoadState>("loading");
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [groupsError, setGroupsError] = useState<string | null>(null);

  // Feed
  const [feedState, setFeedState] = useState<LoadState>("loading");
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [feedError, setFeedError] = useState<string | null>(null);

  // Composer
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  // Join/leave em voo (por grupo)
  const [pendingGroupId, setPendingGroupId] = useState<string | null>(null);
  const [membershipError, setMembershipError] = useState<string | null>(null);

  // Expansao por grupo: agenda + membros
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [activitiesByGroup, setActivitiesByGroup] = useState<
    Record<string, { state: LoadState; items: CommunityActivity[]; error?: string }>
  >({});
  const [membersByGroup, setMembersByGroup] = useState<
    Record<string, { state: LoadState; items: CommunityMember[]; error?: string }>
  >({});

  const [authBlocked, setAuthBlocked] = useState(false);

  const loadGroups = useCallback(async () => {
    setGroupsState("loading");
    setGroupsError(null);
    try {
      const data = await gqlRequest<{ communityGroups: CommunityGroup[] }>(
        GROUPS_QUERY,
        { limit: 50 },
      );
      const items = data.communityGroups ?? [];
      setGroups(items);
      setGroupsState(items.length === 0 ? "empty" : "ready");
    } catch (err) {
      if (isAuthError(err)) {
        setAuthBlocked(true);
        return;
      }
      setGroupsError(
        err instanceof Error ? err.message : "Falha ao carregar grupos",
      );
      setGroupsState("error");
    }
  }, []);

  const loadFeed = useCallback(async () => {
    setFeedState("loading");
    setFeedError(null);
    try {
      const data = await gqlRequest<{ relacionamentosCommunityFeed: CommunityPost[] }>(
        FEED_QUERY,
        { input: { limit: 50 } },
      );
      const items = data.relacionamentosCommunityFeed ?? [];
      setPosts(items);
      setFeedState(items.length === 0 ? "empty" : "ready");
    } catch (err) {
      if (isAuthError(err)) {
        setAuthBlocked(true);
        return;
      }
      setFeedError(
        err instanceof Error ? err.message : "Falha ao carregar o feed",
      );
      setFeedState("error");
    }
  }, []);

  useEffect(() => {
    loadGroups();
    loadFeed();
  }, [loadGroups, loadFeed]);

  async function loadActivities(groupId: string) {
    setActivitiesByGroup((prev) => ({
      ...prev,
      [groupId]: { state: "loading", items: [] },
    }));
    try {
      const data = await gqlRequest<{
        communityGroupActivities: CommunityActivity[];
      }>(ACTIVITIES_QUERY, { groupId, upcomingOnly: true });
      const items = data.communityGroupActivities ?? [];
      setActivitiesByGroup((prev) => ({
        ...prev,
        [groupId]: { state: items.length === 0 ? "empty" : "ready", items },
      }));
    } catch (err) {
      setActivitiesByGroup((prev) => ({
        ...prev,
        [groupId]: {
          state: "error",
          items: [],
          error:
            err instanceof Error ? err.message : "Falha ao carregar a agenda",
        },
      }));
    }
  }

  async function loadMembers(groupId: string) {
    setMembersByGroup((prev) => ({
      ...prev,
      [groupId]: { state: "loading", items: [] },
    }));
    try {
      const data = await gqlRequest<{
        communityGroupMembers: CommunityMember[];
      }>(MEMBERS_QUERY, { groupId });
      const items = data.communityGroupMembers ?? [];
      setMembersByGroup((prev) => ({
        ...prev,
        [groupId]: { state: items.length === 0 ? "empty" : "ready", items },
      }));
    } catch (err) {
      setMembersByGroup((prev) => ({
        ...prev,
        [groupId]: {
          state: "error",
          items: [],
          error:
            err instanceof GqlClientError
              ? err.message
              : "Falha ao carregar membros",
        },
      }));
    }
  }

  function toggleExpand(group: CommunityGroup) {
    if (expandedGroupId === group.id) {
      setExpandedGroupId(null);
      return;
    }
    setExpandedGroupId(group.id);
    loadActivities(group.id);
    if (group.viewerIsMember) loadMembers(group.id);
  }

  async function handleJoinLeave(group: CommunityGroup) {
    setMembershipError(null);
    setPendingGroupId(group.id);
    try {
      const mutation = group.viewerIsMember ? LEAVE_MUTATION : JOIN_MUTATION;
      const key = group.viewerIsMember
        ? "leaveCommunityGroup"
        : "joinCommunityGroup";
      const data = await gqlRequest<
        Record<string, { id: string; memberCount: number; viewerIsMember: boolean }>
      >(mutation, { groupId: group.id });
      const updated = data[key];
      setGroups((prev) =>
        prev.map((g) =>
          g.id === group.id
            ? {
                ...g,
                memberCount: updated.memberCount,
                viewerIsMember: updated.viewerIsMember,
              }
            : g,
        ),
      );
      if (expandedGroupId === group.id && updated.viewerIsMember) {
        loadMembers(group.id);
      }
    } catch (err) {
      setMembershipError(
        err instanceof Error ? err.message : "Falha ao atualizar participacao",
      );
    } finally {
      setPendingGroupId(null);
    }
  }

  async function handlePost() {
    const content = draft.trim();
    if (!content) return;
    setPosting(true);
    setPostError(null);
    try {
      const data = await gqlRequest<{ createCommunityPost: CommunityPost }>(
        CREATE_POST_MUTATION,
        { input: { content } },
      );
      setDraft("");
      setPosts((prev) => [data.createCommunityPost, ...prev]);
      setFeedState("ready");
    } catch (err) {
      setPostError(
        err instanceof Error ? err.message : "Falha ao publicar",
      );
    } finally {
      setPosting(false);
    }
  }

  // ---- Sem sessao: estado honesto, sem dado fake -------------------------
  if (authBlocked) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
          <h1 className="text-3xl font-bold mb-2">Comunidade</h1>
          <p className="text-sm text-zinc-400 mb-6">
            A comunidade e exclusiva pra quem esta logado. Entre na sua conta
            pra ver grupos, agenda e feed.
          </p>
          <Link
            href="/onboarding/perfil"
            className="inline-block px-5 py-2.5 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-700 text-sm font-semibold transition-colors"
          >
            Entrar / criar perfil
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-10">
        <header>
          <h1 className="text-3xl font-bold">Comunidade</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Grupos da vertical, agenda de atividades e eventos exclusivos, e o
            feed de quem esta construindo conexoes de verdade.
          </p>
        </header>

        {/* ================= GRUPOS & AGENDA ================= */}
        <section aria-label="Grupos e comunidades">
          <h2 className="text-xl font-semibold mb-3">Grupos &amp; Comunidades</h2>

          {membershipError && (
            <p className="text-sm text-rose-300 mb-3" role="alert">
              {membershipError}
            </p>
          )}

          {groupsState === "loading" && (
            <div className="space-y-3" role="status" aria-live="polite">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-20 rounded-xl bg-zinc-800/30 animate-pulse"
                />
              ))}
            </div>
          )}

          {groupsState === "error" && (
            <div
              className="rounded-2xl border border-rose-800 bg-rose-950/30 p-6 text-center"
              role="alert"
            >
              <p className="font-semibold mb-1">
                Nao foi possivel carregar os grupos
              </p>
              <p className="text-sm text-rose-300 mb-4">{groupsError}</p>
              <button
                type="button"
                onClick={loadGroups}
                className="px-4 py-2 rounded-lg bg-rose-700 hover:bg-rose-600 text-sm font-medium"
              >
                Tentar de novo
              </button>
            </div>
          )}

          {groupsState === "empty" && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
              <p className="text-lg font-semibold mb-1">
                Nenhum grupo criado ainda
              </p>
              <p className="text-sm text-zinc-400">
                Os grupos da comunidade aparecem aqui assim que a curadoria
                publicar os primeiros — com agenda de atividades e eventos
                exclusivos pra membros.
              </p>
            </div>
          )}

          {groupsState === "ready" && (
            <ul className="space-y-3" aria-label="Lista de grupos">
              {groups.map((g) => {
                const expanded = expandedGroupId === g.id;
                const agenda = activitiesByGroup[g.id];
                const members = membersByGroup[g.id];
                return (
                  <li
                    key={g.id}
                    className="rounded-xl border border-zinc-800 bg-zinc-900/40"
                  >
                    <div className="p-4 flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold truncate">{g.name}</p>
                        {g.description && (
                          <p className="text-sm text-zinc-400 mt-0.5 line-clamp-2">
                            {g.description}
                          </p>
                        )}
                        <p className="text-xs text-zinc-500 mt-1">
                          {g.city ? `${g.city} · ` : ""}
                          {g.memberCount}{" "}
                          {g.memberCount === 1 ? "membro" : "membros"}
                          {g.tags.length > 0 ? ` · ${g.tags.join(", ")}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={pendingGroupId === g.id}
                          onClick={() => handleJoinLeave(g)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
                            g.viewerIsMember
                              ? "border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                              : "bg-fuchsia-600 hover:bg-fuchsia-700 text-white"
                          }`}
                        >
                          {pendingGroupId === g.id
                            ? "..."
                            : g.viewerIsMember
                              ? "Sair do grupo"
                              : "Entrar no grupo"}
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleExpand(g)}
                          className="text-xs text-fuchsia-300 hover:text-fuchsia-200 underline"
                          aria-expanded={expanded}
                        >
                          {expanded ? "Fechar agenda" : "Agenda e detalhes"}
                        </button>
                      </div>
                    </div>

                    {expanded && (
                      <div className="border-t border-zinc-800 p-4 space-y-4">
                        {/* Agenda: atividades em grupo + eventos exclusivos */}
                        <div>
                          <h3 className="text-sm font-semibold text-zinc-300 mb-2">
                            Agenda do grupo
                          </h3>
                          {(!agenda || agenda.state === "loading") && (
                            <div className="h-12 rounded-lg bg-zinc-800/30 animate-pulse" />
                          )}
                          {agenda?.state === "error" && (
                            <p className="text-sm text-rose-300" role="alert">
                              {agenda.error}
                            </p>
                          )}
                          {agenda?.state === "empty" && (
                            <p className="text-sm text-zinc-500">
                              Nenhuma atividade ou evento exclusivo agendado —
                              quando o grupo marcar, aparece aqui.
                            </p>
                          )}
                          {agenda?.state === "ready" && (
                            <ul className="space-y-2">
                              {agenda.items.map((a) => (
                                <li
                                  key={a.id}
                                  className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 flex items-center justify-between gap-3"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium truncate">
                                      {a.title}
                                    </p>
                                    <p className="text-xs text-zinc-500 mt-0.5">
                                      {formatDateTime(a.startsAt)}
                                      {a.location ? ` · ${a.location}` : ""}
                                      {a.city ? ` · ${a.city}` : ""}
                                    </p>
                                  </div>
                                  <span
                                    className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold border shrink-0 ${KIND_CLASS[a.kind] ?? KIND_CLASS.ATIVIDADE}`}
                                  >
                                    {KIND_LABEL[a.kind] ?? "Atividade"}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        {/* Membros — so pra quem e membro (anti-PII) */}
                        {g.viewerIsMember && (
                          <div>
                            <h3 className="text-sm font-semibold text-zinc-300 mb-2">
                              Membros
                            </h3>
                            {(!members || members.state === "loading") && (
                              <div className="h-8 rounded-lg bg-zinc-800/30 animate-pulse" />
                            )}
                            {members?.state === "error" && (
                              <p className="text-sm text-rose-300" role="alert">
                                {members.error}
                              </p>
                            )}
                            {members?.state === "empty" && (
                              <p className="text-sm text-zinc-500">
                                Nenhum membro ativo.
                              </p>
                            )}
                            {members?.state === "ready" && (
                              <ul className="flex flex-wrap gap-2">
                                {members.items.map((m) => (
                                  <li
                                    key={m.id}
                                    className="px-2.5 py-1 rounded-full border border-zinc-700 bg-zinc-900 text-xs text-zinc-300"
                                  >
                                    {m.displayName ?? "Membro"}
                                    {m.role === "ADMIN" ? " · admin" : ""}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ================= FEED ================= */}
        <section aria-label="Feed da comunidade">
          <h2 className="text-xl font-semibold mb-3">Feed</h2>

          {/* Composer */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 mb-4">
            <label htmlFor="comunidade-composer" className="sr-only">
              Escreva um post pra comunidade
            </label>
            <textarea
              id="comunidade-composer"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Compartilhe algo com a comunidade..."
              className="w-full rounded-lg bg-zinc-950/60 border border-zinc-800 p-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-fuchsia-700 resize-none"
            />
            {postError && (
              <p className="text-sm text-rose-300 mt-2" role="alert">
                {postError}
              </p>
            )}
            <div className="flex justify-end mt-2">
              <button
                type="button"
                onClick={handlePost}
                disabled={posting || draft.trim().length === 0}
                className="px-4 py-2 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-50 text-sm font-semibold transition-colors"
              >
                {posting ? "Publicando..." : "Publicar"}
              </button>
            </div>
          </div>

          {feedState === "loading" && (
            <div className="space-y-3" role="status" aria-live="polite">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-16 rounded-xl bg-zinc-800/30 animate-pulse"
                />
              ))}
            </div>
          )}

          {feedState === "error" && (
            <div
              className="rounded-2xl border border-rose-800 bg-rose-950/30 p-6 text-center"
              role="alert"
            >
              <p className="font-semibold mb-1">
                Nao foi possivel carregar o feed
              </p>
              <p className="text-sm text-rose-300 mb-4">{feedError}</p>
              <button
                type="button"
                onClick={loadFeed}
                className="px-4 py-2 rounded-lg bg-rose-700 hover:bg-rose-600 text-sm font-medium"
              >
                Tentar de novo
              </button>
            </div>
          )}

          {feedState === "empty" && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
              <p className="text-lg font-semibold mb-1">
                O feed ainda esta silencioso
              </p>
              <p className="text-sm text-zinc-400">
                Nenhum post publicado ate agora. Seja a primeira pessoa a
                escrever pra comunidade.
              </p>
            </div>
          )}

          {feedState === "ready" && (
            <ul className="space-y-3" aria-label="Posts da comunidade">
              {posts.map((p) => (
                <li
                  key={p.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"
                >
                  <p className="text-xs text-zinc-500 mb-1.5">
                    {p.authorDisplayName ?? "Alguem da comunidade"}
                    {p.viewerIsAuthor ? " (voce)" : ""}
                    {p.groupName ? ` · ${p.groupName}` : ""}
                    {" · "}
                    {formatDateTime(p.createdAt)}
                  </p>
                  <p className="text-sm text-zinc-200 whitespace-pre-wrap break-words">
                    {p.content}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="pt-2 pb-6">
          <Link
            href="/matches"
            className="text-sm text-fuchsia-300 hover:text-fuchsia-200 underline"
          >
            Voltar pros matches
          </Link>
        </footer>
      </div>
    </main>
  );
}
