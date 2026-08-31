"use server";

import { requireCommunityAccess } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { balanceTeams } from "@/lib/team-balancer";
import { computeMatchEloUpdates, ELO_BASE } from "@/lib/elo";
import { rateLimit } from "@/lib/rate-limit";
import { isAdmin } from "@/lib/permissions";
import { getStatsForUsers, upsertZeroStats } from "@/lib/season-stats";
import { getActiveSeason, SeasonNotFoundError } from "@/lib/seasons";
import { MVP_VOTING_WINDOW_MS } from "@/lib/constantes";
import { z } from "zod";
import { sendNotification } from "@/lib/notifications";
import type { ActionResult, ParticipantProfile, SeasonPlayerStats } from "@/lib/types";

async function requireMatchAccess(
    user: { id: string; is_anonymous?: boolean } | null
): Promise<ActionResult<true>> {
    if (!user || user.is_anonymous === true) {
        return { success: false, error: "No autenticado" };
    }

    return requireCommunityAccess(user);
}

type ParticipantProfileLike = {
    elo_rating?: number | null;
    matches_played?: number | null;
    position?: string | null;
} | null;

function getParticipantProfile<T extends ParticipantProfileLike>(
    profile: T | T[] | null
): T | null {
    return Array.isArray(profile) ? (profile[0] as T | undefined) ?? null : profile;
}

async function syncLegacyProfileStats(
    adminSupabase: ReturnType<typeof createAdminClient>,
    seasonId: string,
    userIds: string[]
): Promise<void> {
    const seasonalStats = await getStatsForUsers(seasonId, userIds);

    const results = await Promise.all(
        seasonalStats.map((stat) =>
            adminSupabase
                .from("profiles")
                .update({
                    elo_rating: stat.elo_rating,
                    matches_played: stat.matches_played,
                    goals_scored: stat.goals_scored,
                    market_value: Math.max(1_000_000, (stat.elo_rating - 800) * 50_000),
                })
                .eq("id", stat.user_id)
        )
    );

    const failedUpdate = results.find((result) => result.error);
    if (failedUpdate?.error) {
        throw new Error(`No se pudo sincronizar el perfil: ${failedUpdate.error.message}`);
    }
}

export async function createMatch(formData: FormData): Promise<ActionResult> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const access = await requireMatchAccess(user);
    if (!access.success) return access;
    const currentUser = user!;

    const { allowed } = await rateLimit(`create-match:${currentUser.id}`, 10, 60_000);
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
    let seasonId: string;

    try {
        const season = await getActiveSeason();
        seasonId = season.id;
        await upsertZeroStats(seasonId, currentUser.id);
    } catch (error) {
        if (error instanceof SeasonNotFoundError) {
            return { success: false, error: error.message };
        }

        return { success: false, error: "No se pudo preparar la temporada activa" };
    }

    const { data, error } = await supabase
        .from("matches")
        .insert({
            date: validDate,
            location: validLocation.trim(),
            max_players,
            status: "open",
            created_by: currentUser.id,
            season_id: seasonId,
        })
        .select("id")
        .single();

    if (error) return { success: false, error: error.message };

    // Auto-join the creator
    const { error: joinError } = await supabase
        .from("match_participants")
        .insert({
            match_id: data.id,
            user_id: currentUser.id,
            team: null,
            goals: 0,
            is_mvp: false,
        });

    if (joinError) return { success: false, error: joinError.message };

    revalidatePath("/");
    revalidatePath("/matches");

    redirect(`/matches/${data.id}`);
}

