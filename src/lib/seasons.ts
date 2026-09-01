import { createAdminClient } from "@/lib/supabase/admin";
import type { Season, SeasonPlayerStats } from "@/lib/types";
import { isSeasonSlug } from "@/lib/season-validation";

const SEASON_SELECT = "id, name, slug, status, starts_at, ends_at";
const SEASON_PLAYER_STATS_SELECT =
    "season_id, user_id, elo_rating, matches_played, goals_scored, wins, draws, losses, mvps";

export class SeasonNotFoundError extends Error {
    constructor(message = "Temporada no encontrada") {
        super(message);
        this.name = "SeasonNotFoundError";
    }
}

export async function getActiveSeason(): Promise<Season> {
    const admin = createAdminClient();
    const { data, error } = await admin
        .from("seasons")
        .select(SEASON_SELECT)
        .eq("status", "active")
        .single();

    if (error || !data) {
        throw new SeasonNotFoundError("No hay una temporada activa disponible");
    }

    return data;
}

export async function resolveSeasonSelection(value?: string): Promise<Season> {
    if (!value) {
        return getActiveSeason();
    }

    if (!isSeasonSlug(value)) {
        throw new SeasonNotFoundError();
    }

    const admin = createAdminClient();
    const { data, error } = await admin
        .from("seasons")
        .select(SEASON_SELECT)
        .eq("slug", value)
        .maybeSingle();

    if (error || !data) {
        throw new SeasonNotFoundError();
    }

    return data;
}

export async function ensureSeasonPlayerStats(
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
        .single();

    if (error || !data) {
        throw new Error(
            error?.message ?? "No se pudieron asegurar las estadísticas de temporada"
        );
    }

    return data;
}
