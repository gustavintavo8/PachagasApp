import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getActiveSeason } from "@/lib/seasons";
import { getTemporada } from "@/app/leaderboard/datos";
import { PlayersList } from "./PlayersList";

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

    const season = await getActiveSeason();
    const { filas, adminUserIds } = await getTemporada(season.id);

    const jugadores = [...filas].sort((a, b) =>
        (a.username ?? "").localeCompare(b.username ?? "", "es", { sensitivity: "base" })
    );

    return (
        <>
            <header className="flex items-baseline justify-between gap-4 px-4 pt-2">
                <h1 className="t-titular">Jugadores</h1>
                <p className="text-[15px] leading-tight text-muted">{season.name}</p>
            </header>
            <PlayersList
                jugadores={jugadores}
                yo={user.id}
                adminUserIds={adminUserIds}
                semilla={season.id}
            />
        </>
    );
}
