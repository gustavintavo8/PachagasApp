/**
 * Script de retroactivo — Recalcular ELO de una temporada concreta
 *
 * Uso (PowerShell):
 *   npx tsx --env-file=.env.local src/scripts/recalculate-elo.ts --season season-2
 *   npx tsx --env-file=.env.local src/scripts/recalculate-elo.ts --season <uuid>
 */

import { createClient } from "@supabase/supabase-js";
import { ELO_BASE, computeMatchEloUpdates } from "../lib/elo";

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

        const updates = computeMatchEloUpdates(
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

    if (season.status === "active") {
        for (const [userId, rating] of Object.entries(ratingMap)) {
            const { error } = await supabase
                .from("profiles")
                .update({
                    elo_rating: rating,
                    market_value: Math.max(1_000_000, (rating - 800) * 50_000),
                })
                .eq("id", userId);

            if (error) {
                throw new Error(`No se pudo sincronizar el perfil ${userId}: ${error.message}`);
            }
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
