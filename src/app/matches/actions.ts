"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { balanceTeams } from "@/lib/team-balancer";
import { rateLimit } from "@/lib/rate-limit";

type ActionResult = { success: boolean; error?: string; data?: unknown };

async function sendNotification(
    userIds: string[],
    type: string,
    title: string,
    message: string,
    matchId?: string
) {
    if (userIds.length === 0) return;
    const admin = createAdminClient();
    const rows = userIds.map((uid) => ({
        user_id: uid,
        type,
        title,
        message,
        match_id: matchId ?? null,
    }));
    const { error } = await admin.from("notifications").insert(rows);
    if (error) console.error("Error sending notifications:", error.message);
}

export async function createMatch(formData: FormData): Promise<ActionResult> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "Not authenticated" };

    const { allowed } = rateLimit(`create-match:${user.id}`, 5, 60_000);
    if (!allowed) return { success: false, error: "Demasiadas acciones. Espera un momento." };

    const date = formData.get("date") as string;
    const location = formData.get("location") as string;
    const max_players = parseInt(formData.get("max_players") as string, 10);

    if (!date) return { success: false, error: "Date is required" };
    if (!location || location.trim().length < 2)
        return { success: false, error: "Location is required" };
    if (isNaN(max_players) || max_players < 4 || max_players > 30)
        return { success: false, error: "Max players must be between 4 and 30" };

    const { data, error } = await supabase
        .from("matches")
        .insert({
            date,
            location: location.trim(),
            max_players,
            status: "open",
            created_by: user.id,
        })
        .select("id")
        .single();

    if (error) return { success: false, error: error.message };

    revalidatePath("/");
    revalidatePath("/matches");
    revalidatePath("/calendar");
    redirect(`/matches/${data.id}`);
}

export async function joinMatch(matchId: string): Promise<ActionResult> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "Not authenticated" };

    // Check if already joined
    const { data: existing } = await supabase
        .from("match_participants")
        .select("user_id")
        .eq("match_id", matchId)
        .eq("user_id", user.id)
        .single();

    if (existing) return { success: false, error: "You already joined this match" };

    // Check player count and match status
    const { count } = await supabase
        .from("match_participants")
        .select("*", { count: "exact", head: true })
        .eq("match_id", matchId);

    const { data: match } = await supabase
        .from("matches")
        .select("max_players, status")
        .eq("id", matchId)
        .single();

    if (!match) return { success: false, error: "Match not found" };
    if (match.status !== "open") return { success: false, error: "Match is not open for joining" };
    if (count !== null && count >= match.max_players)
        return { success: false, error: "Match is full" };

    const { error } = await supabase
        .from("match_participants")
        .insert({ match_id: matchId, user_id: user.id });

    if (error) return { success: false, error: error.message };

    // Notify the organizer that someone joined
    const { data: joinerProfile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .single();
    const { data: matchForNotif } = await supabase
        .from("matches")
        .select("created_by, location")
        .eq("id", matchId)
        .single();
    if (matchForNotif && matchForNotif.created_by !== user.id) {
        sendNotification(
            [matchForNotif.created_by],
            "join",
            "Nuevo jugador",
            `${joinerProfile?.username || "Alguien"} se unió a ${matchForNotif.location}`,
            matchId
        );
    }

    revalidatePath(`/matches/${matchId}`);
    revalidatePath("/");
    revalidatePath("/matches");
    revalidatePath("/calendar");
    return { success: true };
}

export async function leaveMatch(matchId: string): Promise<ActionResult> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "Not authenticated" };

    const { error } = await supabase
        .from("match_participants")
        .delete()
        .eq("match_id", matchId)
        .eq("user_id", user.id);

    if (error) return { success: false, error: error.message };

    revalidatePath(`/matches/${matchId}`);
    revalidatePath("/");
    revalidatePath("/matches");
    revalidatePath("/calendar");
    return { success: true };
}

export async function closeMatch(matchId: string): Promise<ActionResult> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "Not authenticated" };

    // Verify organizer
    const { data: match } = await supabase
        .from("matches")
        .select("created_by")
        .eq("id", matchId)
        .single();

    if (match?.created_by !== user.id)
        return { success: false, error: "Only the organizer can close this match" };

    const { error } = await supabase
        .from("matches")
        .update({ status: "closed" })
        .eq("id", matchId)
        .eq("created_by", user.id);

    if (error) return { success: false, error: error.message };

    revalidatePath(`/matches/${matchId}`);
    revalidatePath("/");
    revalidatePath("/matches");
    revalidatePath("/calendar");
    return { success: true };
}