export async function joinMatch(matchId: string): Promise<ActionResult> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const access = await requireMatchAccess(user);
    if (!access.success) return access;
    const currentUser = user!;

    const { allowed } = await rateLimit(`join-match:${currentUser.id}`, 10, 60_000);
    if (!allowed) return { success: false, error: "Demasiadas peticiones. Espera un momento." };

    // Check if already joined
    const { data: existing } = await supabase
        .from("match_participants")
        .select("user_id")
        .eq("match_id", matchId)
        .eq("user_id", currentUser.id)
        .single();

    if (existing) return { success: false, error: "Ya estás apuntado a este partido" };

    // Check player count and match status
    const { count } = await supabase
        .from("match_participants")
        .select("*", { count: "exact", head: true })
        .eq("match_id", matchId);

    const { data: match } = await supabase
        .from("matches")
        .select("max_players, status, season_id")
        .eq("id", matchId)
        .single();

    if (!match) return { success: false, error: "Partido no encontrado" };
    if (match.status !== "open") return { success: false, error: "El partido no está abierto" };
    if (count !== null && count >= match.max_players)
        return { success: false, error: "El partido está completo" };

    await upsertZeroStats(match.season_id, currentUser.id);

    const { error } = await supabase
        .from("match_participants")
        .insert({ match_id: matchId, user_id: currentUser.id });

    if (error) return { success: false, error: error.message };

    // Notify the organizer that someone joined
    const { data: joinerProfile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", currentUser.id)
        .single();
    const { data: matchForNotif } = await supabase
        .from("matches")
        .select("created_by, location")
        .eq("id", matchId)
        .single();
    if (matchForNotif && matchForNotif.created_by !== currentUser.id) {
        await sendNotification(
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

    return { success: true, data: undefined };
}

export async function leaveMatch(matchId: string): Promise<ActionResult> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const access = await requireMatchAccess(user);
    if (!access.success) return access;
    const currentUser = user!;

    const { allowed } = await rateLimit(`leave-match:${currentUser.id}`, 10, 60_000);
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
        .eq("user_id", currentUser.id);

    if (error) return { success: false, error: error.message };

    revalidatePath(`/matches/${matchId}`);
    revalidatePath("/");
    revalidatePath("/matches");

    return { success: true, data: undefined };
}

export async function closeMatch(matchId: string): Promise<ActionResult> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const access = await requireMatchAccess(user);
    if (!access.success) return access;
    const currentUser = user!;

    // Verify organizer or admin
    const { data: match } = await supabase
        .from("matches")
        .select("created_by")
        .eq("id", matchId)
        .single();

    const admin = await isAdmin(currentUser.id);
    if (match?.created_by !== currentUser.id && !admin)
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

    return { success: true, data: undefined };
}

function computeEloUpdates(
    teamAScore: number,
    teamBScore: number,
    participants: Array<{
        user_id: string;
        team: "A" | "B" | null;
        goals: number | null;
        is_mvp: boolean | null;
        profiles: ParticipantProfileLike | ParticipantProfileLike[];
    }>,
    seasonalStatsByUser: Map<string, SeasonPlayerStats>
): ReturnType<typeof computeMatchEloUpdates> {
    const eloInputs = participants
        .filter((p) => p.team === "A" || p.team === "B")
        .map((p) => {
            const profile = getParticipantProfile(p.profiles);
            const seasonStats = seasonalStatsByUser.get(p.user_id);
            return {
                userId: p.user_id,
                currentRating: seasonStats?.elo_rating ?? ELO_BASE,
                matchesPlayed: seasonStats?.matches_played ?? 0,
                team: p.team as "A" | "B",
                position: (profile?.position ?? "MID") as "GK" | "DEF" | "MID" | "FWD",
                goalsScored: p.goals ?? 0,
                isMvp: p.is_mvp ?? false,
            };
        });

    return computeMatchEloUpdates(
        eloInputs,
        teamAScore,
        teamBScore
    );
}

