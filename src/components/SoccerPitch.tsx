"use client";

import { useState, useRef, useEffect } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { getAvatarUrl } from "@/lib/utils";
import type { Profile } from "@/lib/types";

/* ─── Types ─── */

interface Participant {
    match_id: string;
    user_id: string;
    team: "A" | "B" | null;
    goals: number;
    is_mvp: boolean;
    profiles: Profile;
}

interface SoccerPitchProps {
    teamA: Participant[];
    teamB: Participant[];
}

/* ─── Position zones (% from top of team half) ─── */
const POSITION_CONFIG: Record<
    string,
    { zone: number; label: string; emoji: string }
> = {
    GK: { zone: 85, label: "GK", emoji: "🧤" },
    DEF: { zone: 65, label: "DEF", emoji: "🛡️" },
    MID: { zone: 40, label: "MID", emoji: "🎯" },
    FWD: { zone: 15, label: "FWD", emoji: "⚡" },
};

const positionFullNames: Record<string, string> = {
    GK: "Goalkeeper",
    DEF: "Defender",
    MID: "Midfielder",
    FWD: "Forward",
};

function groupByPosition(players: Participant[]) {
    const groups: Record<string, Participant[]> = {
        GK: [],
        DEF: [],
        MID: [],
        FWD: [],
    };
    for (const p of players) {
        const pos = p.profiles?.position ?? "MID";
        if (groups[pos]) {
            groups[pos].push(p);
        } else {
            groups["MID"].push(p);
        }
    }
    return groups;
}

function avgSkill(players: Participant[]) {
    if (players.length === 0) return "0";
    return (
        players.reduce((s, p) => s + (p.profiles?.skill_level ?? 5), 0) /
        players.length
    ).toFixed(1);
}

/* ═══════════════════════════════════════════════
   MAIN COMPONENT — Vertical pitch
   ═══════════════════════════════════════════════ */

