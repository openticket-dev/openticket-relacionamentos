// Relacionamentos — Editar perfil (bio + prompts + interesses + identidade)
// N100 (2026-06-04): wireado ao backend real. Carrega de myMatchProfile e salva
// via updateMyMatchProfile (upsert) — zero localStorage. Fotos exibem as reais
// (read-only); upload completo (storage + moderação) é fluxo dedicado à parte.

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SUBVERTICALS } from "@/lib/subverticals";
import { gqlRequest, GqlClientError } from "@/lib/gql-client";

type Prompt = { id: string; question: string; answer: string };
type Photo = { id: string; url: string; isPrimary: boolean; position: number };

const PROMPT_OPTIONS = [
  "Meu domingo perfeito é...",
  "A coisa que mais me orgulha...",
  "Um talento estranho meu é...",
  "O melhor jeito de me conquistar...",
  "Nunca vou recusar...",
  "Estou aprendendo a...",
];

type EditorState = {
  displayName: string;
  bio: string;
  age: string;
  city: string;
  interests: string[];
  prompts: Prompt[];
};

const INITIAL: EditorState = {
  displayName: "",
  bio: "",
  age: "",
  city: "",
  interests: [],
  prompts: [],
};

const MY_MATCH_PROFILE = /* GraphQL */ `
  query MyMatchProfile {
    myMatchProfile {
      displayName
      bio
      declaredAge
      city
      interests
      prompts { question answer }
      photos { id url isPrimary position }
    }
  }
`;

const UPDATE_PROFILE = /* GraphQL */ `
  mutation UpdateMyMatchProfile($input: UpdateMyMatchProfileInput!) {
    updateMyMatchProfile(input: $input) {
      id
      completeness
    }
  }
`;

