// Relacionamentos — Buscar (deck swipe Tinder-style)
// Sprint M8-1: deck card-stack com keyboard navigation (left=pass, right=like, up=super)
// Backend wiring: sprint W-R-2 (GraphQL matches(filter)) — placeholders explicitos enquanto isso.

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SUBVERTICALS } from "@/lib/subverticals";

type DeckProfile = {
  id: string;
  name_PLACEHOLDER: string;
  age_PLACEHOLDER: number;
  city_PLACEHOLDER: string;
  bio_PLACEHOLDER: string;
  vertical: string;
  compatibility_PLACEHOLDER: number;
  verified_PLACEHOLDER: boolean;
};

const PLACEHOLDER_DECK: DeckProfile[] = [
  {
    id: "ph-1",
    name_PLACEHOLDER: "Perfil exemplo 1",
    age_PLACEHOLDER: 28,
    city_PLACEHOLDER: "Sao Paulo, SP",
    bio_PLACEHOLDER:
      "Bio exemplo — backend api-relacionamentos sera ligado em W-R-2.",
    vertical: "dating",
    compatibility_PLACEHOLDER: 87,
    verified_PLACEHOLDER: true,
  },
  {
    id: "ph-2",
    name_PLACEHOLDER: "Perfil exemplo 2",
    age_PLACEHOLDER: 32,
    city_PLACEHOLDER: "Rio de Janeiro, RJ",
    bio_PLACEHOLDER:
      "Bio exemplo — feed real virá da query GraphQL matches(filter).",
    vertical: "networking",
    compatibility_PLACEHOLDER: 72,
    verified_PLACEHOLDER: false,
  },
  {
    id: "ph-3",
    name_PLACEHOLDER: "Perfil exemplo 3",
    age_PLACEHOLDER: 25,
    city_PLACEHOLDER: "Curitiba, PR",
    bio_PLACEHOLDER:
      "Bio exemplo — algoritmo de matching em desenvolvimento (W-R-3).",
    vertical: "fitness",
    compatibility_PLACEHOLDER: 91,
    verified_PLACEHOLDER: true,
  },
];

type SwipeAction = "pass" | "like" | "super";

