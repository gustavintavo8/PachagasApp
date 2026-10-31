// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Archivo, Sofia_Sans_Extra_Condensed } from "next/font/google";
import { Navbar, BottomNavSesion } from "@/components/Navbar";
import { NavbarSkeleton } from "@/components/NavbarSkeleton";
import { Footer } from "@/components/Footer";
import { BottomNav } from "@/components/BottomNav";
import { RecortesPanenka } from "@/components/Panenka";
import { ToastProvider } from "@/components/ui/Toast";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import "./marca.css";

const display = Sofia_Sans_Extra_Condensed({
  variable: "--font-display",
  weight: ["600", "800", "900"],
  subsets: ["latin"],
  // A estos tamaños un Arial encogido se ve más que un instante en blanco. Va precargada.
  display: "block",
});
const sans = Archivo({
  variable: "--font-sans",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pachanga — Organiza tus partidos de fútbol",
  description: "Organiza partidos de fútbol, equilibra equipos, lleva tus estadísticas y disfruta del deporte.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#000000",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${display.variable} ${sans.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="flex min-h-dvh flex-col antialiased">
        <RecortesPanenka />
        {/* Skip link para usuarios de teclado/lectores de pantalla */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-foreground focus:px-4 focus:py-2 focus:text-background"
        >
          Saltar al contenido principal
        </a>
        <ToastProvider>
          <Suspense fallback={<NavbarSkeleton />}>
            <Navbar />
          </Suspense>
          {/* En escritorio el contenido es una columna; los campos de color ocupan la columna. */}
          <main id="main-content" className="mx-auto w-full flex-1 md:max-w-[640px]">{children}</main>
          <Suspense fallback={null}>
            <Footer />
          </Suspense>
          {/* Mientras llega la sesión se pinta la barra igual, para que no aparezca de golpe. */}
          <Suspense fallback={null}>
            <Suspense fallback={<BottomNav />}>
              <BottomNavSesion />
            </Suspense>
          </Suspense>
        </ToastProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
