import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProfileForm } from "./ProfileForm";
import { isAdmin } from "@/lib/permissions";

export const metadata: Metadata = {
    title: "Perfil — Pachanga",
    description: "Configura tu perfil de jugador.",
};

export default async function ProfilePage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    const userIsAdmin = isAdmin(user.email);

    return (
        <div className="mx-auto max-w-lg px-4 py-8">
            <div className="mb-2 flex items-center gap-3">
                <h1 className="text-2xl font-bold text-foreground">Tu Perfil</h1>
                {userIsAdmin && (
                    <span className="flex items-center gap-1 rounded-full bg-red-500/10 border border-red-500/30 px-2.5 py-0.5 text-xs font-medium text-red-400">
                        👑 Admin
                    </span>
                )}
            </div>
            <p className="mb-8 text-muted">Configura tu info de jugador</p>
            <ProfileForm userId={user.id} profile={profile} />
        </div>
    );
}
