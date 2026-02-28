import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MatchesTabs } from "./MatchesTabs";

export const metadata: Metadata = {
    title: "Partidos — Pachanga",
    description: "Explora y únete a partidos de fútbol, y revisa tu historial.",
};

export default async function MatchesPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    // Fetch all matches with participants
    const { data: matches } = await supabase
        .from("matches")
        .select("*, match_participants(user_id, team, goals, is_mvp)")
        .order("date", { ascending: false });

    return (
        <MatchesTabs
            matches={matches || []}
            userId={user.id}
        />
    );
}
