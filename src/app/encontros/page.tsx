/**
 * /encontros — Lista de encontros marcados/realizados com Sparkles Constellation 3D.
 *
 * Cada encontro aparece como sparkle na constelacao 3D no topo (linha temporal
 * romantica). Lista abaixo mostra detalhes texto. Heart de relacionamentos
 * + constelacao = "voces estao construindo uma historia juntos".
 *
 * Wave: 3D-EXPANSION (J1D) · 62 -> 66
 * Stack: Next 16 App Router + R3F 9 (Tier 3).
 * Zero-mock: dados via fetch /api/graphql; sem fake data inventada.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  SparklesConstellation3D,
  type EncontroPoint,
} from "@/components/SparklesConstellation3D";

const MY_ENCONTROS_QUERY = /* GraphQL */ `
  query MyEncontros($limit: Int) {
    myEncontros(limit: $limit) {
      id
      title
      scheduledAt
      completedAt
      status
      energy
      otherProfile {
        id
        displayName
      }
    }
  }
`;

interface EncontroEntry {
  id: string;
  title: string;
  scheduledAt: string;
  completedAt: string | null;
  status: "scheduled" | "completed" | "cancelled" | "pending";
  energy: number | null;
  otherProfile: {
    id: string;
    displayName: string;
  };
}

type LoadState = "loading" | "ready" | "empty" | "error";

async function fetchEncontros(limit: number): Promise<EncontroEntry[]> {
  const res = await fetch("/api/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: MY_ENCONTROS_QUERY,
      variables: { limit },
    }),
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const json = (await res.json()) as {
    data?: { myEncontros: EncontroEntry[] | null };
    errors?: { message: string }[];
  };
  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors[0]?.message ?? "GraphQL error");
  }
  return json.data?.myEncontros ?? [];
}

function formatScheduled(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function EncontrosPage() {
  const [state, setState] = useState<LoadState>("loading");
  const [encontros, setEncontros] = useState<EncontroEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const items = await fetchEncontros(50);
        if (cancelled) return;
        if (items.length === 0) {
          setEncontros([]);
          setState("empty");
          return;
        }
        setEncontros(items);
        setState("ready");
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof Error ? err.message : "Falha ao carregar encontros";
        setErrorMessage(msg);
        setState("error");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const constellationPoints: EncontroPoint[] = encontros.map((e) => ({
    id: e.id,
    timestampMs: new Date(e.completedAt ?? e.scheduledAt).getTime(),
    energy: e.energy ?? 0.7,
  }));

  return (
    <main className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <header className="mb-6">
          <h1 className="text-3xl font-bold">Encontros</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Sua linha do tempo romantica em 3D. Cada estrela = um encontro.
          </p>
        </header>

        {/* Loading */}
        {state === "loading" && (
          <div
            className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8"
            role="status"
            aria-live="polite"
          >
            <div className="h-80 w-full rounded-xl bg-zinc-800/30 animate-pulse mb-4" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-16 rounded-lg bg-zinc-800/30 animate-pulse"
                />
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {state === "error" && (
          <div
            className="rounded-2xl border border-rose-800 bg-rose-950/30 p-8 text-center"
            role="alert"
          >
            <p className="text-lg font-semibold mb-1">
              Nao foi possivel carregar seus encontros
            </p>
            <p className="text-sm text-rose-300 mb-4">{errorMessage}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-block px-4 py-2 rounded-lg bg-rose-700 hover:bg-rose-600 text-sm font-medium"
            >
              Tentar de novo
            </button>
          </div>
        )}

        {/* Empty */}
        {state === "empty" && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
            {/* Constelacao vazia gera 1 sparkle de boas-vindas */}
            <SparklesConstellation3D
              points={[
                {
                  id: "welcome",
                  timestampMs: Date.now(),
                  energy: 0.5,
                },
              ]}
              ariaLabel="Constelacao vazia — primeiro encontro vai aparecer aqui"
              className="h-64 w-full bg-gradient-to-br from-fuchsia-950/30 via-purple-950/20 to-zinc-950"
            />
            <div className="p-8 text-center">
              <p className="text-lg font-semibold mb-1">
                Nenhum encontro ainda
              </p>
              <p className="text-sm text-zinc-400 mb-5">
                Quando voce marcar ou completar encontros, eles vao aparecer
                aqui como estrelas conectadas.
              </p>
              <Link
                href="/matches"
                className="inline-block px-5 py-2.5 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-700 text-sm font-semibold transition-colors"
              >
                Ver matches
              </Link>
            </div>
          </div>
        )}

        {/* Ready */}
        {state === "ready" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-zinc-800 overflow-hidden bg-gradient-to-br from-fuchsia-950/30 via-purple-950/20 to-zinc-950">
              <SparklesConstellation3D
                points={constellationPoints}
                ariaLabel={`Constelacao 3D com ${encontros.length} encontros conectados`}
                className="h-80 w-full bg-transparent border-0"
              />
            </div>

            <ul className="space-y-3" aria-label="Lista de encontros">
              {encontros.map((e) => (
                <li
                  key={e.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{e.title}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Com{" "}
                      <Link
                        href={`/perfil/${e.otherProfile.id}`}
                        className="text-fuchsia-300 hover:text-fuchsia-200"
                      >
                        {e.otherProfile.displayName}
                      </Link>{" "}
                      · {formatScheduled(e.scheduledAt)}
                    </p>
                  </div>
                  <StatusBadge status={e.status} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: EncontroEntry["status"] }) {
  const cfg: Record<EncontroEntry["status"], { label: string; cls: string }> = {
    scheduled: {
      label: "Marcado",
      cls: "bg-fuchsia-950 text-fuchsia-200 border-fuchsia-800",
    },
    completed: {
      label: "Realizado",
      cls: "bg-emerald-950 text-emerald-200 border-emerald-800",
    },
    cancelled: {
      label: "Cancelado",
      cls: "bg-zinc-800 text-zinc-400 border-zinc-700",
    },
    pending: {
      label: "Pendente",
      cls: "bg-amber-950 text-amber-200 border-amber-800",
    },
  };
  const c = cfg[status];
  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold border ${c.cls}`}
    >
      {c.label}
    </span>
  );
}
