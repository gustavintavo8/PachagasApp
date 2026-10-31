"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Panenka } from "@/components/Panenka";
import { cn } from "@/lib/utils";

export const tabs = [
  { href: "/",            label: "Inicio"   },
  { href: "/matches",     label: "Partidos" },
  { href: "/asistente",   label: "Panenka"  },
  { href: "/leaderboard", label: "Ranking"  },
  { href: "/profile",     label: "Perfil"   },
] as const;

const rutasLegales = ["/privacidad", "/aviso-legal", "/terminos"];

// Una pestaña cubre sus rutas hijas y las que se alcanzan desde ella.
// Jugadores cuelga de Ranking; Historial, de Partidos.
export function tabActiva(href: string, pathname: string) {
  const cubre = (ruta: string) => pathname === ruta || pathname.startsWith(ruta + "/");
  if (href === "/") return pathname === "/";
  if (href === "/matches") return cubre("/matches") || cubre("/history");
  if (href === "/leaderboard") return cubre("/leaderboard") || cubre("/players");
  return cubre(href);
}

// El middleware ya manda fuera a los invitados: si no hay sesión solo pueden estar
// en rutas públicas. Las legales son las únicas que dependen de la sesión, y mientras
// no se sabe (sesion undefined) ahí no se pinta nada.
export function barrasVisibles(pathname: string, sesion?: boolean) {
  if (pathname === "/login" || pathname === "/access") return false;
  if (rutasLegales.includes(pathname)) return sesion === true;
  return sesion !== false;
}

export function BottomNav({ sesion }: { sesion?: boolean }) {
  const pathname = usePathname();
  if (!barrasVisibles(pathname, sesion)) return null;

  return (
    <nav
      aria-label="Navegación principal"
      className="barra-inferior fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background pb-[env(safe-area-inset-bottom,0px)] md:hidden"
    >
      <div className="grid h-14 grid-cols-5">
        {tabs.map(({ href, label }) => {
          const active = tabActiva(href, pathname);
          const esPanenka = href === "/asistente";
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              aria-label={esPanenka ? label : undefined}
              className={cn(
                "relative flex items-center justify-center font-display text-[21px] font-semibold",
                active
                  ? "text-foreground before:absolute before:inset-x-0 before:-top-px before:h-0.5 before:bg-foreground"
                  : "text-muted active:text-foreground"
              )}
            >
              {esPanenka ? (
                // La cara sobre la regla, como un punto de saque. Asoma poco: encima hay enlaces que tocar.
                <span className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/3 text-foreground in-active:text-muted">
                  <Panenka size={36} />
                </span>
              ) : (
                label
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
