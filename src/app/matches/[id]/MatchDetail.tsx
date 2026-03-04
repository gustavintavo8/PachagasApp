"use client";

import { useState, useMemo } from "react";
import { useToast } from "@/components/ui/Toast";
import {
    joinMatch,
    leaveMatch,
    closeMatch,
    setScore,
    generateTeams,
    cancelMatch,
    rescheduleMatch,
    kickPlayer,
} from "../actions";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Dialog } from "@/components/ui/Dialog";
import { SoccerPitch } from "@/components/SoccerPitch";
import { MatchChat } from "@/components/MatchChat";
import { MatchPhotos } from "@/components/MatchPhotos";
import { PlayerRating } from "@/components/PlayerRating";
import { formatDate, getAvatarUrl } from "@/lib/utils";
import {
    Calendar,
    MapPin,
    Users,
    Shield,
    Shuffle,
    Lock,
    Trophy,
    LogOut as LeaveIcon,
    UserPlus,
    ChevronDown,
    Copy,
    MessageCircle,
    Camera,
    Share2,
    ExternalLink,
    Star,
    Ban,
    CalendarClock,
    XCircle,
    X,
    Crown,
} from "lucide-react";
import type { Match, Profile } from "@/lib/types";

interface Participant {
    match_id: string;
    user_id: string;
    team: "A" | "B" | null;
    goals: number;
    is_mvp: boolean;
    profiles: Profile;
}

interface MatchDetailProps {
    match: Match;
    participants: Participant[];
    currentUserId: string;
    organizerName: string;
    currentUserProfile: {
        username: string | null;
        avatar_url: string | null;
    };
    isAdmin: boolean;
}

