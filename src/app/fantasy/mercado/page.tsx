import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Profile, FantasyTeam } from "@/lib/types";
import { MarketList } from "./MarketList";

export default async function MercadoPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const [{ data: players }, { data: team }] = await Promise.all([
        supabase
            .from("profiles")
            .select("*")
            .order("market_value", { ascending: false, nullsFirst: false }),
        supabase
            .from("fantasy_teams")
            .select("*")
            .eq("user_id", user!.id)
            .maybeSingle(),
    ]);

    let myRosterIds: string[] = [];
    if (team) {
        const { data: roster } = await supabase
            .from("fantasy_rosters")
            .select("player_id")
            .eq("team_id", team.id);
        myRosterIds = (roster ?? []).map((r) => r.player_id);
    }

    return (
        <MarketList
            players={(players ?? []) as Profile[]}
            team={team as FantasyTeam | null}
            myRosterIds={myRosterIds}
        />
    );
}
