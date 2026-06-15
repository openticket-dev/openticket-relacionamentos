import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { OnboardingGate } from "@/components/OnboardingGate";
import { RelacionamentosApolloProvider } from "@/lib/apollo/Provider";

export const metadata: Metadata = {
  title: "OpenTicket Relacionamentos",
  description:
    "Vertical B2C de relacionamentos — 18 subverticais (dating, networking, friendship, mentorship, fitness partners, etc.)",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <RelacionamentosApolloProvider>
          <OnboardingGate />
          <AppShell>{children}</AppShell>
        </RelacionamentosApolloProvider>
      </body>
    </html>
  );
}
