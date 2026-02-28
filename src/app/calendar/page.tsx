import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CalendarView } from "./CalendarView";

export const metadata: Metadata = {
    title: "Calendario — Pachanga",
    description: "Vista de calendario de todos tus partidos.",
};

export default async function CalendarPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    // Fetch all matches the user is part of (as participant or organizer)
    const { data: participations } = await supabase
        .from("match_participants")
        .select("match_id")
        .eq("user_id", user.id);

    const matchIds = participations?.map((p) => p.match_id) || [];

    // Also include matches the user created
    const { data: allMatches } = await supabase
        .from("matches")
        .select("id, date, location, status, max_players, created_by")
        .or(`id.in.(${matchIds.join(",")}),created_by.eq.${user.id}`)
        .order("date", { ascending: true });

    // Get participant counts
    const { data: participantCounts } = await supabase
        .from("match_participants")
        .select("match_id");

    const countMap: Record<string, number> = {};
    if (participantCounts) {
        for (const p of participantCounts) {
            countMap[p.match_id] = (countMap[p.match_id] || 0) + 1;
        }
    }

    const matches = (allMatches || []).map((m) => ({
        id: m.id,
        date: m.date,
        location: m.location,
        status: m.status as "open" | "closed" | "finished",
        max_players: m.max_players,
        player_count: countMap[m.id] || 0,
        isOrganizer: m.created_by === user.id,
    }));

    return (
        <div className="mx-auto max-w-5xl px-4 py-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-foreground">📅 Calendario</h1>
                <p className="text-muted">Vista mensual de tus partidos</p>
            </div>
            <CalendarView matches={matches} />
        </div>
    );
}
