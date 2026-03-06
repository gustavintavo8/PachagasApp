"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { voteForMvp } from "@/app/matches/actions";
import { useToast } from "@/components/ui/Toast";
import { Avatar } from "@/components/ui/Avatar";
import { getAvatarUrl } from "@/lib/utils";
import { Trophy, Check, Clock, Crown } from "lucide-react";

interface Participant {
    user_id: string;
    is_mvp?: boolean;
    profiles: {
        username: string | null;
        avatar_url: string | null;
    };
}

interface MvpVote {
    voter_id: string;
    voted_for: string;
}

interface MvpVotingProps {
    matchId: string;
    currentUserId: string;
    participants: Participant[];
    matchFinishedAt: string | null;
    matchDate: string;
    canManage?: boolean;
}

const MVP_VOTING_WINDOW_MS = 24 * 60 * 60 * 1000;

function getTimeRemaining(finishedAt: string): {
    expired: boolean;
    hours: number;
    minutes: number;
    seconds: number;
} {
    const deadline = new Date(finishedAt).getTime() + MVP_VOTING_WINDOW_MS;
    const diff = deadline - Date.now();

    if (diff <= 0) return { expired: true, hours: 0, minutes: 0, seconds: 0 };

    return {
        expired: false,
        hours: Math.floor(diff / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
    };
}

export function MvpVoting({
    matchId,
    currentUserId,
    participants,
    matchFinishedAt,
    matchDate,
    canManage,
}: MvpVotingProps) {
    // If finished_at is null (pre-migration match), use the match date as fallback
    const effectiveFinishedAt = matchFinishedAt || matchDate;
    const [votes, setVotes] = useState<MvpVote[]>([]);
    const [loading, setLoading] = useState(true);
    const [voting, setVoting] = useState(false);
    const [timeLeft, setTimeLeft] = useState(() =>
        getTimeRemaining(effectiveFinishedAt)
    );
    const supabase = createClient();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const { toast } = useToast();

    const myVote = votes.find((v) => v.voter_id === currentUserId);
    const isAlreadyResolved = participants.some((p) => p.is_mvp);
    const votingClosed = timeLeft.expired || isAlreadyResolved;

    // Count votes per candidate
    const voteCounts: Record<string, number> = {};
    for (const v of votes) {
        voteCounts[v.voted_for] = (voteCounts[v.voted_for] || 0) + 1;
    }

    // Find the MVP winner (most votes, no tie)
    let mvpWinnerId: string | null = null;
    const resolvedWinner = participants.find((p) => p.is_mvp);

    if (resolvedWinner) {
        mvpWinnerId = resolvedWinner.user_id;
    } else if (votingClosed && votes.length > 0) {
        let maxVotes = 0;
        let isTie = false;
        for (const [userId, count] of Object.entries(voteCounts)) {
            if (count > maxVotes) {
                maxVotes = count;
                mvpWinnerId = userId;
                isTie = false;
            } else if (count === maxVotes) {
                isTie = true;
            }
        }
        if (isTie) mvpWinnerId = null;
    }

    // Fetch existing votes
    useEffect(() => {
        async function fetchVotes() {
            const { data } = await supabase
                .from("mvp_votes")
                .select("voter_id, voted_for")
                .eq("match_id", matchId);
            setVotes((data as MvpVote[]) || []);
            setLoading(false);
        }
        fetchVotes();
    }, [matchId]);

    // Countdown timer
    useEffect(() => {
        if (votingClosed) return;

        const interval = setInterval(() => {
            const remaining = getTimeRemaining(effectiveFinishedAt);
            setTimeLeft(remaining);
            if (remaining.expired) clearInterval(interval);
        }, 1000);

        return () => clearInterval(interval);
    }, [effectiveFinishedAt, votingClosed]);

    // Realtime subscription for new votes
    useEffect(() => {
        const channel = supabase
            .channel(`mvp-votes-${matchId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "mvp_votes",
                    filter: `match_id=eq.${matchId}`,
                },
                (payload) => {
                    const newVote = payload.new as MvpVote;
                    setVotes((prev) => {
                        if (prev.some((v) => v.voter_id === newVote.voter_id)) return prev;
                        return [...prev, newVote];
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [matchId]);

    async function handleVote(votedForUserId: string) {
        if (voting || myVote || votingClosed) return;
        setVoting(true);

        const result = await voteForMvp(matchId, votedForUserId);

        if (!result.success) {
            toast(result.error || "Error al votar", "error");
        } else {
            // Optimistic update
            setVotes((prev) => [
                ...prev,
                { voter_id: currentUserId, voted_for: votedForUserId },
            ]);
            toast("¡Voto registrado!", "success");
        }
        setVoting(false);
    }

    async function handleForceResolve() {
        if (!confirm("¿Forzar el cierre de la votación y elegir al MVP ahora mismo?")) return;
        setVoting(true);
        const { forceResolveMvp } = await import("@/app/matches/actions");
        const result = await forceResolveMvp(matchId);
        if (!result.success) {
            toast(result.error || "Error al finalizar", "error");
        } else {
            toast("Votación finalizada", "success");
        }
        setVoting(false);
    }

    const otherPlayers = participants.filter((p) => p.user_id !== currentUserId);

    // Sort by vote count when voting is closed
    const sortedPlayers = votingClosed
        ? [...otherPlayers].sort(
            (a, b) => (voteCounts[b.user_id] || 0) - (voteCounts[a.user_id] || 0)
        )
        : otherPlayers;

    if (otherPlayers.length === 0) return null;

    return (
        <div className="rounded-2xl border border-border bg-surface">
            {/* Header */}
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <Trophy size={18} className="text-yellow-400" />
                <h3 className="text-sm font-semibold text-foreground">
                    Votación MVP
                </h3>
                <div className="ml-auto flex items-center gap-2">
                    {!votingClosed ? (
                        <span className="flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/5 px-2.5 py-1 text-xs font-medium text-accent">
                            <Clock size={12} />
                            {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s
                        </span>
                    ) : (
                        <span className="rounded-full border border-zinc-500/30 bg-zinc-500/10 px-2.5 py-1 text-xs font-medium text-zinc-400">
                            Votación cerrada
                        </span>
                    )}
                </div>
            </div>

            {/* Status banner */}
            {!votingClosed && !myVote && (
                <div className="border-b border-border bg-accent/5 px-4 py-2.5 flex items-center justify-between">
                    <p className="text-xs text-accent">
                        ⚡ Elige al jugador que mejor lo hizo. Tienes 24h para votar.
                    </p>
                    {canManage && (
                        <button
                            onClick={handleForceResolve}
                            disabled={voting || votes.length === 0}
                            className="text-xs font-semibold text-accent/80 hover:text-accent disabled:opacity-50"
                        >
                            Finalizar ya
                        </button>
                    )}
                </div>
            )}
            {myVote && !votingClosed && (
                <div className="border-b border-border bg-green-500/5 px-4 py-2.5 flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-xs text-green-400">
                        <Check size={14} />
                        ¡Ya has votado! Los resultados se mostrarán al cerrar.
                    </p>
                    {canManage && (
                        <button
                            onClick={handleForceResolve}
                            disabled={voting || votes.length === 0}
                            className="text-xs font-semibold text-green-500/80 hover:text-green-400 disabled:opacity-50"
                        >
                            Finalizar ya
                        </button>
                    )}
                </div>
            )}

            {/* Player List */}
            <div className="divide-y divide-border">
                {loading ? (
                    <div className="space-y-3 p-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="skeleton h-14 rounded-xl" />
                        ))}
                    </div>
                ) : (
                    sortedPlayers.map((p) => {
                        const avatarUrl = getAvatarUrl(
                            supabaseUrl,
                            p.profiles?.avatar_url ?? null
                        );
                        const isVotedFor = myVote?.voted_for === p.user_id;
                        const voteCount = voteCounts[p.user_id] || 0;
                        const isWinner = mvpWinnerId === p.user_id;

                        return (
                            <div
                                key={p.user_id}
                                className={`flex items-center gap-3 px-4 py-3.5 transition-colors ${isWinner
                                    ? "bg-yellow-400/5"
                                    : isVotedFor
                                        ? "bg-accent/5"
                                        : ""
                                    }`}
                            >
                                {/* Avatar */}
                                <div className="relative">
                                    <Avatar
                                        src={avatarUrl}
                                        fallback={p.profiles?.username || "?"}
                                        size="sm"
                                    />
                                    {isWinner && (
                                        <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-400 text-[8px] text-black">
                                            <Crown size={10} />
                                        </div>
                                    )}
                                </div>

                                {/* Name */}
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium truncate ${isWinner ? "text-yellow-400" : "text-foreground"
                                        }`}>
                                        {p.profiles?.username || "Anónimo"}
                                        {isWinner && " 🏅"}
                                    </p>
                                    {votingClosed && voteCount > 0 && (
                                        <p className="text-xs text-muted">
                                            {voteCount} voto{voteCount !== 1 ? "s" : ""}
                                        </p>
                                    )}
                                </div>

                                {/* Action / State */}
                                {!votingClosed && !myVote && (
                                    <button
                                        onClick={() => handleVote(p.user_id)}
                                        disabled={voting}
                                        className="rounded-xl bg-accent/10 px-4 py-2 text-xs font-medium text-accent transition-all hover:bg-accent/20 active:scale-95 disabled:opacity-50"
                                    >
                                        Votar
                                    </button>
                                )}
                                {isVotedFor && (
                                    <span className="flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
                                        <Check size={14} />
                                        Tu voto
                                    </span>
                                )}
                                {votingClosed && isWinner && (
                                    <span className="rounded-full bg-yellow-400/10 border border-yellow-500/30 px-2.5 py-1 text-xs font-bold text-yellow-400">
                                        MVP
                                    </span>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Footer — total votes */}
            <div className="border-t border-border px-4 py-2.5">
                <p className="text-xs text-muted text-center">
                    {votes.length} de {participants.length} jugadores han votado
                </p>
            </div>
        </div>
    );
}
