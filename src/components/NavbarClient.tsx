// src/components/NavbarClient.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Home, Calendar, BarChart3, Users, Star, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavbarClientProps {
  desktopUserMenu?: React.ReactNode;
  mobileRight?: React.ReactNode;
}

const navLinks = [
  { href: "/",           label: "Inicio",    icon: Home      },
  { href: "/matches",    label: "Partidos",  icon: Calendar  },
  { href: "/leaderboard",label: "Ranking",   icon: BarChart3 },
  { href: "/players",    label: "Jugadores", icon: Users     },
  { href: "/fantasy",    label: "Fantasy",   icon: Star      },
  { href: "/asistente",  label: "Panenka",   icon: Bot       },
];

export function NavbarClient({ desktopUserMenu, mobileRight }: NavbarClientProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegación principal" className="sticky top-0 z-50 border-b border-border bg-surface/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Image src="/icon-192.png" alt="Pachanga" width={32} height={32} className="rounded-lg" />
          <span className="text-lg font-bold text-foreground">Pachanga</span>
        </Link>

        {/* Desktop Nav Links */}
        <div className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const active =
              pathname === link.href ||
              (link.href === "/matches" && pathname === "/history");
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent/10 text-accent"
                    : "text-muted hover:bg-surface-hover hover:text-foreground"
                )}
              >
                <Icon size={16} aria-hidden="true" />
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Desktop: User menu (avatar + notifications + logout) */}
        <div className="hidden items-center gap-3 md:flex">
          {desktopUserMenu}
        </div>

        {/* Mobile: solo campana de notificaciones */}
        <div className="flex items-center md:hidden">
          {mobileRight}
        </div>
      </div>
    </nav>
  );
}