async function applyFantasyPoints(
    adminSupabase: ReturnType<typeof createAdminClient>,
    matchId: string,
    teamAScore: number,
    teamBScore: number,
    participants: Array<{
        user_id: string;
        team: "A" | "B" | null;
        goals: number | null;
        profiles: ParticipantProfileLike | ParticipantProfileLike[];
    }>
): Promise<void> {
    // ── FANTASY: Puntuación del partido ──────────────────────────────────
    // Reglas: +2 jugar, +3 victoria, +1 empate, +3/gol, +4 portería a cero (GK/DEF)
    // Multiplicadores capitán: ×2 base | ×3 si GK portería a cero | ×3 si es MVP
    const fantasyPointsMap: Record<string, number> = {};
    const fantasyIsMvpMap: Record<string, boolean> = {};
    const fantasyPositionMap: Record<string, string> = {};
    const aScore = teamAScore;
    const bScore = teamBScore;

    // Identify the MVP player from this match (if already resolved)
    const { data: mvpParticipant } = await adminSupabase
        .from("match_participants")
        .select("user_id")
        .eq("match_id", matchId)
        .eq("is_mvp", true)
        .maybeSingle();
    const mvpUserId = mvpParticipant?.user_id ?? null;

    for (const p of participants) {
        const pTeam = p.team as "A" | "B" | null;
        if (pTeam !== "A" && pTeam !== "B") continue;

        const goals = p.goals ?? 0;
        const profileData = Array.isArray(p.profiles) ? p.profiles[0] as ParticipantProfile : p.profiles as ParticipantProfile | null;
        const position = profileData?.position ?? "MID";

        let pts = 2; // Jugar el partido

        if (aScore === bScore) {
            pts += 1; // Empate
        } else if (
            (pTeam === "A" && aScore > bScore) ||
            (pTeam === "B" && bScore > aScore)
        ) {
            pts += 3; // Victoria
        }

        pts += goals * 3; // Goles: +3 c/u

        const conceded = pTeam === "A" ? bScore : aScore;
        if (position === "GK" || position === "DEF") {
            if (conceded === 0) pts += 4; // Portería a cero
        }

        fantasyPointsMap[p.user_id] = pts;
        fantasyPositionMap[p.user_id] = position;
        fantasyIsMvpMap[p.user_id] = p.user_id === mvpUserId;
    }

    const scoringPlayerIds = Object.keys(fantasyPointsMap);
    if (scoringPlayerIds.length > 0) {
        const { data: rosterEntries } = await adminSupabase
            .from("fantasy_rosters")
            .select("team_id, player_id, is_captain, is_starter")
            .in("player_id", scoringPlayerIds);

        if (rosterEntries && rosterEntries.length > 0) {
            // Agrupar puntos por equipo fantasy aplicando multiplicador de capitán
            const teamPointsMap: Record<string, number> = {};
            for (const entry of rosterEntries) {
                if (!entry.is_starter) continue;
                const base = fantasyPointsMap[entry.player_id] ?? 0;
                let earned = base;
                if (entry.is_captain) {
                    const pos = fantasyPositionMap[entry.player_id] ?? "MID";
                    const conceded = (() => {
                        const p = participants.find((ep) => ep.user_id === entry.player_id);
                        if (!p) return 99;
                        return p.team === "A" ? bScore : aScore;
                    })();
                    const isMvp = fantasyIsMvpMap[entry.player_id] ?? false;
                    // Regla 5: GK capitán con portería a cero → ×3
                    // Regla 6: Capitán que es MVP → ×3
                    const multiplier = (pos === "GK" && conceded === 0) || isMvp ? 3 : 2;
                    earned = base * multiplier;
                }
                teamPointsMap[entry.team_id] =
                    (teamPointsMap[entry.team_id] ?? 0) + earned;
            }

            for (const [teamId, earned] of Object.entries(teamPointsMap)) {
                const { data: ft } = await adminSupabase
                    .from("fantasy_teams")
                    .select("total_points")
                    .eq("id", teamId)
                    .single();

                await adminSupabase
                    .from("fantasy_teams")
                    .update({ total_points: (ft?.total_points ?? 0) + earned })
                    .eq("id", teamId);
            }
        }
    }
    // ─────────────────────────────────────────────────────────────────────
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

    const access = await requireMatchAccess(user);
    if (!access.success) return access;
    const currentUser = user!;

    const { allowed } = await rateLimit(`set-score:${currentUser.id}`, 5, 60_000);
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
        .select("status, created_by, season_id")
        .eq("id", validData.matchId)
        .single();

    if (!match) return { success: false, error: "Partido no encontrado" };

    const admin = await isAdmin(currentUser.id);
    if (match.created_by !== currentUser.id && !admin) {
        return { success: false, error: "No tienes permiso para establecer el resultado" };
    }

    // Use admin client for all participant-level updates (bypasses RLS)
    const adminSupabase = createAdminClient();
    const { data: participantRows, error: participantError } = await adminSupabase
        .from("match_participants")
        .select("user_id")
        .eq("match_id", validData.matchId);
    if (participantError) return { success: false, error: participantError.message };

    const participantIds = participantRows?.map((participant) => participant.user_id) ?? [];

    try {
        await getStatsForUsers(match.season_id, participantIds);

        const { data: eloParticipants, error: eloParticipantsError } = await adminSupabase
            .from("match_participants")
            .select("user_id, team, goals, is_mvp, profiles(position)")
            .eq("match_id", validData.matchId);
        if (eloParticipantsError) throw new Error(`No se pudieron leer los participantes: ${eloParticipantsError.message}`);

        const seasonalStats = await getStatsForUsers(
            match.season_id,
            eloParticipants?.map((participant) => participant.user_id) ?? []
        );
        const seasonalStatsByUser = new Map(
            seasonalStats.map((stat) => [stat.user_id, stat] as const)
        );
        const goalScorers = validData.goalScorers?.filter((scorer) => scorer.goals > 0) ?? [];
        const goalsByUser = new Map(goalScorers.map((scorer) => [scorer.userId, scorer.goals] as const));
        const eloParticipantsWithSubmittedGoals = (eloParticipants ?? []).map((participant) => ({
            ...participant,
            goals: goalsByUser.get(participant.user_id) ?? participant.goals,
        }));
        const eloUpdates = computeEloUpdates(
            validData.teamAScore,
            validData.teamBScore,
            eloParticipantsWithSubmittedGoals as Parameters<typeof computeEloUpdates>[2],
            seasonalStatsByUser
        );

        // The RPC conditionally claims the open/closed -> finished transition and
        // commits the trigger counters, seasonal ELO, and RP history together.
        const { data: didFinalize, error: finalizeError } = await adminSupabase.rpc(
            "finalize_match_with_elo",
            {
                p_match_id: validData.matchId,
                p_team_a_score: validData.teamAScore,
                p_team_b_score: validData.teamBScore,
                p_finished_at: new Date().toISOString(),
                p_goal_scorers: goalScorers,
                p_elo_updates: eloUpdates.map((update) => ({
                    user_id: update.userId,
                    new_rating: update.newRating,
                    rp_change: update.delta,
                })),
            }
        );
        if (finalizeError) throw new Error(`No se pudo finalizar el partido: ${finalizeError.message}`);
        if (!didFinalize) {
            return { success: false, error: "El partido ya está finalizado o no está disponible" };
        }

        if (eloParticipants && eloParticipants.length > 0) {
            await syncLegacyProfileStats(
                adminSupabase,
                match.season_id,
                eloParticipants.map((participant) => participant.user_id)
            );

            await applyFantasyPoints(
                adminSupabase,
                validData.matchId,
                validData.teamAScore,
                validData.teamBScore,
                eloParticipantsWithSubmittedGoals as Parameters<typeof applyFantasyPoints>[4]
            );
        }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "No se pudo finalizar el partido",
        };
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
            .filter((id) => id !== currentUser.id);
        const { data: matchForNotif } = await supabase
            .from("matches")
            .select("location")
            .eq("id", validData.matchId)
            .single();
        await sendNotification(
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
    revalidateTag("leaderboard", "max");
    revalidateTag("players", "max");

    return { success: true, data: undefined };
}

export async function generateTeams(matchId: string): Promise<ActionResult> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const access = await requireMatchAccess(user);
    if (!access.success) return access;
    const currentUser = user!;

    // Verify organizer or admin
    const { data: match } = await supabase
        .from("matches")
        .select("created_by, season_id")
        .eq("id", matchId)
        .single();

    if (!match) return { success: false, error: "Partido no encontrado" };

    const admin = await isAdmin(currentUser.id);
    if (match.created_by !== currentUser.id && !admin)
        return { success: false, error: "Solo el organizador puede generar equipos" };

    // Fetch participants with positions AND elo_rating
    const { data: participants } = await supabase
        .from("match_participants")
        .select("user_id, profiles(position)")
        .eq("match_id", matchId);

    if (!participants || participants.length < 2)
        return { success: false, error: "Se necesitan al menos 2 jugadores" };

    type ValidPosition = "GK" | "DEF" | "MID" | "FWD";
    const validPositions: ValidPosition[] = ["GK", "DEF", "MID", "FWD"];

    // Update players without a position to MID in the database
    const adminClient = createAdminClient();
    const seasonalStats = await getStatsForUsers(
        match.season_id,
        participants.map((participant) => participant.user_id)
    );
    const seasonalStatsByUser = new Map(
        seasonalStats.map((stat) => [stat.user_id, stat] as const)
    );
    const playersWithPosition = participants.map((p) => {
        const prof = getParticipantProfile(p.profiles);
        const rawPos = prof?.position;
        const position: ValidPosition = rawPos && validPositions.includes(rawPos as ValidPosition)
            ? (rawPos as ValidPosition)
            : "MID";
        return {
            user_id: p.user_id,
            position,
            elo_rating: seasonalStatsByUser.get(p.user_id)?.elo_rating ?? ELO_BASE,
        };
    });

    // Persist MID default for players who had null position
    const noPositionIds = participants
        .filter((p) => !getParticipantProfile(p.profiles)?.position)
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
    await Promise.all(
        assignments.map((assignment) =>
            supabase
                .from("match_participants")
                .update({ team: assignment.team })
                .eq("match_id", matchId)
                .eq("user_id", assignment.user_id)
        )
    );

    // Notify all participants that teams have been generated
    const { data: matchForNotif } = await supabase
        .from("matches")
        .select("location")
        .eq("id", matchId)
        .single();
    const participantIds = participants.map((p) => p.user_id).filter((id) => id !== currentUser.id);
    await sendNotification(
        participantIds,
        "teams",
        "¡Equipos generados!",
        `Se han generado los equipos para ${matchForNotif?.location || "tu partido"}`,
        matchId
    );

    revalidatePath(`/matches/${matchId}`);

    return { success: true, data: undefined };
}

