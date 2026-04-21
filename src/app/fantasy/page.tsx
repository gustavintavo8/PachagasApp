import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { FantasyRoster, Profile } from "@/lib/types";
import { CreateTeamForm } from "./CreateTeamForm";
import { LineupEditor } from "./LineupEditor";

type RosterWithProfile = FantasyRoster & { profiles: Profile };

export default async function FantasyPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: team } = await supabase
        .from("fantasy_teams")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();

    if (!team) {
        return (
            <div className="flex flex-col items-center justify-center gap-6 py-16">
                <div className="text-center">
                    <p className="mb-2 text-xl font-semibold text-foreground">
                        ¡Aún no tienes equipo!
                    </p>
                    <p className="text-sm text-muted">
                        Crea tu equipo fantasy y empieza a competir.
                    </p>
                </div>
                <CreateTeamForm />
            </div>
        );
    }

    const { data: rosterData } = await supabase
        .from("fantasy_rosters")
        .select("*, profiles(*)")
        .eq("team_id", team.id);

    const roster = (rosterData ?? []) as RosterWithProfile[];
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

    return <LineupEditor team={team} roster={roster} supabaseUrl={supabaseUrl} />;
}
