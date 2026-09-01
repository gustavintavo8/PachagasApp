import { createAdminClient } from "@/lib/supabase/admin";
import type { SeasonPlayerStats } from "@/lib/types";

const SEASON_PLAYER_STATS_SELECT =
    "season_id, user_id, elo_rating, matches_played, goals_scored, wins, draws, losses, mvps";

export async function upsertZeroStats(
    seasonId: string,
    userId: string
): Promise<SeasonPlayerStats> {
    const admin = createAdminClient();
    const { data, error } = await admin
        .from("season_player_stats")
        .upsert(
            {
                season_id: seasonId,
                user_id: userId,
            },
            {
                onConflict: "season_id,user_id",
            }
        )
        .select(SEASON_PLAYER_STATS_SELECT)
        .single<SeasonPlayerStats>();

    if (error || !data) {
        throw new Error(
            error?.message ?? "No se pudieron asegurar las estadísticas de temporada"
        );
    }

    return data;
}

export async function getStatsForUser(
    seasonId: string,
    userId: string
): Promise<SeasonPlayerStats> {
    return upsertZeroStats(seasonId, userId);
}

export async function getStatsForUsers(
    seasonId: string,
    userIds: string[]
): Promise<SeasonPlayerStats[]> {
    const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));

    if (uniqueUserIds.length === 0) {
        return [];
    }

    const admin = createAdminClient();
    const { error: upsertError } = await admin.from("season_player_stats").upsert(
        uniqueUserIds.map((userId) => ({
            season_id: seasonId,
            user_id: userId,
        })),
        {
            onConflict: "season_id,user_id",
        }
    );

    if (upsertError) {
        throw new Error(
            upsertError.message ?? "No se pudieron asegurar las estadísticas de temporada"
        );
    }

    const { data, error } = await admin
        .from("season_player_stats")
        .select(SEASON_PLAYER_STATS_SELECT)
        .eq("season_id", seasonId)
        .in("user_id", uniqueUserIds);

    if (error || !data) {
        throw new Error(
            error?.message ?? "No se pudieron leer las estadísticas de temporada"
        );
    }

    return data as SeasonPlayerStats[];
}