export async function cancelMatch(matchId: string): Promise<ActionResult> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const access = await requireMatchAccess(user);
    if (!access.success) return access;
    const currentUser = user!;

    // Validate matchId is a proper UUID
    const CancelSchema = z.object({ matchId: z.string().uuid("ID de partido inválido") });
    const parsedId = CancelSchema.safeParse({ matchId });
    if (!parsedId.success) return { success: false, error: parsedId.error.issues[0].message };

    const { data: match } = await supabase
        .from("matches")
        .select("created_by, location")
        .eq("id", matchId)
        .single();

    if (!match) return { success: false, error: "Partido no encontrado" };

    const admin = await isAdmin(currentUser.id);
    if (match.created_by !== currentUser.id && !admin)
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
        const ids = participants.map((p) => p.user_id).filter((id) => id !== currentUser.id);
        await sendNotification(
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

    return { success: true, data: undefined };
}

export async function rescheduleMatch(
    matchId: string,
    newDate: string
): Promise<ActionResult> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const access = await requireMatchAccess(user);
    if (!access.success) return access;
    const currentUser = user!;

    // Zod: validate matchId (UUID) and newDate (ISO datetime, must be in the future)
    const RescheduleSchema = z.object({
        matchId: z.string().uuid("ID de partido inválido"),
        newDate: z
            .string()
            .datetime({ offset: true, message: "La fecha debe ser una fecha ISO válida" })
            .refine(
                (d) => new Date(d).getTime() > Date.now(),
                { message: "La nueva fecha debe ser en el futuro" }
            ),
    });

    const parsed = RescheduleSchema.safeParse({ matchId, newDate });
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

    const { matchId: validMatchId, newDate: validDate } = parsed.data;

    const { data: match } = await supabase
        .from("matches")
        .select("created_by, location, status")
        .eq("id", validMatchId)
        .single();

    if (!match) return { success: false, error: "Partido no encontrado" };
    if (match.status === "finished" || match.status === "cancelled")
        return { success: false, error: "No se puede cambiar la fecha de un partido finalizado o cancelado" };

    const admin = await isAdmin(currentUser.id);
    if (match.created_by !== currentUser.id && !admin)
        return { success: false, error: "No tienes permiso para cambiar la fecha" };

    const client = admin ? createAdminClient() : supabase;
    const { error } = await client
        .from("matches")
        .update({ date: validDate })
        .eq("id", validMatchId);

    if (error) return { success: false, error: error.message };

    // Notify all participants
    const { data: participants } = await supabase
        .from("match_participants")
        .select("user_id")
        .eq("match_id", validMatchId);

    if (participants) {
        const ids = participants.map((p) => p.user_id).filter((id) => id !== currentUser.id);
        const formattedDate = new Date(validDate).toLocaleString("es-ES", {
            dateStyle: "medium",
            timeStyle: "short",
        });
        await sendNotification(
            ids,
            "reschedule",
            "Fecha cambiada",
            `${match.location} se ha movido al ${formattedDate}`,
            validMatchId
        );
    }

    revalidatePath(`/matches/${validMatchId}`);
    revalidatePath("/");
    revalidatePath("/matches");

    return { success: true, data: undefined };
}

