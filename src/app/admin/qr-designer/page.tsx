"use client";

/**
 * /admin/qr-designer — QR Designer do ERP Relacionamentos (standalone).
 *
 * O shell proxia `/relacionamentos/admin/*` para ESTE app, entao a rota
 * precisa NASCER aqui (no repo standalone), nao no shell. Antes o QR Designer
 * so existia no shell (PR #431) e ficava shadowed -> 404 ao vivo.
 *
 * Este app NAO depende de @openticket-dev/auth (admin é leve, usa gql-client
 * com cookies `credentials: include`). A EMPRESA ATIVA é resolvida direto do
 * cookie `ot_company_id` (setado pelo /empresas). Sem empresa => estado vazio
 * honesto com CTA para /empresas (zero mock).
 *
 * O QR gerado encoda vertical + companyId -> URL real escopada da empresa
 * (perfil, evento de encontro, assinatura, etc.). Persistencia: localStorage
 * por (vertical:companyId). Backend BusinessQrConfig = NOT_IMPLEMENTED.
 */

import React from "react";
import Link from "next/link";
import { Building2, QrCode } from "lucide-react";
import { QrDesigner, getVerticalQrContext } from "@/components/QrDesigner";

const VERTICAL = "relacionamentos";

export const dynamic = "force-dynamic";

/** Lê um cookie client-side (SSR-safe). */
function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  const parts = document.cookie ? document.cookie.split("; ") : [];
  for (const part of parts) {
    if (part.startsWith(prefix)) {
      const raw = part.slice(prefix.length);
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
  }
  return null;
}

export default function RelacionamentosAdminQrDesignerPage() {
  const [companyId, setCompanyId] = React.useState<string | null>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setCompanyId(readCookie("ot_company_id"));
    setMounted(true);
  }, []);

  const ctx = getVerticalQrContext(VERTICAL);

  if (!mounted) {
    return (
      <div
        style={{ minHeight: "70vh", color: "#a1a1aa" }}
        className="flex items-center justify-center text-sm"
      >
        Carregando QR Designer...
      </div>
    );
  }

  if (!companyId) {
    return (
      <div
        style={{ minHeight: "70vh" }}
        className="flex flex-col items-center justify-center gap-4 px-6 text-center"
      >
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: `${ctx.accentColor}22`, color: ctx.accentColor }}
        >
          <QrCode className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <p className="text-lg font-bold">QR Designer · {ctx.name}</p>
          <p className="max-w-md text-sm text-neutral-400">
            Selecione um negócio para gerar QR codes escopados a uma empresa.
            O QR Designer precisa de uma empresa ativa.
          </p>
        </div>
        <Link
          href="/empresas"
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
          style={{ background: ctx.accentColor }}
        >
          <Building2 className="h-4 w-4" />
          Selecionar empresa
        </Link>
      </div>
    );
  }

  return (
    <QrDesigner vertical={VERTICAL} companyId={companyId} backHref="/admin" />
  );
}
