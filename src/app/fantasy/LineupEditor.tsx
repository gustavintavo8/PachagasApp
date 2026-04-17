"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveLineup, setCaptain } from "./actions";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { getAvatarUrl } from "@/lib/utils";
import { Crown, Wallet, AlertTriangle } from "lucide-react";
import { POSITION_ICONS, POSITION_SHORT } from "@/lib/positions";
import type { FantasyRoster, FantasyTeam, Profile } from "@/lib/types";

type RosterEntry = FantasyRoster & { profiles: Profile };

interface LineupEditorProps {
    team: FantasyTeam;
    roster: RosterEntry[];
    supabaseUrl: string;
}

const ZONES: Record<string, number> = { FWD: 13, MID: 38, DEF: 63, GK: 85 };

const PITCH_COLORS: Record<string, string> = {
    GK: "bg-blue-950/90 text-blue-300 border-blue-500/50",
    DEF: "bg-emerald-950/90 text-emerald-300 border-emerald-500/50",
    MID: "bg-yellow-950/90 text-yellow-400 border-yellow-500/50",
    FWD: "bg-red-950/90 text-red-400 border-red-500/50",
};

function formatBudget(n: number) {
    return new Intl.NumberFormat("es-ES", {
        style: "currency",
        currency: "EUR",
        notation: "compact",
        maximumFractionDigits: 1,
    }).format(n);
}

function groupByPosition(players: RosterEntry[]) {
    const g: Record<string, RosterEntry[]> = { GK: [], DEF: [], MID: [], FWD: [] };
    for (const p of players) {
        const pos = p.profiles.position ?? "MID";
        (g[pos] ?? g.MID).push(p);
    }
    return g;
}

/* ── Pitch player token ── */
function PitchPlayer({
    entry,
    isCaptain,
    supabaseUrl,
    onClick,
}: {
    entry: RosterEntry;
    isCaptain: boolean;
    supabaseUrl: string;
    onClick: () => void;
}) {
    const { profiles: p } = entry;
    const avatarUrl = getAvatarUrl(supabaseUrl, p.avatar_url);
    const pos = (p.position ?? "MID") as keyof typeof PITCH_COLORS;
    const label = (POSITION_SHORT as Record<string, string>)[pos] ?? pos;
    const icon = (POSITION_ICONS as Record<string, string>)[pos] ?? "";
    const color = PITCH_COLORS[pos] ?? PITCH_COLORS.MID;

    return (
        <button
            type="button"
            onClick={onClick}
            title="Mover al banquillo"
            className="group flex flex-col items-center gap-1 focus:outline-none"
        >
            <div className="relative mb-3 flex flex-col items-center">
                {isCaptain && (
                    <Crown
                        size={11}
                        className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10 text-accent drop-shadow-[0_0_5px_rgba(204,255,0,0.9)]"
                    />
                )}
                <div className="relative rounded-full ring-[3px] ring-accent/70 shadow-[0_0_10px_rgba(204,255,0,0.3)] outline outline-1 outline-black/50 transition-all duration-200 group-hover:ring-red-400 group-hover:shadow-[0_0_14px_rgba(239,68,68,0.5)] group-hover:scale-110">
                    <Avatar src={avatarUrl} fallback={p.username || "?"} size="sm" />
                    <div className="absolute inset-0 rounded-full bg-red-500/0 group-hover:bg-red-500/20 transition-colors duration-200" />
                </div>
                <span className={`absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-[1px] rounded-full border px-1.5 py-[1.5px] text-[8.5px] font-bold tracking-wider ${color} shadow-[0_2px_4px_rgba(0,0,0,0.6)] whitespace-nowrap z-10 backdrop-blur-sm`}>
                    <span className="text-[9px]">{icon}</span>
                    {label}
                </span>
            </div>
            <span className="max-w-[56px] sm:max-w-[68px] truncate text-center text-[9px] sm:text-[11px] font-semibold text-white drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">
                {p.username || "???"}
            </span>
        </button>
    );
}

