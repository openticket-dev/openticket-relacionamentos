/**
 * /admin/eventos — Fila do curador de eventos para solteiros (REL-G5).
 *
 * QA100-REL-06 (06/09/2026) — backend pago sem tela, e o caso mais caro dos
 * tres desta vertical, porque ele trava um fluxo de DINHEIRO inteiro.
 *
 * O catalogo publico (`partnerEvents`, rollout-6) le PartnerEvent filtrando
 * `approved: true`. Ate 04/09 nada no sistema conseguia criar um evento nem
 * ligar esse flag: o filtro casava com zero linha POR CONSTRUCAO. Efeito em
 * cascata, tudo medido:
 *   - "Eventos curados" no perfil abre vazio;
 *   - o bloco "comprar juntos" do chat some (ele so monta com evento que tem
 *     `ticketingEventId`, e nao havia evento nenhum aprovado);
 *   - o ComprarJuntosCard de /encontros idem.
 * Ou seja: a venda de ingresso pareado nao tinha como acontecer, e nao por
 * falta de backend — o de escrita nasceu em 04/09 (`createPartnerEvent`,
 * `approvePartnerEvent`, `unapprovePartnerEvent`, `archivePartnerEvent`,
 * `curatorPartnerEvents`) e ficou 2 dias sem nenhuma tela chamando.
 *
 * Esta rota tambem fechava um buraco de navegacao: `/admin/eventos/[id]`
 * (painel de porta, check-in e mapa de mesas) existia sem indice, entao nao
 * havia como chegar num evento sem colar o id na URL.
 *
 * Guarda: SUPER_ADMIN no gateway (curadoria de catalogo publico e ato de
 * plataforma, cross-tenant). O client NUNCA manda companyId derivado dele
 * mesmo; o campo do formulario e opcional e serve pra amarrar um evento a um
 * tenant dono, que e o que habilita o check-in por QR na porta.
 *
 * Zero-mock: estados loading/ready/empty/error reais, `total` e `pendingCount`
 * vindos do servidor, paginacao por offset. Nenhum numero inventado.
 */

"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { gqlRequest, GqlClientError } from "@/lib/gql-client";

/** Espelha RelacPartnerEventKind do gateway. */
const KINDS = [
  { value: "SPEED_DATING", label: "Speed dating" },
  { value: "RETREAT", label: "Retiro" },
  { value: "PARTY", label: "Festa" },
  { value: "DINNER", label: "Jantar" },
  { value: "WORKSHOP", label: "Workshop" },
  { value: "OTHER", label: "Outro" },
] as const;

type Kind = (typeof KINDS)[number]["value"];

interface CuratorPartnerEvent {
  id: string;
  title: string;
  kind: string;
  city: string | null;
  state: string | null;
  startsAt: string;
  capacity: number | null;
  externalUrl: string | null;
  ticketingEventId: string | null;
  partnerName: string | null;
  approved: boolean;
}

type Filtro = "pendentes" | "aprovados" | "todos";
type LoadState = "loading" | "ready" | "empty" | "error";

/** Teto por pagina. O resolver aceita limit 1..100. */
const PAGE_SIZE = 25;

const CURATOR_EVENTS_QUERY = /* GraphQL */ `
  query CuratorPartnerEvents($input: CuratorPartnerEventsInput) {
    curatorPartnerEvents(input: $input) {
      items {
        id
        title
        kind
        city
        state
        startsAt
        capacity
        externalUrl
        ticketingEventId
        partnerName
        approved
      }
      total
      pendingCount
    }
  }
`;

const CREATE_EVENT_MUTATION = /* GraphQL */ `
  mutation CreatePartnerEvent($input: CreatePartnerEventInput!) {
    createPartnerEvent(input: $input) {
      id
      title
      approved
    }
  }
`;

const APPROVE_EVENT_MUTATION = /* GraphQL */ `
  mutation ApprovePartnerEvent($input: PartnerEventIdInput!) {
    approvePartnerEvent(input: $input) {
      id
      approved
    }
  }
`;

const UNAPPROVE_EVENT_MUTATION = /* GraphQL */ `
  mutation UnapprovePartnerEvent($input: PartnerEventIdInput!) {
    unapprovePartnerEvent(input: $input) {
      id
      approved
    }
  }
`;

