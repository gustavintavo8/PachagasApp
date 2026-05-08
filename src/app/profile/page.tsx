import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProfileForm } from "./ProfileForm";

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

    const isGuest = user.is_anonymous === true;

    const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    return (
        <div className="mx-auto max-w-lg px-4 py-8">
            <h1 className="mb-2 text-2xl font-bold text-foreground">Tu Perfil</h1>
            <p className="mb-8 text-muted">Configura tu info de jugador</p>
            <ProfileForm userId={user.id} profile={profile} isGuest={isGuest} />
        </div>
    );
}
