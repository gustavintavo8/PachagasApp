"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/app/login/actions";
import { Avatar } from "@/components/ui/Avatar";
import { cn, getAvatarUrl } from "@/lib/utils";
import { Menu, X, Home, PlusCircle, User, LogOut } from "lucide-react";
import type { User as SupabaseUser } from "@supabase/supabase-js";

interface NavbarClientProps {
    user: SupabaseUser | null;
    profile: { username: string | null; avatar_url: string | null } | null;
}

const navLinks = [
    { href: "/", label: "Dashboard", icon: Home },
    { href: "/matches/new", label: "New Match", icon: PlusCircle },
    { href: "/profile", label: "Profile", icon: User },
];

export function NavbarClient({ user, profile }: NavbarClientProps) {
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
                    <span className="text-2xl">⚽</span>
                    <span className="text-lg font-bold text-foreground">Pachanga</span>
                </Link>

                {/* Desktop Nav */}
                <div className="hidden items-center gap-1 md:flex">
                    {navLinks.map((link) => {
                        const Icon = link.icon;
                        const active = pathname === link.href;
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
                    <Avatar
                        src={avatarUrl}
                        fallback={profile?.username || user.email || "U"}
                        size="sm"
                    />
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
                            const active = pathname === link.href;
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
                    <div className="mt-3 border-t border-border pt-3">
                        <form action={signOut}>
                            <button
                                type="submit"
                                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-base font-medium text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
                            >
                                <LogOut size={20} />
                                Sign Out
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </nav>
    );
}
