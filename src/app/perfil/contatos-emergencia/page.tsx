// Relacionamentos — Contatos de emergencia (F4, 2026-08-21).
//
// O beco sem saida: /encontros/seguranca dizia "Cadastre contatos" e mandava
// pra /perfil/editar, que so tem bio/prompts/interesses — zero campo de
// contato. E `grep -r "setEmergencyContacts|myEmergencyContacts" src/` dava 0
// hits neste app. O botao de panico existia, os contatos nao tinham onde ser
// cadastrados.
//
// O backend ja estava pronto:
//   query    myEmergencyContacts   -> profile-extras.resolver.ts:492-505
//   mutation setEmergencyContacts  -> profile-extras.resolver.ts:508-525
//   persistencia real              -> safety.service.ts:772-836
//
// CUIDADO (o motivo de esta tela CARREGAR antes de salvar): a mutation e
// replace-set TRANSACIONAL (safety.service.ts:798-812) — ela soft-deleta todos
// os contatos atuais e cria os enviados. Salvar 1 contato sem ter carregado a
// lista APAGA os anteriores. A tela do shell
// (openticket-shell .../perfil/seguranca/page.tsx) nao carrega a lista — parte
// de [] — e por isso a estrutura de form foi copiada de la, mas o load inicial
// foi ADICIONADO aqui.

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, Phone, ShieldAlert, Trash2 } from "lucide-react";
import { gqlRequest, GqlClientError } from "@/lib/gql-client";

/** Limite do backend: min 1, max 5 (dto/profile-extras.dto.ts:36-38). */
const MAX_CONTACTS = 5;

const MY_EMERGENCY_CONTACTS = /* GraphQL */ `
  query MyEmergencyContacts {
    myEmergencyContacts {
      name
      phone
      relation
    }
  }
`;

const SET_EMERGENCY_CONTACTS = /* GraphQL */ `
  mutation SetEmergencyContacts($input: SetEmergencyContactsInput!) {
    setEmergencyContacts(input: $input) {
      ok
      persisted
      pendingReason
      accepted
    }
  }
`;

type ContactRow = {
  /** Chave local de render — o backend nao devolve id nesta query. */
  key: string;
  name: string;
  phone: string;
  relation: string | null;
};

type SetResult = {
  ok: boolean;
  persisted: boolean;
  pendingReason: string | null;
  accepted: number;
};

