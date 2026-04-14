"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { balanceTeams } from "@/lib/team-balancer";
import { computeMatchEloUpdates, ELO_BASE } from "@/lib/elo";
import { rateLimit } from "@/lib/rate-limit";
import { isAdmin } from "@/lib/permissions";
import { z } from "zod";

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

    if (!user) return { success: false, error: "No autenticado" };

    const { allowed } = await rateLimit(`create-match:${user.id}`, 5, 60_000);
    if (!allowed) return { success: false, error: "Demasiadas acciones. Espera un momento." };

    const date = formData.get("date") as string;
    const location = formData.get("location") as string;
    const max_players_raw = formData.get("max_players");

    const CreateMatchSchema = z.object({
        date: z.string().min(1, "La fecha es obligatoria"),
        location: z.string().min(2, "La ubicación debe tener al menos 2 caracteres"),
        max_players: z.coerce.number().int().min(4, "Mínimo 4 jugadores").max(30, "Máximo 30 jugadores"),
    });

    const parsed = CreateMatchSchema.safeParse({ date, location, max_players: max_players_raw });
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message };
    }

    const { date: validDate, location: validLocation, max_players } = parsed.data;

    const { data, error } = await supabase
        .from("matches")
        .insert({
            date: validDate,
            location: validLocation.trim(),
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

    if (!user) return { success: false, error: "No autenticado" };

    const { allowed } = await rateLimit(`join-match:${user.id}`, 10, 60_000);
    if (!allowed) return { success: false, error: "Demasiadas peticiones. Espera un momento." };

    // Check if already joined
    const { data: existing } = await supabase
        .from("match_participants")
        .select("user_id")
        .eq("match_id", matchId)
        .eq("user_id", user.id)
        .single();

    if (existing) return { success: false, error: "Ya estás apuntado a este partido" };

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

    if (!match) return { success: false, error: "Partido no encontrado" };
    if (match.status !== "open") return { success: false, error: "El partido no está abierto" };
    if (count !== null && count >= match.max_players)
        return { success: false, error: "El partido está completo" };

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

    if (!user) return { success: false, error: "No autenticado" };

    const { allowed } = await rateLimit(`leave-match:${user.id}`, 10, 60_000);
    if (!allowed) return { success: false, error: "Demasiadas peticiones. Espera un momento." };

    const { data: match } = await supabase
        .from("matches")
        .select("status")
        .eq("id", matchId)
        .single();

    if (!match) return { success: false, error: "Partido no encontrado" };
    if (match.status === "finished") return { success: false, error: "No puedes abandonar un partido que ya ha finalizado" };

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

    if (!user) return { success: false, error: "No autenticado" };

    // Verify organizer or admin
    const { data: match } = await supabase
        .from("matches")
        .select("created_by")
        .eq("id", matchId)
        .single();

    const admin = isAdmin(user.email);
    if (match?.created_by !== user.id && !admin)
        return { success: false, error: "Solo el organizador puede cerrar este partido" };

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

    if (!user) return { success: false, error: "No autenticado" };

    const { allowed } = await rateLimit(`set-score:${user.id}`, 5, 60_000);
    if (!allowed) return { success: false, error: "Demasiadas peticiones. Espera un momento." };

    const ScoreSchema = z.object({
        matchId: z.string().uuid("ID de partido inválido"),
        teamAScore: z.number().int("Debe ser un número entero").min(0, "Los marcadores no pueden ser negativos").max(200, "Marcador inválido"),
        teamBScore: z.number().int("Debe ser un número entero").min(0, "Los marcadores no pueden ser negativos").max(200, "Marcador inválido"),
        goalScorers: z.array(z.object({
            userId: z.string().uuid("ID de usuario inválido"),
            goals: z.number().int().min(0).max(100)
        })).optional()
    });

    const parsed = ScoreSchema.safeParse({ matchId, teamAScore, teamBScore, goalScorers });
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message };
    }

    const validData = parsed.data;

    const { data: match } = await supabase
        .from("matches")
        .select("status, created_by")
        .eq("id", validData.matchId)
        .single();

    if (!match) return { success: false, error: "Partido no encontrado" };

    const admin = isAdmin(user.email);
    if (match.created_by !== user.id && !admin) {
        return { success: false, error: "No tienes permiso para establecer el resultado" };
    }

    const isAlreadyFinished = match.status === "finished";

    // Use admin client for all participant-level updates (bypasses RLS)
    const adminSupabase = createAdminClient();

    // Update individual goal scorers FIRST so the trigger reads the correct score
    if (validData.goalScorers && validData.goalScorers.length > 0) {
        for (const scorer of validData.goalScorers) {
            if (scorer.goals > 0) {
                const { error: scorerError } = await adminSupabase
                    .from("match_participants")
                    .update({ goals: scorer.goals })
                    .eq("match_id", validData.matchId)
                    .eq("user_id", scorer.userId);
                if (scorerError) console.error("Error updating scorer:", scorer.userId, scorerError.message);
            }
        }
    }

    // Now update match status. This will fire the match_finished_stats_trigger
    // to update user profiles seamlessly.
    const client = admin ? createAdminClient() : supabase;
    const { error } = await client
        .from("matches")
        .update({
            team_a_score: validData.teamAScore,
            team_b_score: validData.teamBScore,
            status: "finished",
            finished_at: new Date().toISOString(),
        })
        .eq("id", validData.matchId);

    if (error) return { success: false, error: error.message };

    // ── Recalcular ELO de todos los participantes ──────────────────────────
    if (!isAlreadyFinished) {
        const { data: eloParticipants } = await adminSupabase
            .from("match_participants")
            .select("user_id, team, goals, is_mvp, profiles(elo_rating, matches_played, position)")
            .eq("match_id", validData.matchId);

        if (eloParticipants && eloParticipants.length > 0) {
            const eloInputs = eloParticipants
                .filter((p) => p.team === "A" || p.team === "B")
                .map((p) => {
                    const profile = p.profiles as unknown as {
                        elo_rating: number | null;
                        matches_played: number | null;
                        position: string | null;
                    };
                    return {
                        userId: p.user_id,
                        currentRating: profile?.elo_rating ?? ELO_BASE,
                        matchesPlayed: profile?.matches_played ?? 0,
                        team: p.team as "A" | "B",
                        position: (profile?.position ?? "MID") as "GK" | "DEF" | "MID" | "FWD",
                        goalsScored: p.goals ?? 0,
                        isMvp: p.is_mvp ?? false,
                    };
                });

            const eloUpdates = computeMatchEloUpdates(
                eloInputs,
                validData.teamAScore,
                validData.teamBScore
            );

            // Bulk update ELO ratings
            for (const update of eloUpdates) {
                await adminSupabase
                    .from("profiles")
                    .update({ elo_rating: update.newRating })
                    .eq("id", update.userId);
            }
        }
    }
    // ──────────────────────────────────────────────────────────────────────

    // Notify all participants about the score
    const { data: allParticipants } = await adminSupabase
        .from("match_participants")
        .select("user_id")
        .eq("match_id", validData.matchId);

    if (allParticipants) {
        const participantIds = allParticipants
            .map((p) => p.user_id)
            .filter((id) => id !== user.id);
        const { data: matchForNotif } = await supabase
            .from("matches")
            .select("location")
            .eq("id", validData.matchId)
            .single();
        sendNotification(
            participantIds,
            "score",
            "¡Resultado registrado!",
            `${matchForNotif?.location || "Partido"}: ${validData.teamAScore} - ${validData.teamBScore}`,
            validData.matchId
        );
    }

    revalidatePath(`/matches/${validData.matchId}`);
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

    if (!user) return { success: false, error: "No autenticado" };

    // Verify organizer or admin
    const { data: match } = await supabase
        .from("matches")
        .select("created_by")
        .eq("id", matchId)
        .single();

    const admin = isAdmin(user.email);
    if (match?.created_by !== user.id && !admin)
        return { success: false, error: "Solo el organizador puede generar equipos" };

    // Fetch participants with positions AND elo_rating
    const { data: participants } = await supabase
        .from("match_participants")
        .select("user_id, profiles(position, elo_rating)")
        .eq("match_id", matchId);

    if (!participants || participants.length < 2)
        return { success: false, error: "Se necesitan al menos 2 jugadores" };

    type ValidPosition = "GK" | "DEF" | "MID" | "FWD";
    const validPositions: ValidPosition[] = ["GK", "DEF", "MID", "FWD"];

    // Update players without a position to MID in the database
    const adminClient = createAdminClient();
    const playersWithPosition = participants.map((p) => {
        const prof = (p.profiles as unknown as { position: string | null; elo_rating: number | null });
        const rawPos = prof?.position;
        const position: ValidPosition = rawPos && validPositions.includes(rawPos as ValidPosition)
            ? (rawPos as ValidPosition)
            : "MID";
        return { user_id: p.user_id, position, elo_rating: prof?.elo_rating ?? ELO_BASE };
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

    if (!user) return { success: false, error: "No autenticado" };

    const { data: match } = await supabase
        .from("matches")
        .select("created_by, location")
        .eq("id", matchId)
        .single();

    if (!match) return { success: false, error: "Partido no encontrado" };

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

    if (!user) return { success: false, error: "No autenticado" };
    if (!newDate) return { success: false, error: "La fecha es obligatoria" };

    const { data: match } = await supabase
        .from("matches")
        .select("created_by, location, status")
        .eq("id", matchId)
        .single();

    if (!match) return { success: false, error: "Partido no encontrado" };
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

    if (!user) return { success: false, error: "No autenticado" };

    if (!isAdmin(user.email))
        return { success: false, error: "Solo el administrador puede expulsar jugadores" };

    if (targetUserId === user.id)
        return { success: false, error: "No puedes expulsarte a ti mismo" };

    const { data: matchData } = await supabase
        .from("matches")
        .select("status, location")
        .eq("id", matchId)
        .single();

    if (!matchData) return { success: false, error: "Partido no encontrado" };
    if (matchData.status === "finished")
        return { success: false, error: "No se puede expulsar jugadores de un partido finalizado" };

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

// ─── MVP Voting ───────────────────────────────────────────────────

const MVP_VOTING_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

async function resolveMvp(matchId: string) {
    const adminClient = createAdminClient();

    // Count votes per candidate
    const { data: votes } = await adminClient
        .from("mvp_votes")
        .select("voted_for")
        .eq("match_id", matchId);

    if (!votes || votes.length === 0) return;

    const voteCounts: Record<string, number> = {};
    for (const v of votes) {
        voteCounts[v.voted_for] = (voteCounts[v.voted_for] || 0) + 1;
    }

    // Find the player with the most votes
    let maxVotes = 0;
    let winnerId: string | null = null;
    let isTie = false;

    for (const [userId, count] of Object.entries(voteCounts)) {
        if (count > maxVotes) {
            maxVotes = count;
            winnerId = userId;
            isTie = false;
        } else if (count === maxVotes) {
            isTie = true;
        }
    }

    // On tie → no MVP
    if (isTie || !winnerId) return;

    // Reset any existing MVP flags for this match
    await adminClient
        .from("match_participants")
        .update({ is_mvp: false })
        .eq("match_id", matchId);

    // Set the winner as MVP
    await adminClient
        .from("match_participants")
        .update({ is_mvp: true })
        .eq("match_id", matchId)
        .eq("user_id", winnerId);

    // Notify the winner
    const { data: matchInfo } = await adminClient
        .from("matches")
        .select("location")
        .eq("id", matchId)
        .single();

    sendNotification(
        [winnerId],
        "mvp",
        "¡Eres el MVP!",
        `Has sido elegido MVP del partido en ${matchInfo?.location || "tu partido"}`,
        matchId
    );
}

export async function forceResolveMvp(matchId: string): Promise<ActionResult> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "No autenticado" };

    const { data: match } = await supabase
        .from("matches")
        .select("created_by")
        .eq("id", matchId)
        .single();

    if (!match) return { success: false, error: "Partido no encontrado" };

    const { isAdmin } = await import("@/lib/permissions");
    if (match.created_by !== user.id && !isAdmin(user.email)) {
        return { success: false, error: "No tienes permiso para finalizar la votación" };
    }

    await resolveMvp(matchId);
    revalidatePath(`/matches/${matchId}`);
    return { success: true };
}

