"use client";

import { useState, useMemo, useTransition } from "react";
import dynamic from "next/dynamic";
import { useToast } from "@/components/ui/Toast";
import {
    joinMatch,
    leaveMatch,
    setScore,
    generateTeams,
    cancelMatch,
    rescheduleMatch,
    kickPlayer,
    markAsPaid,
} from "../actions";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Dialog } from "@/components/ui/Dialog";
// Match components code-split for mobile performance
const SoccerPitch = dynamic(() => import("@/components/SoccerPitch").then((mod) => ({ default: mod.SoccerPitch })), {
    ssr: false,
    loading: () => <div className="mx-auto w-full max-w-xl h-[600px] animate-pulse rounded-2xl bg-surface/50 border border-border"></div>
});
import { formatDate, getAvatarUrl } from "@/lib/utils";

const WeatherWidget = dynamic(
    () => import("@/components/WeatherWidget").then((m) => ({ default: m.WeatherWidget })),
    {
        ssr: false,
        loading: () => (
            <div className="h-20 w-full animate-pulse rounded-lg bg-surface" />
        ),
    }
);

const MatchChat = dynamic(() => import("@/components/MatchChat").then((mod) => ({ default: mod.MatchChat })), {
    loading: () => <div className="py-12 text-center text-sm text-muted">Cargando...</div>,
});
const MatchPhotos = dynamic(() => import("@/components/MatchPhotos").then((mod) => ({ default: mod.MatchPhotos })), {
    loading: () => <div className="py-12 text-center text-sm text-muted">Cargando...</div>,
});
const MvpVoting = dynamic(() => import("@/components/MvpVoting").then((mod) => ({ default: mod.MvpVoting })), {
    loading: () => <div className="py-12 text-center text-sm text-muted">Cargando...</div>,
});
import {
    Calendar,
    MapPin,
    Users,
    Shield,
    Shuffle,
    Trophy,
    LogOut as LeaveIcon,
    UserPlus,
    ChevronDown,
    Copy,
    MessageCircle,
    Camera,
    Share2,
    ExternalLink,

    Ban,
    CalendarClock,
    XCircle,
    X,
    Crown,
    Target,
    CheckCircle2,
    CircleDashed,
} from "lucide-react";
import { POSITION_ICONS, POSITION_SHORT, POSITION_COLORS } from "@/lib/positions";
import type { Match, Profile } from "@/lib/types";

interface Participant {
    match_id: string;
    user_id: string;
    team: "A" | "B" | null;
    goals: number;
    is_mvp: boolean;
    profiles: Profile;
    has_paid: boolean;
}

interface MatchDetailProps {
    match: Match;
    participants: Participant[];
    currentUserId: string;
    organizerName: string;
    organizerAvatarUrl: string | null;
    currentUserProfile: {
        username: string | null;
        avatar_url: string | null;
    };
    isAdmin: boolean;
    adminUserIds: string[];
}

