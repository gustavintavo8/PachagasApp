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
    Swords,
} from "lucide-react";
import { POSITION_FULL, POSITION_ICONS, POSITION_COLORS } from "@/lib/positions";

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

    const positionLabels = POSITION_FULL;

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
            <Card className="mb-6 overflow-hidden relative border border-border/80 bg-gradient-to-br from-surface to-surface-hover/30 shadow-md">
                <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-accent/10 to-transparent pointer-events-none" />
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start relative z-10">
                    <div className="relative group">
                        <div className="absolute -inset-0.5 rounded-full bg-gradient-to-br from-accent to-accent/20 opacity-0 blur transition duration-500 group-hover:opacity-100 animate-pulse-slow"></div>
                        <Avatar
                            src={avatarUrl}
                            fallback={profile.username || "P"}
                            size="lg"
                            priority={true}
                            className="relative border-2 border-surface shadow-[0_0_20px_rgba(0,0,0,0.5)] transition-transform duration-300 group-hover:scale-105"
                        />
                    </div>
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
                                <span className={`flex items-center gap-1.5 rounded-full border px-3 py-1 font-semibold text-[11px] uppercase tracking-wider ${POSITION_COLORS[profile.position as keyof typeof POSITION_COLORS] || "bg-accent/10 border-accent/30 text-accent"}`}>
                                    <span>{POSITION_ICONS[profile.position as keyof typeof POSITION_ICONS]}</span>
                                    {positionLabels[profile.position as keyof typeof positionLabels] || profile.position}
                                </span>
                            )}
                            <span className="flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 font-bold text-accent shadow-[0_0_10px_rgba(204,255,0,0.1)]">
                                {profile.elo_rating ?? 1000} RP
                            </span>
                            {(profile.matches_played ?? 0) < 3 && (
                                <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-medium text-yellow-400">
                                    Provisional
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
                <Card className="relative overflow-hidden text-center border-border/80 bg-gradient-to-br from-surface to-surface-hover/30 hover:border-accent/40 transition-colors">
                    <p className="text-sm text-muted">Partidos</p>
                    <p className="mt-1 text-3xl font-bold text-foreground drop-shadow-md">{profile.matches_played}</p>
                </Card>
                <Card className="relative overflow-hidden text-center border-border/80 bg-gradient-to-br from-surface to-surface-hover/30 hover:border-accent/40 transition-colors">
                    <p className="text-sm text-muted">Goles</p>
                    <p className="mt-1 text-3xl font-bold text-foreground drop-shadow-md">{profile.goals_scored}</p>
                </Card>
                <Card className="relative overflow-hidden text-center border-border/80 bg-gradient-to-br from-surface to-surface-hover/30 hover:border-green-500/40 transition-colors">
                    <div className="absolute top-0 right-1/2 translate-x-1/2 w-4/5 h-px bg-gradient-to-r from-transparent via-green-500/30 to-transparent"></div>
                    <p className="text-sm text-muted">Victorias</p>
                    <p className="mt-1 text-3xl font-bold text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.4)]">{wins}</p>
                </Card>
                <Card className="relative overflow-hidden text-center border-border/80 bg-gradient-to-br from-surface to-surface-hover/30 hover:border-red-500/40 transition-colors">
                    <div className="absolute top-0 right-1/2 translate-x-1/2 w-4/5 h-px bg-gradient-to-r from-transparent via-red-500/30 to-transparent"></div>
                    <p className="text-sm text-muted">Derrotas</p>
                    <p className="mt-1 text-3xl font-bold text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]">{losses}</p>
                </Card>
            </div>

            {/* H2H Stats (Only if viewing someone else) */}
            {!isYou && (h2h.playedTogether > 0 || h2h.playedAgainst > 0) && (
                <Card className="mb-8 overflow-hidden border border-border/80 bg-gradient-to-br from-surface to-surface-hover/30 hover:border-accent/40 hover:shadow-[0_8px_30px_rgba(204,255,0,0.06)] transition-all">
                    <CardHeader className="border-b border-border/50 pb-4 bg-black/20">
                        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                            <Swords size={20} className="text-accent" />
                            Historial vs Ti
                        </CardTitle>
                    </CardHeader>
                    <div className="grid grid-cols-3 divide-x divide-border/50 p-4 bg-black/10">
                        <div className="text-center px-2 group">
                            <p className="truncate text-[10px] uppercase tracking-wider text-muted mb-1 group-hover:text-green-400 transition-colors">Victoria Tuya</p>
                            <p className="text-3xl font-bold text-green-400">{h2h.viewerWins}</p>
                        </div>
                        <div className="text-center px-2 group">
                            <p className="truncate text-[10px] uppercase tracking-wider text-muted mb-1 group-hover:text-red-500 transition-colors">Victoria Suya</p>
                            <p className="text-3xl font-bold text-red-500">{h2h.profileWins}</p>
                        </div>
                        <div className="text-center px-2 group">
                            <p className="truncate text-[10px] uppercase tracking-wider text-muted mb-1 group-hover:text-blue-400 transition-colors">Juntos</p>
                            <p className="text-3xl font-bold text-blue-400">{h2h.playedTogether}</p>
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

                        const resultConfig = {
                            win: { label: "VICTORIA", bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/30" },
                            draw: { label: "EMPATE", bg: "bg-zinc-500/10", text: "text-zinc-400", border: "border-zinc-500/30" },
                            loss: { label: "DERROTA", bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30" },
                        };

                        const config = result ? resultConfig[result] : null;

                        return (
                            <Link key={match.id} href={`/matches/${match.id}`} className="group block">
                                <Card className="transition-all border border-border/80 bg-gradient-to-br from-surface to-surface-hover/30 hover:border-accent/40 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(204,255,0,0.08)]">
                                    <div className="flex items-center justify-between">
                                        <div className="min-w-0 flex-1 space-y-2">
                                            <div className="flex items-center gap-2">
                                                {config && (
                                                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${config.bg} ${config.text} ${config.border}`}>
                                                        {config.label}
                                                    </span>
                                                )}
                                                {match.userMvp && (
                                                    <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-[10px] font-bold text-yellow-500/90 border border-yellow-500/30 shadow-[0_0_8px_rgba(234,179,8,0.2)]">
                                                        MVP
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 text-foreground">
                                                <MapPin size={14} className="shrink-0 text-accent" />
                                                <span className="truncate font-medium">{match.location}</span>
                                            </div>
                                            <div className="flex items-center gap-4 text-sm text-muted">
                                                <span className="flex items-center gap-1.5">
                                                    <Calendar size={14} />
                                                    {formatDate(match.date)}
                                                </span>
                                                {match.userGoals > 0 && (
                                                    <span className="flex items-center gap-1 text-accent font-semibold">
                                                        <Target size={14} />
                                                        {match.userGoals} gol{match.userGoals !== 1 ? "es" : ""}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {match.team_a_score !== null && match.team_b_score !== null && (
                                        <div className="mt-4 flex items-center justify-between border-t border-border/50 bg-black/10 px-6 py-3 -mx-6 -mb-6 rounded-b-2xl">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted group-hover:text-foreground transition-colors relative z-10 pointer-events-none">Ver Detalles →</span>
                                            <div className="flex items-center justify-end gap-3 text-center shrink-0 min-w-[70px]">
                                                <div>
                                                    <p className={`text-[9px] uppercase tracking-wider font-bold mb-0.5 text-red-400 flex items-center`}>
                                                        Rojo {match.userTeam === "A" && <span className="text-accent ml-1">(P)</span>}
                                                    </p>
                                                    <p className={`text-xl font-bold leading-none ${match.userTeam === "A" && result === "win" ? "text-accent drop-shadow-[0_0_8px_rgba(204,255,0,0.5)] scale-110" : "text-foreground"}`}>
                                                        {match.team_a_score}
                                                    </p>
                                                </div>
                                                <span className="text-sm font-bold text-muted/50">-</span>
                                                <div className="flex flex-col items-end">
                                                    <p className={`text-[9px] uppercase tracking-wider font-bold mb-0.5 text-blue-400 flex items-center`}>
                                                        {match.userTeam === "B" && <span className="text-accent mr-1">(P)</span>} Azul
                                                    </p>
                                                    <p className={`text-xl font-bold leading-none ${match.userTeam === "B" && result === "win" ? "text-accent drop-shadow-[0_0_8px_rgba(204,255,0,0.5)] scale-110" : "text-foreground"}`}>
                                                        {match.team_b_score}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
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
