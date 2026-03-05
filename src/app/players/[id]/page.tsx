import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { PlayerCharts } from "@/components/PlayerCharts";
import { formatDate, getAvatarUrl } from "@/lib/utils";
import { getAdminUserIds } from "@/lib/permissions";
import {
    Calendar,
    MapPin,
    Trophy,
    Target,
    ArrowLeft,
    User,
    Star,
    Crown,
} from "lucide-react";

import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Perfil de Jugador — Pachanga",
    description: "Estadísticas y partidos recientes de un jugador.",
};

export default async function PlayerProfilePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    // Fetch the player's profile
    const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .single();

    if (!profile) notFound();

    // Fetch the player's finished matches
    const { data: participations } = await supabase
        .from("match_participants")
        .select("match_id, team, goals, is_mvp, matches(id, date, location, status, team_a_score, team_b_score)")
        .eq("user_id", id);

    const finishedMatches = participations
        ?.map((p) => {
            const match = p.matches as unknown as {
                id: string;
                date: string;
                location: string;
                status: string;
                team_a_score: number | null;
                team_b_score: number | null;
            };
            return {
                ...match,
                userTeam: p.team,
                userGoals: p.goals,
                userMvp: p.is_mvp,
            };
        })
        .filter((m) => m.status === "finished")
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        ?? [];

    // W/D/L
    let wins = 0, draws = 0, losses = 0;
    for (const m of finishedMatches) {
        if (m.team_a_score === null || m.team_b_score === null || !m.userTeam) continue;
        const myScore = m.userTeam === "A" ? m.team_a_score : m.team_b_score;
        const oppScore = m.userTeam === "A" ? m.team_b_score : m.team_a_score;
        if (myScore > oppScore) wins++;
        else if (myScore === oppScore) draws++;
        else losses++;
    }

    // Fetch average ratings
    const { data: ratingsData } = await supabase
        .from("player_ratings")
        .select("punctuality, sportsmanship, skill")
        .eq("rated_id", id);

    let avgRatings: { punctuality: number; sportsmanship: number; skill: number; count: number } | null = null;
    if (ratingsData && ratingsData.length > 0) {
        const sum = ratingsData.reduce(
            (acc, r) => ({
                punctuality: acc.punctuality + r.punctuality,
                sportsmanship: acc.sportsmanship + r.sportsmanship,
                skill: acc.skill + r.skill,
            }),
            { punctuality: 0, sportsmanship: 0, skill: 0 }
        );
        const n = ratingsData.length;
        avgRatings = {
            punctuality: sum.punctuality / n,
            sportsmanship: sum.sportsmanship / n,
            skill: sum.skill / n,
            count: n,
        };
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const avatarUrl = getAvatarUrl(supabaseUrl, profile.avatar_url);
    const isYou = id === user.id;
    const adminUserIds = await getAdminUserIds();
    const isProfileAdmin = adminUserIds.includes(id);

    const positionLabels: Record<string, string> = {
        GK: "🧤 Portero",
        DEF: "🛡️ Defensa",
        MID: "🎯 Mediocampista",
        FWD: "⚡ Delantero",
    };

    return (
        <div className="mx-auto max-w-3xl px-4 py-8">
            {/* Back Link */}
            <Link
                href="/players"
                className="mb-6 inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-foreground"
            >
                <ArrowLeft size={16} />
                Volver a Jugadores
            </Link>

            {/* Profile Header */}
            <Card className="mb-6">
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                    <Avatar
                        src={avatarUrl}
                        fallback={profile.username || "P"}
                        size="lg"
                    />
                    <div className="flex-1 text-center sm:text-left">
                        <div className="flex flex-col items-center gap-2 sm:flex-row">
                            <h1 className="text-2xl font-bold text-foreground">
                                {profile.username || "Desconocido"}
                            </h1>
                            {isYou && (
                                <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
                                    Tú
                                </span>
                            )}
                            {isProfileAdmin && (
                                <span className="flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400">
                                    <Crown size={12} />
                                    Admin
                                </span>
                            )}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-sm text-muted sm:justify-start">
                            {profile.position && (
                                <span className="rounded-full border border-border bg-surface px-3 py-1">
                                    {positionLabels[profile.position] || profile.position}
                                </span>
                            )}
                            {profile.skill_level && (
                                <span className="rounded-full border border-border bg-surface px-3 py-1">
                                    ⭐ Nivel: {profile.skill_level}/10
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </Card>

            {/* Stats Grid */}
            <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Card className="text-center">
                    <p className="text-sm text-muted">Partidos</p>
                    <p className="mt-1 text-2xl font-bold text-foreground">{profile.matches_played}</p>
                </Card>
                <Card className="text-center">
                    <p className="text-sm text-muted">Goles</p>
                    <p className="mt-1 text-2xl font-bold text-foreground">{profile.goals_scored}</p>
                </Card>
                <Card className="text-center">
                    <p className="text-sm text-muted">Victorias</p>
                    <p className="mt-1 text-2xl font-bold text-green-400">{wins}</p>
                </Card>
                <Card className="text-center">
                    <p className="text-sm text-muted">Derrotas</p>
                    <p className="mt-1 text-2xl font-bold text-red-400">{losses}</p>
                </Card>
            </div>

            {/* Charts */}
            {(() => {
                // Goals per month
                const monthMap: Record<string, number> = {};
                const chronological = [...finishedMatches].sort(
                    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
                );
                for (const m of chronological) {
                    const d = new Date(m.date);
                    const key = `${d.toLocaleString("es-ES", { month: "short" })} ${String(d.getFullYear()).slice(2)}`;
                    monthMap[key] = (monthMap[key] || 0) + (m.userGoals || 0);
                }
                const goalsPerMonth = Object.entries(monthMap).map(([month, goals]) => ({ month, goals }));

                // Win rate over time
                let w = 0;
                const winRateOverTime = chronological
                    .filter((m) => m.team_a_score !== null && m.team_b_score !== null && m.userTeam)
                    .map((m, i) => {
                        const my = m.userTeam === "A" ? m.team_a_score! : m.team_b_score!;
                        const opp = m.userTeam === "A" ? m.team_b_score! : m.team_a_score!;
                        if (my > opp) w++;
                        return { match: i + 1, rate: Math.round((w / (i + 1)) * 100) };
                    });

                return (
                    <div className="mb-8">
                        <PlayerCharts goalsPerMonth={goalsPerMonth} winRateOverTime={winRateOverTime} />
                    </div>
                );
            })()}

            {/* Average Ratings */}
            {avgRatings && (
                <Card className="mb-8">
                    <div className="flex items-center gap-2 mb-4">
                        <Star size={18} className="fill-yellow-400 text-yellow-400" />
                        <h3 className="text-sm font-semibold text-foreground">Valoraciones</h3>
                        <span className="text-xs text-muted">({avgRatings.count} valoracion{avgRatings.count !== 1 ? "es" : ""})</span>
                    </div>
                    <div className="space-y-3">
                        {([
                            { label: "⏰ Puntualidad", value: avgRatings.punctuality },
                            { label: "🤝 Deportividad", value: avgRatings.sportsmanship },
                            { label: "⚽ Nivel", value: avgRatings.skill },
                        ] as const).map(({ label, value }) => (
                            <div key={label} className="flex items-center justify-between">
                                <span className="text-sm text-muted">{label}</span>
                                <div className="flex items-center gap-2">
                                    <div className="flex gap-0.5">
                                        {[1, 2, 3, 4, 5].map((s) => (
                                            <Star
                                                key={s}
                                                size={14}
                                                className={s <= Math.round(value) ? "fill-yellow-400 text-yellow-400" : "text-zinc-600"}
                                            />
                                        ))}
                                    </div>
                                    <span className="text-xs font-medium text-foreground">
                                        {value.toFixed(1)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* Recent Matches */}
            <h2 className="mb-4 text-lg font-semibold text-foreground">
                Partidos Recientes
            </h2>
            {finishedMatches.length > 0 ? (
                <div className="space-y-3">
                    {finishedMatches.slice(0, 10).map((match) => {
                        const myScore = match.userTeam === "A" ? match.team_a_score : match.team_b_score;
                        const oppScore = match.userTeam === "A" ? match.team_b_score : match.team_a_score;
                        let result: "win" | "draw" | "loss" | null = null;
                        if (myScore !== null && oppScore !== null && match.userTeam) {
                            if (myScore > oppScore) result = "win";
                            else if (myScore === oppScore) result = "draw";
                            else result = "loss";
                        }

                        const resultColors = {
                            win: "border-l-green-500",
                            draw: "border-l-zinc-500",
                            loss: "border-l-red-500",
                        };

                        return (
                            <Link key={match.id} href={`/matches/${match.id}`}>
                                <Card
                                    className={`border-l-4 transition-all hover:bg-surface-hover ${result ? resultColors[result] : "border-l-border"
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-foreground">
                                                <MapPin size={14} className="text-accent" />
                                                <span className="font-medium">{match.location}</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-sm text-muted">
                                                <span className="flex items-center gap-1">
                                                    <Calendar size={12} />
                                                    {formatDate(match.date)}
                                                </span>
                                                {match.userGoals > 0 && (
                                                    <span className="text-accent">
                                                        ⚽ {match.userGoals}
                                                    </span>
                                                )}
                                                {match.userMvp && (
                                                    <span className="text-yellow-400">🏅 MVP</span>
                                                )}
                                            </div>
                                        </div>
                                        {match.team_a_score !== null && match.team_b_score !== null && (
                                            <span className="text-lg font-bold text-foreground">
                                                {match.team_a_score} – {match.team_b_score}
                                            </span>
                                        )}
                                    </div>
                                </Card>
                            </Link>
                        );
                    })}
                </div>
            ) : (
                <Card className="text-center">
                    <p className="py-4 text-muted">Aún sin partidos finalizados</p>
                </Card>
            )}
        </div>
    );
}