export async function kickPlayer(
    matchId: string,
    targetUserId: string
): Promise<ActionResult> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const access = await requireMatchAccess(user);
    if (!access.success) return access;
    const currentUser = user!;

    // Validate both IDs are proper UUIDs
    const KickSchema = z.object({
        matchId: z.string().uuid("ID de partido inválido"),
        targetUserId: z.string().uuid("ID de usuario inválido"),
    });
    const parsedKick = KickSchema.safeParse({ matchId, targetUserId });
    if (!parsedKick.success) return { success: false, error: parsedKick.error.issues[0].message };

    if (!(await isAdmin(currentUser.id)))
        return { success: false, error: "Solo el administrador puede expulsar jugadores" };

    if (targetUserId === currentUser.id)
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

    await sendNotification(
        [targetUserId],
        "kick",
        "Expulsado del partido",
        `Has sido eliminado del partido en ${match?.location || "un partido"}`,
        matchId
    );

    revalidatePath(`/matches/${matchId}`);
    revalidatePath("/");
    revalidatePath("/matches");

    return { success: true, data: undefined };
}

// ─── MVP Voting ───────────────────────────────────────────────────

async function resolveMvp(matchId: string): Promise<ActionResult> {
    const adminClient = createAdminClient();
    const { data: match, error: matchError } = await adminClient
        .from("matches")
        .select("season_id, location")
        .eq("id", matchId)
        .single();

    if (matchError) return { success: false, error: matchError.message };
    if (!match) return { success: false, error: "Partido no encontrado" };

    // Count votes per candidate
    const { data: votes, error: votesError } = await adminClient
        .from("mvp_votes")
        .select("voted_for")
        .eq("match_id", matchId);

    if (votesError) return { success: false, error: votesError.message };
    if (!votes || votes.length === 0) return { success: true, data: undefined };

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
    if (isTie || !winnerId) return { success: true, data: undefined };

    try {
        const { data: changed, error: resolveError } = await adminClient.rpc(
            "resolve_mvp_with_stats",
            {
                p_match_id: matchId,
                p_winner_id: winnerId,
            }
        );
        if (resolveError) throw new Error(`No se pudo resolver el MVP: ${resolveError.message}`);
        if (!changed) return { success: true, data: undefined };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "No se pudieron actualizar las estadísticas MVP",
        };
    }

    // Notify the winner
    await sendNotification(
        [winnerId],
        "mvp",
        "¡Eres el MVP!",
        `Has sido elegido MVP del partido en ${match.location || "tu partido"}`,
        matchId
    );

    // ── FANTASY: Bonus MVP (+5 base, +10 si capitán) ─────────────────────
    const { data: mvpRosters } = await adminClient
        .from("fantasy_rosters")
        .select("team_id, is_captain, is_starter")
        .eq("player_id", winnerId);

    if (mvpRosters && mvpRosters.length > 0) {
        for (const entry of mvpRosters) {
            if (!entry.is_starter) continue;
            const mvpPoints = entry.is_captain ? 10 : 5;
            const { data: ft } = await adminClient
                .from("fantasy_teams")
                .select("total_points")
                .eq("id", entry.team_id)
                .single();

            await adminClient
                .from("fantasy_teams")
                .update({ total_points: (ft?.total_points ?? 0) + mvpPoints })
                .eq("id", entry.team_id);
        }
    }
    // ─────────────────────────────────────────────────────────────────────

    return { success: true, data: undefined };
}

