"use client";

import { useState } from "react";
import {
    joinMatch,
    leaveMatch,
    closeMatch,
    setScore,
    generateTeams,
} from "../actions";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Dialog } from "@/components/ui/Dialog";
import { SoccerPitch } from "@/components/SoccerPitch";
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
}

export function MatchDetail({
    match,
    participants,
    currentUserId,
    organizerName,
}: MatchDetailProps) {
    const [loading, setLoading] = useState<string | null>(null);
    const [scoreDialogOpen, setScoreDialogOpen] = useState(false);
    const [teamAScore, setTeamAScore] = useState(match.team_a_score ?? 0);
    const [teamBScore, setTeamBScore] = useState(match.team_b_score ?? 0);

    const isOrganizer = match.created_by === currentUserId;
    const hasJoined = participants.some((p) => p.user_id === currentUserId);
    const teamA = participants.filter((p) => p.team === "A");
    const teamB = participants.filter((p) => p.team === "B");
    const unassigned = participants.filter((p) => !p.team);
    const teamsGenerated = teamA.length > 0 || teamB.length > 0;

    const statusColors = {
        open: "bg-accent/10 text-accent border-accent/30",
        closed: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
        finished: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
    };

    async function handleAction(
        action: () => Promise<{ error?: string; success?: boolean }>,
        key: string
    ) {
        setLoading(key);
        const result = await action();
        if (result?.error) alert(result.error);
        setLoading(null);
    }

    async function handleSetScore() {
        setLoading("score");
        const result = await setScore(match.id, teamAScore, teamBScore);
        if (result?.error) alert(result.error);
        setScoreDialogOpen(false);
        setLoading(null);
    }

    return (
        <div className="mx-auto max-w-3xl px-4 py-8">
            {/* Match Header */}
            <div className="mb-6">
                <div className="mb-3 flex items-center gap-3">
                    <span
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${statusColors[match.status]}`}
                    >
                        {match.status.toUpperCase()}
                    </span>
                    {isOrganizer && (
                        <span className="flex items-center gap-1 rounded-full bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-400 border border-purple-500/30">
                            <Shield size={12} />
                            Organizer
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
                        {participants.length}/{match.max_players} players
                    </span>
                    <span>by {organizerName}</span>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="mb-8 flex flex-wrap gap-3">
                {/* Player actions */}
                {match.status === "open" && !hasJoined && (
                    <Button
                        size="lg"
                        loading={loading === "join"}
                        onClick={() => handleAction(() => joinMatch(match.id), "join")}
                    >
                        <UserPlus size={18} />
                        Join Match
                    </Button>
                )}
                {match.status === "open" && hasJoined && !isOrganizer && (
                    <Button
                        variant="outline"
                        size="lg"
                        loading={loading === "leave"}
                        onClick={() => handleAction(() => leaveMatch(match.id), "leave")}
                    >
                        <LeaveIcon size={18} />
                        Leave
                    </Button>
                )}

                {/* Organizer actions */}
                {isOrganizer && match.status === "open" && (
                    <>
                        <Button
                            variant="outline"
                            size="lg"
                            loading={loading === "generate"}
                            onClick={() =>
                                handleAction(() => generateTeams(match.id), "generate")
                            }
                        >
                            <Shuffle size={18} />
                            Generate Teams
                        </Button>
                        <Button
                            variant="danger"
                            size="lg"
                            loading={loading === "close"}
                            onClick={() =>
                                handleAction(() => closeMatch(match.id), "close")
                            }
                        >
                            <Lock size={18} />
                            Close Match
                        </Button>
                    </>
                )}
                {isOrganizer &&
                    (match.status === "closed" || match.status === "open") && (
                        <Button
                            variant="outline"
                            size="lg"
                            onClick={() => setScoreDialogOpen(true)}
                        >
                            <Trophy size={18} />
                            Set Final Score
                        </Button>
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
                            <PlayerRow key={p.user_id} participant={p} />
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
                            <PlayerRow key={p.user_id} participant={p} />
                        ))}
                    </div>
                </Card>
            )}

            {/* Score Dialog */}
            <Dialog
                open={scoreDialogOpen}
                onClose={() => setScoreDialogOpen(false)}
                title="Set Final Score"
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

function PlayerRow({ participant }: { participant: Participant }) {
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
            {participant.is_mvp && (
                <span className="text-yellow-400 text-xs">🏅 MVP</span>
            )}
        </div>
    );
}