export default function BuscarPage() {
  const [activeVertical, setActiveVertical] = useState<string>("all");
  const [cursor, setCursor] = useState(0);
  const [history, setHistory] = useState<{ id: string; action: SwipeAction }[]>(
    [],
  );
  const [dragX, setDragX] = useState(0);

  const filtered = useMemo(
    () =>
      PLACEHOLDER_DECK.filter(
        (m) => activeVertical === "all" || m.vertical === activeVertical,
      ),
    [activeVertical],
  );

  const current = filtered[cursor];
  const next = filtered[cursor + 1];

  const swipe = (action: SwipeAction) => {
    if (!current) return;
    setHistory((h) => [...h, { id: current.id, action }]);
    setCursor((c) => c + 1);
    setDragX(0);
  };

  // Keyboard nav: ArrowLeft=pass, ArrowRight=like, ArrowUp=super
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") swipe("pass");
      if (e.key === "ArrowRight") swipe("like");
      if (e.key === "ArrowUp") swipe("super");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <header className="mb-4 flex items-baseline justify-between">
        <div>
          <h1 className="text-3xl font-bold">Buscar conexoes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Deck Tinder-style. Backend wireado em W-R-2 (GraphQL matches).
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link
            href="/buscar/filtros"
            className="px-3 py-1.5 rounded-lg border border-border hover:bg-accent"
          >
            Filtros
          </Link>
          <Link
            href="/buscar/explore"
            className="px-3 py-1.5 rounded-lg border border-border hover:bg-accent"
          >
            Explorar
          </Link>
        </div>
      </header>

      {/* Filtros por vertical */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-6 border-b border-border">
        <button
          onClick={() => {
            setActiveVertical("all");
            setCursor(0);
          }}
          className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            activeVertical === "all"
              ? "bg-fuchsia-600 text-white"
              : "bg-muted hover:bg-accent"
          }`}
        >
          Todos
        </button>
        {SUBVERTICALS.slice(0, 8).map((sv) => (
          <button
            key={sv.slug}
            onClick={() => {
              setActiveVertical(sv.slug);
              setCursor(0);
            }}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              activeVertical === sv.slug
                ? "bg-fuchsia-600 text-white"
                : "bg-muted hover:bg-accent"
            }`}
          >
            {sv.emoji} {sv.label}
          </button>
        ))}
      </div>

      {/* Deck area */}
      {!current ? (
        <div className="text-center py-16 border border-border rounded-2xl bg-muted/30">
          <p className="text-2xl mb-2">🎴</p>
          <p className="font-medium">Voce viu todos por aqui</p>
          <p className="text-sm text-muted-foreground mt-2">
            {history.length} avaliacoes nesta sessao. Volte mais tarde ou
            ajuste filtros.
          </p>
          <button
            onClick={() => {
              setCursor(0);
              setHistory([]);
            }}
            className="mt-4 px-4 py-2 text-sm rounded-lg border border-border hover:bg-accent"
          >
            Recomecar
          </button>
        </div>
      ) : (
        <div className="relative h-[480px] mb-6">
          {/* Card de baixo (proximo) */}
          {next && (
            <article
              aria-hidden
              className="absolute inset-0 rounded-2xl border border-border bg-card shadow-md scale-95 opacity-60"
            >
              <CardContent profile={next} dragX={0} />
            </article>
          )}
          {/* Card atual */}
          <article
            role="region"
            aria-label={`Card de ${current.name_PLACEHOLDER}`}
            onMouseDown={(e) => {
              const startX = e.clientX;
              const onMove = (ev: MouseEvent) => setDragX(ev.clientX - startX);
              const onUp = () => {
                window.removeEventListener("mousemove", onMove);
                window.removeEventListener("mouseup", onUp);
                if (dragX > 120) swipe("like");
                else if (dragX < -120) swipe("pass");
                else setDragX(0);
              };
              window.addEventListener("mousemove", onMove);
              window.addEventListener("mouseup", onUp);
            }}
            className="absolute inset-0 rounded-2xl border border-border bg-card shadow-xl cursor-grab active:cursor-grabbing transition-transform"
            style={{
              transform: `translateX(${dragX}px) rotate(${dragX * 0.05}deg)`,
            }}
          >
            <CardContent profile={current} dragX={dragX} />
          </article>
        </div>
      )}

      {/* Acoes */}
      {current && (
        <div className="flex justify-center gap-4">
          <button
            onClick={() => swipe("pass")}
            aria-label="Passar (seta esquerda)"
            className="w-14 h-14 rounded-full bg-white dark:bg-zinc-900 border border-border shadow hover:bg-rose-50 dark:hover:bg-rose-950 text-2xl"
          >
            ✕
          </button>
          <button
            onClick={() => swipe("super")}
            aria-label="Super-like (seta cima)"
            className="w-14 h-14 rounded-full bg-white dark:bg-zinc-900 border border-border shadow hover:bg-blue-50 dark:hover:bg-blue-950 text-2xl"
          >
            ★
          </button>
          <button
            onClick={() => swipe("like")}
            aria-label="Curtir (seta direita)"
            className="w-14 h-14 rounded-full bg-white dark:bg-zinc-900 border border-border shadow hover:bg-emerald-50 dark:hover:bg-emerald-950 text-2xl"
          >
            ♡
          </button>
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground mt-4">
        Atalhos: ← passar · ↑ super · → curtir
      </p>
    </main>
  );
}

function CardContent({
  profile,
  dragX,
}: {
  profile: DeckProfile;
  dragX: number;
}) {
  return (
    <div className="relative h-full p-6 flex flex-col">
      <div className="flex-1 rounded-xl bg-gradient-to-br from-fuchsia-200 via-rose-200 to-amber-200 dark:from-fuchsia-900/40 dark:via-rose-900/40 dark:to-amber-900/40 mb-4 flex items-center justify-center">
        <span className="text-6xl opacity-30">👤</span>
      </div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">
            {profile.name_PLACEHOLDER}, {profile.age_PLACEHOLDER}
            {profile.verified_PLACEHOLDER && (
              <span
                className="ml-2 inline-block text-blue-600"
                title="Perfil verificado (Datavalid)"
              >
                ✓
              </span>
            )}
          </h2>
          <p className="text-sm text-muted-foreground">
            {profile.city_PLACEHOLDER}
          </p>
        </div>
        <span className="shrink-0 text-xs bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-700 dark:text-fuchsia-300 px-2 py-1 rounded-full">
          {profile.compatibility_PLACEHOLDER}% match
        </span>
      </div>
      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
        {profile.bio_PLACEHOLDER}
      </p>
      {/* Overlays drag */}
      {dragX > 40 && (
        <div className="absolute top-8 left-8 px-3 py-1 border-2 border-emerald-500 text-emerald-500 text-xl font-bold rounded rotate-[-12deg]">
          CURTIR
        </div>
      )}
      {dragX < -40 && (
        <div className="absolute top-8 right-8 px-3 py-1 border-2 border-rose-500 text-rose-500 text-xl font-bold rounded rotate-[12deg]">
          PASSAR
        </div>
      )}
    </div>
  );
}