/* ── Bench player card ── */
function BenchPlayer({
    entry,
    supabaseUrl,
    canAdd,
    isCaptain,
    onClick,
}: {
    entry: RosterEntry;
    supabaseUrl: string;
    canAdd: boolean;
    isCaptain: boolean;
    onClick: () => void;
}) {
    const { profiles: p } = entry;
    const avatarUrl = getAvatarUrl(supabaseUrl, p.avatar_url);
    const pos = (p.position ?? "MID") as keyof typeof PITCH_COLORS;
    const label = (POSITION_SHORT as Record<string, string>)[pos] ?? pos;
    const icon = (POSITION_ICONS as Record<string, string>)[pos] ?? "";

    return (
        <button
            type="button"
            onClick={canAdd ? onClick : undefined}
            disabled={!canAdd}
            title={canAdd ? "Poner de titular" : "Plantilla de titulares llena (7/7)"}
            className={`group flex min-w-[64px] flex-col items-center gap-1.5 rounded-xl px-2.5 py-2 transition-all duration-150 focus:outline-none
                ${canAdd ? "cursor-pointer hover:bg-white/10 hover:scale-105" : "cursor-not-allowed opacity-40"}`}
        >
            <div className="relative">
                <Avatar src={avatarUrl} fallback={p.username || "?"} size="sm" />
                {canAdd && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-black text-black opacity-0 transition-opacity group-hover:opacity-100">
                        +
                    </span>
                )}
                {isCaptain && (
                    <Crown size={10} className="absolute -top-1 -left-1 text-accent drop-shadow-[0_0_4px_rgba(204,255,0,0.8)]" />
                )}
            </div>
            <span className="max-w-[60px] truncate text-center text-[10px] font-medium text-foreground/80">
                {p.username || "?"}
            </span>
            <span className="text-[9px] text-muted">
                {icon} {label}
            </span>
        </button>
    );
}

