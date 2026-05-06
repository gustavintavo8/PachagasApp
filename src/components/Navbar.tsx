// src/components/Navbar.tsx
import { createClient } from "@/lib/supabase/server";
import { NavbarClient } from "./NavbarClient";
import { NotificationBell } from "./NotificationBell";
import { Suspense } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { getAvatarUrl } from "@/lib/utils";
import Link from "next/link";
import { LogOut, Bot } from "lucide-react";
import { signOut } from "@/app/login/actions";

async function DesktopUserMenu() {
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

  return (
    <>
      <NotificationBell userId={user.id} />
      <Link href="/profile" className="transition-transform hover:scale-105" title="Mi Perfil" aria-label="Mi Perfil">
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
          aria-label="Cerrar Sesión"
        >
          <LogOut size={16} aria-hidden="true" />
        </button>
      </form>
    </>
  );
}

async function MobileNotificationBell() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return <NotificationBell userId={user.id} />;
}

export function Navbar() {
  return (
    <NavbarClient
      desktopUserMenu={
        <Suspense fallback={<div className="h-8 w-8 rounded-full bg-surface-hover animate-pulse" />}>
          <DesktopUserMenu />
        </Suspense>
      }
      mobileRight={
        <div className="flex items-center gap-1">
          <Link
            href="/asistente"
            aria-label="Panenka — Asistente IA"
            className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <Bot size={20} aria-hidden="true" />
          </Link>
          <Suspense fallback={<div className="h-6 w-6 rounded-full bg-surface-hover animate-pulse" />}>
            <MobileNotificationBell />
          </Suspense>
        </div>
      }
    />
  );
}