export async function forceResolveMvp(matchId: string): Promise<ActionResult> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const access = await requireMatchAccess(user);
    if (!access.success) return access;
    const currentUser = user!;

    const { data: match } = await supabase
        .from("matches")
        .select("created_by")
        .eq("id", matchId)
        .single();

    if (!match) return { success: false, error: "Partido no encontrado" };

    const { isAdmin } = await import("@/lib/permissions");
    if (match.created_by !== currentUser.id && !(await isAdmin(currentUser.id))) {
        return { success: false, error: "No tienes permiso para finalizar la votación" };
    }

    const result = await resolveMvp(matchId);
    if (!result.success) return result;
    revalidatePath(`/matches/${matchId}`);
    return { success: true, data: undefined };
}

export async function checkAndResolveExpiredMvp(matchId: string): Promise<ActionResult> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const access = await requireMatchAccess(user);
    if (!access.success) return access;

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
            const result = await resolveMvp(matchId);
            if (!result.success) return result;
            revalidatePath(`/matches/${matchId}`);
            return { success: true, data: undefined };
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

    const access = await requireMatchAccess(user);
    if (!access.success) return access;
    const currentUser = user!;

    const { allowed } = await rateLimit(`vote-mvp:${currentUser.id}`, 5, 60_000);
    if (!allowed) return { success: false, error: "Demasiadas peticiones. Espera un momento." };

    // Can't vote for yourself
    if (currentUser.id === votedForUserId)
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
        .eq("user_id", currentUser.id)
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
        .eq("voter_id", currentUser.id)
        .single();

    if (existingVote)
        return { success: false, error: "Ya has votado en este partido" };

    // Insert vote
    const { error } = await supabase
        .from("mvp_votes")
        .insert({
            match_id: matchId,
            voter_id: currentUser.id,
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
        const result = await resolveMvp(matchId);
        if (!result.success) return result;
    }

    revalidatePath(`/matches/${matchId}`);
    return { success: true, data: undefined };
}