function keyOf(index: number): string {
  return `ec-${index}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function ContatosEmergenciaPage() {
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [relation, setRelation] = useState("");

  // Load ANTES de qualquer save — sem isso o replace-set apaga o que ja existe.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await gqlRequest<{
          myEmergencyContacts: Array<{
            name: string;
            phone: string;
            relation: string | null;
          }> | null;
        }>(MY_EMERGENCY_CONTACTS);
        if (!alive) return;
        setContacts(
          (data.myEmergencyContacts ?? []).map((c, i) => ({
            key: keyOf(i),
            name: c.name,
            phone: c.phone,
            relation: c.relation ?? null,
          })),
        );
      } catch (e) {
        if (!alive) return;
        setError(
          e instanceof GqlClientError
            ? e.message
            : "Nao foi possivel carregar seus contatos.",
        );
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const canAdd =
    name.trim().length >= 2 &&
    phone.trim().length >= 8 &&
    contacts.length < MAX_CONTACTS;

  /** Envia o SET COMPLETO — a mutation e replace-set, nao append. */
  async function persist(next: ContactRow[]): Promise<boolean> {
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const data = await gqlRequest<{ setEmergencyContacts: SetResult }>(
        SET_EMERGENCY_CONTACTS,
        {
          input: {
            contacts: next.map((c) => ({
              name: c.name,
              phone: c.phone,
              ...(c.relation ? { relation: c.relation } : {}),
            })),
          },
        },
      );
      const r = data.setEmergencyContacts;
      if (r.persisted) {
        setFeedback(
          `${r.accepted} contato(s) salvo(s). Eles serao acionados se voce apertar o botao de panico.`,
        );
      } else {
        setFeedback(
          r.pendingReason
            ? `Nao salvou: ${r.pendingReason}`
            : "Nao salvou. Tente de novo.",
        );
        return false;
      }
      return true;
    } catch (e) {
      setError(
        e instanceof GqlClientError
          ? e.message
          : "Nao foi possivel salvar. Tente de novo.",
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function addContact(e: React.FormEvent) {
    e.preventDefault();
    if (!canAdd) return;
    const previous = contacts;
    const next: ContactRow[] = [
      ...contacts,
      {
        key: keyOf(contacts.length),
        name: name.trim(),
        phone: phone.trim(),
        relation: relation.trim() || null,
      },
    ];
    setContacts(next);
    const ok = await persist(next);
    if (ok) {
      setName("");
      setPhone("");
      setRelation("");
    } else {
      // Nao mente pro usuario: se o backend recusou, a lista volta ao que era.
      setContacts(previous);
    }
  }

  async function removeContact(key: string) {
    const previous = contacts;
    const next = contacts.filter((c) => c.key !== key);
    if (next.length === 0) {
      // O backend exige min 1 (BadRequestException em safety.service.ts:775-777)
      // e nao existe mutation pra zerar a lista. Ser honesto > falhar em silencio.
      setError(
        "Nao da pra remover o ultimo contato: o backend exige pelo menos 1 " +
          "(setEmergencyContacts min 1). Substitua o contato em vez de apagar.",
      );
      return;
    }
    setContacts(next);
    const ok = await persist(next);
    if (!ok) setContacts(previous);
  }

  return (
    <main className="min-h-screen p-6 max-w-2xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShieldAlert className="h-7 w-7 text-rose-400" />
            Contatos de emergencia
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ate {MAX_CONTACTS} pessoas. Elas recebem um alerta com sua
            localizacao aproximada quando voce aciona o botao de panico.
          </p>
        </div>
        <Link
          href="/encontros/seguranca"
          className="shrink-0 text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-accent"
        >
          Voltar
        </Link>
      </header>

      {loading ? (
        <p className="text-center py-16 text-muted-foreground text-sm">
          Carregando contatos...
        </p>
      ) : (
        <div className="space-y-6">
          <section
            className="rounded-xl border border-border p-4"
            aria-label="Contatos cadastrados"
          >
            {contacts.length === 0 ? (
              <div className="text-center py-6">
                <Phone
                  className="mx-auto mb-3 h-8 w-8 text-muted-foreground"
                  aria-hidden="true"
                />
                <p className="text-sm text-muted-foreground">
                  Voce ainda nao tem contatos de emergencia. Adicione abaixo.
                </p>
              </div>
            ) : (
              <ul className="space-y-2" aria-label="Contatos de emergencia">
                {contacts.map((c) => (
                  <li
                    key={c.key}
                    className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
                  >
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-fuchsia-500/10 text-fuchsia-400">
                      <Phone className="h-4 w-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {c.phone}
                        {c.relation ? ` · ${c.relation}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeContact(c.key)}
                      disabled={saving}
                      className="rounded p-2 text-muted-foreground hover:bg-accent hover:text-rose-300 transition disabled:opacity-40"
                      aria-label={`Remover ${c.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <p className="text-xs text-muted-foreground mt-3">
              {contacts.length}/{MAX_CONTACTS} contatos
            </p>
          </section>

          {contacts.length < MAX_CONTACTS && (
            <form
              onSubmit={addContact}
              className="rounded-xl border border-border p-4 space-y-4"
              aria-label="Adicionar contato de emergencia"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs text-muted-foreground">Nome</span>
                  <input
                    aria-label="Nome do contato"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Maria Silva"
                    minLength={2}
                    required
                    className="mt-1 w-full px-3 py-2 border border-border rounded-lg bg-background"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-muted-foreground">
                    Telefone
                  </span>
                  <input
                    aria-label="Telefone do contato"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                    minLength={8}
                    required
                    className="mt-1 w-full px-3 py-2 border border-border rounded-lg bg-background"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-xs text-muted-foreground">
                  Parentesco (opcional)
                </span>
                <input
                  aria-label="Parentesco do contato"
                  type="text"
                  value={relation}
                  onChange={(e) => setRelation(e.target.value)}
                  placeholder="Ex: mae, irmao, amiga"
                  maxLength={60}
                  className="mt-1 w-full px-3 py-2 border border-border rounded-lg bg-background"
                />
              </label>
              <button
                type="submit"
                disabled={!canAdd || saving}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold transition-colors"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Salvando…
                  </>
                ) : (
                  "Salvar contato"
                )}
              </button>
            </form>
          )}

          {feedback && (
            <p className="text-sm text-emerald-300" role="status">
              {feedback}
            </p>
          )}
          {error && (
            <p className="text-sm text-rose-300" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </main>
  );
}
