"use client";

import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    AreaChart, Area,
} from "recharts";
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

interface PlayerChartsProps {
    goalsPerMonth: GoalData[];
    winRateOverTime: WinRateData[];
}

const customTooltipStyle = {
    backgroundColor: "#18181b",
    border: "1px solid #27272a",
    borderRadius: "0.75rem",
    padding: "8px 12px",
    color: "#e4e4e7",
    fontSize: "12px",
};

export function PlayerCharts({ goalsPerMonth, winRateOverTime }: PlayerChartsProps) {
    if (goalsPerMonth.length === 0 && winRateOverTime.length === 0) return null;

    return (
        <div className="grid gap-6 sm:grid-cols-2">
            {/* Goals per Month */}
            {goalsPerMonth.length > 0 && (
                <Card>
                    <h3 className="mb-4 text-sm font-semibold text-foreground">
                        <Target size={16} className="inline" /> Goles por Mes
                    </h3>
                    <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={goalsPerMonth}>
                                <XAxis
                                    dataKey="month"
                                    tick={{ fill: "#71717a", fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    tick={{ fill: "#71717a", fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                    allowDecimals={false}
                                />
                                <Tooltip contentStyle={customTooltipStyle} cursor={{ fill: "rgba(204, 255, 0, 0.05)" }} />
                                <Bar
                                    dataKey="goals"
                                    fill="#ccff00"
                                    radius={[6, 6, 0, 0]}
                                    name="Goles"
                                />
                            </BarChart>
                        </ResponsiveContainer>
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
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={winRateOverTime}>
                                <XAxis
                                    dataKey="match"
                                    tick={{ fill: "#71717a", fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    tick={{ fill: "#71717a", fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                    domain={[0, 100]}
                                    tickFormatter={(v) => `${v}%`}
                                />
                                <Tooltip
                                    contentStyle={customTooltipStyle}
                                    formatter={(value?: number) => [`${(value ?? 0).toFixed(0)}%`, "Tasa de Victoria"]}
                                />
                                <defs>
                                    <linearGradient id="winGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ccff00" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#ccff00" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <Area
                                    type="monotone"
                                    dataKey="rate"
                                    stroke="#ccff00"
                                    strokeWidth={2}
                                    fill="url(#winGradient)"
                                    name="Tasa"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            )}
        </div>
    );
}
