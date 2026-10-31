// src/components/NavbarClient.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { barrasVisibles, tabActiva, tabs } from "./BottomNav";

interface NavbarClientProps {
  enlaces?: React.ReactNode;
  acciones?: React.ReactNode;
}

// Cuanto mayor el nivel, más hondo. Solo se recuerda de dónde vienes si vienes de más arriba:
// así volver desde una ficha no cambia adónde lleva la flecha del partido.
const NIVELES: { ruta: RegExp; nivel: number; nombre: string }[] = [
  { ruta: /^\/$/, nivel: 0, nombre: "Inicio" },
  { ruta: /^\/matches$/, nivel: 0, nombre: "Partidos" },
  { ruta: /^\/leaderboard$/, nivel: 0, nombre: "Ranking" },
  { ruta: /^\/asistente$/, nivel: 0, nombre: "Panenka" },
  { ruta: /^\/profile$/, nivel: 0, nombre: "Perfil" },
  { ruta: /^\/players$/, nivel: 1, nombre: "Jugadores" },
  { ruta: /^\/history$/, nivel: 1, nombre: "Historial" },
  { ruta: /^\/matches\/(?!new$)[^/]+$/, nivel: 2, nombre: "Partido" },
  { ruta: /^\/players\/[^/]+$/, nivel: 3, nombre: "Ficha" },
];

const pantalla = (pathname: string) => NIVELES.find(({ ruta }) => ruta.test(pathname));

// Detalle: flecha de vuelta y contexto en lugar de la palabra
function vuelta(pathname: string, origen: string | undefined, parametros: URLSearchParams) {
  if (pathname.startsWith("/matches/") || pathname === "/history") {
    // La lista que abrió esto lo dice en el enlace (?desde=): la flecha vuelve a ella
    const desde = parametros.get("desde");
    if (desde === "historial" && pathname !== "/history") {
      const temporada = parametros.get("temporada");
      return { href: temporada ? `/history?season=${encodeURIComponent(temporada)}` : "/history", label: "Historial" };
    }
    if (desde === "terminados") return { href: "/matches?tab=terminados", label: "Partidos" };
  }
  const nombre = origen && pantalla(origen)?.nombre;
  if (origen && nombre) return { href: origen, label: nombre };
  // Entrando por un enlace directo no hay de dónde venir
  if (pathname.startsWith("/matches/") || pathname === "/history") return { href: "/matches", label: "Partidos" };
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
  const parametros = useSearchParams();
  const router = useRouter();

  // El camino dentro de la app. Se recuerda al renderizar, no en un efecto, para que la flecha
  // salga bien desde el primer pintado. Volver al penúltimo es ir atrás: no cuenta como venir de allí.
  const [ruta, setRuta] = useState({ pila: [pathname], origenes: {} as Record<string, string> });
  const anterior = ruta.pila.at(-2);
  if (ruta.pila.at(-1) !== pathname) {
    const actual = ruta.pila[ruta.pila.length - 1];
    const vuelve = anterior === pathname;
    const [desde, aqui] = [pantalla(actual), pantalla(pathname)];
    setRuta({
      pila: vuelve ? ruta.pila.slice(0, -1) : [...ruta.pila, pathname],
      origenes: !vuelve && desde && aqui && desde.nivel < aqui.nivel ? { ...ruta.origenes, [pathname]: actual } : ruta.origenes,
    });
  }

  if (pathname === "/login" || pathname === "/access") return null;

  const atras = vuelta(pathname, ruta.origenes[pathname], parametros);

  return (
    // Sin fondo y con z: los campos de color pasan por debajo. No flota, se va con el scroll.
    <header className="barra-superior relative z-40 pt-[env(safe-area-inset-top,0px)]">
      <div className="mx-auto flex h-12 w-full items-center justify-between gap-4 px-4 md:max-w-[640px]">
        {atras ? (
          <Link
            href={atras.href}
            onClick={(e) => {
              // Volver de verdad: la lista conserva su búsqueda en la URL y su scroll
              if (atras.href.split("?")[0] !== anterior) return;
              e.preventDefault();
              router.back();
            }}
            className="pulsable -ml-1 flex min-h-11 items-center gap-0.5 pr-3 text-[15px] font-medium text-foreground active:text-muted"
          >
            <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
            {atras.label}
          </Link>
        ) : (
          <Link href="/" className="pulsable flex min-h-11 items-center font-display text-[30px] font-black leading-none active:text-muted">
            Pachanga
          </Link>
        )}

        {enlaces}

        <div className="-mr-2.5 flex items-center">{acciones}</div>
      </div>
    </header>
  );
}
