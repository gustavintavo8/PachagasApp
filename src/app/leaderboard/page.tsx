import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { LeaderboardTabs } from "./LeaderboardTabs";
import { getAdminUserIds } from "@/lib/permissions";
import { cacheLife, cacheTag } from "next/cache";
import type { Metadata } from "next";
import Link from "next/link";
import { getActiveSeason } from "@/lib/seasons";

export const metadata: Metadata = {
    title: "Ranking — Pachanga",
    description: "Clasificación de los mejores jugadores de la comunidad.",
};

const PAGE_SIZE = 20;

export default async function LeaderboardPage({
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

    const { leaderboardData, totalPages, adminUserIds } = await getLeaderboardData(page, season.id);

    return (
        <div className="mx-auto max-w-5xl px-4 py-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-foreground">Ranking</h1>
                <p className="text-muted">Los mejores jugadores de la comunidad · {season.name}</p>
            </div>
            <LeaderboardTabs data={leaderboardData} currentUserId={user.id} adminUserIds={adminUserIds} />
            {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                    {page > 1 && (
                        <Link
                            href={`/leaderboard?page=${page - 1}`}
                            className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-accent/30 hover:text-foreground"
                        >
                            ← Anterior
                        </Link>
                    )}
                    <span className="text-sm text-muted">{page} / {totalPages}</span>
                    {page < totalPages && (
                        <Link
                            href={`/leaderboard?page=${page + 1}`}
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

async function getLeaderboardData(page: number, seasonId: string) {
    "use cache";
    cacheLife("hours");
    cacheTag("leaderboard", `leaderboard:${seasonId}`);

    const admin = createAdminClient();
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const [{ data: stats, count }, adminUserIds] = await Promise.all([
        admin
            .from("season_player_stats")
            .select(`
                season_id, user_id, elo_rating, matches_played, goals_scored,
                wins, draws, losses, mvps,
                profiles!inner(id, username, avatar_url, position, skill_level)
            `, { count: "exact" })
            .eq("season_id", seasonId)
            .order("elo_rating", { ascending: false })
            .order("matches_played", { ascending: false })
            .range(from, to),
        getAdminUserIds(),
    ]);

    const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

    const leaderboardData = (stats || []).map((stat) => {
        const profile = (Array.isArray(stat.profiles) ? stat.profiles[0] : stat.profiles) as {
            username: string | null;
            avatar_url: string | null;
            position: string | null;
            skill_level: number | null;
        } | null | undefined;

        return {
            id: stat.user_id,
            username: profile?.username ?? null,
            avatar_url: profile?.avatar_url ?? null,
            position: profile?.position ?? null,
            skill_level: profile?.skill_level ?? null,
            elo_rating: stat.elo_rating ?? 1000,
            matches_played: stat.matches_played ?? 0,
            goals_scored: stat.goals_scored ?? 0,
            wins: stat.wins ?? 0,
            draws: stat.draws ?? 0,
            losses: stat.losses ?? 0,
            mvps: stat.mvps ?? 0,
        };
    });

    return { leaderboardData, totalPages, adminUserIds };
}
