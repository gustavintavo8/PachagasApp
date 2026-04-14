import { ShieldCheck, Shield, Crosshair, Zap } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Lucide icon components mapped to each position.
 * Usage:  {POSITION_ICONS.GK}  or  {POSITION_ICONS[player.position]}
 */
export const POSITION_ICONS: Record<string, ReactNode> = {
    GK: <ShieldCheck size={14} />,
    DEF: <Shield size={14} />,
    MID: <Crosshair size={14} />,
    FWD: <Zap size={14} />,
};

/** Short Spanish labels for each position */
export const POSITION_SHORT: Record<string, string> = {
    GK: "POR",
    DEF: "DEF",
    MID: "MED",
    FWD: "DEL",
};

/** Full Spanish labels for each position */
export const POSITION_FULL: Record<string, string> = {
    GK: "Portero",
    DEF: "Defensa",
    MID: "Mediocampista",
    FWD: "Delantero",
};

/** Shared color classes for position pills */
export const POSITION_COLORS: Record<string, string> = {
    GK: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    DEF: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    MID: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    FWD: "text-rose-400 bg-rose-500/10 border-rose-500/20",
};
