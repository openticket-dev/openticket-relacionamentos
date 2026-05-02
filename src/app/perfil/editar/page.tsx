// Relacionamentos — Editar perfil (fotos + bio + prompts)
// Sprint M8-1: editor completo com prompts (estilo Hinge), upload fotos placeholder.
// Backend: W-R-4 wira updateProfile mutation + R2 storage upload.

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SUBVERTICALS } from "@/lib/subverticals";

type Photo = { id: string; previewUrl: string };

type Prompt = {
  id: string;
  question: string;
  answer: string;
};

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
  photos: Photo[];
  prompts: Prompt[];
};

const STORAGE_KEY = "relac:perfil-editor";

const INITIAL: EditorState = {
  displayName: "",
  bio: "",
  age: "",
  city: "",
  interests: [],
  photos: [],
  prompts: [],
};

export default function PerfilEditarPage() {
  const [form, setForm] = useState<EditorState>(INITIAL);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setForm({ ...INITIAL, ...JSON.parse(raw) });
    } catch {
      // ignore
    }
  }, []);

  const update = <K extends keyof EditorState>(
    key: K,
    value: EditorState[K],
  ) => {
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

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // PLACEHOLDER: cria preview local. W-R-4 fara upload pro R2 e salva URL real.
    const previewUrl = URL.createObjectURL(file);
    const id = `local-${Date.now()}`;
    setForm((prev) => ({
      ...prev,
      photos: [...prev.photos, { id, previewUrl }].slice(0, 6),
    }));
    setSaved(false);
    e.target.value = "";
  };

  const removePhoto = (id: string) => {
    setForm((prev) => ({
      ...prev,
      photos: prev.photos.filter((p) => p.id !== id),
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // PLACEHOLDER: salva tudo em localStorage. W-R-4 chamara updateProfile mutation.
      const toPersist = {
        ...form,
        // photos com URL.createObjectURL nao persistem entre reloads — guardamos so ids
        photos: form.photos.map((p) => ({ id: p.id, previewUrl: "" })),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toPersist));
      setSaved(true);
    } catch {
      // ignore
    }
  };

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Editar perfil</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Fotos, bio, prompts. Persistencia backend em W-R-4.
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
        {/* Fotos */}
        <fieldset className="rounded-xl border border-border p-4">
          <legend className="px-2 text-sm font-medium">
            Fotos ({form.photos.length}/6)
          </legend>
          <p className="text-xs text-muted-foreground mt-1 mb-3">
            Min 2 fotos recomendado. Upload pro R2 sera ligado em W-R-4.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {form.photos.map((p) => (
              <div
                key={p.id}
                className="relative aspect-square rounded-lg overflow-hidden border border-border bg-muted"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.previewUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(p.id)}
                  aria-label="Remover foto"
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs hover:bg-black"
                >
                  ✕
                </button>
              </div>
            ))}
            {form.photos.length < 6 && (
              <label className="aspect-square rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:bg-accent text-2xl text-muted-foreground">
                +
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoSelect}
                />
              </label>
            )}
          </div>
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
            Influencia o algoritmo de matching (W-R-3).
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

        <div className="flex items-center gap-3 pt-4 border-t border-border">
          <button
            type="submit"
            className="px-6 py-2 rounded-lg bg-fuchsia-600 text-white font-medium hover:bg-fuchsia-700"
          >
            Salvar perfil
          </button>
          <Link
            href="/perfil/verificar"
            className="px-4 py-2 text-sm rounded-lg border border-blue-300 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-blue-700 dark:text-blue-300"
          >
            Verificar perfil →
          </Link>
          {saved && (
            <span className="text-sm text-emerald-600 dark:text-emerald-400">
              Salvo localmente. Backend em W-R-4.
            </span>
          )}
        </div>
      </form>
    </main>
  );
}