export default function PerfilEditarPage() {
  const [form, setForm] = useState<EditorState>(INITIAL);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await gqlRequest<{
          myMatchProfile: {
            displayName?: string | null;
            bio?: string | null;
            declaredAge?: number | null;
            city?: string | null;
            interests?: string[] | null;
            prompts?: { question: string; answer: string }[] | null;
            photos?: Photo[] | null;
          } | null;
        }>(MY_MATCH_PROFILE);
        if (!alive) return;
        const p = data.myMatchProfile;
        if (p) {
          setForm({
            displayName: p.displayName ?? "",
            bio: p.bio ?? "",
            age: p.declaredAge ? String(p.declaredAge) : "",
            city: p.city ?? "",
            interests: p.interests ?? [],
            prompts: (p.prompts ?? []).map((pr, i) => ({
              id: `pr-${i}`,
              question: pr.question,
              answer: pr.answer,
            })),
          });
          setPhotos(p.photos ?? []);
        }
      } catch (e) {
        if (alive)
          setError(
            e instanceof GqlClientError
              ? e.message
              : "Não foi possível carregar seu perfil.",
          );
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const update = <K extends keyof EditorState>(key: K, value: EditorState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const toggleInterest = (slug: string) => {
    setForm((prev) => ({
      ...prev,
      interests: prev.interests.includes(slug)
        ? prev.interests.filter((s) => s !== slug)
        : [...prev.interests, slug],
    }));
    setSaved(false);
  };

  const addPrompt = (question: string) => {
    if (form.prompts.some((p) => p.question === question)) return;
    setForm((prev) => ({
      ...prev,
      prompts: [
        ...prev.prompts,
        { id: `pr-${Date.now()}`, question, answer: "" },
      ].slice(0, 3),
    }));
    setSaved(false);
  };

  const updatePromptAnswer = (id: string, answer: string) => {
    setForm((prev) => ({
      ...prev,
      prompts: prev.prompts.map((p) => (p.id === id ? { ...p, answer } : p)),
    }));
    setSaved(false);
  };

  const removePrompt = (id: string) => {
    setForm((prev) => ({
      ...prev,
      prompts: prev.prompts.filter((p) => p.id !== id),
    }));
    setSaved(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const ageNum = parseInt(form.age, 10);
      const input: Record<string, unknown> = {
        displayName: form.displayName,
        bio: form.bio,
        city: form.city,
        interests: form.interests,
        prompts: form.prompts
          .filter((p) => p.answer.trim())
          .map((p) => ({ question: p.question, answer: p.answer })),
      };
      if (!Number.isNaN(ageNum) && ageNum > 0) input.declaredAge = ageNum;
      await gqlRequest(UPDATE_PROFILE, { input });
      setSaved(true);
    } catch (err) {
      setError(
        err instanceof GqlClientError
          ? err.message
          : "Não foi possível salvar. Tente novamente.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen p-6 max-w-3xl mx-auto">
        <p className="text-center py-16 text-muted-foreground text-sm">
          Carregando editor...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Editar perfil</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Identidade, bio, prompts e interesses.
          </p>
        </div>
        <Link
          href="/perfil"
          className="text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-accent"
        >
          Voltar
        </Link>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Fotos (read-only — gerenciamento completo no fluxo de fotos) */}
        <fieldset className="rounded-xl border border-border p-4">
          <legend className="px-2 text-sm font-medium">
            Fotos ({photos.length})
          </legend>
          {photos.length > 0 ? (
            <div className="grid grid-cols-3 gap-2 mt-2">
              {photos.map((p, idx) => (
                <div
                  key={p.id}
                  className="relative aspect-square rounded-lg overflow-hidden border border-border bg-muted"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt={`Foto de perfil ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {p.isPrimary && (
                    <span className="absolute top-1 left-1 text-[10px] px-1.5 py-0.5 rounded-full bg-fuchsia-600 text-white">
                      Principal
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">
              Nenhuma foto ainda.
            </p>
          )}
        </fieldset>

        {/* Identidade */}
        <fieldset className="rounded-xl border border-border p-4 space-y-4">
          <legend className="px-2 text-sm font-medium">Identidade</legend>
          <label className="block">
            <span className="text-xs text-muted-foreground">
              Nome de exibicao *
            </span>
            <input
              type="text"
              required
              value={form.displayName}
              onChange={(e) => update("displayName", e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-border rounded-lg bg-background"
              placeholder="Como voce quer aparecer"
            />
          </label>

          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs text-muted-foreground">Idade</span>
              <input
                type="number"
                min={18}
                max={99}
                value={form.age}
                onChange={(e) => update("age", e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-border rounded-lg bg-background"
              />
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">Cidade</span>
              <input
                type="text"
                value={form.city}
                onChange={(e) => update("city", e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-border rounded-lg bg-background"
                placeholder="Sao Paulo, SP"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs text-muted-foreground">
              Bio ({form.bio.length}/500)
            </span>
            <textarea
              rows={4}
              maxLength={500}
              value={form.bio}
              onChange={(e) => update("bio", e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-border rounded-lg bg-background resize-none"
              placeholder="Conte um pouco sobre voce..."
            />
          </label>
        </fieldset>

        {/* Prompts */}
        <fieldset className="rounded-xl border border-border p-4">
          <legend className="px-2 text-sm font-medium">
            Prompts ({form.prompts.length}/3)
          </legend>
          <p className="text-xs text-muted-foreground mt-1 mb-3">
            Escolha ate 3 prompts pra mostrar sua personalidade.
          </p>

          {form.prompts.length > 0 && (
            <div className="space-y-3 mb-4">
              {form.prompts.map((p) => (
                <div
                  key={p.id}
                  className="rounded-lg border border-border p-3 bg-muted/30"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{p.question}</span>
                    <button
                      type="button"
                      onClick={() => removePrompt(p.id)}
                      aria-label="Remover prompt"
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      ✕
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={p.answer}
                    onChange={(e) => updatePromptAnswer(p.id, e.target.value)}
                    placeholder="Sua resposta..."
                    maxLength={150}
                    className="w-full px-2 py-1.5 text-sm border border-border rounded bg-background resize-none"
                  />
                </div>
              ))}
            </div>
          )}

          {form.prompts.length < 3 && (
            <div className="space-y-1">
              {PROMPT_OPTIONS.filter(
                (q) => !form.prompts.some((p) => p.question === q),
              ).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => addPrompt(q)}
                  className="block w-full text-left px-3 py-2 text-sm rounded-lg border border-border hover:bg-accent"
                >
                  + {q}
                </button>
              ))}
            </div>
          )}
        </fieldset>

        {/* Interesses */}
        <fieldset className="rounded-xl border border-border p-4">
          <legend className="px-2 text-sm font-medium">
            Interesses ({form.interests.length})
          </legend>
          <p className="text-xs text-muted-foreground mt-1 mb-3">
            Influencia o algoritmo de matching.
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {SUBVERTICALS.map((sv) => {
              const on = form.interests.includes(sv.slug);
              return (
                <button
                  key={sv.slug}
                  type="button"
                  onClick={() => toggleInterest(sv.slug)}
                  className={`p-2 rounded-lg border text-xs font-medium transition-colors ${
                    on
                      ? "border-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-950/40 text-fuchsia-700 dark:text-fuchsia-300"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  <div className="text-xl mb-0.5">{sv.emoji}</div>
                  {sv.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="flex items-center gap-3 pt-4 border-t border-border">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 rounded-lg bg-fuchsia-600 text-white font-medium hover:bg-fuchsia-700 disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar perfil"}
          </button>
          <Link
            href="/perfil/verificar"
            className="px-4 py-2 text-sm rounded-lg border border-blue-300 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-blue-700 dark:text-blue-300"
          >
            Verificar perfil →
          </Link>
          {saved && (
            <span className="text-sm text-emerald-600 dark:text-emerald-400">
              Perfil salvo ✓
            </span>
          )}
        </div>
      </form>
    </main>
  );
}
