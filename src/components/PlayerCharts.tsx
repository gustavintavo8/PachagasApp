"use client";

import dynamic from "next/dynamic";
import { Card } from "@/components/ui/Card";
import { Target, TrendingUp } from "lucide-react";

interface GoalData {
    month: string;
    goals: number;
}

interface WinRateData {
    match: number;
    rate: number;
}

interface RpData {
    match: number;
    rp: number;
}

interface PlayerChartsProps {
    goalsPerMonth: GoalData[];
    winRateOverTime: WinRateData[];
    rpOverTime?: RpData[];
}

// ── Lazy-load recharts to keep it out of the initial JS bundle ──────────────
const LazyBarChart = dynamic(
    () => import("recharts").then((m) => ({ default: m.BarChart })),
    { ssr: false }
);
const LazyAreaChart = dynamic(
    () => import("recharts").then((m) => ({ default: m.AreaChart })),
    { ssr: false }
);
const LazyBar = dynamic(
    () => import("recharts").then((m) => ({ default: m.Bar })),
    { ssr: false }
);
const LazyArea = dynamic(
    () => import("recharts").then((m) => ({ default: m.Area })),
    { ssr: false }
);
const LazyXAxis = dynamic(
    () => import("recharts").then((m) => ({ default: m.XAxis })),
    { ssr: false }
);
const LazyYAxis = dynamic(
    () => import("recharts").then((m) => ({ default: m.YAxis })),
    { ssr: false }
);
const LazyTooltip = dynamic(
    () => import("recharts").then((m) => ({ default: m.Tooltip })),
    { ssr: false }
);
const LazyResponsiveContainer = dynamic(
    () => import("recharts").then((m) => ({ default: m.ResponsiveContainer })),
    { ssr: false, loading: () => <ChartSkeleton /> }
);
// ─────────────────────────────────────────────────────────────────────────────

const customTooltipStyle = {
    backgroundColor: "#18181b",
    border: "1px solid #27272a",
    borderRadius: "0.75rem",
    padding: "8px 12px",
    color: "#e4e4e7",
    fontSize: "12px",
};

const ChartSkeleton = () => (
    <div className="h-48 w-full animate-pulse rounded-xl bg-zinc-800/60" />
);

export function PlayerCharts({ goalsPerMonth, winRateOverTime, rpOverTime = [] }: PlayerChartsProps) {
    if (goalsPerMonth.length === 0 && winRateOverTime.length === 0 && rpOverTime.length === 0) return null;

    return (
        <div className="grid gap-6 sm:grid-cols-2">
            {/* Goals per Month */}
            {goalsPerMonth.length > 0 && (
                <Card>
                    <h3 className="mb-4 text-sm font-semibold text-foreground">
                        <Target size={16} className="inline" /> Goles por Mes
                    </h3>
                    <div className="h-48">
                        <LazyResponsiveContainer width="100%" height="100%">
                            <LazyBarChart data={goalsPerMonth}>
                                <LazyXAxis
                                    dataKey="month"
                                    tick={{ fill: "#71717a", fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <LazyYAxis
                                    tick={{ fill: "#71717a", fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                    allowDecimals={false}
                                />
                                <LazyTooltip contentStyle={customTooltipStyle} cursor={{ fill: "rgba(204, 255, 0, 0.05)" }} />
                                <LazyBar
                                    dataKey="goals"
                                    fill="#ccff00"
                                    radius={[6, 6, 0, 0]}
                                    name="Goles"
                                />
                            </LazyBarChart>
                        </LazyResponsiveContainer>
                    </div>
                </Card>
            )}

            {/* Win Rate Evolution */}
            {winRateOverTime.length > 1 && (
                <Card>
                    <h3 className="mb-4 text-sm font-semibold text-foreground">
                        <TrendingUp size={16} className="inline" /> Evolución Tasa de Victoria
                    </h3>
                    <div className="h-48">
                        <LazyResponsiveContainer width="100%" height="100%">
                            <LazyAreaChart data={winRateOverTime}>
                                <LazyXAxis
                                    dataKey="match"
                                    tick={{ fill: "#71717a", fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <LazyYAxis
                                    tick={{ fill: "#71717a", fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                    domain={[0, 100]}
                                    tickFormatter={(v) => `${v}%`}
                                />
                                <LazyTooltip
                                    contentStyle={customTooltipStyle}
                                    formatter={(value: any) => [`${(Number(value) ?? 0).toFixed(0)}%`, "Tasa de Victoria"]}
                                />
                                <defs>
                                    <linearGradient id="winGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ccff00" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#ccff00" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <LazyArea
                                    type="monotone"
                                    dataKey="rate"
                                    stroke="#ccff00"
                                    strokeWidth={2}
                                    fill="url(#winGradient)"
                                    name="Tasa"
                                />
                            </LazyAreaChart>
                        </LazyResponsiveContainer>
                    </div>
                </Card>
            )}

            {/* RP Evolution */}
            {rpOverTime.length > 1 && (
                <Card className="sm:col-span-2">
                    <h3 className="mb-4 text-sm font-semibold text-foreground">
                        <TrendingUp size={16} className="inline text-purple-400" /> Evolución del Rating (RP)
                    </h3>
                    <div className="h-64">
                        <LazyResponsiveContainer width="100%" height="100%">
                            <LazyAreaChart data={rpOverTime}>
                                <LazyXAxis
                                    dataKey="match"
                                    tick={{ fill: "#71717a", fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <LazyYAxis
                                    domain={["dataMin - 10", "dataMax + 10"]}
                                    tick={{ fill: "#71717a", fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                    allowDecimals={false}
                                />
                                <LazyTooltip
                                    contentStyle={customTooltipStyle}
                                    formatter={(value: any) => [`${value} RP`, "Rating"]}
                                />
                                <defs>
                                    <linearGradient id="rpGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <LazyArea
                                    type="monotone"
                                    dataKey="rp"
                                    stroke="#a855f7"
                                    strokeWidth={2}
                                    fill="url(#rpGradient)"
                                    name="RP"
                                />
                            </LazyAreaChart>
                        </LazyResponsiveContainer>
                    </div>
                </Card>
            )}
        </div>
    );
}
