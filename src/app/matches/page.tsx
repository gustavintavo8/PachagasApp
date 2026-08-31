import type { Metadata } from "next";
import { requireCommunityAccess } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MatchesTabs } from "./MatchesTabs";
import { getActiveSeason } from "@/lib/seasons";

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
    if (user.is_anonymous === true) redirect("/login");

    const access = await requireCommunityAccess(user);
    if (!access.success) redirect("/access");
    const season = await getActiveSeason();

    const { data: matches } = await supabase
        .from("matches")
        .select("*, match_participants(user_id, team, goals, is_mvp)")
        .eq("season_id", season.id)
        .order("date", { ascending: false })
        .limit(30);

    return (
        <MatchesTabs
            matches={matches || []}
            userId={user.id}
            isGuest={false}
        />
    );
}