export function MatchDetail({
    match,
    participants,
    currentUserId,
    organizerName,
    currentUserProfile,
    isAdmin,
}: MatchDetailProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"chat" | "photos" | "rating">("chat");
    const [scoreDialogOpen, setScoreDialogOpen] = useState(false);
    const [teamAScore, setTeamAScore] = useState(match.team_a_score ?? 0);
    const [teamBScore, setTeamBScore] = useState(match.team_b_score ?? 0);
    const [goalScorers, setGoalScorers] = useState<Record<string, number>>({});
    const [showGoalScorers, setShowGoalScorers] = useState(false);
    const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
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
        const scorers = Object.entries(goalScorers)
            .filter(([, g]) => g > 0)
            .map(([userId, goals]) => ({ userId, goals }));
        const result = await setScore(
            match.id,
            teamAScore,
            teamBScore,
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
        <div className="mx-auto max-w-3xl px-4 py-8">
            {/* Match Header */}
            <div className="mb-6">
                <div className="mb-3 flex items-center gap-3">
                    <span
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${statusColors[match.status] || statusColors.open}`}
                    >
                        {match.status === "cancelled" ? "CANCELADO" : match.status.toUpperCase()}
                    </span>
                    {isOrganizer && (
                        <span className="flex items-center gap-1 rounded-full bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-400 border border-purple-500/30">
                            <Shield size={12} />
                            Organizador
                        </span>
                    )}
                    {isAdmin && (
                        <span className="flex items-center gap-1 rounded-full bg-red-500/10 px-3 py-1 text-xs font-medium text-red-400 border border-red-500/30">
                            <Crown size={12} />
                            Admin
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2 text-lg text-foreground">
                    <MapPin size={18} className="text-accent" />
                    <h1 className="text-2xl font-bold">{match.location}</h1>
                </div>

                <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted">
                    <span className="flex items-center gap-1.5">
                        <Calendar size={14} />
                        {formatDate(match.date)}
                    </span>
                    <span className="flex items-center gap-1.5">
                        <Users size={14} />
                        {participants.length}/{match.max_players} jugadores
                    </span>
                    <span>por {organizerName}</span>
                </div>
            </div>
            {/* Share Buttons */}
            <div className="mb-6 flex flex-wrap items-center gap-2">
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
                    href={`https://wa.me/?text=${encodeURIComponent(`¡Únete a la pachanga! 🏟️\n📍 ${match.location}\n📅 ${formatDate(match.date)}\n👉 ${typeof window !== "undefined" ? window.location.origin : ""}/matches/${match.id}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs font-medium text-green-400 transition-all hover:bg-green-500/20"
                >
                    <ExternalLink size={14} />
                    WhatsApp
                </a>
                <a
                    href={`https://t.me/share/url?url=${encodeURIComponent(`${typeof window !== "undefined" ? window.location.origin : ""}/matches/${match.id}`)}&text=${encodeURIComponent(`¡Únete a la pachanga! 🏟️ ${match.location} — ${formatDate(match.date)}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-400 transition-all hover:bg-blue-500/20"
                >
                    <ExternalLink size={14} />
                    Telegram
                </a>
            </div>

            {/* Action Buttons */}
            <div className="mb-8 flex flex-wrap gap-3">
                {/* Player actions */}
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

                {/* Organizer / Admin actions */}
                {(canManage) && match.status === "open" && (
                    <>
                        <Button
                            variant="outline"
                            size="lg"
                            loading={loading === "generate"}
                            onClick={() =>
                                handleAction(() => generateTeams(match.id), "generate", "¡Equipos generados!")
                            }
                        >
                            <Shuffle size={18} />
                            Generar Equipos
                        </Button>
                        <Button
                            variant="danger"
                            size="lg"
                            loading={loading === "close"}
                            onClick={() =>
                                handleAction(() => closeMatch(match.id), "close", "Partido cerrado")
                            }
                        >
                            <Lock size={18} />
                            Cerrar Partido
                        </Button>
                    </>
                )}
                {(canManage) &&
                    (match.status === "closed" || match.status === "open") && (
                        <Button
                            variant="outline"
                            size="lg"
                            onClick={() => setScoreDialogOpen(true)}
                        >
                            <Trophy size={18} />
                            Poner Resultado
                        </Button>
                    )}

                {/* Reschedule — admin or organizer, only on active matches */}
                {canManage && match.status !== "finished" && match.status !== "cancelled" && (
                    <Button
                        variant="outline"
                        size="lg"
                        onClick={() => setRescheduleDialogOpen(true)}
                    >
                        <CalendarClock size={18} />
                        Cambiar Fecha
                    </Button>
                )}

                {/* Cancel — admin or organizer, only on active matches */}
                {canManage && match.status !== "finished" && match.status !== "cancelled" && (
                    <Button
                        variant="danger"
                        size="lg"
                        onClick={() => setCancelDialogOpen(true)}
                    >
                        <Ban size={18} />
                        Cancelar Partido
                    </Button>
                )}

                {(canManage) && match.status === "finished" && (
                    <Link href={`/matches/new?location=${encodeURIComponent(match.location)}&max_players=${match.max_players}`}>
                        <Button variant="outline" size="lg">
                            <Copy size={18} />
                            Repetir Partido
                        </Button>
                    </Link>
                )}
            </div>

            {/* Score Display */}
            {match.status === "finished" &&
                match.team_a_score !== null &&
                match.team_b_score !== null && (
                    <Card className="mb-8 border-accent/20 bg-accent/5">
                        <div className="flex items-center justify-center gap-8 text-center">
                            <div>
                                <p className="text-sm font-medium text-accent">Team A</p>
                                <p className="text-5xl font-bold text-foreground">
                                    {match.team_a_score}
                                </p>
                            </div>
                            <div className="text-2xl text-muted">vs</div>
                            <div>
                                <p className="text-sm font-medium text-blue-400">Team B</p>
                                <p className="text-5xl font-bold text-foreground">
                                    {match.team_b_score}
                                </p>
                            </div>
                        </div>
                    </Card>
                )}

            {/* Teams Display */}
            {teamsGenerated ? (
                <SoccerPitch teamA={teamA} teamB={teamB} />
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>
                            <Users size={18} className="inline mr-2" />
                            Players ({participants.length})
                        </CardTitle>
                    </CardHeader>
                    <div className="space-y-3">
                        {participants.map((p) => (
                            <PlayerRow
                                key={p.user_id}
                                participant={p}
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
                            <p className="py-4 text-center text-muted">
                                No players yet. Be the first to join!
                            </p>
                        )}
                    </div>
                </Card>
            )}

            {/* Unassigned players */}
            {teamsGenerated && unassigned.length > 0 && (
                <Card className="mt-6">
                    <CardHeader>
                        <CardTitle>Unassigned ({unassigned.length})</CardTitle>
                    </CardHeader>
                    <div className="space-y-3">
                        {unassigned.map((p) => (
                            <PlayerRow
                                key={p.user_id}
                                participant={p}
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

            {/* Chat & Photos Tabs */}
            <div className="mt-8">
                <div className="mb-4 flex gap-2">
                    <button
                        onClick={() => setActiveTab("chat")}
                        className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${activeTab === "chat"
                            ? "border-accent bg-accent/10 text-accent"
                            : "border-border bg-surface text-muted hover:border-border-hover hover:text-foreground"
                            }`}
                    >
                        <MessageCircle size={16} />
                        Chat
                    </button>
                    <button
                        onClick={() => setActiveTab("photos")}
                        className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${activeTab === "photos"
                            ? "border-accent bg-accent/10 text-accent"
                            : "border-border bg-surface text-muted hover:border-border-hover hover:text-foreground"
                            }`}
                    >
                        <Camera size={16} />
                        Fotos
                    </button>
                    {match.status === "finished" && (
                        <button
                            onClick={() => setActiveTab("rating")}
                            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${activeTab === "rating"
                                ? "border-yellow-400 bg-yellow-400/10 text-yellow-400"
                                : "border-border bg-surface text-muted hover:border-border-hover hover:text-foreground"
                                }`}
                        >
                            <Star size={16} />
                            Valorar
                        </button>
                    )}
                </div>

                {activeTab === "chat" ? (
                    <MatchChat
                        matchId={match.id}
                        currentUserId={currentUserId}
                        currentUserProfile={currentUserProfile}
                    />
                ) : activeTab === "photos" ? (
                    <MatchPhotos
                        matchId={match.id}
                        currentUserId={currentUserId}
                    />
                ) : (
                    <PlayerRating
                        matchId={match.id}
                        currentUserId={currentUserId}
                        participants={participants}
                    />
                )}
            </div>

            {/* Score Dialog */}
            <Dialog
                open={scoreDialogOpen}
                onClose={() => setScoreDialogOpen(false)}
                title="Set Final Score"
                className="max-w-lg"
            >
                <div className="space-y-6">
                    <div className="flex items-center justify-center gap-6">
                        <div className="text-center">
                            <p className="mb-2 text-sm font-medium text-accent">Team A</p>
                            <input
                                type="number"
                                min="0"
                                value={teamAScore}
                                onChange={(e) => setTeamAScore(parseInt(e.target.value) || 0)}
                                className="w-20 rounded-xl border border-border bg-zinc-800 px-3 py-3 text-center text-2xl font-bold text-foreground focus:border-accent focus:outline-none"
                            />
                        </div>
                        <span className="text-xl text-muted">vs</span>
                        <div className="text-center">
                            <p className="mb-2 text-sm font-medium text-blue-400">Team B</p>
                            <input
                                type="number"
                                min="0"
                                value={teamBScore}
                                onChange={(e) => setTeamBScore(parseInt(e.target.value) || 0)}
                                className="w-20 rounded-xl border border-border bg-zinc-800 px-3 py-3 text-center text-2xl font-bold text-foreground focus:border-accent focus:outline-none"
                            />
                        </div>
                    </div>

                    {/* Optional goal scorers section */}
                    {teamsGenerated && (teamAScore > 0 || teamBScore > 0) && (
                        <div className="rounded-xl border border-border bg-zinc-900/50">
                            <button
                                type="button"
                                onClick={() => setShowGoalScorers(!showGoalScorers)}
                                className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-muted transition-colors hover:text-foreground"
                            >
                                <span>⚽ Asignar goleadores (opcional)</span>
                                <ChevronDown
                                    size={16}
                                    className={`transition-transform duration-200 ${showGoalScorers ? "rotate-180" : ""
                                        }`}
                                />
                            </button>

                            {showGoalScorers && (
                                <div className="space-y-4 border-t border-border px-4 py-4">
                                    {/* Team A scorers */}
                                    {teamA.length > 0 && (
                                        <div>
                                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-accent">
                                                Team A
                                                {teamAGoalsAssigned !== teamAScore && (
                                                    <span className="ml-2 font-normal normal-case text-yellow-400">
                                                        ({teamAGoalsAssigned}/{teamAScore} asignados)
                                                    </span>
                                                )}
                                            </p>
                                            <div className="space-y-2">
                                                {teamA.map((p) => (
                                                    <div
                                                        key={p.user_id}
                                                        className="flex items-center justify-between rounded-lg bg-zinc-800/60 px-3 py-2"
                                                    >
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <Avatar
                                                                src={getAvatarUrl(
                                                                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                                                                    p.profiles?.avatar_url ?? null
                                                                )}
                                                                fallback={p.profiles?.username || "P"}
                                                                size="sm"
                                                            />
                                                            <span className="text-sm text-foreground truncate">
                                                                {p.profiles?.username || "Unknown"}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    setPlayerGoals(
                                                                        p.user_id,
                                                                        (goalScorers[p.user_id] ?? 0) - 1
                                                                    )
                                                                }
                                                                className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-700 text-sm text-muted transition-colors hover:bg-zinc-600 hover:text-foreground"
                                                            >
                                                                −
                                                            </button>
                                                            <span className="w-8 text-center text-sm font-bold text-foreground">
                                                                {goalScorers[p.user_id] ?? 0}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    setPlayerGoals(
                                                                        p.user_id,
                                                                        (goalScorers[p.user_id] ?? 0) + 1
                                                                    )
                                                                }
                                                                className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-700 text-sm text-muted transition-colors hover:bg-zinc-600 hover:text-foreground"
                                                            >
                                                                +
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Team B scorers */}
                                    {teamB.length > 0 && (
                                        <div>
                                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-blue-400">
                                                Team B
                                                {teamBGoalsAssigned !== teamBScore && (
                                                    <span className="ml-2 font-normal normal-case text-yellow-400">
                                                        ({teamBGoalsAssigned}/{teamBScore} asignados)
                                                    </span>
                                                )}
                                            </p>
                                            <div className="space-y-2">
                                                {teamB.map((p) => (
                                                    <div
                                                        key={p.user_id}
                                                        className="flex items-center justify-between rounded-lg bg-zinc-800/60 px-3 py-2"
                                                    >
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <Avatar
                                                                src={getAvatarUrl(
                                                                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                                                                    p.profiles?.avatar_url ?? null
                                                                )}
                                                                fallback={p.profiles?.username || "P"}
                                                                size="sm"
                                                            />
                                                            <span className="text-sm text-foreground truncate">
                                                                {p.profiles?.username || "Unknown"}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    setPlayerGoals(
                                                                        p.user_id,
                                                                        (goalScorers[p.user_id] ?? 0) - 1
                                                                    )
                                                                }
                                                                className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-700 text-sm text-muted transition-colors hover:bg-zinc-600 hover:text-foreground"
                                                            >
                                                                −
                                                            </button>
                                                            <span className="w-8 text-center text-sm font-bold text-foreground">
                                                                {goalScorers[p.user_id] ?? 0}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    setPlayerGoals(
                                                                        p.user_id,
                                                                        (goalScorers[p.user_id] ?? 0) + 1
                                                                    )
                                                                }
                                                                className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-700 text-sm text-muted transition-colors hover:bg-zinc-600 hover:text-foreground"
                                                            >
                                                                +
                                                            </button>
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

                    <Button
                        onClick={handleSetScore}
                        loading={loading === "score"}
                        size="lg"
                        className="w-full"
                    >
                        Save Score & Finish Match
                    </Button>
                </div>
            </Dialog>

            {/* Reschedule Dialog */}
            <Dialog
                open={rescheduleDialogOpen}
                onClose={() => setRescheduleDialogOpen(false)}
                title="Cambiar Fecha y Hora"
                className="max-w-md"
            >
                <div className="space-y-4">
                    <input
                        type="datetime-local"
                        value={newDate}
                        onChange={(e) => setNewDate(e.target.value)}
                        className="w-full rounded-xl border border-border bg-zinc-800 px-4 py-3 text-foreground transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent [color-scheme:dark]"
                    />
                    <Button
                        onClick={async () => {
                            if (!newDate) { toast("Selecciona una fecha", "error"); return; }
                            setLoading("reschedule");
                            const result = await rescheduleMatch(match.id, newDate);
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

            {/* Cancel Confirmation Dialog */}
            <Dialog
                open={cancelDialogOpen}
                onClose={() => setCancelDialogOpen(false)}
                title="¿Cancelar Partido?"
                className="max-w-md"
            >
                <div className="space-y-4">
                    <p className="text-sm text-muted">
                        Esta acción es irreversible. Todos los jugadores serán notificados.
                    </p>
                    <div className="flex gap-3">
                        <Button
                            variant="outline"
                            size="lg"
                            className="flex-1"
                            onClick={() => setCancelDialogOpen(false)}
                        >
                            Volver
                        </Button>
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
}: {
    team: "A" | "B";
    players: Participant[];
    color: string;
}) {
    const avgSkill =
        players.length > 0
            ? (
                players.reduce(
                    (sum, p) => sum + (p.profiles?.skill_level ?? 5),
                    0
                ) / players.length
            ).toFixed(1)
            : "0";

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    <span className={`text-${color}`}>Team {team}</span>
                </CardTitle>
                <span className={`text-xs text-${color} bg-${color}/10 px-2 py-1 rounded-full`}>
                    Avg: {avgSkill}
                </span>
            </CardHeader>
            <div className="space-y-3">
                {players.map((p) => (
                    <PlayerRow key={p.user_id} participant={p} />
                ))}
                {players.length === 0 && (
                    <p className="text-center text-sm text-muted">No players</p>
                )}
            </div>
        </Card>
    );
}

function PlayerRow({ participant, onKick }: { participant: Participant; onKick?: () => void }) {
    const [kicking, setKicking] = useState(false);
    const profile = participant.profiles;
    const avatarUrl = getAvatarUrl(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        profile?.avatar_url ?? null
    );

    const positionBadge: Record<string, string> = {
        GK: "🧤",
        DEF: "🛡️",
        MID: "🎯",
        FWD: "⚡",
    };

    return (
        <div className="flex items-center gap-3 rounded-xl bg-zinc-800/50 px-3 py-2">
            <Avatar
                src={avatarUrl}
                fallback={profile?.username || "P"}
                size="sm"
            />
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                    {profile?.username || "Unknown"}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted">
                    {profile?.position && (
                        <span>{positionBadge[profile.position]} {profile.position}</span>
                    )}
                    {profile?.skill_level && (
                        <span>⭐ {profile.skill_level}</span>
                    )}
                </div>
            </div>
            {participant.goals > 0 && (
                <span className="flex items-center gap-0.5 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                    ⚽ ×{participant.goals}
                </span>
            )}
            {participant.is_mvp && (
                <span className="text-yellow-400 text-xs">🏅 MVP</span>
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