export function MatchDetail({
    match,
    participants,
    currentUserId,
    organizerName,
    organizerAvatarUrl,
    currentUserProfile,
    isAdmin,
    adminUserIds,
}: MatchDetailProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"info" | "chat" | "fotos">("info");
    const [isPending, startTransition] = useTransition();
    const [scoreDialogOpen, setScoreDialogOpen] = useState(false);
    const [teamAScore, setTeamAScore] = useState<number | "">(match.team_a_score ?? 0);
    const [teamBScore, setTeamBScore] = useState<number | "">(match.team_b_score ?? 0);
    const [goalScorers, setGoalScorers] = useState<Record<string, number>>({});
    const [showGoalScorers, setShowGoalScorers] = useState(false);
    const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const [paidState, setPaidState] = useState<Record<string, boolean>>(
        () => Object.fromEntries(participants.map((p) => [p.user_id, p.has_paid]))
    );
    const [newDate, setNewDate] = useState("");

    const isOrganizer = match.created_by === currentUserId;
    const canManage = isAdmin || isOrganizer;
    const hasJoined = participants.some((p) => p.user_id === currentUserId);
    const teamA = participants.filter((p) => p.team === "A");
    const teamB = participants.filter((p) => p.team === "B");
    const unassigned = participants.filter((p) => !p.team);
    const teamsGenerated = teamA.length > 0 || teamB.length > 0;

    const teamAGoalsAssigned = useMemo(
        () => teamA.reduce((sum, p) => sum + (goalScorers[p.user_id] ?? 0), 0),
        [teamA, goalScorers]
    );
    const teamBGoalsAssigned = useMemo(
        () => teamB.reduce((sum, p) => sum + (goalScorers[p.user_id] ?? 0), 0),
        [teamB, goalScorers]
    );

    function setPlayerGoals(userId: string, goals: number) {
        setGoalScorers((prev) => ({ ...prev, [userId]: Math.max(0, goals) }));
    }

    async function handleTogglePaid(userId: string) {
        const current = paidState[userId] ?? false;
        setPaidState((prev) => ({ ...prev, [userId]: !current }));
        const result = await markAsPaid(match.id, userId, !current);
        if (result?.error) {
            setPaidState((prev) => ({ ...prev, [userId]: current }));
            toast(result.error, "error");
        }
    }

    const statusColors: Record<string, string> = {
        open: "bg-accent/10 text-accent border-accent/30",
        closed: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
        finished: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
        cancelled: "bg-red-500/10 text-red-400 border-red-500/30",
    };

    async function handleAction(
        action: () => Promise<{ error?: string; success?: boolean }>,
        key: string,
        successMsg?: string
    ) {
        setLoading(key);
        const result = await action();
        if (result?.error) {
            toast(result.error, "error");
        } else if (successMsg) {
            toast(successMsg, "success");
        }
        setLoading(null);
    }

    async function handleSetScore() {
        setLoading("score");
        const finalA = teamAScore === "" ? 0 : teamAScore;
        const finalB = teamBScore === "" ? 0 : teamBScore;
        const scorers = Object.entries(goalScorers)
            .filter(([, g]) => g > 0)
            .map(([userId, goals]) => ({ userId, goals }));
        const result = await setScore(
            match.id,
            finalA,
            finalB,
            scorers.length > 0 ? scorers : undefined
        );
        if (result?.error) {
            toast(result.error, "error");
        } else {
            toast("¡Partido finalizado! Resultado guardado.", "success");
        }
        setScoreDialogOpen(false);
        setLoading(null);
    }

    return (
        <div className="mx-auto max-w-3xl">
            {/* ── Tab navigation bar ── */}
            <div className="sticky top-16 z-40 flex border-b border-border bg-surface/95 backdrop-blur-xl">
                {(["info", "chat", "fotos"] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => startTransition(() => setActiveTab(tab))}
                        className={`relative flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
                            activeTab === tab ? "text-accent" : "text-muted hover:text-foreground"
                        }`}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        {activeTab === tab && (
                            <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full bg-accent" />
                        )}
                    </button>
                ))}
            </div>

            {/* ── Tab: Info ── */}
            {activeTab === "info" && (
                <div className="px-4 py-6 space-y-6">
                    {/* Match Header */}
                    <Card className="overflow-hidden relative border border-border/80 bg-gradient-to-br from-surface to-surface-hover/50 shadow-xl p-6">
                        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-accent/5 to-transparent pointer-events-none" />
                        <div className="relative z-10 space-y-4">
                            <div className="flex flex-wrap items-center gap-3">
                                <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${statusColors[match.status] || statusColors.open}`}>
                                    {match.status === "cancelled" ? "CANCELADO" : match.status}
                                </span>
                                {isOrganizer && (
                                    <span className="flex items-center gap-1.5 rounded-full bg-purple-500/10 px-3 py-1 text-[11px] font-bold text-purple-400 border border-purple-500/30 uppercase tracking-wider">
                                        <Shield size={12} />
                                        Organizador
                                    </span>
                                )}
                                {isAdmin && (
                                    <span className="flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 text-[11px] font-bold text-red-500 border border-red-500/30 uppercase tracking-wider drop-shadow-[0_0_8px_rgba(239,68,68,0.3)]">
                                        <Crown size={12} />
                                        Admin
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-lg text-foreground mt-2">
                                <div className="flex items-center gap-2">
                                    <MapPin size={22} className="text-accent drop-shadow-[0_0_8px_rgba(204,255,0,0.5)]" />
                                    <h1 className="text-3xl font-bold tracking-tight">{match.location}</h1>
                                </div>
                                <WeatherWidget date={match.date} />
                            </div>
                            <div className="flex flex-wrap items-center gap-5 text-sm text-muted/90 font-medium">
                                <span className="flex items-center gap-2 bg-black/20 rounded-lg px-3 py-1.5 border border-border/50">
                                    <Calendar size={16} className="text-accent" />
                                    {formatDate(match.date)}
                                </span>
                                <span className="flex items-center gap-2 bg-black/20 rounded-lg px-3 py-1.5 border border-border/50">
                                    <Users size={16} className="text-accent" />
                                    {participants.length}/{match.max_players} jugadores
                                </span>
                                <Link href={`/players/${match.created_by}`} className="flex items-center gap-2 bg-surface hover:bg-surface-hover/80 transition-colors rounded-full pl-1.5 pr-4 py-1 border border-border/50 group">
                                    <Avatar
                                        src={getAvatarUrl(process.env.NEXT_PUBLIC_SUPABASE_URL!, organizerAvatarUrl)}
                                        fallback={organizerName}
                                        size="sm"
                                        className="h-6 w-6 ring-2 ring-purple-500/30 group-hover:ring-purple-500/60 transition-all"
                                    />
                                    <div className="flex flex-col">
                                        <span className="text-[9px] uppercase tracking-wider text-muted group-hover:text-purple-400 transition-colors leading-[10px]">Organiza</span>
                                        <span className="text-xs font-bold text-foreground leading-[14px]">{organizerName}</span>
                                    </div>
                                </Link>
                            </div>
                            {/* Progress bar */}
                            <div>
                                <div className="h-1.5 overflow-hidden rounded-full bg-surface-hover">
                                    <div
                                        className="h-full rounded-full bg-accent transition-all"
                                        style={{ width: `${Math.min((participants.length / match.max_players) * 100, 100)}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Share Buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={() => {
                                const url = `${window.location.origin}/matches/${match.id}`;
                                navigator.clipboard.writeText(url);
                                toast("¡Enlace copiado!", "success");
                            }}
                            className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-medium text-muted transition-all hover:border-accent hover:text-accent"
                        >
                            <Copy size={14} />
                            Copiar enlace
                        </button>
                        <a
                            href={`https://wa.me/?text=${encodeURIComponent(`¡Únete a la pachanga!\n${match.location}\n${formatDate(match.date)}\n→ ${typeof window !== "undefined" ? window.location.origin : ""}/matches/${match.id}`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs font-medium text-green-400 transition-all hover:bg-green-500/20"
                        >
                            <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.019-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                            WhatsApp
                        </a>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-3">
                        {match.status === "open" && !hasJoined && (
                            <Button
                                size="lg"
                                loading={loading === "join"}
                                onClick={() => handleAction(() => joinMatch(match.id), "join", "¡Te has unido al partido!")}
                            >
                                <UserPlus size={18} />
                                Unirse
                            </Button>
                        )}
                        {match.status === "open" && hasJoined && !isOrganizer && !isAdmin && (
                            <Button
                                variant="outline"
                                size="lg"
                                loading={loading === "leave"}
                                onClick={() => handleAction(() => leaveMatch(match.id), "leave", "Has salido del partido")}
                            >
                                <LeaveIcon size={18} />
                                Salir
                            </Button>
                        )}
                        {canManage && match.status === "open" && (
                            <Button
                                variant="outline"
                                size="lg"
                                loading={loading === "generate"}
                                onClick={() => handleAction(() => generateTeams(match.id), "generate", "¡Equipos generados!")}
                            >
                                <Shuffle size={18} />
                                Generar Equipos
                            </Button>
                        )}
                        {canManage && teamsGenerated && match.status !== "finished" && match.status !== "cancelled" && (
                            <Button variant="outline" size="lg" onClick={() => setScoreDialogOpen(true)}>
                                <Trophy size={18} />
                                Poner Resultado
                            </Button>
                        )}
                        {canManage && match.status !== "finished" && match.status !== "cancelled" && (
                            <Button variant="outline" size="lg" onClick={() => setRescheduleDialogOpen(true)}>
                                <CalendarClock size={18} />
                                Cambiar Fecha
                            </Button>
                        )}
                        {canManage && match.status !== "finished" && match.status !== "cancelled" && (
                            <Button variant="danger" size="lg" onClick={() => setCancelDialogOpen(true)}>
                                <Ban size={18} />
                                Cancelar Partido
                            </Button>
                        )}
                        {canManage && match.status === "finished" && (
                            <Link href={`/matches/new?location=${encodeURIComponent(match.location)}&max_players=${match.max_players}`}>
                                <Button variant="outline" size="lg">
                                    <Copy size={18} />
                                    Repetir Partido
                                </Button>
                            </Link>
                        )}
                    </div>

                    {canManage && match.status === "open" && participants.length > 0 && (
                        <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-surface px-4 py-2.5 text-sm">
                            <CheckCircle2 size={16} className="text-[#ccff00]" />
                            <span className="text-muted">
                                <span className="font-bold text-foreground">
                                    {Object.values(paidState).filter(Boolean).length}
                                </span>
                                {" / "}
                                <span className="font-bold text-foreground">{participants.length}</span>
                                {" pagados"}
                            </span>
                        </div>
                    )}

                    {/* Score Display */}
                    {match.status === "finished" && match.team_a_score !== null && match.team_b_score !== null && (
                        <Card className="border-accent/20 bg-accent/5">
                            <div className="flex items-center justify-center gap-8 text-center">
                                <div>
                                    <p className="text-sm font-medium text-accent">Equipo Rojo</p>
                                    <p className="text-5xl font-bold text-foreground">{match.team_a_score}</p>
                                </div>
                                <div className="text-2xl text-muted">vs</div>
                                <div>
                                    <p className="text-sm font-medium text-blue-400">Equipo Azul</p>
                                    <p className="text-5xl font-bold text-foreground">{match.team_b_score}</p>
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Terreno de juego o lista de jugadores */}
                    {teamsGenerated ? (
                        <>
                            <SoccerPitch teamA={teamA} teamB={teamB} />
                            {unassigned.length > 0 && (
                                <Card className="mt-6">
                                    <CardHeader>
                                        <CardTitle>Sin Equipo ({unassigned.length})</CardTitle>
                                    </CardHeader>
                                    <div className="space-y-3">
                                        {unassigned.map((p) => (
                                            <PlayerRow
                                                key={p.user_id}
                                                participant={p}
                                                adminUserIds={adminUserIds}
                                                organizerId={match.created_by}
                                                showPaid={match.status === "open"}
                                                isPaid={paidState[p.user_id] ?? false}
                                                onTogglePaid={
                                                    canManage && match.status === "open"
                                                        ? () => handleTogglePaid(p.user_id)
                                                        : undefined
                                                }
                                                onKick={
                                                    isAdmin && match.status === "open" && p.user_id !== currentUserId
                                                        ? async () => {
                                                            const result = await kickPlayer(match.id, p.user_id);
                                                            if (result?.error) toast(result.error, "error");
                                                            else toast(`${p.profiles?.username || "Jugador"} expulsado`, "success");
                                                        }
                                                        : undefined
                                                }
                                            />
                                        ))}
                                    </div>
                                </Card>
                            )}
                        </>
                    ) : (
                        <Card>
                            <CardHeader>
                                <CardTitle>
                                    <Users size={18} className="inline mr-2" />
                                    Jugadores ({participants.length})
                                </CardTitle>
                            </CardHeader>
                            <div className="space-y-3">
                                {participants.map((p) => (
                                    <PlayerRow
                                        key={p.user_id}
                                        participant={p}
                                        adminUserIds={adminUserIds}
                                        organizerId={match.created_by}
                                        showPaid={match.status === "open"}
                                        isPaid={paidState[p.user_id] ?? false}
                                        onTogglePaid={
                                            canManage && match.status === "open"
                                                ? () => handleTogglePaid(p.user_id)
                                                : undefined
                                        }
                                        onKick={
                                            isAdmin && match.status === "open" && p.user_id !== currentUserId
                                                ? async () => {
                                                    const result = await kickPlayer(match.id, p.user_id);
                                                    if (result?.error) toast(result.error, "error");
                                                    else toast(`${p.profiles?.username || "Jugador"} expulsado`, "success");
                                                }
                                                : undefined
                                        }
                                    />
                                ))}
                                {participants.length === 0 && (
                                    <p className="py-4 text-center text-muted">No hay jugadores aún. ¡Sé el primero en unirte!</p>
                                )}
                            </div>
                        </Card>
                    )}
                </div>
            )}

            {/* ── Tab: Chat ── */}
            {activeTab === "chat" && (
                <div className="px-4 py-6">
                    <MatchChat
                        matchId={match.id}
                        currentUserId={currentUserId}
                        currentUserProfile={currentUserProfile}
                    />
                </div>
            )}

            {/* ── Tab: Fotos ── */}
            {activeTab === "fotos" && (
                <div className="px-4 py-6 space-y-6">
                    <MatchPhotos
                        matchId={match.id}
                        currentUserId={currentUserId}
                    />
                    {match.status === "finished" && (
                        <MvpVoting
                            matchId={match.id}
                            currentUserId={currentUserId}
                            participants={participants}
                            matchFinishedAt={match.finished_at}
                            matchDate={match.date}
                            canManage={canManage}
                        />
                    )}
                </div>
            )}

            {/* ── Dialogs (always mounted, tab-independent) ── */}

            {/* Score Dialog */}
            <Dialog open={scoreDialogOpen} onClose={() => setScoreDialogOpen(false)} title="Poner Resultado" className="max-w-lg">
                <div className="space-y-6">
                    <div className="flex items-center justify-center gap-6">
                        <div className="text-center">
                            <p className="mb-2 text-sm font-medium text-accent">Equipo Rojo</p>
                            <input
                                type="number"
                                min="0"
                                value={teamAScore}
                                onChange={(e) => { const val = e.target.value; setTeamAScore(val === "" ? "" : parseInt(val) || 0); }}
                                onFocus={(e) => e.target.select()}
                                className="w-20 rounded-xl border border-border bg-zinc-800 px-3 py-3 text-center text-2xl font-bold text-foreground focus:border-accent focus:outline-none"
                            />
                        </div>
                        <span className="text-xl text-muted">vs</span>
                        <div className="text-center">
                            <p className="mb-2 text-sm font-medium text-blue-400">Equipo Azul</p>
                            <input
                                type="number"
                                min="0"
                                value={teamBScore}
                                onChange={(e) => { const val = e.target.value; setTeamBScore(val === "" ? "" : parseInt(val) || 0); }}
                                onFocus={(e) => e.target.select()}
                                className="w-20 rounded-xl border border-border bg-zinc-800 px-3 py-3 text-center text-2xl font-bold text-foreground focus:border-accent focus:outline-none"
                            />
                        </div>
                    </div>
                    {teamsGenerated && ((teamAScore || 0) > 0 || (teamBScore || 0) > 0) && (
                        <div className="rounded-xl border border-border bg-zinc-900/50">
                            <button type="button" onClick={() => setShowGoalScorers(!showGoalScorers)} className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-muted transition-colors hover:text-foreground">
                                <span>Asignar goleadores (opcional)</span>
                                <ChevronDown size={16} className={`transition-transform duration-200 ${showGoalScorers ? "rotate-180" : ""}`} />
                            </button>
                            {showGoalScorers && (
                                <div className="space-y-4 border-t border-border px-4 py-4">
                                    {teamA.length > 0 && (
                                        <div>
                                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-accent">
                                                Equipo Rojo{teamAGoalsAssigned !== teamAScore && (<span className="ml-2 font-normal normal-case text-yellow-400">({teamAGoalsAssigned}/{teamAScore} asignados)</span>)}
                                            </p>
                                            <div className="space-y-2">
                                                {teamA.map((p) => (
                                                    <div key={p.user_id} className="flex items-center justify-between rounded-lg bg-zinc-800/60 px-3 py-2">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <Avatar src={getAvatarUrl(process.env.NEXT_PUBLIC_SUPABASE_URL!, p.profiles?.avatar_url ?? null)} fallback={p.profiles?.username || "P"} size="sm" />
                                                            <span className="text-sm text-foreground truncate">{p.profiles?.username || "Desconocido"}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <button type="button" onClick={() => setPlayerGoals(p.user_id, (goalScorers[p.user_id] ?? 0) - 1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-700 text-sm text-muted transition-colors hover:bg-zinc-600 hover:text-foreground">−</button>
                                                            <span className="w-8 text-center text-sm font-bold text-foreground">{goalScorers[p.user_id] ?? 0}</span>
                                                            <button type="button" onClick={() => setPlayerGoals(p.user_id, (goalScorers[p.user_id] ?? 0) + 1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-700 text-sm text-muted transition-colors hover:bg-zinc-600 hover:text-foreground">+</button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {teamB.length > 0 && (
                                        <div>
                                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-blue-400">
                                                Equipo Azul{teamBGoalsAssigned !== teamBScore && (<span className="ml-2 font-normal normal-case text-yellow-400">({teamBGoalsAssigned}/{teamBScore} asignados)</span>)}
                                            </p>
                                            <div className="space-y-2">
                                                {teamB.map((p) => (
                                                    <div key={p.user_id} className="flex items-center justify-between rounded-lg bg-zinc-800/60 px-3 py-2">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <Avatar src={getAvatarUrl(process.env.NEXT_PUBLIC_SUPABASE_URL!, p.profiles?.avatar_url ?? null)} fallback={p.profiles?.username || "P"} size="sm" />
                                                            <span className="text-sm text-foreground truncate">{p.profiles?.username || "Desconocido"}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <button type="button" onClick={() => setPlayerGoals(p.user_id, (goalScorers[p.user_id] ?? 0) - 1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-700 text-sm text-muted transition-colors hover:bg-zinc-600 hover:text-foreground">−</button>
                                                            <span className="w-8 text-center text-sm font-bold text-foreground">{goalScorers[p.user_id] ?? 0}</span>
                                                            <button type="button" onClick={() => setPlayerGoals(p.user_id, (goalScorers[p.user_id] ?? 0) + 1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-700 text-sm text-muted transition-colors hover:bg-zinc-600 hover:text-foreground">+</button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                    <Button onClick={handleSetScore} loading={loading === "score"} size="lg" className="w-full">
                        Guardar Resultado y Finalizar
                    </Button>
                </div>
            </Dialog>

            {/* Reschedule Dialog */}
            <Dialog open={rescheduleDialogOpen} onClose={() => setRescheduleDialogOpen(false)} title="Cambiar Fecha y Hora" className="max-w-md">
                <div className="space-y-4">
                    <input
                        type="datetime-local"
                        value={newDate}
                        onChange={(e) => setNewDate(e.target.value)}
                        className="block w-full min-w-0 appearance-none rounded-xl border border-border bg-zinc-800 px-2 py-3 sm:px-4 text-base text-foreground transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent [color-scheme:dark]"
                    />
                    <Button
                        onClick={async () => {
                            if (!newDate) { toast("Selecciona una fecha", "error"); return; }
                            setLoading("reschedule");
                            const isoString = new Date(newDate).toISOString();
                            const result = await rescheduleMatch(match.id, isoString);
                            if (result?.error) toast(result.error, "error");
                            else toast("¡Fecha actualizada!", "success");
                            setRescheduleDialogOpen(false);
                            setLoading(null);
                        }}
                        loading={loading === "reschedule"}
                        size="lg"
                        className="w-full"
                    >
                        Confirmar Nueva Fecha
                    </Button>
                </div>
            </Dialog>

            {/* Cancel Dialog */}
            <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)} title="¿Cancelar Partido?" className="max-w-md">
                <div className="space-y-4">
                    <p className="text-sm text-muted">Esta acción es irreversible. Todos los jugadores serán notificados.</p>
                    <div className="flex gap-3">
                        <Button variant="outline" size="lg" className="flex-1" onClick={() => setCancelDialogOpen(false)}>Volver</Button>
                        <Button
                            variant="danger"
                            size="lg"
                            className="flex-1"
                            loading={loading === "cancel"}
                            onClick={async () => {
                                setLoading("cancel");
                                const result = await cancelMatch(match.id);
                                if (result?.error) toast(result.error, "error");
                                else toast("Partido cancelado", "success");
                                setCancelDialogOpen(false);
                                setLoading(null);
                            }}
                        >
                            Sí, Cancelar
                        </Button>
                    </div>
                </div>
            </Dialog>
        </div>
    );
}

function TeamCard({
    team,
    players,
    color,
    adminUserIds,
    organizerId,
}: {
    team: "A" | "B";
    players: Participant[];
    color: string;
    adminUserIds: string[];
    organizerId: string;
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    <span className={`text-${color}`}>{team === "A" ? "Equipo Rojo" : "Equipo Azul"}</span>
                </CardTitle>
            </CardHeader>
            <div className="space-y-3">
                {players.map((p) => (
                    <PlayerRow key={p.user_id} participant={p} adminUserIds={adminUserIds} organizerId={organizerId} />
                ))}
                {players.length === 0 && (
                    <p className="text-center text-sm text-muted">No players</p>
                )}
            </div>
        </Card>
    );
}

function PlayerRow({
    participant,
    adminUserIds,
    organizerId,
    onKick,
    showPaid,
    isPaid,
    onTogglePaid,
}: {
    participant: Participant;
    adminUserIds?: string[];
    organizerId?: string;
    onKick?: () => void;
    showPaid?: boolean;
    isPaid?: boolean;
    onTogglePaid?: () => Promise<void>;
}) {
    const [kicking, setKicking] = useState(false);
    const [toggling, setToggling] = useState(false);
    const profile = participant.profiles;
    const avatarUrl = getAvatarUrl(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        profile?.avatar_url ?? null
    );

    return (
        <div className="group flex items-center gap-3 rounded-xl border border-border/50 bg-gradient-to-br from-surface to-surface-hover/30 px-3 py-2 transition-all hover:border-accent/40 hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(204,255,0,0.05)]">
            <div className="relative">
                <Avatar
                    src={avatarUrl}
                    fallback={profile?.username || "P"}
                    size="sm"
                />
                <div className="absolute inset-0 rounded-full ring-2 ring-border ring-offset-2 ring-offset-surface transition-all group-hover:ring-accent/50"></div>
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-foreground truncate">
                        {profile?.username || "Desconocido"}
                    </p>
                    {adminUserIds?.includes(participant.user_id) && (
                        <span className="shrink-0 flex items-center gap-0.5 rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
                            <Crown size={9} />
                            Admin
                        </span>
                    )}
                    {organizerId === participant.user_id && (
                        <span className="shrink-0 flex items-center gap-0.5 rounded-full bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-medium text-purple-400">
                            <Shield size={9} />
                            Organizador
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                    {profile?.position && (
                        <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase border ${POSITION_COLORS[profile.position] || "text-muted"}`}>
                            {POSITION_ICONS[profile.position]}
                            {POSITION_SHORT[profile.position] || profile.position}
                        </span>
                    )}
                </div>
            </div>
            {showPaid && (
                onTogglePaid ? (
                    <button
                        onClick={async () => {
                            setToggling(true);
                            await onTogglePaid();
                            setToggling(false);
                        }}
                        disabled={toggling}
                        title={isPaid ? "Marcar como no pagado" : "Marcar como pagado"}
                        className={`flex h-6 items-center gap-1 rounded-full border px-1.5 transition-all disabled:opacity-50 ${
                            isPaid
                                ? "border-[#ccff00]/30 bg-[#ccff00]/10 text-[#ccff00] hover:bg-[#ccff00]/20"
                                : "border-border bg-surface-hover text-muted hover:border-[#ccff00]/40 hover:text-[#ccff00]/70"
                        }`}
                    >
                        {isPaid
                            ? <CheckCircle2 size={12} />
                            : <CircleDashed size={12} />
                        }
                    </button>
                ) : (
                    <div
                        title={isPaid ? "Pagado" : "Pendiente de pago"}
                        className={`flex h-6 items-center gap-1 rounded-full border px-1.5 ${
                            isPaid
                                ? "border-[#ccff00]/30 bg-[#ccff00]/10 text-[#ccff00]"
                                : "border-border bg-surface-hover text-muted"
                        }`}
                    >
                        {isPaid
                            ? <CheckCircle2 size={12} />
                            : <CircleDashed size={12} />
                        }
                    </div>
                )
            )}
            {participant.goals > 0 && (
                <div className="flex flex-col items-center justify-center h-6 min-w-[24px] rounded-full bg-accent/10 border border-accent/20 px-1.5">
                    <span className="text-[10px] font-bold text-accent">
                        ×{participant.goals} <Target size={8} className="inline ml-0.5 mb-0.5" />
                    </span>
                </div>
            )}
            {participant.is_mvp && (
                <div className="flex flex-col items-center justify-center h-6 min-w-[24px] rounded-full bg-yellow-500/10 border border-yellow-500/20 px-1.5">
                    <span className="text-[10px] font-bold text-yellow-400">
                        MVP <Crown size={9} className="inline ml-0.5 mb-0.5" />
                    </span>
                </div>
            )}
            {onKick && (
                <button
                    onClick={async () => {
                        setKicking(true);
                        await onKick();
                        setKicking(false);
                    }}
                    disabled={kicking}
                    className="ml-1 flex h-6 w-6 items-center justify-center rounded-full text-red-400 transition-colors hover:bg-red-500/20 hover:text-red-300 disabled:opacity-50"
                    title={`Expulsar a ${profile?.username || "jugador"}`}
                >
                    <XCircle size={14} />
                </button>
            )}
        </div>
    );
}
