"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { balanceTeams } from "@/lib/team-balancer";
import { rateLimit } from "@/lib/rate-limit";
import { isAdmin } from "@/lib/permissions";

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

    // Auto-join the creator
    const { error: joinError } = await supabase
        .from("match_participants")
        .insert({
            match_id: data.id,
            user_id: user.id,
            team: null,
            goals: 0,
            is_mvp: false,
        });

    if (joinError) console.error("Error auto-joining creator:", joinError.message);

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

    // Verify organizer or admin
    const { data: match } = await supabase
        .from("matches")
        .select("created_by")
        .eq("id", matchId)
        .single();

    const admin = isAdmin(user.email);
    if (match?.created_by !== user.id && !admin)
        return { success: false, error: "Only the organizer can close this match" };

    // Admin uses admin client to bypass RLS
    const client = admin ? createAdminClient() : supabase;
    const { error } = await client
        .from("matches")
        .update({ status: "closed" })
        .eq("id", matchId);

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

    const { data: match } = await supabase
        .from("matches")
        .select("status")
        .eq("id", matchId)
        .single();

    const isAlreadyFinished = match?.status === "finished";

    // Admin can set score on any match
    const admin = isAdmin(user.email);
    const client = admin ? createAdminClient() : supabase;
    let query = client
        .from("matches")
        .update({
            team_a_score: teamAScore,
            team_b_score: teamBScore,
            status: "finished",
        })
        .eq("id", matchId);
    if (!admin) query = query.eq("created_by", user.id);
    const { error } = await query;

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

    // Update profile stats (matches_played & goals_scored) for all participants ONLY if not already finished
    const { data: allParticipants, error: fetchError } = await adminSupabase
        .from("match_participants")
        .select("user_id, goals")
        .eq("match_id", matchId);

    if (fetchError) console.error("Error fetching participants:", fetchError.message);

    // Update profile stats (matches_played & goals_scored) for all participants ONLY if not already finished
    if (!isAlreadyFinished) {
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

    // Verify organizer or admin
    const { data: match } = await supabase
        .from("matches")
        .select("created_by")
        .eq("id", matchId)
        .single();

    const admin = isAdmin(user.email);
    if (match?.created_by !== user.id && !admin)
        return { success: false, error: "Only the organizer can generate teams" };

    // Fetch participants with positions
    const { data: participants } = await supabase
        .from("match_participants")
        .select("user_id, profiles(position)")
        .eq("match_id", matchId);

    if (!participants || participants.length < 2)
        return { success: false, error: "Need at least 2 players to generate teams" };

    type ValidPosition = "GK" | "DEF" | "MID" | "FWD";
    const validPositions: ValidPosition[] = ["GK", "DEF", "MID", "FWD"];

    // Update players without a position to MID in the database
    const adminClient = createAdminClient();
    const playersWithPosition = participants.map((p) => {
        const rawPos = (p.profiles as unknown as { position: string | null })?.position;
        const position: ValidPosition = rawPos && validPositions.includes(rawPos as ValidPosition)
            ? (rawPos as ValidPosition)
            : "MID";
        return { user_id: p.user_id, position };
    });

    // Persist MID default for players who had null position
    const noPositionIds = participants
        .filter((p) => !(p.profiles as unknown as { position: string | null })?.position)
        .map((p) => p.user_id);

    if (noPositionIds.length > 0) {
        for (const uid of noPositionIds) {
            await adminClient
                .from("profiles")
                .update({ position: "MID" })
                .eq("id", uid);
        }
    }

    const { assignments } = balanceTeams(playersWithPosition);

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
    return { success: true };
}

export async function cancelMatch(matchId: string): Promise<ActionResult> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "Not authenticated" };

    const { data: match } = await supabase
        .from("matches")
        .select("created_by, location")
        .eq("id", matchId)
        .single();

    if (!match) return { success: false, error: "Match not found" };

    const admin = isAdmin(user.email);
    if (match.created_by !== user.id && !admin)
        return { success: false, error: "No tienes permiso para cancelar este partido" };

    const client = admin ? createAdminClient() : supabase;
    const { error } = await client
        .from("matches")
        .update({ status: "cancelled" })
        .eq("id", matchId);

    if (error) return { success: false, error: error.message };

    // Notify all participants
    const { data: participants } = await supabase
        .from("match_participants")
        .select("user_id")
        .eq("match_id", matchId);

    if (participants) {
        const ids = participants.map((p) => p.user_id).filter((id) => id !== user.id);
        sendNotification(
            ids,
            "cancel",
            "Partido cancelado",
            `El partido en ${match.location} ha sido cancelado`,
            matchId
        );
    }

    revalidatePath(`/matches/${matchId}`);
    revalidatePath("/");
    revalidatePath("/matches");
    revalidatePath("/calendar");
    return { success: true };
}

export async function rescheduleMatch(
    matchId: string,
    newDate: string
): Promise<ActionResult> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "Not authenticated" };
    if (!newDate) return { success: false, error: "Date is required" };

    const { data: match } = await supabase
        .from("matches")
        .select("created_by, location, status")
        .eq("id", matchId)
        .single();

    if (!match) return { success: false, error: "Match not found" };
    if (match.status === "finished" || match.status === "cancelled")
        return { success: false, error: "No se puede cambiar la fecha de un partido finalizado o cancelado" };

    const admin = isAdmin(user.email);
    if (match.created_by !== user.id && !admin)
        return { success: false, error: "No tienes permiso para cambiar la fecha" };

    const client = admin ? createAdminClient() : supabase;
    const { error } = await client
        .from("matches")
        .update({ date: newDate })
        .eq("id", matchId);

    if (error) return { success: false, error: error.message };

    // Notify all participants
    const { data: participants } = await supabase
        .from("match_participants")
        .select("user_id")
        .eq("match_id", matchId);

    if (participants) {
        const ids = participants.map((p) => p.user_id).filter((id) => id !== user.id);
        const formattedDate = new Date(newDate).toLocaleString("es-ES", {
            dateStyle: "medium",
            timeStyle: "short",
        });
        sendNotification(
            ids,
            "reschedule",
            "Fecha cambiada",
            `${match.location} se ha movido al ${formattedDate}`,
            matchId
        );
    }

    revalidatePath(`/matches/${matchId}`);
    revalidatePath("/");
    revalidatePath("/matches");
    revalidatePath("/calendar");
    return { success: true };
}

export async function kickPlayer(
    matchId: string,
    targetUserId: string
): Promise<ActionResult> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "Not authenticated" };

    if (!isAdmin(user.email))
        return { success: false, error: "Solo el administrador puede expulsar jugadores" };

    if (targetUserId === user.id)
        return { success: false, error: "No puedes expulsarte a ti mismo" };

    const adminClient = createAdminClient();
    const { error } = await adminClient
        .from("match_participants")
        .delete()
        .eq("match_id", matchId)
        .eq("user_id", targetUserId);

    if (error) return { success: false, error: error.message };

    // Notify the kicked player
    const { data: match } = await supabase
        .from("matches")
        .select("location")
        .eq("id", matchId)
        .single();

    sendNotification(
        [targetUserId],
        "kick",
        "Expulsado del partido",
        `Has sido eliminado del partido en ${match?.location || "un partido"}`,
        matchId
    );

    revalidatePath(`/matches/${matchId}`);
    revalidatePath("/");
    revalidatePath("/matches");
    revalidatePath("/calendar");
    return { success: true };
}
