/**
 * QR Designer — per-vertical context catalog.
 *
 * Extracted from the former platform-wide page
 * (`/configuracoes/qr-designer`) so that each vertical ERP can mount its OWN
 * QR Designer scoped to the active company.
 *
 * Routes use PT-BR vertical slugs (gastronomia, varejo, cultura, esportes,
 * educacao, igreja, healthcare, eventos, relacionamentos). The original page
 * used a mix of EN slugs internally — this catalog is keyed by the PT-BR
 * route slug (the single source of truth used by `(vertical)/<v>/admin`).
 */

export type VerticalRouteSlug =
  | "gastronomia"
  | "varejo"
  | "cultura"
  | "esportes"
  | "educacao"
  | "igreja"
  | "healthcare"
  | "eventos"
  | "relacionamentos";

export type VerticalQrContext = {
  /** PT-BR route slug — matches `(vertical)/<slug>`. */
  slug: VerticalRouteSlug;
  /** Display name shown in the designer header / panels. */
  name: string;
  /** Default top curved-arc text. */
  defaultTopText: string;
  /** Default bottom curved-arc text. */
  defaultBottomText: string;
  /**
   * Path segment used to build the company-scoped sample payload. The real
   * payload encodes the vertical + companyId so the generated QR is genuinely
   * scoped to the active company (zero mock — it is a real, resolvable URL).
   */
  payloadPath: string;
  /** Use-case bullets shown in the right panel. */
  useCases: string[];
  /** Accent hex color for the vertical. */
  accentColor: string;
  /** Where the admin "back" button returns to (inside the ERP). */
  adminHref: string;
};

/**
 * Base origin used when building company-scoped payloads. Prefer the
 * deployed public origin at runtime; fall back to the canonical domain so the
 * QR always encodes a real, resolvable URL (never a placeholder).
 */
export function qrBaseOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "https://openticket.com.br";
}

/**
 * Builds the canonical company-scoped payload for a vertical.
 * Example: https://app.openticket.com.br/gastronomia/c/comp_rest_sublime/menu
 *
 * This is a REAL scoped URL: it embeds the vertical + the active companyId, so
 * scanning it routes to that company's vertical surface. No fake data.
 */
export function buildScopedPayload(
  ctx: VerticalQrContext,
  companyId: string,
): string {
  const origin = qrBaseOrigin();
  const safeCompany = encodeURIComponent(companyId);
  return `${origin}/${ctx.slug}/c/${safeCompany}/${ctx.payloadPath}`;
}

