"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, MapPin, Users } from "lucide-react";
import { Card } from "@/components/ui/Card";

interface MatchData {
    id: string;
    date: string;
    location: string;
    status: "open" | "closed" | "finished";
    max_players: number;
    player_count: number;
    isOrganizer: boolean;
}

interface CalendarViewProps {
    matches: MatchData[];
}

const MONTHS = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const statusDot: Record<string, string> = {
    open: "bg-accent",
    closed: "bg-yellow-400",
    finished: "bg-zinc-500",
};

export function CalendarView({ matches }: CalendarViewProps) {
    const today = new Date();
    const [currentMonth, setCurrentMonth] = useState(() => today.getMonth());
    const [currentYear, setCurrentYear] = useState(() => today.getFullYear());
    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    function prev() {
        if (currentMonth === 0) {
            setCurrentMonth(11);
            setCurrentYear((y) => y - 1);
        } else {
            setCurrentMonth((m) => m - 1);
        }
    }

    function next() {
        if (currentMonth === 11) {
            setCurrentMonth(0);
            setCurrentYear((y) => y + 1);
        } else {
            setCurrentMonth((m) => m + 1);
        }
    }

    // Build calendar grid
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();

    // Monday-based (0=Mon, 6=Sun)
    let startDay = firstDayOfMonth.getDay() - 1;
    if (startDay < 0) startDay = 6;

    const totalCells = Math.ceil((startDay + daysInMonth) / 7) * 7;

    // Group matches by date string (YYYY-MM-DD)
    const matchesByDate: Record<string, MatchData[]> = {};
    for (const m of matches) {
        const dateKey = m.date.split("T")[0];
        if (!matchesByDate[dateKey]) matchesByDate[dateKey] = [];
        matchesByDate[dateKey].push(m);
    }

    const isToday = (day: number) =>
        day === today.getDate() &&
        currentMonth === today.getMonth() &&
        currentYear === today.getFullYear();

    const selectedMatches = selectedDate ? matchesByDate[selectedDate] || [] : [];

    return (
        <div>
            {/* Month Navigation */}
            <div className="mb-6 flex items-center justify-between">
                <button
                    onClick={prev}
                    className="rounded-xl border border-border bg-surface p-2.5 text-muted transition-all hover:border-accent hover:text-accent"
                >
                    <ChevronLeft size={20} />
                </button>
                <h2 className="text-lg font-bold text-foreground">
                    {MONTHS[currentMonth]} {currentYear}
                </h2>
                <button
                    onClick={next}
                    className="rounded-xl border border-border bg-surface p-2.5 text-muted transition-all hover:border-accent hover:text-accent"
                >
                    <ChevronRight size={20} />
                </button>
            </div>

            {/* Calendar Grid */}
            <div className="overflow-hidden rounded-2xl border border-border bg-surface">
                {/* Weekday headers */}
                <div className="grid grid-cols-7 border-b border-border">
                    {WEEKDAYS.map((day) => (
                        <div
                            key={day}
                            className="px-2 py-2.5 text-center text-xs font-medium text-muted"
                        >
                            {day}
                        </div>
                    ))}
                </div>

                {/* Days */}
                <div className="grid grid-cols-7">
                    {Array.from({ length: totalCells }).map((_, i) => {
                        const day = i - startDay + 1;
                        const isValid = day >= 1 && day <= daysInMonth;
                        const dateKey = isValid
                            ? `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                            : "";
                        const dayMatches = isValid ? matchesByDate[dateKey] || [] : [];
                        const selected = dateKey === selectedDate;

                        return (
                            <button
                                key={i}
                                disabled={!isValid}
                                onClick={() => isValid && setSelectedDate(selected ? null : dateKey)}
                                className={`relative flex min-h-[60px] flex-col items-center border-b border-r border-border p-1.5 transition-all sm:min-h-[80px] ${!isValid
                                    ? "cursor-default bg-zinc-900/50"
                                    : selected
                                        ? "bg-accent/10"
                                        : "hover:bg-zinc-800/50"
                                    }`}
                            >
                                {isValid && (
                                    <>
                                        <span
                                            className={`mb-1 flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${isToday(day)
                                                ? "bg-accent text-zinc-950 font-bold"
                                                : selected
                                                    ? "text-accent"
                                                    : "text-foreground"
                                                }`}
                                        >
                                            {day}
                                        </span>
                                        {dayMatches.length > 0 && (
                                            <div className="flex gap-0.5">
                                                {dayMatches.slice(0, 3).map((m) => (
                                                    <div
                                                        key={m.id}
                                                        className={`h-1.5 w-1.5 rounded-full ${statusDot[m.status]}`}
                                                    />
                                                ))}
                                                {dayMatches.length > 3 && (
                                                    <span className="text-[8px] text-muted">
                                                        +{dayMatches.length - 3}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Legend */}
            <div className="mt-4 flex gap-4 text-xs text-muted">
                <span className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-accent" /> Abierto
                </span>
                <span className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-yellow-400" /> Cerrado
                </span>
                <span className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-zinc-500" /> Finalizado
                </span>
            </div>

            {/* Selected Date Matches */}
            {selectedDate && (
                <div className="mt-6">
                    <h3 className="mb-3 text-sm font-semibold text-foreground">
                        Partidos del {new Date(selectedDate + "T00:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
                    </h3>
                    {selectedMatches.length > 0 ? (
                        <div className="space-y-3">
                            {selectedMatches.map((m) => (
                                <Link key={m.id} href={`/matches/${m.id}`}>
                                    <Card className="transition-all hover:border-accent/30 hover:bg-accent/5">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <MapPin size={14} className="text-accent" />
                                                    <p className="font-medium text-foreground">
                                                        {m.location}
                                                    </p>
                                                </div>
                                                <p className="mt-1 text-xs text-muted">
                                                    {new Date(m.date).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                                                    {m.isOrganizer && " · Organizador"}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <div className="flex items-center gap-1 text-sm text-muted">
                                                    <Users size={14} />
                                                    {m.player_count}/{m.max_players}
                                                </div>
                                                <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium ${m.status === "open"
                                                    ? "border-accent/30 text-accent"
                                                    : m.status === "closed"
                                                        ? "border-yellow-500/30 text-yellow-400"
                                                        : "border-zinc-500/30 text-zinc-400"
                                                    }`}>
                                                    {m.status === "open" ? "Abierto" : m.status === "closed" ? "Cerrado" : "Finalizado"}
                                                </span>
                                            </div>
                                        </div>
                                    </Card>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted">Sin partidos este día</p>
                    )}
                </div>
            )}
        </div>
    );
}
