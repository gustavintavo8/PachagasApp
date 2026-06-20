// src/app/layout.tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { Navbar } from "@/components/Navbar";
import { NavbarSkeleton } from "@/components/NavbarSkeleton";
import { Footer } from "@/components/Footer";
import { BottomNav } from "@/components/BottomNav";
import { ToastProvider } from "@/components/ui/Toast";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pachanga — Organiza tus partidos de fútbol",
  description: "Organiza partidos de fútbol, equilibra equipos, lleva tus estadísticas y disfruta del deporte.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className="dark">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#ccff00" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* Skip link para usuarios de teclado/lectores de pantalla */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-black focus:outline-none"
        >
          Saltar al contenido principal
        </a>
        <ToastProvider>
          <Suspense fallback={<NavbarSkeleton />}>
            <Navbar />
          </Suspense>
          {/* pb-20 on mobile to clear the fixed BottomNav */}
          <main id="main-content" className="min-h-[calc(100vh-4rem)] pb-20 md:pb-0">{children}</main>
          <Footer />
          <Suspense fallback={null}>
            <BottomNav />
          </Suspense>
        </ToastProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