export const VERTICAL_QR_CONTEXTS: Record<VerticalRouteSlug, VerticalQrContext> = {
  gastronomia: {
    slug: "gastronomia",
    name: "Gastronomia",
    defaultTopText: "MENU",
    defaultBottomText: "SCAN TO ORDER",
    payloadPath: "menu",
    useCases: [
      "QR na mesa para abrir o cardapio digital",
      "QR de pagamento (PIX / cashless) da mesa",
      "QR do garcom para chamar atendimento",
      "QR do cardapio impresso (entregador / delivery)",
      "QR de avaliacao pos-refeicao",
    ],
    accentColor: "#f97316",
    adminHref: "/gastronomia/admin/dashboard",
  },
  varejo: {
    slug: "varejo",
    name: "Varejo",
    defaultTopText: "OPENTICKET",
    defaultBottomText: "SCAN TO BUY",
    payloadPath: "loja",
    useCases: [
      "QR de produto (abrir página no catalogo)",
      "QR de cupom promocional / programa de fidelidade",
      "QR de checkout rápido no PDV",
      "QR de troca / devolucao (SAC)",
      "QR em etiqueta impressa (gondola)",
    ],
    accentColor: "#3b82f6",
    adminHref: "/varejo/admin/dashboard",
  },
  cultura: {
    slug: "cultura",
    name: "Cultura & Museus",
    defaultTopText: "INGRESSO",
    defaultBottomText: "SCAN PARA ENTRAR",
    payloadPath: "ingresso",
    useCases: [
      "QR de ingresso de exposicao",
      "QR de audioguia por obra",
      "QR de visita guiada agendada",
      "QR de assinatura cultural (carteirinha digital)",
      "QR de acesso a evento especial / vernissage",
    ],
    accentColor: "#e11d48",
    adminHref: "/cultura/admin/dashboard",
  },
  esportes: {
    slug: "esportes",
    name: "Esportes",
    defaultTopText: "INGRESSO",
    defaultBottomText: "TORCIDA",
    payloadPath: "ingresso",
    useCases: [
      "QR de ingresso de jogo",
      "QR de socio torcedor (carteirinha)",
      "QR de cashless / cartão do estadio",
      "QR de check-in em catraca",
      "QR de POAP / colecionavel do jogo",
    ],
    accentColor: "#10b981",
    adminHref: "/esportes/admin",
  },
  educacao: {
    slug: "educacao",
    name: "Educacao",
    defaultTopText: "MINHA TURMA",
    defaultBottomText: "SCAN PARA ACESSAR",
    payloadPath: "matricula",
    useCases: [
      "QR de matricula em curso",
      "QR de aula ao vivo (acesso rápido)",
      "QR de certificado digital",
      "QR de boleto / pagamento de mensalidade",
      "QR de chamada (presenca em sala)",
    ],
    accentColor: "#6366f1",
    adminHref: "/educacao/admin/dashboard",
  },
  igreja: {
    slug: "igreja",
    name: "Igreja",
    defaultTopText: "PAROQUIA",
    defaultBottomText: "SCAN PARA DOAR",
    payloadPath: "paroquia",
    useCases: [
      "QR de dizimo / oferta (PIX)",
      "QR de inscrição em missa",
      "QR de grupo pastoral / movimento",
      "QR de certidao (batismo, casamento)",
      "QR de pedido de oracao",
    ],
    accentColor: "#f59e0b",
    adminHref: "/igreja/admin/dashboard",
  },
  healthcare: {
    slug: "healthcare",
    name: "Healthcare",
    defaultTopText: "CLINICA",
    defaultBottomText: "SCAN PARA ACESSAR",
    payloadPath: "agenda",
    useCases: [
      "QR de check-in de consulta",
      "QR de receita / prescricao digital",
      "QR de acesso a telemedicina",
      "QR de plano de saude (carteirinha)",
      "QR de resultado de exame",
    ],
    accentColor: "#0ea5e9",
    adminHref: "/healthcare/admin/dashboard",
  },
  eventos: {
    slug: "eventos",
    name: "Eventos",
    defaultTopText: "SEU TICKET",
    defaultBottomText: "OPENTICKET",
    payloadPath: "ticket",
    useCases: [
      "QR de ingresso do evento (catraca)",
      "QR de wallet / cashless do participante",
      "QR de rider tecnico (staff / artista)",
      "QR de credencial (staff, imprensa, VIP)",
      "QR de POAP / colecionavel do evento",
    ],
    accentColor: "#a855f7",
    adminHref: "/eventos/admin",
  },
  relacionamentos: {
    slug: "relacionamentos",
    name: "Relacionamentos",
    defaultTopText: "MEU PERFIL",
    defaultBottomText: "SCAN PARA CONECTAR",
    payloadPath: "perfil",
    useCases: [
      "QR de perfil / convite de conexao",
      "QR de evento de encontro (check-in)",
      "QR de assinatura premium",
      "QR de match / interesse",
      "QR de compartilhamento de perfil",
    ],
    accentColor: "#ec4899",
    adminHref: "/relacionamentos/admin/dashboard",
  },
};

const DEFAULT_SLUG: VerticalRouteSlug = "eventos";

export function getVerticalQrContext(
  slug: string | null | undefined,
): VerticalQrContext {
  if (!slug) return VERTICAL_QR_CONTEXTS[DEFAULT_SLUG];
  const normalized = slug.toLowerCase() as VerticalRouteSlug;
  return VERTICAL_QR_CONTEXTS[normalized] ?? VERTICAL_QR_CONTEXTS[DEFAULT_SLUG];
}