export async function setScore(
    matchId: string,
    teamAScore: number,
    teamBScore: number,
    goalScorers?: { userId: string; goals: number }[]
): Promise<ActionResult> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "Not authenticated" };

    if (teamAScore < 0 || teamBScore < 0)
        return { success: false, error: "Scores cannot be negative" };

    const { error } = await supabase
        .from("matches")
        .update({
            team_a_score: teamAScore,
            team_b_score: teamBScore,
            status: "finished",
        })
        .eq("id", matchId)
        .eq("created_by", user.id);

    if (error) return { success: false, error: error.message };

    // Use admin client for all participant-level updates (bypasses RLS)
    const adminSupabase = createAdminClient();

    // Update individual goal scorers if provided
    if (goalScorers && goalScorers.length > 0) {
        for (const scorer of goalScorers) {
            if (scorer.goals > 0) {
                const { error: scorerError } = await adminSupabase
                    .from("match_participants")
                    .update({ goals: scorer.goals })
                    .eq("match_id", matchId)
                    .eq("user_id", scorer.userId);
                if (scorerError) console.error("Error updating scorer:", scorer.userId, scorerError.message);
            }
        }
    }

    // Update profile stats (matches_played & goals_scored) for all participants
    const { data: allParticipants, error: fetchError } = await adminSupabase
        .from("match_participants")
        .select("user_id, goals")
        .eq("match_id", matchId);

    if (fetchError) console.error("Error fetching participants:", fetchError.message);

    if (allParticipants) {
        for (const participant of allParticipants) {
            const { data: profile } = await adminSupabase
                .from("profiles")
                .select("matches_played, goals_scored")
                .eq("id", participant.user_id)
                .single();

            if (profile) {
                const { error: updateError } = await adminSupabase
                    .from("profiles")
                    .update({
                        matches_played: (profile.matches_played ?? 0) + 1,
                        goals_scored: (profile.goals_scored ?? 0) + (participant.goals ?? 0),
                    })
                    .eq("id", participant.user_id);
                if (updateError) console.error("Error updating profile:", participant.user_id, updateError.message);
            }
        }
    }

    // Notify all participants about the score
    if (allParticipants) {
        const participantIds = allParticipants
            .map((p) => p.user_id)
            .filter((id) => id !== user.id);
        const { data: matchForNotif } = await supabase
            .from("matches")
            .select("location")
            .eq("id", matchId)
            .single();
        sendNotification(
            participantIds,
            "score",
            "¡Resultado registrado!",
            `${matchForNotif?.location || "Partido"}: ${teamAScore} - ${teamBScore}`,
            matchId
        );
    }

    revalidatePath(`/matches/${matchId}`);
    revalidatePath("/");
    revalidatePath("/matches");
    revalidatePath("/calendar");
    return { success: true };
}

export async function generateTeams(matchId: string): Promise<ActionResult> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "Not authenticated" };

    // Verify organizer
    const { data: match } = await supabase
        .from("matches")
        .select("created_by")
        .eq("id", matchId)
        .single();

    if (match?.created_by !== user.id)
        return { success: false, error: "Only the organizer can generate teams" };

    // Fetch participants with skill levels
    const { data: participants } = await supabase
        .from("match_participants")
        .select("user_id, profiles(skill_level)")
        .eq("match_id", matchId);

    if (!participants || participants.length < 2)
        return { success: false, error: "Need at least 2 players to generate teams" };

    const playersWithSkill = participants.map((p) => ({
        user_id: p.user_id,
        skill_level:
            (p.profiles as unknown as { skill_level: number })?.skill_level ?? 5,
    }));

    const { assignments, balanceScore } = balanceTeams(playersWithSkill);

    // Update each participant's team
    for (const assignment of assignments) {
        await supabase
            .from("match_participants")
            .update({ team: assignment.team })
            .eq("match_id", matchId)
            .eq("user_id", assignment.user_id);
    }

    // Notify all participants that teams have been generated
    const { data: matchForNotif } = await supabase
        .from("matches")
        .select("location")
        .eq("id", matchId)
        .single();
    const participantIds = participants.map((p) => p.user_id).filter((id) => id !== user.id);
    sendNotification(
        participantIds,
        "teams",
        "¡Equipos generados!",
        `Se han generado los equipos para ${matchForNotif?.location || "tu partido"}`,
        matchId
    );

    revalidatePath(`/matches/${matchId}`);
    revalidatePath("/calendar");
    return {
        success: true,
        data: { balanceScore: balanceScore.toFixed(2) },
    };
}
