"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { getAvatarUrl } from "@/lib/utils";
import { Trophy, Target, TrendingUp, Medal, Crown, Star } from "lucide-react";
import { POSITION_ICONS, POSITION_SHORT, POSITION_COLORS } from "@/lib/positions";

interface PlayerData {
    id: string;
    username: string | null;
    avatar_url: string | null;
    position: string | null;
    skill_level: number | null;
    elo_rating: number;
    matches_played: number;
    goals_scored: number;
    wins: number;
    draws: number;
    losses: number;
    mvps: number;
}

interface LeaderboardTabsProps {
    data: PlayerData[];
    currentUserId: string;
    adminUserIds: string[];
}

const tabs = [
    { key: "rating", label: "Rating", icon: Star },
    { key: "wins", label: "Victorias", icon: TrendingUp },
    { key: "goals", label: "Goles", icon: Target },
    { key: "matches", label: "Partidos", icon: Trophy },
    { key: "mvps", label: "MVPs", icon: Medal },
] as const;

type TabKey = (typeof tabs)[number]["key"];

function getSortedData(data: PlayerData[], tab: TabKey): PlayerData[] {
    return [...data].sort((a, b) => {
        switch (tab) {
            case "rating":
                return b.elo_rating - a.elo_rating;
            case "wins":
                return b.wins - a.wins || b.matches_played - a.matches_played;
            case "goals":
                return b.goals_scored - a.goals_scored;
            case "matches":
                return b.matches_played - a.matches_played;
            case "mvps":
                return b.mvps - a.mvps || b.wins - a.wins;
        }
    });
}

function getStatValue(player: PlayerData, tab: TabKey): number {
    switch (tab) {
        case "rating": return player.elo_rating;
        case "wins": return player.wins;
        case "goals": return player.goals_scored;
        case "matches": return player.matches_played;
        case "mvps": return player.mvps;
    }
}

function getStatLabel(tab: TabKey): string {
    switch (tab) {
        case "rating": return "RP";
        case "wins": return "victorias";
        case "goals": return "goles";
        case "matches": return "partidos";
        case "mvps": return "MVPs";
    }
}

const podiumColors = [
    "from-yellow-500/20 to-yellow-600/5 border-yellow-500/40",
    "from-zinc-400/20 to-zinc-500/5 border-zinc-400/40",
    "from-amber-700/20 to-amber-800/5 border-amber-700/40",
];

const podiumBadgeColors = [
    "bg-yellow-500 text-black",
    "bg-zinc-400 text-black",
    "bg-amber-700 text-white",
];

