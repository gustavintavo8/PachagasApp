"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { balanceTeams } from "@/lib/team-balancer";

export async function createMatch(formData: FormData) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { error: "Not authenticated" };

    const date = formData.get("date") as string;
    const location = formData.get("location") as string;
    const max_players = parseInt(formData.get("max_players") as string, 10);

    const { data, error } = await supabase
        .from("matches")
        .insert({
            date,
            location,
            max_players,
            status: "open",
            created_by: user.id,
        })
        .select("id")
        .single();

    if (error) return { error: error.message };

    redirect(`/matches/${data.id}`);
}

export async function joinMatch(matchId: string) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { error: "Not authenticated" };

    // Check if already joined
    const { data: existing } = await supabase
        .from("match_participants")
        .select("user_id")
        .eq("match_id", matchId)
        .eq("user_id", user.id)
        .single();

    if (existing) return { error: "Already joined" };

    // Check player count
    const { count } = await supabase
        .from("match_participants")
        .select("*", { count: "exact", head: true })
        .eq("match_id", matchId);

    const { data: match } = await supabase
        .from("matches")
        .select("max_players, status")
        .eq("id", matchId)
        .single();

    if (match?.status !== "open") return { error: "Match is not open" };
    if (count !== null && match && count >= match.max_players) {
        return { error: "Match is full" };
    }

    const { error } = await supabase
        .from("match_participants")
        .insert({ match_id: matchId, user_id: user.id });

    if (error) return { error: error.message };

    revalidatePath(`/matches/${matchId}`);
    revalidatePath("/");
    return { success: true };
}

export async function leaveMatch(matchId: string) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { error: "Not authenticated" };

    const { error } = await supabase
        .from("match_participants")
        .delete()
        .eq("match_id", matchId)
        .eq("user_id", user.id);

    if (error) return { error: error.message };

    revalidatePath(`/matches/${matchId}`);
    revalidatePath("/");
    return { success: true };
}

export async function closeMatch(matchId: string) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { error: "Not authenticated" };

    const { error } = await supabase
        .from("matches")
        .update({ status: "closed" })
        .eq("id", matchId)
        .eq("created_by", user.id);

    if (error) return { error: error.message };

    revalidatePath(`/matches/${matchId}`);
    return { success: true };
}

export async function setScore(
    matchId: string,
    teamAScore: number,
    teamBScore: number
) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { error: "Not authenticated" };

    const { error } = await supabase
        .from("matches")
        .update({
            team_a_score: teamAScore,
            team_b_score: teamBScore,
            status: "finished",
        })
        .eq("id", matchId)
        .eq("created_by", user.id);

    if (error) return { error: error.message };

    revalidatePath(`/matches/${matchId}`);
    revalidatePath("/");
    return { success: true };
}

export async function generateTeams(matchId: string) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { error: "Not authenticated" };

    // Verify organizer
    const { data: match } = await supabase
        .from("matches")
        .select("created_by")
        .eq("id", matchId)
        .single();

    if (match?.created_by !== user.id) {
        return { error: "Only the organizer can generate teams" };
    }

    // Fetch participants with skill levels
    const { data: participants } = await supabase
        .from("match_participants")
        .select("user_id, profiles(skill_level)")
        .eq("match_id", matchId);

    if (!participants || participants.length < 2) {
        return { error: "Need at least 2 players to generate teams" };
    }

    const playersWithSkill = participants.map((p) => ({
        user_id: p.user_id,
        skill_level:
            (p.profiles as unknown as { skill_level: number })?.skill_level ?? 5,
    }));

    const assignments = balanceTeams(playersWithSkill);

    // Update each participant's team
    for (const assignment of assignments) {
        await supabase
            .from("match_participants")
            .update({ team: assignment.team })
            .eq("match_id", matchId)
            .eq("user_id", assignment.user_id);
    }

    revalidatePath(`/matches/${matchId}`);
    return { success: true };
}
