import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { formatDate, getAvatarUrl } from "@/lib/utils";
import {
    Calendar,
    MapPin,
    Trophy,
    Target,
    TrendingUp,
    TrendingDown,
    Minus,
} from "lucide-react";

export const metadata: Metadata = {
    title: "Historial — Pachanga",
    description: "Tu historial de partidos jugados y resultados.",
};

export default async function HistoryPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    // Fetch user profile for header stats
    const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    // Fetch finished matches where the user participated
    const { data: participations } = await supabase
        .from("match_participants")
        .select(`
            match_id, 
            team, 
            goals, 
            is_mvp, 
            matches(id, date, location, status, team_a_score, team_b_score)
        `)
        .eq("user_id", user.id);

    // Filter to only finished matches and sort by date desc
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

    // Calculate win/draw/loss stats
    let wins = 0, draws = 0, losses = 0;
    for (const m of finishedMatches) {
        if (m.team_a_score === null || m.team_b_score === null || !m.userTeam) continue;
        const myScore = m.userTeam === "A" ? m.team_a_score : m.team_b_score;
        const oppScore = m.userTeam === "A" ? m.team_b_score : m.team_a_score;
        if (myScore > oppScore) wins++;
        else if (myScore === oppScore) draws++;
        else losses++;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

    return (
        <div className="mx-auto max-w-5xl px-4 py-8">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-foreground">Historial de Partidos</h1>
                <p className="text-muted">Tus pachangas pasadas y resultados</p>
            </div>

            {/* Stats Summary */}
            <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Card className="relative overflow-hidden text-center">
                    <p className="text-sm text-muted">Jugados</p>
                    <p className="mt-1 text-3xl font-bold text-foreground">{finishedMatches.length}</p>
                </Card>
                <Card className="relative overflow-hidden text-center">
                    <div className="absolute right-3 top-3 text-green-500/20">
                        <TrendingUp size={32} />
                    </div>
                    <p className="text-sm text-muted">Victorias</p>
                    <p className="mt-1 text-3xl font-bold text-green-400">{wins}</p>
                </Card>
                <Card className="relative overflow-hidden text-center">
                    <div className="absolute right-3 top-3 text-zinc-500/20">
                        <Minus size={32} />
                    </div>
                    <p className="text-sm text-muted">Empates</p>
                    <p className="mt-1 text-3xl font-bold text-zinc-400">{draws}</p>
                </Card>
                <Card className="relative overflow-hidden text-center">
                    <div className="absolute right-3 top-3 text-red-500/20">
                        <TrendingDown size={32} />
                    </div>
                    <p className="text-sm text-muted">Derrotas</p>
                    <p className="mt-1 text-3xl font-bold text-red-400">{losses}</p>
                </Card>
            </div>

            {/* Match History List */}
            {finishedMatches.length > 0 ? (
                <div className="space-y-4">
                    {finishedMatches.map((match) => {
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
                            <Link key={match.id} href={`/matches/${match.id}`}>
                                <Card className="transition-all hover:border-border-hover hover:bg-surface-hover">
                                    <div className="flex items-center justify-between">
                                        {/* Left: Info */}
                                        <div className="min-w-0 flex-1 space-y-2">
                                            <div className="flex items-center gap-2">
                                                {config && (
                                                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${config.bg} ${config.text} ${config.border}`}>
                                                        {config.label}
                                                    </span>
                                                )}
                                                {match.userMvp && (
                                                    <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-400 border border-yellow-500/30">
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
                                                    <span className="flex items-center gap-1 text-accent">
                                                        <Target size={14} />
                                                        {match.userGoals} gol{match.userGoals !== 1 ? "es" : ""}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Right: Score */}
                                        {match.team_a_score !== null && match.team_b_score !== null && (
                                            <div className="ml-4 flex items-center gap-3 text-center">
                                                <div>
                                                    <p className={`text-xs font-medium ${match.userTeam === "A" ? "text-accent" : "text-muted"}`}>
                                                        {match.userTeam === "A" ? "Tú" : "Riv"}
                                                    </p>
                                                    <p className="text-3xl font-bold text-foreground">
                                                        {match.userTeam === "A" ? match.team_a_score : match.team_b_score}
                                                    </p>
                                                </div>
                                                <span className="text-lg text-muted">–</span>
                                                <div>
                                                    <p className={`text-xs font-medium ${match.userTeam === "B" ? "text-accent" : "text-muted"}`}>
                                                        {match.userTeam === "B" ? "Tú" : "Riv"}
                                                    </p>
                                                    <p className="text-3xl font-bold text-foreground">
                                                        {match.userTeam === "B" ? match.team_a_score : match.team_b_score}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </Card>
                            </Link>
                        );
                    })}
                </div>
            ) : (
                <Card className="text-center">
                    <div className="py-8">
                        <Trophy size={48} className="mx-auto mb-4 text-muted/30" />
                        <p className="text-lg font-medium text-muted">Aún no has jugado partidos</p>
                        <p className="mt-1 text-sm text-muted/70">
                            ¡Únete a un partido y compétalo para ver tu historial aquí!
                        </p>
                    </div>
                </Card>
            )}
        </div>
    );
}
