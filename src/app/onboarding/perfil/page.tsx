// Relacionamentos — Onboarding de perfil (OBRIGATÓRIO ao entrar na vertical).
// Wizard de 3 passos que cria o perfil de match via updateMyMatchProfile (upsert).
// Disparado pelo OnboardingGate quando myMatchProfile == null.

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SUBVERTICALS } from "@/lib/subverticals";
import { gqlRequest, GqlClientError } from "@/lib/gql-client";

const UPDATE_PROFILE = /* GraphQL */ `
  mutation UpdateMyMatchProfile($input: UpdateMyMatchProfileInput!) {
    updateMyMatchProfile(input: $input) {
      id
      completeness
    }
  }
`;

const GENDERS: { value: string; label: string }[] = [
  { value: "MULHER", label: "Mulher" },
  { value: "HOMEM", label: "Homem" },
  { value: "NAO_BINARIO", label: "Não-binárie" },
  { value: "TRANS_MULHER", label: "Mulher trans" },
  { value: "TRANS_HOMEM", label: "Homem trans" },
  { value: "PREFERIRO_NAO_DIZER", label: "Prefiro não dizer" },
];

const INTERESTED_IN: { value: string; label: string }[] = [
  { value: "MULHER", label: "Mulheres" },
  { value: "HOMEM", label: "Homens" },
  { value: "NAO_BINARIO", label: "Não-bináries" },
];

export default function OnboardingPerfilPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [gender, setGender] = useState("");
  const [interestedIn, setInterestedIn] = useState<string[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [age, setAge] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState<string[]>([]);

  const toggle = (arr: string[], v: string) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  const ageNum = parseInt(age, 10);
  const step1Ok = !!gender && interestedIn.length > 0;
  const step2Ok = displayName.trim().length >= 2 && !Number.isNaN(ageNum) && ageNum >= 18;

  async function handleSubmit() {
    setError(null);
    if (!step1Ok || !step2Ok) return;
    setSaving(true);
    try {
      await gqlRequest(UPDATE_PROFILE, {
        input: {
          displayName: displayName.trim(),
          genderIdentity: gender,
          interestedIn,
          declaredAge: ageNum,
          city: city.trim() || undefined,
          bio: bio.trim() || undefined,
          interests,
        },
      });
      router.replace("/hub");
    } catch (err) {
      setError(
        err instanceof GqlClientError
          ? err.message
          : "Não foi possível salvar. Tente de novo.",
      );
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen p-6 max-w-lg mx-auto">
      <header className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-fuchsia-500">
          Passo {step} de 3
        </p>
        <h1 className="text-3xl font-bold mt-1">Monte seu perfil</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pra te mostrar pra quem combina com você, a gente precisa te conhecer
          um pouco. Leva menos de 1 minuto.
        </p>
        <div className="mt-4 h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-fuchsia-600 transition-all"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>
      </header>

      {/* ── Passo 1: identidade + interesse ── */}
      {step === 1 && (
        <section className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold mb-2">Você é...</h2>
            <div className="grid grid-cols-2 gap-2">
              {GENDERS.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => setGender(g.value)}
                  className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                    gender === g.value
                      ? "border-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-950/40 text-fuchsia-700 dark:text-fuchsia-300"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-sm font-semibold mb-2">
              Quer conhecer... <span className="text-muted-foreground font-normal">(pode marcar mais de um)</span>
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {INTERESTED_IN.map((i) => (
                <button
                  key={i.value}
                  type="button"
                  onClick={() => setInterestedIn((p) => toggle(p, i.value))}
                  className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                    interestedIn.includes(i.value)
                      ? "border-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-950/40 text-fuchsia-700 dark:text-fuchsia-300"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  {i.label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            disabled={!step1Ok}
            onClick={() => setStep(2)}
            className="w-full py-3 rounded-xl bg-fuchsia-600 text-white font-semibold disabled:opacity-50"
          >
            Continuar
          </button>
        </section>
      )}

      {/* ── Passo 2: nome + idade + cidade ── */}
      {step === 2 && (
        <section className="space-y-4">
          <label className="block">
            <span className="text-xs text-muted-foreground">Nome de exibição *</span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Como você quer aparecer"
              className="mt-1 w-full px-3 py-2.5 border border-border rounded-xl bg-background"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-muted-foreground">Idade * (18+)</span>
              <input
                type="number"
                min={18}
                max={99}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="mt-1 w-full px-3 py-2.5 border border-border rounded-xl bg-background"
              />
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">Cidade</span>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="São Paulo, SP"
                className="mt-1 w-full px-3 py-2.5 border border-border rounded-xl bg-background"
              />
            </label>
          </div>
          {!Number.isNaN(ageNum) && ageNum > 0 && ageNum < 18 && (
            <p className="text-xs text-red-600 dark:text-red-400">
              É preciso ter 18 anos ou mais pra usar Relacionamentos.
            </p>
          )}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-5 py-3 rounded-xl border border-border hover:bg-accent font-medium"
            >
              Voltar
            </button>
            <button
              type="button"
              disabled={!step2Ok}
              onClick={() => setStep(3)}
              className="flex-1 py-3 rounded-xl bg-fuchsia-600 text-white font-semibold disabled:opacity-50"
            >
              Continuar
            </button>
          </div>
        </section>
      )}

      {/* ── Passo 3: bio + interesses ── */}
      {step === 3 && (
        <section className="space-y-5">
          <label className="block">
            <span className="text-xs text-muted-foreground">
              Bio ({bio.length}/500)
            </span>
            <textarea
              rows={4}
              maxLength={500}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Conte um pouco sobre você, o que curte, o que procura..."
              className="mt-1 w-full px-3 py-2.5 border border-border rounded-xl bg-background resize-none"
            />
          </label>
          <div>
            <h2 className="text-sm font-semibold mb-1">
              Seus interesses{" "}
              <span className="text-muted-foreground font-normal">
                ({interests.length} — ajuda o match)
              </span>
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
              {SUBVERTICALS.map((sv) => {
                const on = interests.includes(sv.slug);
                return (
                  <button
                    key={sv.slug}
                    type="button"
                    onClick={() => setInterests((p) => toggle(p, sv.slug))}
                    className={`p-2 rounded-xl border text-xs font-medium transition-colors ${
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
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={saving}
              className="px-5 py-3 rounded-xl border border-border hover:bg-accent font-medium disabled:opacity-50"
            >
              Voltar
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSubmit}
              className="flex-1 py-3 rounded-xl bg-fuchsia-600 text-white font-semibold disabled:opacity-60"
            >
              {saving ? "Criando seu perfil..." : "Concluir e entrar"}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
