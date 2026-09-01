"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Calendar, Users, User } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/",          label: "Inicio",    Icon: Home     },
  { href: "/matches",   label: "Partidos",  Icon: Calendar },
  { href: "/players",   label: "Jugadores", Icon: Users    },
  { href: "/profile",   label: "Perfil",    Icon: User     },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface/95 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch">
        {tabs.map(({ href, label, Icon }) => {
          const active =
            href === "/"
              ? pathname === "/"
              : pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              aria-label={label}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2 transition-colors",
                active ? "text-accent" : "text-muted"
              )}
            >
              <span className={cn(
                "flex h-8 w-8 items-center justify-center rounded-xl transition-colors",
                active && "bg-accent/15"
              )}>
                <Icon size={18} aria-hidden="true" />
              </span>
              <span className={cn(
                "text-[10px] font-medium",
                active ? "text-accent" : "text-muted"
              )}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
