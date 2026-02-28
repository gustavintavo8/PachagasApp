"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { getAvatarUrl } from "@/lib/utils";
import { Star, Check } from "lucide-react";

interface Participant {
    user_id: string;
    profiles: {
        username: string | null;
        avatar_url: string | null;
    };
}

interface PlayerRatingProps {
    matchId: string;
    currentUserId: string;
    participants: Participant[];
}

function StarRating({
    value,
    onChange,
}: {
    value: number;
    onChange: (v: number) => void;
}) {
    return (
        <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    type="button"
                    onClick={() => onChange(star)}
                    className="transition-transform hover:scale-110"
                >
                    <Star
                        size={16}
                        className={
                            star <= value
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-zinc-600"
                        }
                    />
                </button>
            ))}
        </div>
    );
}

interface Ratings {
    [userId: string]: {
        punctuality: number;
        sportsmanship: number;
        skill: number;
    };
}

export function PlayerRating({
    matchId,
    currentUserId,
    participants,
}: PlayerRatingProps) {
    const [ratings, setRatings] = useState<Ratings>({});
    const [submitted, setSubmitted] = useState<Set<string>>(new Set());
    const [submitting, setSubmitting] = useState(false);
    const supabase = createClient();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const { toast } = useToast();

    const otherPlayers = participants.filter((p) => p.user_id !== currentUserId);

    // Check which players already have ratings from current user
    useEffect(() => {
        async function checkExisting() {
            const { data } = await supabase
                .from("player_ratings")
                .select("rated_id")
                .eq("match_id", matchId)
                .eq("rater_id", currentUserId);
            if (data) {
                setSubmitted(new Set(data.map((r) => r.rated_id)));
            }
        }
        checkExisting();
    }, [matchId, currentUserId]);

    function updateRating(
        userId: string,
        field: "punctuality" | "sportsmanship" | "skill",
        value: number
    ) {
        setRatings((prev) => ({
            ...prev,
            [userId]: {
                punctuality: prev[userId]?.punctuality || 0,
                sportsmanship: prev[userId]?.sportsmanship || 0,
                skill: prev[userId]?.skill || 0,
                [field]: value,
            },
        }));
    }

    async function submitRating(userId: string) {
        const r = ratings[userId];
        if (!r || r.punctuality === 0 || r.sportsmanship === 0 || r.skill === 0) {
            toast("Rellena las 3 valoraciones", "error");
            return;
        }

        setSubmitting(true);
        const { error } = await supabase.from("player_ratings").insert({
            match_id: matchId,
            rater_id: currentUserId,
            rated_id: userId,
            punctuality: r.punctuality,
            sportsmanship: r.sportsmanship,
            skill: r.skill,
        });

        if (error) {
            toast(error.message, "error");
        } else {
            setSubmitted((prev) => new Set([...prev, userId]));
            toast("¡Valoración enviada!", "success");
        }
        setSubmitting(false);
    }

    if (otherPlayers.length === 0) return null;

    return (
        <div className="rounded-2xl border border-border bg-surface">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <Star size={18} className="text-yellow-400" />
                <h3 className="text-sm font-semibold text-foreground">
                    Valorar Jugadores
                </h3>
            </div>

            <div className="divide-y divide-border">
                {otherPlayers.map((p) => {
                    const alreadyRated = submitted.has(p.user_id);
                    const avatarUrl = getAvatarUrl(supabaseUrl, p.profiles?.avatar_url ?? null);
                    const r = ratings[p.user_id];

                    return (
                        <div key={p.user_id} className="px-4 py-4">
                            <div className="flex items-center gap-3 mb-3">
                                <Avatar
                                    src={avatarUrl}
                                    fallback={p.profiles?.username || "?"}
                                    size="sm"
                                />
                                <span className="text-sm font-medium text-foreground">
                                    {p.profiles?.username || "Anónimo"}
                                </span>
                                {alreadyRated && (
                                    <span className="ml-auto flex items-center gap-1 text-xs text-green-400">
                                        <Check size={14} /> Valorado
                                    </span>
                                )}
                            </div>

                            {!alreadyRated && (
                                <div className="space-y-2 pl-10">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-muted">⏰ Puntualidad</span>
                                        <StarRating
                                            value={r?.punctuality || 0}
                                            onChange={(v) => updateRating(p.user_id, "punctuality", v)}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-muted">🤝 Deportividad</span>
                                        <StarRating
                                            value={r?.sportsmanship || 0}
                                            onChange={(v) => updateRating(p.user_id, "sportsmanship", v)}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-muted">⚽ Nivel</span>
                                        <StarRating
                                            value={r?.skill || 0}
                                            onChange={(v) => updateRating(p.user_id, "skill", v)}
                                        />
                                    </div>
                                    <button
                                        onClick={() => submitRating(p.user_id)}
                                        disabled={submitting}
                                        className="mt-2 w-full rounded-xl bg-accent/10 py-2 text-xs font-medium text-accent transition-all hover:bg-accent/20 disabled:opacity-50"
                                    >
                                        Enviar Valoración
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
