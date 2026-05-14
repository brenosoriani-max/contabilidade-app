import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";

import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "CONTEC - Sistema de Analise IRPF",
  description:
    "Sistema de analise de imposto de renda pessoa fisica para escritorios de contabilidade",

  icons: {
    icon: [
      {
        url: "/logo-contec.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/logo-contec.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/logo-contec.png",
        type: "image/svg+xml",
      },
    ],

    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${geist.variable} ${geistMono.variable}`}
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>

        <Toaster richColors closeButton />

        {process.env.NODE_ENV === "production" && (
          <Analytics />
        )}
      </body>
    </html>
  );
}