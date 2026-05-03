// Relacionamentos — UserSidebarRight (M8 sprint)
// CEO order (OT-LEGACY-MIGRATION-MASTER-PLAN-2026-05-02): relacionamentos NAO tem
// admin tradicional. Modelo eh "catalogo de empresas/coaches B2B2C com sidebar
// usuario direita + camaleao a esquerda".
//
// Status: sticky right-aligned sidebar para rotas autenticadas.
// Sections: Perfil quick info, Status match, Preferencias quick-toggle, Privacidade.
//
// Pendente futuro sprint:
// - useSession()/useUserContext() pra dados reais (placeholder Carregando... ate la)
// - Quick-toggles persistem preferencia em backend (mutation GraphQL)
// - Status match puxa myMatches GraphQL (W-R-2)

"use client";

import { useState } from "react";
import Link from "next/link";

interface UserSidebarRightProps {
  className?: string;
}

export function UserSidebarRight({ className }: UserSidebarRightProps) {
  // Local state para quick-toggles. W-R-4 ligara mutation GraphQL pra persistir.
  const [visibility, setVisibility] = useState(true);
  const [notifications, setNotifications] = useState(true);

  return (
    <aside
      className={`sticky top-4 right-0 w-72 h-[calc(100vh-2rem)] p-4 bg-[hsl(var(--muted))]/50 backdrop-blur-md rounded-l-xl border-l border-[hsl(var(--border))] animate-in slide-in-from-right duration-300 ${className ?? ""}`}
      aria-label="Painel do usuario"
    >
      <div className="space-y-6 overflow-y-auto h-full pr-1">
        {/* Section: Perfil quick info */}
        <section>
          <h3 className="text-sm font-semibold mb-2">Meu Perfil</h3>
          <div className="text-xs text-[hsl(var(--muted-foreground))]">
            {/* TODO: substituir por useSession()/useUserContext() em sprint W-R-4 */}
            Carregando...
          </div>
          <Link
            href="/perfil"
            className="mt-2 inline-block text-xs text-fuchsia-600 hover:underline"
          >
            Editar perfil →
          </Link>
        </section>

        {/* Section: Status match */}
        <section>
          <h3 className="text-sm font-semibold mb-2">Status</h3>
          <div className="space-y-1 text-xs">
            {/* TODO: W-R-2 GraphQL myMatches */}
            <div className="flex justify-between">
              <span className="text-[hsl(var(--muted-foreground))]">
                Curtidas hoje
              </span>
              <span className="font-medium">0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[hsl(var(--muted-foreground))]">
                Matches ativos
              </span>
              <span className="font-medium">0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[hsl(var(--muted-foreground))]">
                Conversas abertas
              </span>
              <span className="font-medium">0</span>
            </div>
          </div>
        </section>

        {/* Section: Preferencias quick-toggle */}
        <section>
          <h3 className="text-sm font-semibold mb-2">Preferencias</h3>
          <div className="space-y-2 text-xs">
            <label className="flex items-center justify-between cursor-pointer">
              <span>Visivel publicamente</span>
              <input
                type="checkbox"
                checked={visibility}
                onChange={(e) => setVisibility(e.target.checked)}
                className="rounded accent-fuchsia-600"
                aria-label="Alternar visibilidade publica"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span>Notificacoes</span>
              <input
                type="checkbox"
                checked={notifications}
                onChange={(e) => setNotifications(e.target.checked)}
                className="rounded accent-fuchsia-600"
                aria-label="Alternar notificacoes"
              />
            </label>
          </div>
          <p className="mt-2 text-[10px] text-[hsl(var(--muted-foreground))]">
            Persistencia em backend liga em W-R-4.
          </p>
        </section>

        {/* Section: Privacy */}
        <section>
          <h3 className="text-sm font-semibold mb-2">Privacidade</h3>
          <div className="space-y-1">
            <Link
              href="/perfil"
              className="block text-xs text-fuchsia-600 hover:underline"
            >
              Gerenciar privacidade →
            </Link>
            <Link
              href="/admin/seguranca"
              className="block text-xs text-fuchsia-600 hover:underline"
            >
              Seguranca da conta →
            </Link>
          </div>
        </section>
      </div>
    </aside>
  );
}
