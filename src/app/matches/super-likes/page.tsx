// Relacionamentos — Super-likes recebidos
// Sprint M8-1: lista destacada de super-likes (sem blur, signal forte).
// Backend: W-R-2 wira query GraphQL receivedSuperLikes.

"use client";

import Link from "next/link";

type SuperLike = {
  id: string;
  name_PLACEHOLDER: string;
  age_PLACEHOLDER: number;
  city_PLACEHOLDER: string;
  message_PLACEHOLDER: string | null;
  receivedAt_PLACEHOLDER: string;
};

const PLACEHOLDER_SUPERS: SuperLike[] = [
  {
    id: "sl-1",
    name_PLACEHOLDER: "Super-like 1",
    age_PLACEHOLDER: 27,
    city_PLACEHOLDER: "Sao Paulo, SP",
    message_PLACEHOLDER:
      "Adorei sua bio! Tambem curto trilha aos fins de semana.",
    receivedAt_PLACEHOLDER: "ha 30 min",
  },
  {
    id: "sl-2",
    name_PLACEHOLDER: "Super-like 2",
    age_PLACEHOLDER: 31,
    city_PLACEHOLDER: "Belo Horizonte, MG",
    message_PLACEHOLDER: null,
    receivedAt_PLACEHOLDER: "ha 3h",
  },
];

export default function SuperLikesPage() {
  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <span className="text-blue-500">★</span> Super-likes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pessoas que ja se destacaram pra voce. Resposta tem prioridade.
          </p>
        </div>
        <Link
          href="/matches"
          className="text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-accent"
        >
          Voltar
        </Link>
      </header>

      {PLACEHOLDER_SUPERS.length === 0 ? (
        <div className="text-center py-12 border border-border rounded-xl bg-muted/30">
          <p className="text-3xl mb-2">★</p>
          <p className="font-medium">Nenhum super-like ainda</p>
          <p className="text-sm text-muted-foreground mt-1">
            Quando alguem te der super-like, aparece aqui.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {PLACEHOLDER_SUPERS.map((s) => (
            <li
              key={s.id}
              className="border-2 border-blue-300 dark:border-blue-800 rounded-2xl p-5 bg-blue-50/30 dark:bg-blue-950/20 relative"
            >
              <div className="absolute top-3 right-3 text-blue-500 text-2xl">
                ★
              </div>
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-300 to-fuchsia-400 flex-shrink-0" />
                <div className="flex-1 min-w-0 pr-8">
                  <h3 className="font-semibold">
                    {s.name_PLACEHOLDER}, {s.age_PLACEHOLDER}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {s.city_PLACEHOLDER} · {s.receivedAt_PLACEHOLDER}
                  </p>
                  {s.message_PLACEHOLDER && (
                    <blockquote className="mt-3 p-3 rounded-lg bg-background border border-border text-sm italic">
                      "{s.message_PLACEHOLDER}"
                    </blockquote>
                  )}
                  <div className="flex gap-2 mt-3">
                    <Link
                      href={`/chat/${s.id}`}
                      className="px-4 py-1.5 text-sm rounded-lg bg-fuchsia-600 text-white hover:bg-fuchsia-700"
                    >
                      Curtir de volta
                    </Link>
                    <button
                      type="button"
                      className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-accent text-muted-foreground"
                      title="Mutation passSuperLike sera ligada em W-R-2"
                    >
                      Passar
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground text-center mt-6">
        Acoes (curtir/passar) ficam em local state ate W-R-2 wirar mutations
        GraphQL.
      </p>
    </main>
  );
}
