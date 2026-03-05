"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/app/login/actions";
import { Avatar } from "@/components/ui/Avatar";
import { cn, getAvatarUrl } from "@/lib/utils";
import { Menu, X, Home, PlusCircle, LogOut, Trophy, BarChart3, CalendarDays, UsersRound } from "lucide-react";
import type { User as SupabaseUser } from "@supabase/supabase-js";

interface NavbarClientProps {
    user: SupabaseUser | null;
    profile: { username: string; avatar_url: string } | null;
    children?: React.ReactNode;
}

const navLinks = [
    { href: "/", label: "Inicio", icon: Home },
    { href: "/matches", label: "Partidos", icon: Trophy },
    { href: "/matches/new", label: "Nuevo", icon: PlusCircle },
    { href: "/leaderboard", label: "Ranking", icon: BarChart3 },
    { href: "/calendar", label: "Calendario", icon: CalendarDays },
    { href: "/players", label: "Jugadores", icon: UsersRound },
];

export function NavbarClient({ user, profile, children }: NavbarClientProps) {
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);

    if (!user) return null;

    const avatarUrl = getAvatarUrl(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        profile?.avatar_url ?? null
    );

    return (
        <nav className="sticky top-0 z-50 border-b border-border bg-surface/80 backdrop-blur-xl">
            <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2">
                    <Image
                        src="/icon-192.png"
                        alt="Pachanga"
                        width={32}
                        height={32}
                        className="rounded-lg"
                    />
                    <span className="text-lg font-bold text-foreground">Pachanga</span>
                </Link>

                {/* Desktop Nav */}
                <div className="hidden items-center gap-1 md:flex">
                    {navLinks.map((link) => {
                        const Icon = link.icon;
                        const active = pathname === link.href || (link.href === "/matches" && pathname === "/history");
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={cn(
                                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                                    active
                                        ? "bg-accent/10 text-accent"
                                        : "text-muted hover:bg-surface-hover hover:text-foreground"
                                )}
                            >
                                <Icon size={16} />
                                {link.label}
                            </Link>
                        );
                    })}
                </div>

                {/* User Section (Desktop) */}
                <div className="hidden items-center gap-3 md:flex">
                    {children}
                    <Link href="/profile" className="transition-transform hover:scale-105">
                        <Avatar
                            src={avatarUrl}
                            fallback={profile?.username || user.email || "U"}
                            size="sm"
                        />
                    </Link>
                    <form action={signOut}>
                        <button
                            type="submit"
                            className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
                        >
                            <LogOut size={16} />
                        </button>
                    </form>
                </div>

                {/* Mobile Toggle */}
                <button
                    onClick={() => setMobileOpen(!mobileOpen)}
                    className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-hover hover:text-foreground md:hidden"
                >
                    {mobileOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

            {/* Mobile Menu */}
            {mobileOpen && (
                <div className="border-t border-border bg-surface px-4 pb-4 pt-2 md:hidden">
                    <div className="space-y-1">
                        {navLinks.map((link) => {
                            const Icon = link.icon;
                            const active = pathname === link.href || (link.href === "/matches" && pathname === "/history");
                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    onClick={() => setMobileOpen(false)}
                                    className={cn(
                                        "flex items-center gap-3 rounded-xl px-4 py-3 text-base font-medium transition-colors",
                                        active
                                            ? "bg-accent/10 text-accent"
                                            : "text-muted hover:bg-surface-hover hover:text-foreground"
                                    )}
                                >
                                    <Icon size={20} />
                                    {link.label}
                                </Link>
                            );
                        })}
                    </div>
                    {/* Mobile: Profile + Sign Out */}
                    <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                        <Link
                            href="/profile"
                            onClick={() => setMobileOpen(false)}
                            className="flex items-center gap-3 rounded-xl px-4 py-3 text-base font-medium text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
                        >
                            <Avatar
                                src={avatarUrl}
                                fallback={profile?.username || user.email || "U"}
                                size="sm"
                            />
                            Mi Perfil
                        </Link>
                        <form action={signOut}>
                            <button
                                type="submit"
                                className="flex items-center gap-3 rounded-xl px-4 py-3 text-base font-medium text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
                            >
                                <LogOut size={20} />
                                Salir
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </nav>
    );
}
