import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
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
    Crown,
    Medal,
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

    // Fetch MVP trophies
    const { data: mvpTrophies } = await supabase
        .from("match_participants")
        .select("match_id, matches(id, date, location, team_a_score, team_b_score)")
        .eq("user_id", id)
        .eq("is_mvp", true);

    const trophies = (mvpTrophies || [])
        .map((t) => {
            const match = t.matches as unknown as {
                id: string;
                date: string;
                location: string;
                team_a_score: number | null;
                team_b_score: number | null;
            };
            return match;
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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

    // Head-to-Head (H2H) Logic
    let h2h = { playedTogether: 0, playedAgainst: 0, viewerWins: 0, profileWins: 0 };
    if (!isYou) {
        // Fetch matches where BOTH users participated
        const { data: commonMatches } = await supabase
            .rpc("get_common_matches", { user_a: user.id, user_b: id });

        // Since we might not have a clean RPC, let's do it application side for simplicity if RPC fails, 
        // or just query all finished matches of the viewer and intersect.
        const { data: viewerParticipations } = await supabase
            .from("match_participants")
            .select("match_id, team")
            .eq("user_id", user.id);

        if (viewerParticipations && participations) {
            const viewerMatchMap = new Map(viewerParticipations.map(p => [p.match_id, p.team]));

            for (const p of finishedMatches) {
                const viewerTeam = viewerMatchMap.get(p.id);
                if (viewerTeam && p.userTeam && p.team_a_score !== null && p.team_b_score !== null) {
                    if (viewerTeam === p.userTeam) {
                        h2h.playedTogether++;
                    } else {
                        h2h.playedAgainst++;
                        // Determine who won
                        const profileWon =
                            (p.userTeam === "A" && p.team_a_score > p.team_b_score) ||
                            (p.userTeam === "B" && p.team_b_score > p.team_a_score);
                        const viewerWon =
                            (viewerTeam === "A" && p.team_a_score > p.team_b_score) ||
                            (viewerTeam === "B" && p.team_b_score > p.team_a_score);

                        if (viewerWon) h2h.viewerWins++;
                        else if (profileWon) h2h.profileWins++;
                    }
                }
            }
        }
    }

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
                        priority={true}
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

                        {/* Trophies Section - Under Name */}
                        {trophies.length > 0 && (
                            <div className="mt-5 border-t border-border/50 pt-4">
                                <h3 className="mb-3 text-sm font-semibold text-yellow-400/90 flex items-center justify-center sm:justify-start gap-1.5">
                                    <Crown size={14} className="text-yellow-400" />
                                    Trofeos ({trophies.length})
                                </h3>
                                <div className="flex flex-wrap gap-4 justify-center sm:justify-start">
                                    {trophies.map((trophy) => (
                                        <Link
                                            key={trophy.id}
                                            href={`/matches/${trophy.id}`}
                                            className="group relative flex flex-col items-center gap-2 rounded-2xl bg-surface p-4 transition-transform hover:-translate-y-1 hover:bg-surface-hover"
                                        >
                                            <div className="relative h-28 w-28 drop-shadow-[0_0_15px_rgba(250,204,21,0.3)] group-hover:drop-shadow-[0_0_30px_rgba(250,204,21,0.6)] transition-all">
                                                <Image
                                                    src="/mvp-trophy.png"
                                                    alt="MVP Trophy"
                                                    fill
                                                    priority={true}
                                                    className="object-contain transition-transform duration-300 hover:scale-110"
                                                />
                                            </div>
                                            <div className="text-center mt-1">
                                                <p className="text-[11px] tracking-wider uppercase font-bold text-yellow-500/90">MVP</p>
                                                <p className="text-xs font-medium text-foreground capitalize">
                                                    {new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(trophy.date))}
                                                </p>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}
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

            {/* H2H Stats (Only if viewing someone else) */}
            {!isYou && (h2h.playedTogether > 0 || h2h.playedAgainst > 0) && (
                <Card className="mb-8 overflow-hidden bg-gradient-to-br from-surface to-surface-hover/50">
                    <CardHeader className="bg-accent/5 pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg text-accent">
                            <span className="text-xl">⚔️</span>
                            Historial vs Ti
                        </CardTitle>
                    </CardHeader>
                    <div className="grid grid-cols-3 divide-x divide-border/50 p-4">
                        <div className="text-center px-2">
                            <p className="truncate text-xs text-muted mb-1">Victoria Tuya</p>
                            <p className="text-2xl font-bold text-green-400">{h2h.viewerWins}</p>
                        </div>
                        <div className="text-center px-2">
                            <p className="truncate text-xs text-muted mb-1">Victoria Suya</p>
                            <p className="text-2xl font-bold text-red-400">{h2h.profileWins}</p>
                        </div>
                        <div className="text-center px-2">
                            <p className="truncate text-xs text-muted mb-1">Juntos</p>
                            <p className="text-2xl font-bold text-blue-400">{h2h.playedTogether}</p>
                        </div>
                    </div>
                </Card>
            )}

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