export async function checkAndResolveExpiredMvp(matchId: string): Promise<ActionResult> {
    const supabase = await createClient();

    const { data: match } = await supabase
        .from("matches")
        .select("status, finished_at, date")
        .eq("id", matchId)
        .single();

    if (!match || match.status !== "finished") return { success: false, error: "No válido" };

    const referenceTime = match.finished_at || match.date;
    if (!referenceTime) return { success: false, error: "Falta referencia de tiempo" };

    const finishedAt = new Date(referenceTime).getTime();
    if (Date.now() - finishedAt > MVP_VOTING_WINDOW_MS) {
        // Passed 24h. Check if already resolved.
        const { data: participants } = await supabase
            .from("match_participants")
            .select("is_mvp")
            .eq("match_id", matchId);

        const isResolved = participants?.some((p) => p.is_mvp);
        if (!isResolved) {
            await resolveMvp(matchId);
            revalidatePath(`/matches/${matchId}`);
            return { success: true };
        }
    }
    return { success: false, error: "No expirado o ya resuelto" };
}

export async function voteForMvp(
    matchId: string,
    votedForUserId: string
): Promise<ActionResult> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "No autenticado" };

    const { allowed } = await rateLimit(`vote-mvp:${user.id}`, 5, 60_000);
    if (!allowed) return { success: false, error: "Demasiadas peticiones. Espera un momento." };

    // Can't vote for yourself
    if (user.id === votedForUserId)
        return { success: false, error: "No puedes votarte a ti mismo" };

    // Verify match exists and is finished
    const { data: match } = await supabase
        .from("matches")
        .select("status, finished_at, date")
        .eq("id", matchId)
        .single();

    if (!match) return { success: false, error: "Partido no encontrado" };
    if (match.status !== "finished")
        return { success: false, error: "El partido no ha finalizado aún" };

    // Check 24h voting window (use finished_at, fallback to match date)
    const referenceTime = match.finished_at || match.date;
    if (referenceTime) {
        const finishedAt = new Date(referenceTime).getTime();
        const now = Date.now();
        if (now - finishedAt > MVP_VOTING_WINDOW_MS)
            return { success: false, error: "El plazo de votación ha terminado (24h)" };
    }

    // Verify voter is a participant
    const { data: voterPart } = await supabase
        .from("match_participants")
        .select("user_id")
        .eq("match_id", matchId)
        .eq("user_id", user.id)
        .single();

    if (!voterPart)
        return { success: false, error: "No participaste en este partido" };

    // Verify voted-for player is a participant
    const { data: targetPart } = await supabase
        .from("match_participants")
        .select("user_id")
        .eq("match_id", matchId)
        .eq("user_id", votedForUserId)
        .single();

    if (!targetPart)
        return { success: false, error: "El jugador seleccionado no participó en este partido" };

    // Check if already voted
    const { data: existingVote } = await supabase
        .from("mvp_votes")
        .select("id")
        .eq("match_id", matchId)
        .eq("voter_id", user.id)
        .single();

    if (existingVote)
        return { success: false, error: "Ya has votado en este partido" };

    // Insert vote
    const { error } = await supabase
        .from("mvp_votes")
        .insert({
            match_id: matchId,
            voter_id: user.id,
            voted_for: votedForUserId,
        });

    if (error) return { success: false, error: error.message };

    // Check if all participants have voted → resolve immediately
    const { count: totalParticipants } = await supabase
        .from("match_participants")
        .select("*", { count: "exact", head: true })
        .eq("match_id", matchId);

    const { count: totalVotes } = await supabase
        .from("mvp_votes")
        .select("*", { count: "exact", head: true })
        .eq("match_id", matchId);

    // All participants voted (minus the person being voted for — they can't vote for themselves,
    // so max votes = totalParticipants). But we resolve when everyone has cast their vote.
    if (totalParticipants !== null && totalVotes !== null && totalVotes >= totalParticipants) {
        await resolveMvp(matchId);
    }

    revalidatePath(`/matches/${matchId}`);
    return { success: true };
}
