/**
 * Script de retroactivo — Recalcular ELO de una temporada concreta
 *
 * Uso (PowerShell):
 *   npx tsx --env-file=.env.local src/scripts/recalculate-elo.ts --season season-2
 *   npx tsx --env-file=.env.local src/scripts/recalculate-elo.ts --season <uuid>
 */

import { createClient } from "@supabase/supabase-js";

// This is intentionally kept inline: historical recalculation must remain byte-for-byte
// compatible with the approved algorithm and must not follow the live-match algorithm.
const ELO_BASE = 1000;
const K_FACTOR = 30;
const K_FACTOR_NEW = 60;
const NEW_PLAYER_THRESHOLD = 5;
const BLOWOUT_THRESHOLD = 4;
const MAX_CHANGE_PER_MATCH = 50;
const MIN_RATING = 100;
const GK_CLEAN_SHEET_BONUS = 8;
const GK_SOLID_DEFENSE_BONUS = 4;
const GK_HEAVY_CONCEDE_PENALTY = -3;

function calcExpected(ownAvg: number, oppAvg: number): number {
    return 1 / (1 + Math.pow(10, (oppAvg - ownAvg) / 400));
}

function matchResult(myScore: number, oppScore: number): number {
    if (myScore > oppScore) return 1;
    if (myScore === oppScore) return 0.5;
    return 0;
}

type HistoricalEloInput = {
    userId: string;
    currentRating: number;
    matchesPlayed: number;
    team: "A" | "B";
    position: "GK" | "DEF" | "MID" | "FWD";
    goalsScored: number;
    isMvp: boolean;
};

type HistoricalEloOutput = {
    userId: string;
    oldRating: number;
    newRating: number;
    delta: number;
};

function computeHistoricalEloUpdates(
    participants: HistoricalEloInput[],
    teamAScore: number,
    teamBScore: number
): HistoricalEloOutput[] {
    const teamA = participants.filter((participant) => participant.team === "A");
    const teamB = participants.filter((participant) => participant.team === "B");
    const avgRatingA = teamA.length > 0
        ? teamA.reduce((sum, participant) => sum + participant.currentRating, 0) / teamA.length
        : ELO_BASE;
    const avgRatingB = teamB.length > 0
        ? teamB.reduce((sum, participant) => sum + participant.currentRating, 0) / teamB.length
        : ELO_BASE;
    const isBlowout = Math.abs(teamAScore - teamBScore) >= BLOWOUT_THRESHOLD;

    return participants.map((participant) => {
        const isTeamA = participant.team === "A";
        const myTeamScore = isTeamA ? teamAScore : teamBScore;
        const oppTeamScore = isTeamA ? teamBScore : teamAScore;
        const ownAvg = isTeamA ? avgRatingA : avgRatingB;
        const oppAvg = isTeamA ? avgRatingB : avgRatingA;
        const k = participant.matchesPlayed < NEW_PLAYER_THRESHOLD ? K_FACTOR_NEW : K_FACTOR;
        const expected = calcExpected(ownAvg, oppAvg);
        const actual = matchResult(myTeamScore, oppTeamScore);
        let delta = Math.round(k * (actual - expected));

        delta += participant.goalsScored * 3;
        if (participant.isMvp) delta += 10;

        if (participant.position === "GK") {
            if (oppTeamScore === 0) delta += GK_CLEAN_SHEET_BONUS;
            else if (oppTeamScore === 1) delta += GK_SOLID_DEFENSE_BONUS;
            if (oppTeamScore >= 5) delta += GK_HEAVY_CONCEDE_PENALTY;
        }

        if (isBlowout) {
            if (myTeamScore > oppTeamScore) delta += 5;
            else if (myTeamScore < oppTeamScore) delta -= 5;
        }

        delta = Math.max(-MAX_CHANGE_PER_MATCH, Math.min(MAX_CHANGE_PER_MATCH, delta));
        const newRating = Math.max(MIN_RATING, participant.currentRating + delta);
        return {
            userId: participant.userId,
            oldRating: participant.currentRating,
            newRating,
            delta: newRating - participant.currentRating,
        };
    });
}

type Season = {
    id: string;
    slug: string;
    name: string;
    status: "active" | "archived";
};