export function SoccerPitch({ teamA, teamB }: SoccerPitchProps) {
    const groupA = groupByPosition(teamA);
    const groupB = groupByPosition(teamB);
    const [activePlayer, setActivePlayer] = useState<Participant | null>(null);
    const [popoverPos, setPopoverPos] = useState<{
        x: number;
        y: number;
    } | null>(null);
    const pitchRef = useRef<HTMLDivElement>(null);

    // Close popover on click outside
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            const target = e.target as HTMLElement;
            if (
                !target.closest("[data-player-marker]") &&
                !target.closest("[data-player-popover]")
            ) {
                setActivePlayer(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    function handlePlayerClick(p: Participant, el: HTMLElement) {
        if (activePlayer?.user_id === p.user_id) {
            setActivePlayer(null);
            return;
        }
        const pitchRect = pitchRef.current?.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        if (pitchRect) {
            setPopoverPos({
                x: elRect.left - pitchRect.left + elRect.width / 2,
                y: elRect.top - pitchRect.top,
            });
        }
        setActivePlayer(p);
    }

    return (
        <div className="w-full space-y-4">
            {/* Team A header */}
            <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-full bg-accent" />
                    <span className="text-sm font-bold text-accent">
                        Team A
                    </span>
                    <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
                        Avg: {avgSkill(teamA)}
                    </span>
                </div>
                <span className="text-xs text-muted">
                    {teamA.length} players
                </span>
            </div>

            {/* Vertical Pitch */}
            <div
                ref={pitchRef}
                className="pitch-container relative mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-border"
            >
                {/* Grass + aspect ratio wrapper */}
                <div
                    className="relative w-full"
                    style={{ paddingBottom: "135%" }}
                >
                    {/* Grass background */}
                    <div className="absolute inset-0 bg-gradient-to-b from-emerald-900 via-emerald-800 to-emerald-900">
                        {/* Horizontal grass stripes */}
                        <div
                            className="absolute inset-0"
                            style={{
                                backgroundImage:
                                    "repeating-linear-gradient(180deg, transparent, transparent 6.9%, rgba(0,0,0,0.05) 6.9%, rgba(0,0,0,0.05) 7.1%, transparent 7.1%, transparent 14%)",
                            }}
                        />
                    </div>

                    {/* SVG field markings — vertical orientation */}
                    <svg
                        viewBox="0 0 600 840"
                        className="absolute inset-0 h-full w-full"
                        preserveAspectRatio="xMidYMid meet"
                    >
                        <defs>
                            <filter id="line-glow">
                                <feGaussianBlur
                                    stdDeviation="1.5"
                                    result="blur"
                                />
                                <feMerge>
                                    <feMergeNode in="blur" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                        </defs>

                        {/* Outer boundary */}
                        <rect
                            x="30"
                            y="30"
                            width="540"
                            height="780"
                            fill="none"
                            stroke="rgba(255,255,255,0.35)"
                            strokeWidth="2.5"
                            rx="4"
                        />

                        {/* Half-way line */}
                        <line
                            x1="30"
                            y1="420"
                            x2="570"
                            y2="420"
                            stroke="rgba(255,255,255,0.35)"
                            strokeWidth="2.5"
                        />

                        {/* Centre circle */}
                        <circle
                            cx="300"
                            cy="420"
                            r="60"
                            fill="none"
                            stroke="rgba(255,255,255,0.35)"
                            strokeWidth="2.5"
                        />
                        <circle
                            cx="300"
                            cy="420"
                            r="4"
                            fill="rgba(255,255,255,0.4)"
                        />

                        {/* ─── Top half (Team A attacks downward, their GK is at top) ─── */}

                        {/* Top penalty area */}
                        <rect
                            x="150"
                            y="30"
                            width="300"
                            height="120"
                            fill="none"
                            stroke="rgba(255,255,255,0.3)"
                            strokeWidth="2"
                        />
                        {/* Top goal area */}
                        <rect
                            x="210"
                            y="30"
                            width="180"
                            height="48"
                            fill="none"
                            stroke="rgba(255,255,255,0.25)"
                            strokeWidth="2"
                        />
                        {/* Top penalty spot */}
                        <circle
                            cx="300"
                            cy="120"
                            r="3"
                            fill="rgba(255,255,255,0.35)"
                        />
                        {/* Top goal */}
                        <rect
                            x="230"
                            y="12"
                            width="140"
                            height="18"
                            fill="none"
                            stroke="rgba(255,255,255,0.2)"
                            strokeWidth="2"
                            rx="2"
                        />
                        {/* Top penalty arc */}
                        <path
                            d="M210,150 A60,60 0 0,0 390,150"
                            fill="none"
                            stroke="rgba(255,255,255,0.25)"
                            strokeWidth="2"
                        />

                        {/* ─── Bottom half (Team B attacks upward, their GK is at bottom) ─── */}

                        {/* Bottom penalty area */}
                        <rect
                            x="150"
                            y="690"
                            width="300"
                            height="120"
                            fill="none"
                            stroke="rgba(255,255,255,0.3)"
                            strokeWidth="2"
                        />
                        {/* Bottom goal area */}
                        <rect
                            x="210"
                            y="762"
                            width="180"
                            height="48"
                            fill="none"
                            stroke="rgba(255,255,255,0.25)"
                            strokeWidth="2"
                        />
                        {/* Bottom penalty spot */}
                        <circle
                            cx="300"
                            cy="720"
                            r="3"
                            fill="rgba(255,255,255,0.35)"
                        />
                        {/* Bottom goal */}
                        <rect
                            x="230"
                            y="810"
                            width="140"
                            height="18"
                            fill="none"
                            stroke="rgba(255,255,255,0.2)"
                            strokeWidth="2"
                            rx="2"
                        />
                        {/* Bottom penalty arc */}
                        <path
                            d="M210,690 A60,60 0 0,1 390,690"
                            fill="none"
                            stroke="rgba(255,255,255,0.25)"
                            strokeWidth="2"
                        />

                        {/* Corner arcs */}
                        <path
                            d="M30,45 A15,15 0 0,1 45,30"
                            fill="none"
                            stroke="rgba(255,255,255,0.2)"
                            strokeWidth="2"
                        />
                        <path
                            d="M555,30 A15,15 0 0,1 570,45"
                            fill="none"
                            stroke="rgba(255,255,255,0.2)"
                            strokeWidth="2"
                        />
                        <path
                            d="M45,810 A15,15 0 0,1 30,795"
                            fill="none"
                            stroke="rgba(255,255,255,0.2)"
                            strokeWidth="2"
                        />
                        <path
                            d="M570,795 A15,15 0 0,1 555,810"
                            fill="none"
                            stroke="rgba(255,255,255,0.2)"
                            strokeWidth="2"
                        />
                    </svg>

                    {/* Players overlay */}
                    <div className="absolute inset-0">
                        {/* Team A — top half */}
                        <TeamHalf
                            groups={groupA}
                            half="top"
                            accentColor="accent"
                            onPlayerClick={handlePlayerClick}
                            activePlayerId={activePlayer?.user_id ?? null}
                        />
                        {/* Team B — bottom half */}
                        <TeamHalf
                            groups={groupB}
                            half="bottom"
                            accentColor="blue-400"
                            onPlayerClick={handlePlayerClick}
                            activePlayerId={activePlayer?.user_id ?? null}
                        />
                    </div>

                    {/* Player Profile Popover */}
                    {activePlayer && popoverPos && (
                        <PlayerPopover
                            participant={activePlayer}
                            x={popoverPos.x}
                            y={popoverPos.y}
                        />
                    )}
                </div>
            </div>

            {/* Team B header */}
            <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-full bg-blue-400" />
                    <span className="text-sm font-bold text-blue-400">
                        Team B
                    </span>
                    <span className="rounded-full bg-blue-400/10 px-2 py-0.5 text-xs text-blue-400">
                        Avg: {avgSkill(teamB)}
                    </span>
                </div>
                <span className="text-xs text-muted">
                    {teamB.length} players
                </span>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════
   TEAM HALF — top or bottom of the vertical pitch
   ═══════════════════════════════════════════════ */

function TeamHalf({
    groups,
    half,
    accentColor,
    onPlayerClick,
    activePlayerId,
}: {
    groups: Record<string, Participant[]>;
    half: "top" | "bottom";
    accentColor: string;
    onPlayerClick: (p: Participant, el: HTMLElement) => void;
    activePlayerId: string | null;
}) {
    // Top half: GK at very top, FWD near centre line
    // Bottom half: FWD near centre line, GK at very bottom
    const positionOrder =
        half === "top"
            ? ["GK", "DEF", "MID", "FWD"]
            : ["FWD", "MID", "DEF", "GK"];

    return (
        <div
            className="absolute left-0 right-0"
            style={{
                top: half === "top" ? "2%" : "51%",
                height: "47%",
            }}
        >
            {positionOrder.map((pos) => {
                const config = POSITION_CONFIG[pos];
                const players = groups[pos];
                if (players.length === 0) return null;

                return (
                    <div
                        key={pos}
                        className="absolute left-0 right-0 flex items-center justify-center"
                        style={{
                            top: `${config.zone}%`,
                            transform: "translateY(-50%)",
                        }}
                    >
                        <div className="flex items-center justify-center gap-3 sm:gap-6 md:gap-8">
                            {players.map((p) => (
                                <PlayerMarker
                                    key={p.user_id}
                                    participant={p}
                                    accentColor={accentColor}
                                    onPlayerClick={onPlayerClick}
                                    isActive={
                                        activePlayerId === p.user_id
                                    }
                                />
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

/* ═══════════════════════════════════════════════
   PLAYER MARKER — avatar circle on the pitch
   ═══════════════════════════════════════════════ */

function PlayerMarker({
    participant,
    accentColor,
    onPlayerClick,
    isActive,
}: {
    participant: Participant;
    accentColor: string;
    onPlayerClick: (p: Participant, el: HTMLElement) => void;
    isActive: boolean;
}) {
    const profile = participant.profiles;
    const avatarUrl = getAvatarUrl(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        profile?.avatar_url ?? null
    );

    const posEmoji =
        POSITION_CONFIG[profile?.position ?? "MID"]?.emoji ?? "⚽";

    const ringClass =
        accentColor === "accent"
            ? "ring-accent shadow-[0_0_8px_rgba(204,255,0,0.4)]"
            : "ring-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.4)]";

    const activeRing = isActive
        ? accentColor === "accent"
            ? "ring-4 shadow-[0_0_16px_rgba(204,255,0,0.6)]"
            : "ring-4 shadow-[0_0_16px_rgba(96,165,250,0.6)]"
        : "ring-2";

    return (
        <div
            data-player-marker
            className="flex cursor-pointer flex-col items-center gap-0.5"
            onClick={(e) => {
                const el = e.currentTarget as HTMLElement;
                onPlayerClick(participant, el);
            }}
        >
            {/* Avatar circle */}
            <div
                className={`relative rounded-full ${ringClass} ${activeRing} transition-all duration-200 hover:scale-110`}
            >
                <Avatar
                    src={avatarUrl}
                    fallback={profile?.username || "P"}
                    size="sm"
                />
                {/* Position badge */}
                <span className="absolute -bottom-1 -right-1 text-[10px] leading-none">
                    {posEmoji}
                </span>
            </div>
            {/* Name */}
            <span className="max-w-[56px] truncate text-center text-[9px] font-semibold text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] sm:max-w-[70px] sm:text-[11px]">
                {profile?.username || "???"}
            </span>
            {participant.is_mvp && (
                <span className="text-[9px] text-yellow-400">🏅 MVP</span>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════
   PLAYER POPOVER — profile card on hover/click
   ═══════════════════════════════════════════════ */

function PlayerPopover({
    participant,
    x,
    y,
}: {
    participant: Participant;
    x: number;
    y: number;
}) {
    const profile = participant.profiles;
    const avatarUrl = getAvatarUrl(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        profile?.avatar_url ?? null
    );
    const posEmoji =
        POSITION_CONFIG[profile?.position ?? "MID"]?.emoji ?? "⚽";
    const posName =
        positionFullNames[profile?.position ?? "MID"] ?? "Midfielder";

    const popoverRef = useRef<HTMLDivElement>(null);
    const [adjustedPos, setAdjustedPos] = useState({ x, y });

    useEffect(() => {
        if (!popoverRef.current) return;
        const el = popoverRef.current;
        const parent = el.offsetParent as HTMLElement;
        if (!parent) return;

        const parentRect = parent.getBoundingClientRect();
        const popW = el.offsetWidth;
        const popH = el.offsetHeight;

        let ax = x - popW / 2;
        let ay = y - popH - 12;

        // Clamp horizontally
        if (ax < 8) ax = 8;
        if (ax + popW > parentRect.width - 8) ax = parentRect.width - popW - 8;

        // If popover would go above the pitch, flip below
        if (ay < 8) ay = y + 44;

        setAdjustedPos({ x: ax, y: ay });
    }, [x, y]);

    return (
        <div
            ref={popoverRef}
            data-player-popover
            className="absolute z-50 w-56 animate-in fade-in zoom-in-95 duration-200"
            style={{
                left: `${adjustedPos.x}px`,
                top: `${adjustedPos.y}px`,
            }}
        >
            <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-2xl shadow-black/50 backdrop-blur-sm">
                {/* Header band */}
                <div className="relative h-12 bg-gradient-to-r from-accent/20 via-emerald-800/30 to-blue-400/20">
                    <div className="absolute -bottom-5 left-1/2 -translate-x-1/2">
                        <div className="rounded-full ring-2 ring-surface">
                            <Avatar
                                src={avatarUrl}
                                fallback={profile?.username || "P"}
                                size="lg"
                            />
                        </div>
                    </div>
                </div>

                {/* Info */}
                <div className="px-4 pb-4 pt-8 text-center">
                    <p className="text-sm font-bold text-foreground">
                        {profile?.username || "Unknown"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                        {posEmoji} {posName}
                    </p>

                    {/* Stats grid */}
                    <div className="mt-3 grid grid-cols-3 gap-1">
                        <StatBox
                            label="Skill"
                            value={`${profile?.skill_level ?? "?"}`}
                            icon="⭐"
                        />
                        <StatBox
                            label="Matches"
                            value={`${profile?.matches_played ?? 0}`}
                            icon="🏟️"
                        />
                        <StatBox
                            label="Goals"
                            value={`${profile?.goals_scored ?? 0}`}
                            icon="⚽"
                        />
                    </div>

                    {participant.is_mvp && (
                        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-yellow-400/10 px-2.5 py-1 text-xs font-semibold text-yellow-400">
                            🏅 MVP
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function StatBox({
    label,
    value,
    icon,
}: {
    label: string;
    value: string;
    icon: string;
}) {
    return (
        <div className="rounded-lg bg-zinc-800/80 px-2 py-1.5">
            <p className="text-[10px] text-muted">{icon} {label}</p>
            <p className="text-sm font-bold text-foreground">{value}</p>
        </div>
    );
}
