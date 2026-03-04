"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { getAvatarUrl } from "@/lib/utils";
import { Search, Trophy, Target, Users, Crown } from "lucide-react";
import type { Profile } from "@/lib/types";

const positions = ["ALL", "GK", "DEF", "MID", "FWD"] as const;
const positionLabels: Record<string, string> = {
    ALL: "🌐 Todos",
    GK: "🧤 POR",
    DEF: "🛡️ DEF",
    MID: "🎯 MED",
    FWD: "⚡ DEL",
};

interface PlayersListProps {
    profiles: Profile[];
    currentUserId: string;
    adminUserIds: string[];
}

export function PlayersList({ profiles, currentUserId, adminUserIds }: PlayersListProps) {
    const [search, setSearch] = useState("");
    const [positionFilter, setPositionFilter] = useState<string>("ALL");

    const filtered = profiles.filter((p) => {
        const matchesSearch =
            !search ||
            (p.username ?? "").toLowerCase().includes(search.toLowerCase());
        const matchesPosition =
            positionFilter === "ALL" || p.position === positionFilter;
        return matchesSearch && matchesPosition;
    });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

    return (
        <div>
            {/* Search & Filters */}
            <div className="mb-6 space-y-4">
                {/* Search Input */}
                <div className="relative">
                    <Search
                        size={18}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-muted"
                    />
                    <input
                        type="text"
                        placeholder="Buscar jugadores..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full rounded-xl border border-border bg-surface px-4 py-3 pl-11 text-foreground placeholder:text-muted/60 transition-colors focus:border-accent focus:outline-none"
                    />
                </div>

                {/* Position Filter */}
                <div className="flex flex-wrap gap-2">
                    {positions.map((pos) => (
                        <button
                            key={pos}
                            onClick={() => setPositionFilter(pos)}
                            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${positionFilter === pos
                                ? "border-accent bg-accent/10 text-accent"
                                : "border-border bg-surface text-muted hover:border-border-hover hover:text-foreground"
                                }`}
                        >
                            {positionLabels[pos]}
                        </button>
                    ))}
                </div>
            </div>

            {/* Results Count */}
            <p className="mb-4 text-sm text-muted">
                {filtered.length} jugador{filtered.length !== 1 ? "es" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
            </p>

            {/* Players Grid */}
            {filtered.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filtered.map((profile) => {
                        const isYou = profile.id === currentUserId;
                        const avatarUrl = getAvatarUrl(supabaseUrl, profile.avatar_url);

                        const positionBadge: Record<string, string> = {
                            GK: "🧤",
                            DEF: "🛡️",
                            MID: "🎯",
                            FWD: "⚡",
                        };
                        const positionShort: Record<string, string> = {
                            GK: "POR",
                            DEF: "DEF",
                            MID: "MED",
                            FWD: "DEL",
                        };

                        return (
                            <Link key={profile.id} href={`/players/${profile.id}`}>
                                <Card className="h-full transition-all hover:border-border-hover hover:bg-surface-hover">
                                    {/* Player Header */}
                                    <div className="mb-3 flex items-center gap-3">
                                        <Avatar
                                            src={avatarUrl}
                                            fallback={profile.username || "P"}
                                            size="md"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="truncate font-semibold text-foreground">
                                                    {profile.username || "Unknown"}
                                                </p>
                                                {isYou && (
                                                    <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                                                        Tú
                                                    </span>
                                                )}
                                                {adminUserIds.includes(profile.id) && (
                                                    <span className="shrink-0 flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-400">
                                                        <Crown size={10} />
                                                        Admin
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-muted">
                                                {profile.position && (
                                                    <span>
                                                        {positionBadge[profile.position]}{" "}
                                                        {positionShort[profile.position] || profile.position}
                                                    </span>
                                                )}
                                                {profile.skill_level && (
                                                    <span>⭐ {profile.skill_level}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Stats */}
                                    <div className="flex items-center justify-between border-t border-border pt-3">
                                        <div className="flex items-center gap-1.5 text-sm text-muted">
                                            <Trophy size={14} />
                                            <span>{profile.matches_played} partidos</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-sm text-muted">
                                            <Target size={14} />
                                            <span>{profile.goals_scored} goles</span>
                                        </div>
                                    </div>
                                </Card>
                            </Link>
                        );
                    })}
                </div>
            ) : (
                <Card className="text-center">
                    <div className="py-8">
                        <Users size={48} className="mx-auto mb-4 text-muted/30" />
                        <p className="text-lg font-medium text-muted">No se encontraron jugadores</p>
                        <p className="mt-1 text-sm text-muted/70">
                            Intenta ajustar tu búsqueda o filtros
                        </p>
                    </div>
                </Card>
            )}
        </div>
    );
}
