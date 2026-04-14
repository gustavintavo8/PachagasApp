"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { getAvatarUrl } from "@/lib/utils";
import { Search, Trophy, Target, Users, Crown } from "lucide-react";
import { POSITION_ICONS, POSITION_SHORT } from "@/lib/positions";
import type { Profile } from "@/lib/types";

const positions = ["ALL", "GK", "DEF", "MID", "FWD"] as const;
const positionLabels: Record<string, string> = {
    ALL: "Todos",
    GK: "POR",
    DEF: "DEF",
    MID: "MED",
    FWD: "DEL",
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

                        const posColors: Record<string, string> = {
                            GK: "text-blue-400 bg-blue-500/10 border-blue-500/20",
                            DEF: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
                            MID: "text-amber-400 bg-amber-500/10 border-amber-500/20",
                            FWD: "text-rose-400 bg-rose-500/10 border-rose-500/20",
                        };

                        const posColor = profile.position ? posColors[profile.position] || "text-muted" : "text-muted";

                        return (
                            <Link key={profile.id} href={`/players/${profile.id}`} className="group relative">
                                <Card className="h-full transition-all border-border/80 bg-gradient-to-br from-surface to-surface-hover/30 hover:border-accent/40 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(204,255,0,0.08)]">
                                    {/* Player Header */}
                                    <div className="mb-3 flex items-center gap-3">
                                        <div className="relative">
                                            <Avatar
                                                src={avatarUrl}
                                                fallback={profile.username || "P"}
                                                size="md"
                                            />
                                            <div className="absolute inset-0 rounded-full ring-2 ring-border ring-offset-2 ring-offset-surface transition-all group-hover:ring-accent/50"></div>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="truncate font-semibold text-foreground">
                                                    {profile.username || "Desconocido"}
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
                                            <div className="flex items-center gap-2 text-xs">
                                                {profile.position && (
                                                    <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium ${posColor}`}>
                                                        {POSITION_ICONS[profile.position]}
                                                        {POSITION_SHORT[profile.position] || profile.position}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Stats */}
                                    <div className="flex items-center justify-between border-t border-border/50 bg-black/10 px-6 py-3 -mx-6 -mb-6 mt-3 rounded-b-2xl">
                                        <div className="flex items-center gap-2 text-foreground font-semibold">
                                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-accent/10">
                                                <Trophy size={12} className="text-accent" />
                                            </div>
                                            <span>{profile.matches_played} <span className="text-muted/70 font-normal text-xs uppercase tracking-wider">PJ</span></span>
                                        </div>
                                        <div className="flex items-center gap-2 text-foreground font-semibold">
                                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-accent/10">
                                                <Target size={14} className="text-accent" />
                                            </div>
                                            <span>{profile.goals_scored} <span className="text-muted/70 font-normal text-xs uppercase tracking-wider">GL</span></span>
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
