import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PlayersList } from "./PlayersList";
import { getAdminUserIds } from "@/lib/permissions";
import type { Profile } from "@/lib/types";

export const metadata: Metadata = {
    title: "Jugadores — Pachanga",
    description: "Explora todos los jugadores de la comunidad.",
};

export default async function PlayersPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const [{ data: profiles }, adminUserIds] = await Promise.all([
        supabase
            .from("profiles")
            .select("*")
            .order("matches_played", { ascending: false }),
        getAdminUserIds(),
    ]);

    return (
        <div className="mx-auto max-w-5xl px-4 py-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-foreground">Jugadores</h1>
                <p className="text-muted">Explora todos los jugadores registrados</p>
            </div>
            <PlayersList
                profiles={(profiles as Profile[]) || []}
                currentUserId={user.id}
                adminUserIds={adminUserIds}
            />
        </div>
    );
}