type Participant = {
    user_id: string;
    team: "A" | "B";
    goals: number | null;
    is_mvp: boolean | null;
};

type Match = {
    id: string;
    date: string;
    team_a_score: number;
    team_b_score: number;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceKey) {
    console.error(
        "❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY"
    );
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

function parseSeasonSelector(argv: string[]): string {
    const seasonFlagIndex = argv.findIndex((arg) => arg === "--season");
    if (seasonFlagIndex >= 0) {
        const value = argv[seasonFlagIndex + 1];
        if (value) return value;
    }

    const inlineSeasonFlag = argv.find((arg) => arg.startsWith("--season="));
    if (inlineSeasonFlag) {
        return inlineSeasonFlag.slice("--season=".length);
    }

    console.error("❌ Debes indicar una temporada explícita con --season <slug|uuid>");
    process.exit(1);
}

async function getSeason(selector: string): Promise<Season> {
    const bySlug = await supabase
        .from("seasons")
        .select("id, slug, name, status")
        .eq("slug", selector)
        .maybeSingle<Season>();

    if (bySlug.data) {
        return bySlug.data;
    }

    const byId = await supabase
        .from("seasons")
        .select("id, slug, name, status")
        .eq("id", selector)
        .maybeSingle<Season>();

    if (byId.data) {
        return byId.data;
    }

    const message = bySlug.error?.message ?? byId.error?.message ?? "Temporada no encontrada";
    throw new Error(message);
}

async function ensureSeasonRows(seasonId: string, userIds: string[]) {
    const uniqueUserIds = Array.from(new Set(userIds));
    if (uniqueUserIds.length === 0) return;

    const { error } = await supabase.from("season_player_stats").upsert(
        uniqueUserIds.map((userId) => ({
            season_id: seasonId,
            user_id: userId,
        })),
        {
            onConflict: "season_id,user_id",
        }
    );

    if (error) {
        throw new Error(`No se pudieron preparar las filas de temporada: ${error.message}`);
    }
}

async function main() {
    const seasonSelector = parseSeasonSelector(process.argv.slice(2));
    const season = await getSeason(seasonSelector);

    console.log(`🔄 Recalculando ELO para ${season.name} (${season.slug})...\n`);

    const { data: allProfiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, position");

    if (profileError) {
        throw new Error(`No se pudieron leer los perfiles: ${profileError.message}`);
    }

    const positionMap: Record<string, "GK" | "DEF" | "MID" | "FWD"> = {};
    const usernameMap: Record<string, string> = {};
    for (const profile of allProfiles ?? []) {
        positionMap[profile.id] = (profile.position ?? "MID") as "GK" | "DEF" | "MID" | "FWD";
        usernameMap[profile.id] = profile.username ?? "???";
    }

    const { data: matches, error: matchError } = await supabase
        .from("matches")
        .select("id, date, team_a_score, team_b_score")
        .eq("season_id", season.id)
        .eq("status", "finished")
        .not("team_a_score", "is", null)
        .not("team_b_score", "is", null)
        .order("date", { ascending: true });

    if (matchError) {
        throw new Error(`No se pudieron leer los partidos: ${matchError.message}`);
    }

    console.log(`📅 Procesando ${matches?.length ?? 0} partidos finalizados...\n`);

    let allParticipants: { match_id: string; user_id: string }[] = [];
    if (matches && matches.length > 0) {
        const { data, error: participantError } = await supabase
            .from("match_participants")
            .select("match_id, user_id")
            .in("match_id", matches.map((match) => match.id));

        if (participantError) {
            throw new Error(`No se pudieron leer los participantes: ${participantError.message}`);
        }

        allParticipants = data ?? [];
    }

    await ensureSeasonRows(
        season.id,
        (allParticipants ?? []).map((participant) => participant.user_id)
    );

    const { error: resetError } = await supabase
        .from("season_player_stats")
        .update({ elo_rating: ELO_BASE })
        .eq("season_id", season.id);

    if (resetError) {
        throw new Error(`No se pudieron resetear los ratings de temporada: ${resetError.message}`);
    }

    const ratingMap: Record<string, number> = {};
    const matchesPlayedMap: Record<string, number> = {};
    const historyInserts: Array<{
        user_id: string;
        match_id: string;
        season_id: string;
        rp_change: number;
        new_rp: number;
        created_at: string;
    }> = [];

    for (const match of (matches ?? []) as Match[]) {
        const { data: participants, error } = await supabase
            .from("match_participants")
            .select("user_id, team, goals, is_mvp")
            .eq("match_id", match.id)
            .in("team", ["A", "B"]);

        if (error) {
            throw new Error(`No se pudieron leer los participantes de ${match.id}: ${error.message}`);
        }
        if (!participants || participants.length === 0) continue;

        const updates = computeHistoricalEloUpdates(
            (participants as Participant[]).map((participant) => ({
                userId: participant.user_id,
                currentRating: ratingMap[participant.user_id] ?? ELO_BASE,
                matchesPlayed: matchesPlayedMap[participant.user_id] ?? 0,
                team: participant.team,
                position: positionMap[participant.user_id] ?? "MID",
                goalsScored: participant.goals ?? 0,
                isMvp: participant.is_mvp ?? false,
            })),
            match.team_a_score,
            match.team_b_score
        );

        for (const update of updates) {
            ratingMap[update.userId] = update.newRating;
            matchesPlayedMap[update.userId] = (matchesPlayedMap[update.userId] ?? 0) + 1;
            historyInserts.push({
                user_id: update.userId,
                match_id: match.id,
                season_id: season.id,
                rp_change: update.delta,
                new_rp: update.newRating,
                created_at: match.date,
            });
        }

        console.log(
            `  ⚽ ${match.date.split("T")[0]} | ${match.team_a_score}-${match.team_b_score} | ${participants.length} jugadores`
        );
    }

    // Preserve the approved post-processing step: amplify the dispersion without changing
    // the order, and apply the same transformation to each event's resulting RP.
    const SCALE_FACTOR = 2.5;
    console.log(`\n📐 Reescalando dispersión ×${SCALE_FACTOR} desde base ${ELO_BASE}...`);
    for (const userId of Object.keys(ratingMap)) {
        const raw = ratingMap[userId];
        ratingMap[userId] = Math.max(
            MIN_RATING,
            Math.round(ELO_BASE + (raw - ELO_BASE) * SCALE_FACTOR)
        );
    }
    for (const entry of historyInserts) {
        entry.new_rp = Math.max(
            MIN_RATING,
            Math.round(ELO_BASE + (entry.new_rp - ELO_BASE) * SCALE_FACTOR)
        );
    }

    console.log(`\n💾 Limpiando rp_history solo para ${season.slug}...`);
    const { error: deleteError } = await supabase
        .from("rp_history")
        .delete()
        .eq("season_id", season.id);
    if (deleteError) {
        throw new Error(`No se pudo limpiar rp_history de la temporada: ${deleteError.message}`);
    }

    console.log("💾 Guardando ratings finales e historial...");
    for (const [userId, rating] of Object.entries(ratingMap)) {
        const { error } = await supabase
            .from("season_player_stats")
            .update({ elo_rating: rating })
            .eq("season_id", season.id)
            .eq("user_id", userId);

        if (error) {
            throw new Error(`No se pudo guardar el rating de ${userId}: ${error.message}`);
        }
    }

    for (let i = 0; i < historyInserts.length; i += 500) {
        const chunk = historyInserts.slice(i, i + 500);
        const { error } = await supabase.from("rp_history").insert(chunk);
        if (error) {
            throw new Error(`No se pudo guardar el historial RP: ${error.message}`);
        }
    }

    console.log(
        `\n✅ Listo. ${Object.keys(ratingMap).length} jugadores recalculados y ${historyInserts.length} eventos RP reescritos en ${season.slug}.`
    );

    const finalStats = await supabase
        .from("season_player_stats")
        .select("user_id, elo_rating, matches_played")
        .eq("season_id", season.id)
        .order("elo_rating", { ascending: false })
        .limit(10);

    if (finalStats.error) {
        throw new Error(`No se pudo leer el ranking final: ${finalStats.error.message}`);
    }

    if (finalStats.data && finalStats.data.length > 0) {
        console.log("\n📊 Top 10 final:");
        for (const stat of finalStats.data) {
            console.log(
                `  ${(usernameMap[stat.user_id] ?? "???").padEnd(25)} ${String(stat.elo_rating).padStart(4)} RP  (${stat.matches_played} partidos)`
            );
        }
    }
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
