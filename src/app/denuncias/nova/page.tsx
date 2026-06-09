// Relacionamentos — Nova Denuncia (Sprint M8-2)
// User flow pra denunciar perfil ou mensagem (motivos + descricao + evidencias).
// WIRE_REAL: dispara a mutation reportProfile no subgraph relacionamentos via
// gateway federado (/api/graphql). Auth + anti-IDOR sao server-side: o resolver
// SafetyResolver.reportProfile deriva o reporterId do JWT (user.sub), recusa
// auto-denuncia, e cria um Report PENDING que notifica Trust & Safety.
// Zero-mock: sem setTimeout, sem fake-success — o sucesso vem do reportId real.

"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

type Reason =
  | "spam"
  | "harassment"
  | "fake"
  | "underage"
  | "fraud"
  | "inappropriate_content"
  | "other";

// Mapeia o motivo da UI -> enum RelacReportReason do backend (entities:32).
// inappropriate_content nao tem 1:1 no enum; cai em AGGRESSIVE (conteudo
// sexual/agressivo nao-solicitado) e o detalhe vai na nota.
const REASON_TO_ENUM: Record<Reason, string> = {
  spam: "SPAM",
  harassment: "HARASSMENT",
  fake: "FAKE_PHOTO",
  underage: "UNDERAGE",
  fraud: "PAYMENT_REQUEST",
  inappropriate_content: "AGGRESSIVE",
  other: "OTHER",
};

const REPORT_PROFILE_MUTATION = /* GraphQL */ `
  mutation ReportProfile($input: ReportProfileInput!) {
    reportProfile(input: $input) {
      ok
      reportId
    }
  }
`;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ReasonOption = {
  id: Reason;
  label: string;
  desc: string;
};

const REASONS: ReasonOption[] = [
  {
    id: "spam",
    label: "Spam ou conteudo promocional",
    desc: "Perfil divulgando produtos, links suspeitos, vendas",
  },
  {
    id: "harassment",
    label: "Assedio, ameaca ou discurso de odio",
    desc: "Mensagens ofensivas, intimidatorias, racistas, etc.",
  },
  {
    id: "fake",
    label: "Perfil falso",
    desc: "Fotos roubadas, identidade falsa, catfishing",
  },
  {
    id: "underage",
    label: "Menor de idade",
    desc: "Suspeita que a pessoa tem menos de 18 anos",
  },
  {
    id: "fraud",
    label: "Fraude ou golpe",
    desc: "Pediu dinheiro, dados bancarios, codigos de SMS/WhatsApp",
  },
  {
    id: "inappropriate_content",
    label: "Conteudo impropio",
    desc: "Nudez nao-solicitada, conteudo sexual sem consentimento",
  },
  {
    id: "other",
    label: "Outro",
    desc: "Descreva no campo abaixo",
  },
];

function NovaDenunciaContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const targetId = searchParams.get("target") || "";
  const targetType = searchParams.get("type") === "message" ? "message" : "profile";

  const [reason, setReason] = useState<Reason | null>(null);
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length + files.length > 3) {
      setError("Maximo 3 evidencias.");
      return;
    }
    setFiles([...files, ...selected]);
    setError(null);
  };

  const removeFile = (i: number) => {
    setFiles(files.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!reason) {
      setError("Selecione um motivo.");
      return;
    }
    if (description.length < 10) {
      setError("Descreva o ocorrido com pelo menos 10 caracteres.");
      return;
    }
    if (!targetId || !UUID_RE.test(targetId)) {
      // Anti-mock: sem um alvo valido nao da pra registrar denuncia real.
      setError(
        "Nao foi possivel identificar quem voce esta denunciando. Abra a denuncia a partir do perfil ou da conversa.",
      );
      return;
    }

    setSubmitting(true);

    // O backend (reportProfile) so aceita reportedProfileId + reason + note +
    // messageId opcional. Nao ha endpoint de upload de evidencia ligado a este
    // fluxo, entao anexamos os nomes dos arquivos a nota pra nao perder o sinal
    // (zero-mock: nao fingimos que a imagem foi enviada).
    const noteParts = [description];
    if (files.length > 0) {
      noteParts.push(
        `Evidencias citadas pelo usuario (nao anexadas): ${files
          .map((f) => f.name)
          .join(", ")}`,
      );
    }

    const input: Record<string, unknown> = {
      reportedProfileId: targetId,
      reason: REASON_TO_ENUM[reason],
      note: noteParts.join("\n\n"),
    };
    // Quando a denuncia parte de uma mensagem e o alvo (target) e o id da
    // mensagem, repassa como messageId (UUID) pra moderacao localizar o trecho.
    if (targetType === "message") {
      input.messageId = targetId;
    }

    try {
      const res = await fetch("/api/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          query: REPORT_PROFILE_MUTATION,
          variables: { input },
        }),
      });
      if (!res.ok && res.status !== 400) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json = (await res.json()) as {
        data?: { reportProfile: { ok: boolean; reportId: string } | null };
        errors?: { message: string }[];
      };
      if (json.errors && json.errors.length > 0) {
        throw new Error(json.errors[0]?.message ?? "Erro ao enviar denuncia");
      }
      if (!json.data?.reportProfile?.ok) {
        throw new Error("A denuncia nao foi registrada. Tente novamente.");
      }
      setSubmitted(true);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Falha ao enviar a denuncia";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <main className="min-h-screen p-6 max-w-xl mx-auto flex flex-col items-center justify-center text-center">
        <p className="text-6xl mb-4">✅</p>
        <h1 className="text-2xl font-bold mb-2">Denuncia recebida</h1>
        <p className="text-sm text-muted-foreground mb-6 max-w-md">
          Nossa equipe de Trust & Safety vai analisar em ate 24h. Voce recebera
          uma notificacao com o resultado. Obrigado por ajudar a manter a
          comunidade segura.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => router.push("/matches")}
            className="px-5 py-2.5 rounded-full bg-fuchsia-600 text-white font-medium hover:bg-fuchsia-700"
          >
            Voltar pros matches
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 max-w-2xl mx-auto">
      <header className="mb-6">
        <button
          onClick={() => router.back()}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Voltar
        </button>
        <h1 className="text-2xl font-semibold mt-2">Denunciar</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {targetType === "message"
            ? `Mensagem ${targetId ? `de ${targetId}` : ""}`
            : `Perfil ${targetId ? targetId : ""}`}
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section>
          <h2 className="font-semibold mb-3">Motivo</h2>
          <div className="space-y-2">
            {REASONS.map((r) => (
              <label
                key={r.id}
                className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                  reason === r.id
                    ? "border-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-950/20"
                    : "border-border hover:border-muted-foreground/50"
                }`}
              >
                <input
                  type="radio"
                  name="reason"
                  value={r.id}
                  checked={reason === r.id}
                  onChange={() => setReason(r.id)}
                  className="mt-0.5"
                />
                <div>
                  <p className="font-medium text-sm">{r.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {r.desc}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-semibold mb-2">
            Descricao{" "}
            <span className="text-xs text-muted-foreground font-normal">
              (obrigatorio)
            </span>
          </h2>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Conta o que aconteceu. Quanto mais detalhe, mais rapido a moderacao resolve."
            rows={5}
            maxLength={1000}
            className="w-full px-4 py-3 border border-border rounded-lg bg-background text-sm resize-none"
          />
          <p className="text-xs text-muted-foreground mt-1">
            {description.length} / 1000
          </p>
        </section>

        <section>
          <h2 className="font-semibold mb-2">
            Evidencias{" "}
            <span className="text-xs text-muted-foreground font-normal">
              (opcional, max 3)
            </span>
          </h2>
          <p className="text-xs text-muted-foreground mb-3">
            Screenshots da conversa, foto do perfil, etc.
          </p>

          {files.length < 3 && (
            <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed border-border hover:border-fuchsia-500 cursor-pointer transition-colors">
              <span className="text-2xl">📎</span>
              <span className="text-sm font-medium">Adicionar imagem</span>
              <span className="text-xs text-muted-foreground">
                JPG, PNG ate 5MB
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          )}

          {files.length > 0 && (
            <ul className="mt-3 space-y-2">
              {files.map((f, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between p-2 rounded border border-border text-sm"
                >
                  <span className="truncate">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="text-red-600 hover:text-red-700 text-xs ml-3"
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-xs text-amber-900 dark:text-amber-200">
          <p className="font-semibold mb-1">Importante (LGPD)</p>
          <p>
            Sua denuncia sera analisada pela equipe Trust & Safety. Acoes
            tomadas ficam logadas. Denuncias falsas ou maliciosas podem
            resultar em sancao na sua propria conta.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !reason}
          className="w-full py-3 rounded-full bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Enviando..." : "Enviar denuncia"}
        </button>
      </form>
    </main>
  );
}

export default function NovaDenunciaPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen p-6 text-sm text-muted-foreground">
          Carregando...
        </main>
      }
    >
      <NovaDenunciaContent />
    </Suspense>
  );
}
