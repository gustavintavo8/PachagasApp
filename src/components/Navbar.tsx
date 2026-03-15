import { createClient } from "@/lib/supabase/server";
import { NavbarClient } from "./NavbarClient";
import { NotificationBell } from "./NotificationBell";
import { Suspense } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { getAvatarUrl } from "@/lib/utils";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/login/actions";

async function UserMenuAsync({ variant }: { variant: "desktop" | "mobile" }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: profile } = await supabase
        .from("profiles")
        .select("username, avatar_url")
        .eq("id", user.id)
        .single();

    const avatarUrl = getAvatarUrl(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        profile?.avatar_url ?? null
    );

    if (variant === "desktop") {
        return (
            <>
                <NotificationBell userId={user.id} />
                <Link href="/profile" className="transition-transform hover:scale-105" title="Mi Perfil">
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
                        title="Cerrar Sesión"
                    >
                        <LogOut size={16} />
                    </button>
                </form>
            </>
        );
    }

    // mobile
    return (
        <>
            <Link
                href="/profile"
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-base font-medium text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
            >
                <Avatar
                    src={avatarUrl}
                    fallback={profile?.username || user.email || "U"}
                    size="sm"
                />
                Mi Perfil
            </Link>
            <div className="flex items-center gap-2">
                <NotificationBell userId={user.id} />
                <form action={signOut}>
                    <button
                        type="submit"
                        className="flex items-center gap-3 rounded-xl px-4 py-3 text-base font-medium text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
                    >
                        <LogOut size={20} />
                    </button>
                </form>
            </div>
        </>
    );
}

export function Navbar() {
    return (
        <NavbarClient
            desktopUserMenu={
                <Suspense fallback={<div className="h-8 w-8 rounded-full bg-surface-hover animate-pulse" />}>
                    <UserMenuAsync variant="desktop" />
                </Suspense>
            }
            mobileUserMenu={
                <Suspense fallback={<div className="h-12 w-full rounded-xl bg-surface-hover animate-pulse" />}>
                    <UserMenuAsync variant="mobile" />
                </Suspense>
            }
        />
    );
}
