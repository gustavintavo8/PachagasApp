"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/utils";
import {
    Calendar,
    MapPin,
    Users,
    PlusCircle,
    CheckCircle2,
    Clock,
    Lock,
    Target,
    Trophy,
    TrendingUp,
    TrendingDown,
    Minus,
} from "lucide-react";

interface Match {
    id: string;
    date: string;
    location: string;
    max_players: number;
    status: string;
    team_a_score: number | null;
    team_b_score: number | null;
    created_by: string;
    match_participants: {
        user_id: string;
        team: "A" | "B" | null;
        goals: number;
        is_mvp: boolean;
    }[];
}

interface MatchesTabsProps {
    matches: Match[];
    userId: string;
}

export function MatchesTabs({ matches, userId }: MatchesTabsProps) {
    const [tab, setTab] = useState<"active" | "history">("active");

    const activeMatches = matches.filter((m) => m.status === "open" || m.status === "closed");
    const finishedMatches = matches.filter((m) => m.status === "finished");

    // W/D/L stats for history
    let wins = 0, draws = 0, losses = 0;
    for (const m of finishedMatches) {
        const myPart = m.match_participants.find((p) => p.user_id === userId);
        if (!myPart?.team || m.team_a_score === null || m.team_b_score === null) continue;
        const myScore = myPart.team === "A" ? m.team_a_score : m.team_b_score;
        const oppScore = myPart.team === "A" ? m.team_b_score : m.team_a_score;
        if (myScore > oppScore) wins++;
        else if (myScore === oppScore) draws++;
        else losses++;
    }

    const statusConfig: Record<string, { label: string; icon: React.ReactNode; classes: string }> = {
        open: { label: "Abierto", icon: <Clock size={12} />, classes: "bg-accent/10 text-accent border-accent/30" },
        closed: { label: "Cerrado", icon: <Lock size={12} />, classes: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" },
        finished: { label: "Finalizado", icon: <CheckCircle2 size={12} />, classes: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30" },
    };

    return (
        <div className="mx-auto max-w-5xl px-4 py-8">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Partidos</h1>
                    <p className="text-muted">Explora, únete y revisa tu historial</p>
                </div>
                <Link href="/matches/new">
                    <Button size="lg">
                        <PlusCircle size={18} />
                        Nuevo
                    </Button>
                </Link>
            </div>

            {/* Tab Toggle */}
            <div className="mb-6 flex gap-2">
                <button
                    onClick={() => setTab("active")}
                    className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${tab === "active"
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border bg-surface text-muted hover:border-border-hover hover:text-foreground"
                        }`}
                >
                    <Trophy size={16} />
                    Activos ({activeMatches.length})
                </button>
                <button
                    onClick={() => setTab("history")}
                    className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${tab === "history"
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border bg-surface text-muted hover:border-border-hover hover:text-foreground"
                        }`}
                >
                    <Clock size={16} />
                    Historial ({finishedMatches.length})
                </button>
            </div>

            {/* Active Matches Tab */}
            {tab === "active" && (
                <>
                    {activeMatches.length > 0 ? (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {activeMatches.map((match) => {
                                const playerCount = match.match_participants.length;
                                const isFull = playerCount >= match.max_players;
                                const hasJoined = match.match_participants.some((p) => p.user_id === userId);
                                const config = statusConfig[match.status] || statusConfig.open;

                                return (
                                    <Link key={match.id} href={`/matches/${match.id}`} className="group block h-full">
                                        <Card className="h-full transition-all border border-border/80 bg-gradient-to-br from-surface to-surface-hover/30 hover:border-accent/40 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(204,255,0,0.08)]">
                                            <div className="mb-3 flex items-center gap-2">
                                                <span className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.classes}`}>
                                                    {config.icon}
                                                    {config.label}
                                                </span>
                                                {hasJoined && (
                                                    <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                                                        Apuntado
                                                    </span>
                                                )}
                                            </div>
                                            <div className="mb-2 flex items-center gap-2 text-foreground">
                                                <MapPin size={14} className="shrink-0 text-accent" />
                                                <span className="truncate font-medium">{match.location}</span>
                                            </div>
                                            <div className="mb-3 flex items-center gap-2 text-sm text-muted">
                                                <Calendar size={14} className="shrink-0" />
                                                {formatDate(match.date)}
                                            </div>
                                            <div className="flex items-center justify-between border-t border-border/50 bg-black/10 px-6 py-3 -mx-6 -mb-6 mt-3 rounded-b-2xl">
                                                <div className="flex items-center gap-2 text-foreground font-semibold">
                                                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-accent/10">
                                                        <Users size={12} className="text-accent" />
                                                    </div>
                                                    <span>{playerCount}<span className="text-muted/70 font-normal text-xs uppercase tracking-wider ml-1">/ {match.max_players}</span></span>
                                                </div>
                                                <span className={`text-xs font-bold uppercase tracking-wider ${isFull ? "text-red-400" : "text-accent group-hover:scale-105 transition-transform"}`}>
                                                    {isFull ? "Completo" : "Unirse →"}
                                                </span>
                                            </div>
                                        </Card>
                                    </Link>
                                );
                            })}
                        </div>
                    ) : (
                        <Card className="text-center">
                            <p className="mb-2 text-muted">No hay partidos activos.</p>
                            <Link href="/matches/new">
                                <Button variant="outline" size="sm">Crea el primero</Button>
                            </Link>
                        </Card>
                    )}
                </>
            )}

            {/* History Tab */}
            {tab === "history" && (
                <>
                    {/* Stats Summary */}
                    <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                        <Card className="relative overflow-hidden text-center">
                            <p className="text-sm text-muted">Jugados</p>
                            <p className="mt-1 text-3xl font-bold text-foreground">{finishedMatches.length}</p>
                        </Card>
                        <Card className="relative overflow-hidden text-center">
                            <div className="absolute right-3 top-3 text-green-500/20"><TrendingUp size={32} /></div>
                            <p className="text-sm text-muted">Victorias</p>
                            <p className="mt-1 text-3xl font-bold text-green-400">{wins}</p>
                        </Card>
                        <Card className="relative overflow-hidden text-center">
                            <div className="absolute right-3 top-3 text-zinc-500/20"><Minus size={32} /></div>
                            <p className="text-sm text-muted">Empates</p>
                            <p className="mt-1 text-3xl font-bold text-zinc-400">{draws}</p>
                        </Card>
                        <Card className="relative overflow-hidden text-center">
                            <div className="absolute right-3 top-3 text-red-500/20"><TrendingDown size={32} /></div>
                            <p className="text-sm text-muted">Derrotas</p>
                            <p className="mt-1 text-3xl font-bold text-red-400">{losses}</p>
                        </Card>
                    </div>

                    {/* History List */}
                    {finishedMatches.length > 0 ? (
                        <div className="space-y-4">
                            {finishedMatches.map((match) => {
                                const myPart = match.match_participants.find((p) => p.user_id === userId);
                                const myTeam = myPart?.team;
                                const myGoals = myPart?.goals || 0;
                                const myMvp = myPart?.is_mvp || false;
                                const myScore = myTeam === "A" ? match.team_a_score : match.team_b_score;
                                const oppScore = myTeam === "A" ? match.team_b_score : match.team_a_score;
                                let result: "win" | "draw" | "loss" | null = null;
                                if (myScore !== null && oppScore !== null && myTeam) {
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
                                                            <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${config.bg} ${config.text} ${config.border}`}>
                                                                {config.label}
                                                            </span>
                                                        )}
                                                        {myMvp && (
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
                                                        {myGoals > 0 && (
                                                            <span className="flex items-center gap-1 text-accent">
                                                                <Target size={14} />
                                                                {myGoals} gol{myGoals !== 1 ? "es" : ""}
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
                                                            <p className={`text-[9px] uppercase tracking-wider font-bold mb-0.5 ${myTeam === "A" ? "text-accent" : "text-muted"}`}>
                                                                {myTeam === "A" ? "Tú" : "Riv"}
                                                            </p>
                                                            <p className={`text-xl font-bold leading-none ${myTeam === "A" && result === "win" ? "text-accent drop-shadow-[0_0_8px_rgba(204,255,0,0.5)]" : "text-foreground"}`}>
                                                                {myTeam === "A" ? match.team_a_score : match.team_b_score}
                                                            </p>
                                                        </div>
                                                        <span className="text-sm font-bold text-muted/50">-</span>
                                                        <div>
                                                            <p className={`text-[9px] uppercase tracking-wider font-bold mb-0.5 ${myTeam === "B" ? "text-accent" : "text-muted"}`}>
                                                                {myTeam === "B" ? "Tú" : "Riv"}
                                                            </p>
                                                            <p className={`text-xl font-bold leading-none ${myTeam === "B" && result === "win" ? "text-accent drop-shadow-[0_0_8px_rgba(204,255,0,0.5)]" : "text-foreground"}`}>
                                                                {myTeam === "B" ? match.team_a_score : match.team_b_score}
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
                            <div className="py-8">
                                <Trophy size={48} className="mx-auto mb-4 text-muted/30" />
                                <p className="text-lg font-medium text-muted">Aún no has jugado partidos</p>
                                <p className="mt-1 text-sm text-muted/70">
                                    ¡Únete a un partido y complétalo para ver tu historial aquí!
                                </p>
                            </div>
                        </Card>
                    )}
                </>
            )}
        </div>
    );
}
