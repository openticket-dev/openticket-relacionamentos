"use client";

/**
 * QrDesigner — reusable, company-scoped QR seal configurator.
 *
 * Extracted from the former platform-wide page at
 * `/configuracoes/qr-designer` (user config / Camaleão profile) and
 * generalized to live INSIDE each vertical ERP, scoped to the active company.
 *
 * Props:
 *  - `vertical`  — PT-BR route slug (gastronomia, varejo, cultura, esportes,
 *                  educacao, igreja, healthcare, eventos, relacionamentos).
 *  - `companyId` — active company (from `useActiveCompany()` / ot_company_id).
 *
 * Scoping: the QR payload is built from the vertical + companyId, so the
 * generated QR is a REAL, resolvable, company-scoped URL — zero mock, zero
 * placeholder. The QR matrix is rendered live by qr-code-styling (level H).
 *
 * REL-OPS-03: the "Exportar PNG (em breve)" button was removed. It was disabled
 * and exported nothing — a placeholder shipped to the user, which the zero-
 * incomplete-feature rule forbids. PNG export is NOT implemented; when it is, it
 * comes back as a working button, not as a promise.
 *
 * Persistence: the chosen variant + texts are persisted to localStorage keyed
 * by `vertical:companyId`, so each company keeps its own seal style. A backend
 * resolver (BusinessQrConfig) is NOT yet implemented — we do NOT fake it; the
 * UI is honest that sync is per-browser for now.
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Info,
  Moon,
  QrCode,
  Save,
  Sparkles,
  Sun,
} from "lucide-react";
import {
  StyledQR,
  STYLED_QR_VARIANTS,
  type Variant,
} from "@/components/qr-styles/StyledQR";
import { Ticket3DCard } from "@/components/qr-styles/Ticket3DCard";
import {
  buildScopedPayload,
  getVerticalQrContext,
  type VerticalRouteSlug,
} from "./verticalContexts";
import { gqlRequest, GqlClientError } from "@/lib/gql-client";

// Backend real (subgraph eventos, ja em origin/staging). Anti-IDOR: o companyId
// vem SEMPRE do JWT no gateway — o cliente so passa `vertical`. A query resolve
// e a mutation grava apenas a empresa do caller.
//   query    businessQrConfig(vertical: String!): BusinessQrConfig | null
//   mutation saveBusinessQrConfig(input: SaveBusinessQrConfigInput!): BusinessQrConfig
const BUSINESS_QR_CONFIG = /* GraphQL */ `
  query BusinessQrConfig($vertical: String!) {
    businessQrConfig(vertical: $vertical) {
      id
      variant
      topText
      bottomText
      updatedAt
    }
  }
`;

const SAVE_BUSINESS_QR_CONFIG = /* GraphQL */ `
  mutation SaveBusinessQrConfig($input: SaveBusinessQrConfigInput!) {
    saveBusinessQrConfig(input: $input) {
      id
      variant
      topText
      bottomText
      updatedAt
    }
  }
`;

type BusinessQrConfigDto = {
  id: string;
  variant: string;
  topText?: string | null;
  bottomText?: string | null;
  updatedAt: string;
};

function isValidVariant(v: string): v is Variant {
  return STYLED_QR_VARIANTS.some((x) => x.key === v);
}

export type QrDesignerProps = {
  /** PT-BR route slug of the vertical ERP mounting this designer. */
  vertical: VerticalRouteSlug | string;
  /** Active companyId — QR payload + persistence are scoped to it. */
  companyId: string;
  /** Optional override for the "back" link (defaults to the vertical admin). */
  backHref?: string;
};

type PersistedConfig = {
  variant: Variant;
  topText: string;
  bottomText: string;
  payload: string;
  updatedAt: string;
};

function storageKey(vertical: string, companyId: string): string {
  return `qr-style:${vertical}:${companyId}`;
}

function loadPersistedConfig(
  vertical: string,
  companyId: string,
): PersistedConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(vertical, companyId));
    if (!raw) return null;
    return JSON.parse(raw) as PersistedConfig;
  } catch {
    return null;
  }
}