export function LeaderboardTabs({ data, currentUserId, adminUserIds }: LeaderboardTabsProps) {
    const [activeTab, setActiveTab] = useState<TabKey>("rating");
    // For "rating" tab, only show players with ≥3 matches (non-provisional)
    const PROVISIONAL_MIN = 3;
    const filtered = activeTab === "rating"
        ? data.filter((p) => p.matches_played >= PROVISIONAL_MIN)
        : data;
    const sorted = getSortedData(filtered, activeTab);
    const top3 = sorted.slice(0, 3);
    const rest = sorted.slice(3);
    const provisionalCount = activeTab === "rating"
        ? data.filter((p) => p.matches_played < PROVISIONAL_MIN && p.matches_played > 0).length
        : 0;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

    return (
        <div data-testid="leaderboard">
            {/* Tab Switcher */}
            <div className="mb-6 flex gap-2 overflow-x-auto">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.key;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all ${active
                                ? "border-accent bg-accent/10 text-accent"
                                : "border-border bg-surface text-muted hover:border-border-hover hover:text-foreground"
                                }`}
                        >
                            <Icon size={16} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Provisional players notice */}
            {provisionalCount > 0 && (
                <p className="mb-4 text-xs text-muted/70 italic">
                    {provisionalCount} jugador{provisionalCount !== 1 ? "es" : ""} con menos de {PROVISIONAL_MIN} partidos no aparece{provisionalCount !== 1 ? "n" : ""} en el ranking
                </p>
            )}

            {/* Podium — Top 3 */}
            {top3.length > 0 && (
                <div className="mb-8 grid gap-4 sm:grid-cols-3">
                    {top3.map((player, idx) => (
                        <Link key={player.id} href={`/players/${player.id}`}>
                            <Card
                                className={`relative group bg-gradient-to-b ${podiumColors[idx]} border border-border/50 shadow-[0_4px_20px_rgba(0,0,0,0.2)] transition-all hover:-translate-y-2 hover:shadow-[0_8px_30px_rgba(204,255,0,0.15)] hover:border-accent/40`}
                            >
                                <div className="flex flex-col items-center text-center">
                                    <span
                                        className={`absolute -top-3 left-4 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${podiumBadgeColors[idx]}`}
                                    >
                                        {idx + 1}
                                    </span>
                                    <div className="relative mb-3">
                                        <Avatar
                                            src={getAvatarUrl(supabaseUrl, player.avatar_url)}
                                            fallback={player.username || "P"}
                                            size="lg"
                                        />
                                        <div className="absolute inset-0 rounded-full ring-4 ring-border ring-offset-4 ring-offset-surface transition-all group-hover:ring-accent/50"></div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-semibold text-foreground truncate max-w-[140px]">
                                            {player.username || "Desconocido"}
                                        </p>
                                        {player.id === currentUserId && (
                                            <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                                                Tú
                                            </span>
                                        )}
                                        {adminUserIds.includes(player.id) && (
                                            <span className="shrink-0 flex items-center gap-0.5 rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
                                                <Crown size={9} />
                                                Admin
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-2 flex items-center justify-center">
                                        {player.position && (
                                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase border ${POSITION_COLORS[player.position] || "text-muted border-border"}`}>
                                                {POSITION_ICONS[player.position]}
                                                {POSITION_SHORT[player.position] || player.position}
                                            </span>
                                        )}
                                    </div>
                                    <p className="mt-3 text-4xl font-bold drop-shadow-md text-accent">
                                        {getStatValue(player, activeTab)}
                                    </p>
                                    <p className="text-xs text-muted">{getStatLabel(activeTab)}</p>
                                    <div className="mt-2 flex gap-3 text-xs text-muted">
                                        <span className="text-green-400">{player.wins}V</span>
                                        <span>{player.draws}E</span>
                                        <span className="text-red-400">{player.losses}D</span>
                                    </div>
                                </div>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}

            {/* Rest of the ranking */}
            {rest.length > 0 && (
                <div className="space-y-2">
                    {rest.map((player, idx) => (
                        <Link key={player.id} href={`/players/${player.id}`} className="group block">
                            <div className="flex items-center gap-4 rounded-xl border border-border/80 bg-gradient-to-br from-surface to-surface-hover/30 px-4 py-3 transition-all hover:border-accent/40 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(204,255,0,0.06)]">
                                <span className="w-8 text-center text-sm font-bold text-muted">
                                    {idx + 4}
                                </span>
                                <div className="relative">
                                    <Avatar
                                        src={getAvatarUrl(supabaseUrl, player.avatar_url)}
                                        fallback={player.username || "P"}
                                        size="sm"
                                    />
                                    <div className="absolute inset-0 rounded-full ring-2 ring-border ring-offset-2 ring-offset-surface transition-all group-hover:ring-accent/50"></div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="truncate text-sm font-medium text-foreground">
                                            {player.username || "Desconocido"}
                                        </p>
                                        {player.id === currentUserId && (
                                            <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                                                Tú
                                            </span>
                                        )}
                                        {adminUserIds.includes(player.id) && (
                                            <span className="shrink-0 flex items-center gap-0.5 rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
                                                <Crown size={9} />
                                                Admin
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex gap-1.5 text-[11px] font-medium text-muted">
                                        <span className="text-green-400">{player.wins}V</span>
                                        <span>{player.draws}E</span>
                                            <span className="text-red-400">{player.losses}D</span>
                                        </div>
                                        {player.position && (
                                            <span className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase border ${POSITION_COLORS[player.position] || "text-muted"}`}>
                                                {POSITION_SHORT[player.position] || player.position}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right flex flex-col justify-center items-end">
                                    <p className="text-xl font-bold text-accent">
                                        {getStatValue(player, activeTab)}
                                    </p>
                                    <p className="text-[10px] text-muted">{getStatLabel(activeTab)}</p>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {sorted.length === 0 && (
                <Card className="text-center">
                    <div className="py-8">
                        <Trophy size={48} className="mx-auto mb-4 text-muted/30" />
                        <p className="text-lg font-medium text-muted">
                            Aún no hay datos de ranking
                        </p>
                        <p className="mt-1 text-sm text-muted/70">
                            Juega partidos para aparecer en la clasificación
                        </p>
                    </div>
                </Card>
            )}
        </div>
    );
}
