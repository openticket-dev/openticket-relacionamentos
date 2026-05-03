// Relacionamentos — AppShell (M8 sprint)
// Client wrapper que decide se mostra UserSidebarRight baseado na rota.
// Landing publica (/landing, /) NAO tem sidebar. Demais rotas (perfil, matches,
// buscar, chat, admin) renderizam UserSidebarRight stick na direita em desktop.
//
// CEO order: relacionamentos = catalogo B2B2C, sidebar usuario direita +
// camaleao esquerda (camaleao chega em sprint futuro).

"use client";

import { usePathname } from "next/navigation";
import { UserSidebarRight } from "./UserSidebarRight";

const PUBLIC_ROUTES = ["/", "/landing"];

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname() ?? "/";
  const isPublic = PUBLIC_ROUTES.includes(pathname);

  if (isPublic) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <main className="flex-1 min-w-0">{children}</main>
      <UserSidebarRight className="hidden lg:block flex-shrink-0" />
    </div>
  );
}