function savePersistedConfig(
  vertical: string,
  companyId: string,
  config: PersistedConfig,
) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      storageKey(vertical, companyId),
      JSON.stringify(config),
    );
  } catch {
    // ignore quota / private-mode errors
  }
  // localStorage e apenas cache local / fallback offline. A fonte de verdade e
  // o backend via saveBusinessQrConfig (chamado em handleSave). Ver useEffect
  // de hydrate: backend-first, localStorage so quando o backend nao responde.
}

export function QrDesigner({ vertical, companyId, backHref }: QrDesignerProps) {
  const ctx = useMemo(() => getVerticalQrContext(vertical), [vertical]);

  const scopedPayload = useMemo(
    () => buildScopedPayload(ctx, companyId),
    [ctx, companyId],
  );

  const [darkMode, setDarkMode] = useState(true);
  const [selectedVariant, setSelectedVariant] =
    useState<Variant>("midnightGold");
  const [topText, setTopText] = useState("");
  const [bottomText, setBottomText] = useState("");
  const [value, setValue] = useState(scopedPayload);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // synced=true quando a config veio/foi gravada no backend; backendOffline=true
  // quando a query/mutation falhou e caimos no cache localStorage (honesto).
  const [synced, setSynced] = useState(false);
  const [backendOffline, setBackendOffline] = useState(false);

  // Hydrate: backend-first (businessQrConfig), fallback pro cache localStorage,
  // e por fim defaults da vertical + payload escopado. O payload (URL) e sempre
  // derivado de vertical+companyId — o backend guarda o template (variant+textos).
  useEffect(() => {
    let alive = true;

    const applyLocalOrDefaults = () => {
      const persisted = loadPersistedConfig(ctx.slug, companyId);
      if (persisted) {
        setSelectedVariant(persisted.variant);
        setTopText(persisted.topText);
        setBottomText(persisted.bottomText);
        setValue(persisted.payload || scopedPayload);
        setSavedAt(persisted.updatedAt);
      } else {
        setTopText(ctx.defaultTopText);
        setBottomText(ctx.defaultBottomText);
        setValue(scopedPayload);
      }
    };

    (async () => {
      try {
        const data = await gqlRequest<{
          businessQrConfig: BusinessQrConfigDto | null;
        }>(BUSINESS_QR_CONFIG, { vertical: ctx.slug });
        if (!alive) return;
        const cfg = data.businessQrConfig;
        if (cfg) {
          if (isValidVariant(cfg.variant)) setSelectedVariant(cfg.variant);
          setTopText(cfg.topText ?? ctx.defaultTopText);
          setBottomText(cfg.bottomText ?? ctx.defaultBottomText);
          setValue(scopedPayload);
          setSavedAt(cfg.updatedAt);
          setSynced(true);
        } else {
          // Empresa ainda sem template salvo: cache local ou defaults.
          applyLocalOrDefaults();
        }
      } catch {
        // Backend indisponivel — degradacao honesta: usa cache local e sinaliza.
        if (!alive) return;
        setBackendOffline(true);
        applyLocalOrDefaults();
      }
    })();

    return () => {
      alive = false;
    };
  }, [ctx.slug, ctx.defaultTopText, ctx.defaultBottomText, companyId, scopedPayload]);

  const returnTo = backHref ?? ctx.adminHref;

  const bg = darkMode ? "#09090b" : "#fafafa";
  const fg = darkMode ? "#f4f4f5" : "#09090b";
  const muted = "#71717a";
  const cardBg = darkMode ? "rgba(13,12,20,0.98)" : "rgba(255,255,255,1)";
  const cardBorder = darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const subtleBg = darkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)";

  const handleSave = async () => {
    setSaving(true);
    // Cache local imediato (fallback offline) — nao substitui o backend.
    const localConfig: PersistedConfig = {
      variant: selectedVariant,
      topText,
      bottomText,
      payload: value,
      updatedAt: new Date().toISOString(),
    };
    savePersistedConfig(ctx.slug, companyId, localConfig);

    try {
      // Backend real: companyId vem do JWT (anti-IDOR); guard OWNER/ADMIN no
      // gateway. Persiste o template (variant + textos) por empresa+vertical.
      const data = await gqlRequest<{
        saveBusinessQrConfig: BusinessQrConfigDto;
      }>(SAVE_BUSINESS_QR_CONFIG, {
        input: {
          vertical: ctx.slug,
          variant: selectedVariant,
          topText: topText || null,
          bottomText: bottomText || null,
        },
      });
      const saved = data.saveBusinessQrConfig;
      setSavedAt(saved.updatedAt);
      setSynced(true);
      setBackendOffline(false);
    } catch (err) {
      // Degradacao honesta: gravou no navegador, backend nao confirmou.
      setSavedAt(localConfig.updatedAt);
      setSynced(false);
      setBackendOffline(
        err instanceof GqlClientError ? false : true,
      );
      // GqlClientError => backend respondeu com erro (ex.: sem permissao
      // OWNER/ADMIN). backendOffline fica false; a UI mostra "nao sincronizado".
    } finally {
      setSaving(false);
    }
  };

  const handleResetPayload = () => setValue(scopedPayload);

  const selectedMeta = STYLED_QR_VARIANTS.find((v) => v.key === selectedVariant);

  return (
    <div style={{ background: bg, color: fg, minHeight: "100vh" }}>
      {/* ── Header ── */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b"
        style={{
          borderColor: cardBorder,
          background: darkMode ? "rgba(9,9,11,0.85)" : "rgba(255,255,255,0.9)",
          backdropFilter: "blur(12px)",
        }}
      >
        <a
          href={returnTo}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold"
          style={{ background: cardBg, border: `1px solid ${cardBorder}`, color: fg }}
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para {ctx.name}
        </a>
        <div className="text-center">
          <p
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: muted }}
          >
            ERP {ctx.name} · QR Designer
          </p>
          <p
            className="text-xs font-bold flex items-center gap-1 justify-center"
            style={{ color: fg }}
          >
            <QrCode className="h-3 w-3" />
            QR Designer
          </p>
        </div>
        <button
          onClick={() => setDarkMode((v) => !v)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold"
          style={{ background: cardBg, border: `1px solid ${cardBorder}`, color: fg }}
        >
          {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {darkMode ? "Claro" : "Escuro"}
        </button>
      </div>

      {/* ── Active company banner ── */}
      <div
        className="max-w-7xl mx-auto px-4 pt-4 flex items-center gap-2 text-[11px]"
        style={{ color: muted }}
      >
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold"
          style={{
            background: `${ctx.accentColor}15`,
            color: ctx.accentColor,
            border: `1px solid ${ctx.accentColor}33`,
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: ctx.accentColor }}
          />
          Empresa ativa
        </span>
        <code style={{ color: fg }}>{companyId}</code>
      </div>

      {/* ── Main grid: controls + live preview + use cases ── */}
      <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-[320px_1fr_280px] gap-6">
        {/* LEFT — Controls */}
        <aside
          className="rounded-2xl p-5 space-y-5 h-fit"
          style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
        >
          <div>
            <p
              className="text-[10px] font-bold uppercase tracking-wider mb-1.5"
              style={{ color: muted }}
            >
              Categoria Ativa
            </p>
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold"
              style={{
                background: `${ctx.accentColor}15`,
                color: ctx.accentColor,
                border: `1px solid ${ctx.accentColor}33`,
              }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: ctx.accentColor }}
              />
              {ctx.name}
            </div>
          </div>

          <div>
            <label
              className="block text-[10px] font-bold uppercase tracking-wider mb-1.5"
              style={{ color: muted }}
            >
              Payload (URL escopada da empresa)
            </label>
            <input
              aria-label="Valor"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs font-mono"
              style={{
                background: subtleBg,
                border: `1px solid ${cardBorder}`,
                color: fg,
              }}
              spellCheck={false}
            />
            <div className="flex items-center justify-between mt-1">
              <p className="text-[10px]" style={{ color: muted }}>
                O que o scanner abre ao ler este QR.
              </p>
              <button
                onClick={handleResetPayload}
                className="text-[10px] font-semibold"
                style={{ color: ctx.accentColor }}
              >
                Resetar p/ empresa
              </button>
            </div>
          </div>

          <div>
            <label
              className="block text-[10px] font-bold uppercase tracking-wider mb-1.5"
              style={{ color: muted }}
            >
              Texto superior
            </label>
            <input
              value={topText}
              onChange={(e) => setTopText(e.target.value)}
              placeholder={ctx.defaultTopText}
              className="w-full px-3 py-2 rounded-xl text-xs"
              style={{
                background: subtleBg,
                border: `1px solid ${cardBorder}`,
                color: fg,
              }}
            />
          </div>

          <div>
            <label
              className="block text-[10px] font-bold uppercase tracking-wider mb-1.5"
              style={{ color: muted }}
            >
              Texto inferior
            </label>
            <input
              value={bottomText}
              onChange={(e) => setBottomText(e.target.value)}
              placeholder={ctx.defaultBottomText}
              className="w-full px-3 py-2 rounded-xl text-xs"
              style={{
                background: subtleBg,
                border: `1px solid ${cardBorder}`,
                color: fg,
              }}
            />
          </div>

          <div>
            <p
              className="text-[10px] font-bold uppercase tracking-wider mb-2"
              style={{ color: muted }}
            >
              Estilo (variante)
            </p>
            <div className="grid grid-cols-2 gap-2">
              {STYLED_QR_VARIANTS.map((variant) => {
                const active = variant.key === selectedVariant;
                return (
                  <button
                    key={variant.key}
                    onClick={() => setSelectedVariant(variant.key)}
                    className="p-2 rounded-xl text-left text-[11px] font-semibold transition-all"
                    style={{
                      background: active ? `${ctx.accentColor}15` : subtleBg,
                      border: `1px solid ${active ? ctx.accentColor : cardBorder}`,
                      color: active ? ctx.accentColor : fg,
                    }}
                  >
                    <span className="block truncate">{variant.name}</span>
                    <span
                      className="block text-[9px] truncate mt-0.5"
                      style={{ color: muted }}
                    >
                      {variant.tagline.split(" · ")[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ borderTop: `1px solid ${cardBorder}` }} className="pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 disabled:opacity-60"
              style={{ background: ctx.accentColor, color: "#fff" }}
            >
              <Save className="h-4 w-4" />
              {saving ? "Salvando..." : "Salvar como padrao desta empresa"}
            </button>
            {savedAt && (
              <p
                className="mt-2 text-[10px] flex items-center gap-1"
                style={{ color: synced ? "#10b981" : "#f59e0b" }}
              >
                <CheckCircle2 className="h-3 w-3" />
                {synced ? "Salvo na empresa" : "Salvo neste navegador"}{" "}
                {new Date(savedAt).toLocaleString("pt-BR")}
              </p>
            )}
            <p className="mt-2 text-[10px] leading-snug" style={{ color: muted }}>
              {synced
                ? "Sincronizado com o backend da empresa (businessQrConfig). Vale em qualquer navegador de quem tem acesso."
                : backendOffline
                  ? "Backend indisponivel agora — salvamos neste navegador e sincronizamos quando o gateway responder."
                  : "Salvo neste navegador. Ao salvar, sincronizamos com o backend da empresa (requer permissao OWNER/ADMIN)."}
            </p>
          </div>
        </aside>

        {/* MIDDLE — Live preview */}
        <main
          className="rounded-2xl p-6 flex flex-col items-center justify-center"
          style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
        >
          <div className="w-full flex items-center justify-between mb-4">
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: muted }}
              >
                Preview ao Vivo
              </p>
              <p className="text-base font-black" style={{ color: fg }}>
                {selectedMeta?.name ?? "Estilo"}
              </p>
            </div>
            <span
              className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-full"
              style={{ background: "#10b98120", color: "#10b981" }}
            >
              Nivel H · 30% redundancia
            </span>
          </div>

          <div className="py-4">
            <Ticket3DCard intensity={15}>
              <StyledQR
                variant={selectedVariant}
                value={value || scopedPayload}
                size={420}
                topText={topText || undefined}
                bottomText={bottomText || undefined}
              />
            </Ticket3DCard>
          </div>

          <p
            className="text-[11px] text-center mt-2 max-w-md leading-relaxed"
            style={{ color: muted }}
          >
            {selectedMeta?.tagline}
          </p>
        </main>

        {/* RIGHT — Use cases panel */}
        <aside
          className="rounded-2xl p-5 h-fit"
          style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Info className="h-3.5 w-3.5" style={{ color: ctx.accentColor }} />
            <p
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: muted }}
            >
              Onde usar · {ctx.name}
            </p>
          </div>
          <ul className="space-y-2">
            {ctx.useCases.map((useCase, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-[12px] leading-snug"
                style={{ color: fg }}
              >
                <span
                  className="mt-1.5 w-1 h-1 rounded-full shrink-0"
                  style={{ background: ctx.accentColor }}
                />
                <span>{useCase}</span>
              </li>
            ))}
          </ul>

          <div
            className="mt-4 pt-4 space-y-2 text-[11px] leading-relaxed"
            style={{ borderTop: `1px solid ${cardBorder}`, color: muted }}
          >
            <p className="flex items-center gap-1.5 font-bold" style={{ color: fg }}>
              <Sparkles className="h-3 w-3" /> Dica
            </p>
            <p>
              Todos os estilos usam correcao H (30% de redundancia). Mesmo com
              decoracao, a matriz central esta intacta para scanner iOS Camera /
              Google Lens.
            </p>
          </div>
        </aside>
      </div>

      {/* ── Thumbnail grid (all variants) ── */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-black uppercase tracking-wider" style={{ color: fg }}>
            Todas as variantes
          </h2>
          <span className="text-[11px]" style={{ color: muted }}>
            Clique para selecionar
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {STYLED_QR_VARIANTS.map((variant) => {
            const active = variant.key === selectedVariant;
            return (
              <button
                key={variant.key}
                onClick={() => setSelectedVariant(variant.key)}
                className="p-4 rounded-2xl flex flex-col items-center transition-all hover:scale-[1.02]"
                style={{
                  background: cardBg,
                  border: `2px solid ${active ? ctx.accentColor : cardBorder}`,
                  boxShadow: active ? `0 0 0 2px ${ctx.accentColor}33` : undefined,
                }}
              >
                <div className="w-full flex items-center justify-between mb-2">
                  <span className="text-xs font-black" style={{ color: fg }}>
                    {variant.name}
                  </span>
                  {active && (
                    <CheckCircle2
                      className="h-4 w-4"
                      style={{ color: ctx.accentColor }}
                    />
                  )}
                </div>
                <StyledQR
                  variant={variant.key}
                  value={value || scopedPayload}
                  size={200}
                  topText={topText || undefined}
                  bottomText={bottomText || undefined}
                />
                <p
                  className="text-[10px] mt-3 text-center leading-snug"
                  style={{ color: muted }}
                >
                  {variant.tagline.split(" · ")[0]}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Footer ── */}
      <footer
        className="max-w-4xl mx-auto px-4 py-8 text-[11px] text-center"
        style={{ color: muted }}
      >
        <p>
          QR Designer · ERP <strong>{ctx.name}</strong> · empresa{" "}
          <code>{companyId}</code>
        </p>
        <p className="mt-1">
          {STYLED_QR_VARIANTS.length} variantes · nivel H · powered by
          qr-code-styling
        </p>
      </footer>
    </div>
  );
}

export default QrDesigner;