/* ── Main component ── */
export function LineupEditor({ team, roster, supabaseUrl }: LineupEditorProps) {
    const savedCaptainId = roster.find((r) => r.is_captain)?.player_id ?? "";

    const [starterIds, setStarterIds] = useState<Set<string>>(
        () => new Set(roster.filter((r) => r.is_starter).map((r) => r.player_id))
    );
    const [captainId, updateCaptainId] = useState(savedCaptainId);
    const [savingLineup, setSavingLineup] = useState(false);
    const [savingCaptain, setSavingCaptain] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    const starters = roster.filter((r) => starterIds.has(r.player_id));
    const bench = roster.filter((r) => !starterIds.has(r.player_id));
    const captainOnPitch = starterIds.has(captainId);

    const lineupChanged = (() => {
        const saved = new Set(roster.filter((r) => r.is_starter).map((r) => r.player_id));
        if (saved.size !== starterIds.size) return true;
        for (const id of starterIds) if (!saved.has(id)) return true;
        return false;
    })();
    const captainChanged = !!captainId && captainId !== savedCaptainId && captainOnPitch;

    function togglePlayer(playerId: string) {
        if (!starterIds.has(playerId) && starterIds.size >= 7) {
            toast("Ya tienes 7 titulares. Retira a uno primero.", "error");
            return;
        }
        setStarterIds((prev) => {
            const next = new Set(prev);
            if (next.has(playerId)) next.delete(playerId);
            else next.add(playerId);
            return next;
        });
    }

    async function handleSaveLineup() {
        if (starterIds.size !== 7) return;
        setSavingLineup(true);
        const result = await saveLineup(team.id, Array.from(starterIds));
        if (result.success) {
            toast("Alineación guardada", "success");
            router.refresh();
        } else {
            toast(result.error ?? "Error al guardar", "error");
        }
        setSavingLineup(false);
    }

    async function handleSaveCaptain() {
        if (!captainChanged) return;
        setSavingCaptain(true);
        const result = await setCaptain(team.id, captainId);
        if (result.success) {
            toast("Capitán actualizado", "success");
            router.refresh();
        } else {
            toast(result.error ?? "Error al cambiar el capitán", "error");
            updateCaptainId(savedCaptainId);
        }
        setSavingCaptain(false);
    }

    const starterGroups = groupByPosition(starters);

    return (
        <div className="space-y-4">
            {/* Team header */}
            <Card>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-lg font-bold text-foreground">{team.name}</p>
                        <p className="text-xs text-muted mt-0.5">
                            {roster.length} jugadores · {team.total_points} pts
                        </p>
                    </div>
                    <div className="flex items-center gap-2 font-semibold text-accent text-sm">
                        <Wallet size={16} />
                        {formatBudget(team.budget)}
                    </div>
                </div>
            </Card>

            {/* Pitch + Bench */}
            <div>
                {/* Pitch */}
                <div
                    className="relative w-full overflow-hidden rounded-t-2xl border border-border"
                    style={{ paddingBottom: "128%" }}
                >
                    {/* Grass */}
                    <div className="absolute inset-0 bg-gradient-to-b from-emerald-900 via-emerald-800 to-emerald-900">
                        <div
                            className="absolute inset-0"
                            style={{
                                backgroundImage:
                                    "repeating-linear-gradient(180deg, transparent, transparent 9.9%, rgba(0,0,0,0.07) 9.9%, rgba(0,0,0,0.07) 10.1%, transparent 10.1%, transparent 20%)",
                            }}
                        />
                    </div>

                    {/* SVG markings */}
                    <svg
                        viewBox="0 0 600 768"
                        className="absolute inset-0 h-full w-full"
                        preserveAspectRatio="xMidYMid meet"
                        aria-hidden="true"
                    >
                        {/* Outer boundary */}
                        <rect x="30" y="30" width="540" height="708" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" rx="4" />
                        {/* Halfway line */}
                        <line x1="30" y1="384" x2="570" y2="384" stroke="rgba(255,255,255,0.22)" strokeWidth="2" />
                        {/* Centre circle */}
                        <circle cx="300" cy="384" r="55" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="2" />
                        <circle cx="300" cy="384" r="4" fill="rgba(255,255,255,0.35)" />
                        {/* Top penalty area */}
                        <rect x="165" y="30" width="270" height="108" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="2" />
                        <rect x="225" y="30" width="150" height="44" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" />
                        <rect x="240" y="12" width="120" height="18" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" rx="2" />
                        <path d="M204,138 A60,60 0 0,0 396,138" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" />
                        {/* Bottom penalty area */}
                        <rect x="165" y="630" width="270" height="108" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="2" />
                        <rect x="225" y="694" width="150" height="44" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" />
                        <rect x="240" y="738" width="120" height="18" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" rx="2" />
                        <path d="M204,630 A60,60 0 0,1 396,630" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" />
                        {/* Corners */}
                        <path d="M30,45 A15,15 0 0,1 45,30" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" />
                        <path d="M555,30 A15,15 0 0,1 570,45" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" />
                        <path d="M45,738 A15,15 0 0,1 30,723" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" />
                        <path d="M570,723 A15,15 0 0,1 555,738" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" />
                    </svg>

                    {/* Players overlay */}
                    <div className="absolute inset-0">
                        {(["FWD", "MID", "DEF", "GK"] as const).map((pos) => {
                            const players = starterGroups[pos] ?? [];
                            if (players.length === 0) return null;
                            return (
                                <div
                                    key={pos}
                                    className="absolute left-0 right-0 flex justify-center"
                                    style={{ top: `${ZONES[pos]}%`, transform: "translateY(-50%)" }}
                                >
                                    <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 px-3">
                                        {players.map((entry) => (
                                            <PitchPlayer
                                                key={entry.player_id}
                                                entry={entry}
                                                isCaptain={entry.player_id === captainId && captainOnPitch}
                                                supabaseUrl={supabaseUrl}
                                                onClick={() => togglePlayer(entry.player_id)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Slot counter badge */}
                        <div className="absolute bottom-3 right-3">
                            <span
                                className={`rounded-full border px-2.5 py-1 text-xs font-bold backdrop-blur-sm
                                    ${starterIds.size === 7
                                        ? "border-accent/50 bg-accent/20 text-accent"
                                        : "border-white/20 bg-black/50 text-white/70"
                                    }`}
                            >
                                {starterIds.size}/7
                            </span>
                        </div>

                        {/* Empty hint */}
                        {starters.length === 0 && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <p className="rounded-xl bg-black/50 px-4 py-2 text-sm text-white/60 backdrop-blur-sm border border-white/10">
                                    Selecciona titulares desde el banquillo ↓
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Bench */}
                <div className="rounded-b-2xl border border-t-0 border-border bg-zinc-900/70 px-4 py-3">
                    <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-muted/80">
                        Banquillo
                    </p>
                    {bench.length === 0 ? (
                        <p className="py-2 text-center text-xs text-muted/50">
                            {roster.length === 0 ? "Ve al Mercado a fichar jugadores" : "Todos en el campo"}
                        </p>
                    ) : (
                        <div className="flex gap-1 overflow-x-auto pb-1">
                            {bench.map((entry) => (
                                <BenchPlayer
                                    key={entry.player_id}
                                    entry={entry}
                                    supabaseUrl={supabaseUrl}
                                    canAdd={starterIds.size < 7}
                                    isCaptain={entry.player_id === captainId}
                                    onClick={() => togglePlayer(entry.player_id)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Captain on bench warning */}
            {captainId && !captainOnPitch && (
                <div className="flex items-start gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                    <span>Tu capitán está en el banquillo y no multiplicará puntos.</span>
                </div>
            )}

            {/* Save lineup */}
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
                <div>
                    <p className={`text-sm font-semibold ${starterIds.size === 7 ? "text-accent" : "text-muted"}`}>
                        {starterIds.size}/7 titulares
                    </p>
                    {starterIds.size < 7 && (
                        <p className="text-xs text-muted">
                            Faltan {7 - starterIds.size} jugador{7 - starterIds.size !== 1 ? "es" : ""}
                        </p>
                    )}
                </div>
                <Button
                    size="sm"
                    disabled={starterIds.size !== 7 || !lineupChanged}
                    loading={savingLineup}
                    onClick={handleSaveLineup}
                >
                    Guardar alineación
                </Button>
            </div>

            {/* Captain selector — only starters */}
            {roster.length > 0 && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Crown size={18} className="text-accent" />
                            <CardTitle>Capitán</CardTitle>
                        </div>
                    </CardHeader>
                    <p className="mb-3 text-xs text-muted">
                        Solo los titulares pueden ser capitán. Sus puntos se multiplican ×2.
                    </p>
                    <div className="flex items-center gap-3">
                        <select
                            value={captainId}
                            onChange={(e) => updateCaptainId(e.target.value)}
                            className="flex-1 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground focus:border-accent focus:outline-none"
                        >
                            <option value="">Seleccionar capitán…</option>
                            {starters.map((entry) => (
                                <option key={entry.player_id} value={entry.player_id}>
                                    {entry.profiles.username ?? entry.player_id}
                                    {entry.player_id === savedCaptainId ? " ★" : ""}
                                </option>
                            ))}
                        </select>
                        <Button
                            size="sm"
                            disabled={!captainChanged}
                            loading={savingCaptain}
                            onClick={handleSaveCaptain}
                        >
                            Confirmar
                        </Button>
                    </div>
                </Card>
            )}
        </div>
    );
}
