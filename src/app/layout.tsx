import type { Metadata } from "next";
import "./globals.css";

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
        {children}
      </body>
    </html>
  );
}
