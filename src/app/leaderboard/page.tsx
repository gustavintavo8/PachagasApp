import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LeaderboardTabs } from "./LeaderboardTabs";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Ranking — Pachanga",
    description: "Clasificación de los mejores jugadores de la comunidad.",
};

export default async function LeaderboardPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    // Fetch all profiles with stats
    const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .order("matches_played", { ascending: false });

    // Fetch W/D/L data for all users
    const { data: allParticipations } = await supabase
        .from("match_participants")
        .select("user_id, team, goals, is_mvp, matches(status, team_a_score, team_b_score)");

    // Build stats map
    const statsMap: Record<string, { wins: number; draws: number; losses: number; mvps: number }> = {};

    if (allParticipations) {
        for (const p of allParticipations) {
            const match = p.matches as unknown as {
                status: string;
                team_a_score: number | null;
                team_b_score: number | null;
            };
            if (!match || match.status !== "finished" || match.team_a_score === null || match.team_b_score === null || !p.team) continue;

            if (!statsMap[p.user_id]) {
                statsMap[p.user_id] = { wins: 0, draws: 0, losses: 0, mvps: 0 };
            }

            const myScore = p.team === "A" ? match.team_a_score : match.team_b_score;
            const oppScore = p.team === "A" ? match.team_b_score : match.team_a_score;

            if (myScore > oppScore) statsMap[p.user_id].wins++;
            else if (myScore === oppScore) statsMap[p.user_id].draws++;
            else statsMap[p.user_id].losses++;

            if (p.is_mvp) statsMap[p.user_id].mvps++;
        }
    }

    const leaderboardData = (profiles || []).map((p) => ({
        id: p.id,
        username: p.username,
        avatar_url: p.avatar_url,
        position: p.position,
        skill_level: p.skill_level,
        matches_played: p.matches_played ?? 0,
        goals_scored: p.goals_scored ?? 0,
        wins: statsMap[p.id]?.wins ?? 0,
        draws: statsMap[p.id]?.draws ?? 0,
        losses: statsMap[p.id]?.losses ?? 0,
        mvps: statsMap[p.id]?.mvps ?? 0,
    }));

    return (
        <div className="mx-auto max-w-5xl px-4 py-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-foreground">🏆 Ranking</h1>
                <p className="text-muted">Los mejores jugadores de la comunidad</p>
            </div>
            <LeaderboardTabs data={leaderboardData} currentUserId={user.id} />
        </div>
    );
}