export async function markAsPaid(
    matchId: string,
    targetUserId: string,
    paid: boolean
): Promise<ActionResult> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const access = await requireMatchAccess(user);
    if (!access.success) return access;
    const currentUser = user!;

    const MarkPaidSchema = z.object({
        matchId: z.string().uuid("ID de partido inválido"),
        targetUserId: z.string().uuid("ID de usuario inválido"),
        paid: z.boolean(),
    });
    const parsed = MarkPaidSchema.safeParse({ matchId, targetUserId, paid });
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

    const { allowed } = await rateLimit(`mark-paid:${currentUser.id}`, 20, 60_000);
    if (!allowed) return { success: false, error: "Demasiadas acciones. Espera un momento." };

    const { data: match } = await supabase
        .from("matches")
        .select("status, created_by")
        .eq("id", parsed.data.matchId)
        .single();

    if (!match) return { success: false, error: "Partido no encontrado" };
    if (match.status !== "open") return { success: false, error: "Solo se puede marcar pagos en partidos abiertos" };

    const admin = await isAdmin(currentUser.id);
    if (match.created_by !== currentUser.id && !admin)
        return { success: false, error: "Solo el organizador puede marcar pagos" };

    const adminClient = createAdminClient();
    const { error } = await adminClient
        .from("match_participants")
        .update({ has_paid: parsed.data.paid })
        .eq("match_id", parsed.data.matchId)
        .eq("user_id", parsed.data.targetUserId);

    if (error) return { success: false, error: error.message };

    revalidatePath(`/matches/${parsed.data.matchId}`);
    return { success: true, data: undefined };
}
