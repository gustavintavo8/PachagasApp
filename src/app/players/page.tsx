import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { cacheLife, cacheTag } from "next/cache";
import { PlayersList } from "./PlayersList";
import { getAdminUserIds } from "@/lib/permissions";
import type { Profile } from "@/lib/types";
import Link from "next/link";
import { getActiveSeason } from "@/lib/seasons";

export const metadata: Metadata = {
    title: "Jugadores — Pachanga",
    description: "Explora todos los jugadores de la comunidad.",
};

const PAGE_SIZE = 20;

export default async function PlayersPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string }>;
}) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const { page: pageParam } = await searchParams;
    const page = Math.max(1, parseInt(pageParam ?? "1", 10));
    const season = await getActiveSeason();

    const { profiles, adminUserIds, totalPages } = await getPlayersData(page, season.id);

    return (
        <div className="mx-auto max-w-5xl px-4 py-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-foreground">Jugadores</h1>
                <p className="text-muted">Explora todos los jugadores registrados · {season.name}</p>
            </div>
            <PlayersList
                profiles={(profiles as Profile[]) || []}
                currentUserId={user.id}
                adminUserIds={adminUserIds}
            />
            {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                    {page > 1 && (
                        <Link
                            href={`/players?page=${page - 1}`}
                            className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-accent/30 hover:text-foreground"
                        >
                            ← Anterior
                        </Link>
                    )}
                    <span className="text-sm text-muted">{page} / {totalPages}</span>
                    {page < totalPages && (
                        <Link
                            href={`/players?page=${page + 1}`}
                            className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-accent/30 hover:text-foreground"
                        >
                            Siguiente →
                        </Link>
                    )}
                </div>
            )}
        </div>
    );
}

async function getPlayersData(page: number, seasonId: string) {
    "use cache";
    cacheLife("hours");
    cacheTag("players", `players:${seasonId}`);

    const admin = createAdminClient();
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const [{ data: stats, count }, adminUserIds] = await Promise.all([
        admin
            .from("season_player_stats")
            .select(`
                season_id, user_id, elo_rating, matches_played, goals_scored,
                wins, draws, losses, mvps,
                profiles!inner(id, username, avatar_url, position, skill_level, market_value)
            `, { count: "exact" })
            .eq("season_id", seasonId)
            .order("matches_played", { ascending: false })
            .range(from, to),
        getAdminUserIds(),
    ]);

    return {
        profiles: (stats ?? []).map((stat) => {
            const profile = (Array.isArray(stat.profiles) ? stat.profiles[0] : stat.profiles) as {
                id: string;
                username: string | null;
                avatar_url: string | null;
                position: "GK" | "DEF" | "MID" | "FWD" | null;
                skill_level: number | null;
                market_value: number | null;
            } | null | undefined;

            return {
                ...profile,
                id: stat.user_id,
                elo_rating: stat.elo_rating ?? 1000,
                matches_played: stat.matches_played ?? 0,
                goals_scored: stat.goals_scored ?? 0,
            };
        }),
        adminUserIds,
        totalPages: Math.ceil((count ?? 0) / PAGE_SIZE),
    };
}
