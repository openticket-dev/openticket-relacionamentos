// Relacionamentos — Perfil (view + edit)
// Wave: W-R-9 (initial scaffold). Form funcional salva em local state.
// W-R-4 wira mutation GraphQL `updateProfile(input: ProfileInput!)` + R2 storage para foto.

"use client";

import { useState } from "react";
import { SUBVERTICALS } from "@/lib/subverticals";

type ProfileForm = {
  displayName: string;
  bio: string;
  age: string;
  city: string;
  interests: string[];
};

const INITIAL_FORM: ProfileForm = {
  displayName: "",
  bio: "",
  age: "",
  city: "",
  interests: [],
};

export default function PerfilPage() {
  const [form, setForm] = useState<ProfileForm>(INITIAL_FORM);
  const [saved, setSaved] = useState(false);

  const handleChange = <K extends keyof ProfileForm>(
    key: K,
    value: ProfileForm[K],
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // W-R-4: substituir por mutation GraphQL updateProfile(input)
    // Por enquanto: salva em local state e mostra confirmacao
    setSaved(true);
  };

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Meu perfil</h1>
        <p className="text-muted-foreground mt-2">
          Configure seu perfil. Persistencia em backend sera ligada em W-R-4.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label
            htmlFor="displayName"
            className="block text-sm font-medium mb-1"
          >
            Nome de exibicao *
          </label>
          <input
            id="displayName"
            type="text"
            required
            value={form.displayName}
            onChange={(e) => handleChange("displayName", e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background"
            placeholder="Como voce quer aparecer"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="age" className="block text-sm font-medium mb-1">
              Idade
            </label>
            <input
              id="age"
              type="number"
              min={18}
              max={99}
              value={form.age}
              onChange={(e) => handleChange("age", e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background"
            />
          </div>
          <div>
            <label htmlFor="city" className="block text-sm font-medium mb-1">
              Cidade
            </label>
            <input
              id="city"
              type="text"
              value={form.city}
              onChange={(e) => handleChange("city", e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background"
              placeholder="Sao Paulo, SP"
            />
          </div>
        </div>

        <div>
          <label htmlFor="bio" className="block text-sm font-medium mb-1">
            Bio
          </label>
          <textarea
            id="bio"
            rows={4}
            value={form.bio}
            onChange={(e) => handleChange("bio", e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background resize-none"
            placeholder="Conte um pouco sobre voce..."
          />
        </div>

        <fieldset>
          <legend className="text-sm font-medium mb-2">Interesses</legend>
          <p className="text-xs text-muted-foreground mb-3">
            Escolha uma ou mais subverticais. Influencia o algoritmo de
            matching.
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {SUBVERTICALS.map((sv) => {
              const on = form.interests.includes(sv.slug);
              return (
                <button
                  key={sv.slug}
                  type="button"
                  onClick={() => toggleInterest(sv.slug)}
                  className={`p-3 rounded-lg border text-xs font-medium transition-colors ${
                    on
                      ? "border-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-950/40 text-fuchsia-700 dark:text-fuchsia-300"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  <div className="text-2xl mb-1">{sv.emoji}</div>
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
          {saved && (
            <span className="text-sm text-green-600 dark:text-green-400">
              Perfil salvo localmente. Persistencia backend em W-R-4.
            </span>
          )}
        </div>
      </form>
    </main>
  );
}
