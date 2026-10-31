// src/components/NavbarClient.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { barrasVisibles, tabActiva, tabs } from "./BottomNav";

interface NavbarClientProps {
  enlaces?: React.ReactNode;
  acciones?: React.ReactNode;
}

// Detalle: flecha de vuelta y contexto en lugar de la palabra
function vuelta(pathname: string, desdeJugadores: boolean) {
  if (pathname.startsWith("/matches/") || pathname === "/history") {
    return { href: "/matches", label: "Partidos" };
  }
  if (desdeJugadores) return { href: "/players", label: "Jugadores" };
  if (pathname === "/players" || pathname.startsWith("/players/")) {
    return { href: "/leaderboard", label: "Ranking" };
  }
  return null;
}

// Mismos enlaces que la barra inferior, en md+
export function EnlacesBarra({ sesion }: { sesion?: boolean }) {
  const pathname = usePathname();
  if (!barrasVisibles(pathname, sesion)) return null;

  return (
    <nav aria-label="Navegación principal" className="hidden items-stretch gap-4 self-stretch md:flex">
      {tabs.map(({ href, label }) => {
        const active = tabActiva(href, pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center font-display text-[21px] font-semibold",
              active
                ? "text-foreground before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-foreground"
                : "text-muted hover:text-foreground active:text-foreground"
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function NavbarClient({ enlaces, acciones }: NavbarClientProps) {
  const pathname = usePathname();
  const router = useRouter();

  // La ruta anterior dentro de la app. Se recuerda al renderizar, no en un efecto, para que
  // la flecha salga bien desde el primer pintado.
  const [ruta, setRuta] = useState({ actual: pathname, anterior: null as string | null });
  if (ruta.actual !== pathname) setRuta({ actual: pathname, anterior: ruta.actual });

  if (pathname === "/login" || pathname === "/access") return null;

  const desdeJugadores = pathname.startsWith("/players/") && ruta.anterior === "/players";
  const atras = vuelta(pathname, desdeJugadores);

  return (
    // Sin fondo y con z: los campos de color pasan por debajo. No flota, se va con el scroll.
    <header className="barra-superior relative z-40 pt-[env(safe-area-inset-top,0px)]">
      <div className="mx-auto flex h-12 w-full items-center justify-between gap-4 px-4 md:max-w-[640px]">
        {atras ? (
          <Link
            href={atras.href}
            onClick={(e) => {
              // Volver de verdad: la lista conserva su búsqueda en la URL y su scroll
              if (!desdeJugadores) return;
              e.preventDefault();
              router.back();
            }}
            className="-ml-1 flex min-h-11 items-center gap-0.5 pr-3 text-[15px] font-medium text-foreground active:text-muted"
          >
            <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
            {atras.label}
          </Link>
        ) : (
          <Link href="/" className="flex min-h-11 items-center font-display text-[30px] font-black leading-none">
            Pachanga
          </Link>
        )}

        {enlaces}

        <div className="-mr-2.5 flex items-center">{acciones}</div>
      </div>
    </header>
  );
}