const ARCHIVE_EVENT_MUTATION = /* GraphQL */ `
  mutation ArchivePartnerEvent($input: PartnerEventIdInput!) {
    archivePartnerEvent(input: $input) {
      archived
      eventId
    }
  }
`;

function kindLabel(kind: string): string {
  return KINDS.find((k) => k.value === kind)?.label ?? kind;
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function mensagemDeErro(err: unknown, fallback: string): string {
  if (err instanceof GqlClientError) return err.message;
  if (err instanceof Error) return err.message;
  return fallback;
}

export default function CuradoriaEventosPage() {
  const [items, setItems] = useState<CuratorPartnerEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("pendentes");
  const [offset, setOffset] = useState(0);
  const [acting, setActing] = useState<string | null>(null);
  const [acaoErro, setAcaoErro] = useState<string | null>(null);

  // Formulário de cadastro
  const [formAberto, setFormAberto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [kind, setKind] = useState<Kind>("SPEED_DATING");
  const [startsAt, setStartsAt] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [capacidade, setCapacidade] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [parceiro, setParceiro] = useState("");
  const [formErro, setFormErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const data = await gqlRequest<{
        curatorPartnerEvents: {
          items: CuratorPartnerEvent[];
          total: number;
          pendingCount: number;
        };
      }>(CURATOR_EVENTS_QUERY, {
        input: {
          // `approved` ausente = fila mista. Os três estados são distintos.
          approved:
            filtro === "todos" ? null : filtro === "aprovados" ? true : false,
          limit: PAGE_SIZE,
          offset,
        },
      });
      const page = data.curatorPartnerEvents;
      setItems(page?.items ?? []);
      setTotal(page?.total ?? 0);
      setPendingCount(page?.pendingCount ?? 0);
      setState((page?.items ?? []).length === 0 ? "empty" : "ready");
    } catch (err) {
      setErrorMessage(mensagemDeErro(err, "Falha ao carregar a fila"));
      setState("error");
    }
  }, [filtro, offset]);

  useEffect(() => {
    load();
  }, [load]);

  const agir = async (
    mutation: string,
    eventId: string,
    falha: string,
  ): Promise<void> => {
    setActing(eventId);
    setAcaoErro(null);
    try {
      await gqlRequest(mutation, { input: { eventId } });
      await load();
    } catch (err) {
      setAcaoErro(mensagemDeErro(err, falha));
    } finally {
      setActing(null);
    }
  };

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErro(null);
    const t = titulo.trim();
    // Mesmos limites do Zod do resolver: título 3..200 e data obrigatória.
    if (t.length < 3) {
      setFormErro("Título precisa de pelo menos 3 caracteres.");
      return;
    }
    if (!startsAt) {
      setFormErro("Data de início é obrigatória.");
      return;
    }
    const inicio = new Date(startsAt);
    if (Number.isNaN(inicio.getTime())) {
      setFormErro("Data de início inválida.");
      return;
    }
    const cap = capacidade.trim() ? Number(capacidade) : null;
    if (cap != null && (!Number.isInteger(cap) || cap < 1)) {
      setFormErro("Capacidade precisa ser um número inteiro a partir de 1.");
      return;
    }
    const url = externalUrl.trim();
    if (url && !/^https?:\/\//i.test(url)) {
      // O resolver exige URL absoluta: relativa vira link quebrado no domínio
      // da OpenTicket em vez de levar ao parceiro.
      setFormErro("O link do parceiro precisa começar com http:// ou https://");
      return;
    }
    setSalvando(true);
    try {
      await gqlRequest(CREATE_EVENT_MUTATION, {
        input: {
          title: t,
          kind,
          startsAt: inicio.toISOString(),
          ...(cidade.trim() ? { city: cidade.trim() } : {}),
          ...(estado.trim() ? { state: estado.trim() } : {}),
          ...(cap != null ? { capacity: cap } : {}),
          ...(url ? { externalUrl: url } : {}),
          ...(parceiro.trim() ? { partnerName: parceiro.trim() } : {}),
        },
      });
      setTitulo("");
      setStartsAt("");
      setCidade("");
      setEstado("");
      setCapacidade("");
      setExternalUrl("");
      setParceiro("");
      setFormAberto(false);
      // Nasce pendente: quem cria não publica sozinho.
      setFiltro("pendentes");
      setOffset(0);
      await load();
    } catch (err) {
      setFormErro(mensagemDeErro(err, "Falha ao cadastrar o evento"));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <header className="mb-6">
        <Link
          href="/admin/seguranca"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Administração
        </Link>
        <h1 className="text-2xl font-semibold mt-2">
          Curadoria de eventos para solteiros
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
          O catálogo público só mostra evento aprovado. Enquanto ninguém aprova,
          a aba &ldquo;Eventos curados&rdquo; do perfil e a sugestão de comprar
          ingresso junto no chat ficam vazias — não por falta de dado, por falta
          desta decisão.
        </p>
        <p
          className="text-sm text-muted-foreground mt-2"
          data-testid="curadoria-pendentes"
        >
          Aguardando aprovação:{" "}
          <span className="font-semibold text-foreground">{pendingCount}</span>
        </p>
      </header>

      <div className="flex gap-2 mb-4 flex-wrap items-center">
        {(
          [
            ["pendentes", "Pendentes"],
            ["aprovados", "Publicados"],
            ["todos", "Todos"],
          ] as [Filtro, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => {
              setFiltro(k);
              setOffset(0);
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filtro === k
                ? "bg-fuchsia-600 text-white"
                : "bg-muted hover:bg-accent"
            }`}
          >
            {label}
            {filtro === k && state !== "loading" ? ` (${total})` : ""}
          </button>
        ))}
        <button
          onClick={() => setFormAberto((v) => !v)}
          className="ml-auto px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-accent"
        >
          {formAberto ? "Fechar cadastro" : "Cadastrar evento"}
        </button>
      </div>

      {formAberto && (
        <form
          onSubmit={criar}
          className="mb-6 p-4 rounded-lg border border-border bg-card space-y-3"
        >
          <p className="text-xs text-muted-foreground">
            O evento nasce pendente. Publicar é um segundo ato, feito na lista.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs">
              Título
              <input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                maxLength={200}
                placeholder="Speed dating de sexta"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
            </label>
            <label className="text-xs">
              Tipo
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as Kind)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              >
                {KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              Início
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
            </label>
            <label className="text-xs">
              Capacidade (opcional)
              <input
                value={capacidade}
                onChange={(e) => setCapacidade(e.target.value)}
                inputMode="numeric"
                placeholder="40"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
            </label>
            <label className="text-xs">
              Cidade (opcional)
              <input
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                maxLength={120}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
            </label>
            <label className="text-xs">
              Estado (opcional)
              <input
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                maxLength={120}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
            </label>
            <label className="text-xs">
              Parceiro (opcional)
              <input
                value={parceiro}
                onChange={(e) => setParceiro(e.target.value)}
                maxLength={200}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
            </label>
            <label className="text-xs">
              Link do parceiro (opcional)
              <input
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
            </label>
          </div>
          {formErro && (
            <p
              className="text-xs text-rose-600 dark:text-rose-400"
              role="alert"
            >
              {formErro}
            </p>
          )}
          <button
            type="submit"
            disabled={salvando}
            className="px-4 py-2 rounded-lg text-sm bg-fuchsia-600 text-white hover:bg-fuchsia-700 disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Cadastrar"}
          </button>
        </form>
      )}

      {acaoErro && (
        <p
          className="mb-4 text-sm text-rose-600 dark:text-rose-400"
          role="alert"
        >
          {acaoErro}
        </p>
      )}

      {state === "loading" && (
        <div className="space-y-2" role="status" aria-live="polite">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-14 rounded-lg border border-border bg-muted/30 animate-pulse"
            />
          ))}
        </div>
      )}

      {state === "error" && (
        <div
          className="text-center py-12 border border-rose-800 rounded-xl bg-rose-950/20"
          role="alert"
        >
          <p className="font-medium text-rose-300">
            Não foi possível carregar a fila de curadoria
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

      {state === "empty" && (
        <div className="p-12 text-center rounded-lg border border-dashed border-border">
          <p className="text-4xl mb-3">🗓️</p>
          <p className="font-semibold mb-1">
            {offset === 0
              ? "Nenhum evento neste filtro"
              : "Nenhum evento nesta página"}
          </p>
          <p className="text-sm text-muted-foreground">
            {offset === 0
              ? "Enquanto não houver evento publicado, o catálogo do usuário fica vazio."
              : `São ${total} no filtro atual. Você está além do fim da lista.`}
          </p>
          {offset > 0 ? (
            <button
              onClick={() => setOffset(0)}
              className="mt-4 px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-accent"
            >
              Voltar ao início
            </button>
          ) : null}
        </div>
      )}

      {state === "ready" && (
        <>
          <div className="border border-border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Evento</th>
                  <th className="text-left p-3 font-medium">Tipo</th>
                  <th className="text-left p-3 font-medium">Quando</th>
                  <th className="text-left p-3 font-medium">Onde</th>
                  <th className="text-left p-3 font-medium">Ingresso</th>
                  <th className="text-left p-3 font-medium">Estado</th>
                  <th className="text-left p-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((ev) => (
                  <tr key={ev.id} className="border-t border-border align-top">
                    <td className="p-3">
                      <Link
                        href={`/admin/eventos/${ev.id}`}
                        className="font-medium hover:underline"
                      >
                        {ev.title}
                      </Link>
                      {ev.partnerName ? (
                        <p className="text-xs text-muted-foreground">
                          {ev.partnerName}
                        </p>
                      ) : null}
                    </td>
                    <td className="p-3 text-xs">{kindLabel(ev.kind)}</td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {formatDate(ev.startsAt)}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {ev.city ? `${ev.city}${ev.state ? `/${ev.state}` : ""}` : "—"}
                    </td>
                    <td className="p-3 text-xs">
                      {ev.ticketingEventId ? (
                        <span title="Vende ingresso pela OpenTicket — é o que habilita o 'comprar juntos' no chat.">
                          pela OpenTicket
                        </span>
                      ) : ev.externalUrl ? (
                        <span
                          className="text-muted-foreground"
                          title="Só link externo: o bloco 'comprar juntos' não aparece para este evento."
                        >
                          link externo
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          ev.approved
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                            : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                        }`}
                      >
                        {ev.approved ? "Publicado" : "Pendente"}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-2 flex-wrap">
                        {ev.approved ? (
                          <button
                            onClick={() =>
                              agir(
                                UNAPPROVE_EVENT_MUTATION,
                                ev.id,
                                "Falha ao tirar do ar",
                              )
                            }
                            disabled={acting === ev.id}
                            className="px-3 py-1 rounded text-xs border border-border hover:bg-accent disabled:opacity-50"
                          >
                            {acting === ev.id ? "..." : "Tirar do ar"}
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              agir(
                                APPROVE_EVENT_MUTATION,
                                ev.id,
                                "Falha ao publicar",
                              )
                            }
                            disabled={acting === ev.id}
                            className="px-3 py-1 rounded text-xs bg-fuchsia-600 text-white hover:bg-fuchsia-700 disabled:opacity-50"
                          >
                            {acting === ev.id ? "..." : "Publicar"}
                          </button>
                        )}
                        <button
                          onClick={() =>
                            agir(
                              ARCHIVE_EVENT_MUTATION,
                              ev.id,
                              "Falha ao arquivar",
                            )
                          }
                          disabled={acting === ev.id}
                          className="px-3 py-1 rounded text-xs border border-border text-muted-foreground hover:bg-accent disabled:opacity-50"
                          title="Arquivar tira o evento da fila e do catálogo. O registro continua no banco."
                        >
                          Arquivar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginação — o total é do servidor; a página nunca esconde o resto
              em silêncio. */}
          <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
            <p
              className="text-xs text-muted-foreground"
              data-testid="curadoria-paginacao-resumo"
            >
              Mostrando {offset + 1}–{offset + items.length} de {total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                disabled={offset === 0}
                className="px-3 py-1.5 rounded-lg border border-border text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent"
              >
                ← Anterior
              </button>
              <button
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
                disabled={offset + items.length >= total}
                className="px-3 py-1.5 rounded-lg border border-border text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent"
              >
                Próxima →
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
