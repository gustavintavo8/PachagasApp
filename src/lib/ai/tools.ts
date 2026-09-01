import { tool, jsonSchema } from "ai";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveSeasonSelection } from "@/lib/seasons";
import type { Season } from "@/lib/types";

type SeasonInput = { season_slug?: string };

const seasonInputProperties = {
    season_slug: {
        type: "string",
        pattern: "^season-[1-9][0-9]*$",
        description: "Slug de temporada, por ejemplo season-2.",
    },
} as const;

function profileFromRow(row: { profiles?: unknown }) {
    return Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
}

type ResolvedSeasonalPlayer = {
    id: string;
    username: string;
    elo_rating: number;
};

async function resolveSeasonalPlayer(
    admin: ReturnType<typeof createAdminClient>,
    seasonId: string,
    usernameQuery: string
): Promise<{ player: ResolvedSeasonalPlayer | null; error: string | null }> {
    const { data, error } = await admin
        .from("season_player_stats")
        .select("user_id, elo_rating, profiles!inner(id, username)")
        .eq("season_id", seasonId)
        .ilike("profiles.username", `%${usernameQuery}%`)
        .order("elo_rating", { ascending: false })
        .limit(2);

    if (error) return { player: null, error: error.message };

    const candidates = data ?? [];
    if (candidates.length !== 1) {
        return { player: null, error: "La búsqueda no identifica a un único jugador" };
    }

    const profile = profileFromRow(candidates[0]) as { id: string; username: string | null } | null;
    if (!profile?.username) {
        return { player: null, error: "El jugador no tiene un nombre válido" };
    }

    return {
        player: {
            id: candidates[0].user_id,
            username: profile.username,
            elo_rating: candidates[0].elo_rating,
        },
        error: null,
    };
}

export function buildTools(userId: string, defaultSeason: Season) {
    const resolveToolSeason = async (seasonSlug?: string) => {
        if (seasonSlug === undefined) return defaultSeason;
        if (typeof seasonSlug !== "string" || !seasonSlug.trim()) return null;

        try {
            return await resolveSeasonSelection(seasonSlug);
        } catch {
            return null;
        }
    };

    return {
        get_players: tool({
            description: "Lista jugadores de la temporada seleccionada. Filtros opcionales: posición (GK/DEF/MID/FWD), rango ELO, límite.",
            inputSchema: jsonSchema<{
                season_slug?: string;
                position?: "GK" | "DEF" | "MID" | "FWD";
                min_elo?: number;
                max_elo?: number;
                limit?: number;
            }>({
                type: "object",
                properties: {
                    ...seasonInputProperties,
                    position: { type: "string", enum: ["GK", "DEF", "MID", "FWD"] },
                    min_elo: { type: "number" },
                    max_elo: { type: "number" },
                    limit: { type: "number" },
                },
                required: [],
            }),
            execute: async (input) => {
                const season = await resolveToolSeason(input.season_slug);
                if (!season) return { error: "Temporada inválida" };

                const { position, min_elo, max_elo } = input;
                const limit = input.limit ?? 20;
                const admin = createAdminClient();
                let query = admin
                    .from("season_player_stats")
                    .select("elo_rating, matches_played, goals_scored, profiles!inner(username, position, avatar_url)")
                    .eq("season_id", season.id)
                    .order("elo_rating", { ascending: false })
                    .limit(limit);

                if (position) query = query.eq("profiles.position", position);
                if (min_elo !== undefined) query = query.gte("elo_rating", min_elo);
                if (max_elo !== undefined) query = query.lte("elo_rating", max_elo);

                const { data, error } = await query;
                if (error) return { error: "No se pudo obtener la lista de jugadores" };

                const jugadores = (data ?? []).map((row) => ({
                    ...profileFromRow(row),
                    elo_rating: row.elo_rating,
                    matches_played: row.matches_played,
                    goals_scored: row.goals_scored,
                }));
                return { jugadores };
            },
        }),

        get_matches: tool({
            description: "Lista partidos de la temporada seleccionada. Filtros opcionales: estado (open/closed/finished/cancelled), fechas ISO 8601, límite.",
            inputSchema: jsonSchema<SeasonInput & {
                status?: "open" | "closed" | "finished" | "cancelled";
                from_date?: string;
                to_date?: string;
                limit?: number;
            }>({
                type: "object",
                properties: {
                    ...seasonInputProperties,
                    status: { type: "string", enum: ["open", "closed", "finished", "cancelled"] },
                    from_date: { type: "string" },
                    to_date: { type: "string" },
                    limit: { type: "number" },
                },
                required: [],
            }),
            execute: async (input) => {
                const season = await resolveToolSeason(input.season_slug);
                if (!season) return { error: "Temporada inválida" };

                const { status, from_date, to_date } = input;
                const limit = input.limit ?? 10;
                const admin = createAdminClient();
                let query = admin
                    .from("matches")
                    .select("id, season_id, date, location, status, max_players, team_a_score, team_b_score")
                    .eq("season_id", season.id)
                    .order("date", { ascending: false })
                    .limit(limit);

                if (status) query = query.eq("status", status);
                if (from_date) query = query.gte("date", from_date);
                if (to_date) query = query.lte("date", to_date);

                const { data, error } = await query;
                if (error) return { error: "No se pudo obtener los partidos" };
                return { partidos: data ?? [] };
            },
        }),

        get_top_scorers: tool({
            description: "Ranking de máximos goleadores de la temporada seleccionada.",
            inputSchema: jsonSchema<SeasonInput & { limit?: number }>({
                type: "object",
                properties: { ...seasonInputProperties, limit: { type: "number" } },
                required: [],
            }),
            execute: async (input) => {
                const season = await resolveToolSeason(input.season_slug);
                if (!season) return { error: "Temporada inválida" };

                const admin = createAdminClient();
                const { data, error } = await admin
                    .from("season_player_stats")
                    .select("goals_scored, matches_played, profiles!inner(username, position, avatar_url)")
                    .eq("season_id", season.id)
                    .order("goals_scored", { ascending: false })
                    .limit(input.limit ?? 10);
                if (error) return { error: "No se pudo obtener el ranking de goleadores" };

                const goleadores = (data ?? []).map((row) => ({
                    ...profileFromRow(row),
                    goals_scored: row.goals_scored,
                    matches_played: row.matches_played,
                }));
                return { goleadores };
            },
        }),

        get_leaderboard: tool({
            description: "Ranking ELO de jugadores de la temporada seleccionada con al menos 3 partidos.",
            inputSchema: jsonSchema<SeasonInput & { limit?: number }>({
                type: "object",
                properties: { ...seasonInputProperties, limit: { type: "number" } },
                required: [],
            }),
            execute: async (input) => {
                const season = await resolveToolSeason(input.season_slug);
                if (!season) return { error: "Temporada inválida" };

                const admin = createAdminClient();
                const { data, error } = await admin
                    .from("season_player_stats")
                    .select("elo_rating, matches_played, goals_scored, profiles!inner(username, position, avatar_url)")
                    .eq("season_id", season.id)
                    .gte("matches_played", 3)
                    .order("elo_rating", { ascending: false })
                    .limit(input.limit ?? 10);
                if (error) return { error: "No se pudo obtener el ranking" };

                const ranking = (data ?? []).map((row) => ({
                    ...profileFromRow(row),
                    elo_rating: row.elo_rating,
                    matches_played: row.matches_played,
                    goals_scored: row.goals_scored,
                }));
                return { ranking };
            },
        }),

        get_player_detail: tool({
            description: "Perfil completo y posición en el ranking de la temporada seleccionada para un jugador por username.",
            inputSchema: jsonSchema<SeasonInput & { username: string }>({
                type: "object",
                properties: { ...seasonInputProperties, username: { type: "string" } },
                required: ["username"],
            }),
            execute: async (input) => {
                const season = await resolveToolSeason(input.season_slug);
                if (!season) return { error: "Temporada inválida" };

                const admin = createAdminClient();
                const { data: playerStat, error } = await admin
                    .from("season_player_stats")
                    .select("elo_rating, matches_played, goals_scored, profiles!inner(username, position, skill_level, avatar_url)")
                    .eq("season_id", season.id)
                    .ilike("profiles.username", `%${input.username}%`)
                    .order("elo_rating", { ascending: false })
                    .limit(1)
                    .maybeSingle();

                const player = playerStat ? profileFromRow(playerStat) : null;
                if (error || !playerStat || !player)
                    return { error: `No se encontró al jugador "${input.username}"` };

                const { count } = await admin
                    .from("season_player_stats")
                    .select("user_id", { count: "exact", head: true })
                    .eq("season_id", season.id)
                    .gt("elo_rating", playerStat.elo_rating)
                    .gte("matches_played", 3);

                return {
                    jugador: {
                        ...player,
                        elo_rating: playerStat.elo_rating,
                        matches_played: playerStat.matches_played,
                        goals_scored: playerStat.goals_scored,
                        rank: (count ?? 0) + 1,
                    },
                };
            },
        }),

        get_match_detail: tool({
            description: "Detalles completos de un partido de la temporada seleccionada: resultado, participantes, goles y MVP.",
            inputSchema: jsonSchema<SeasonInput & { match_id: string }>({
                type: "object",
                properties: { ...seasonInputProperties, match_id: { type: "string" } },
                required: ["match_id"],
            }),
            execute: async (input) => {
                const season = await resolveToolSeason(input.season_slug);
                if (!season) return { error: "Temporada inválida" };

                const admin = createAdminClient();
                const { data, error } = await admin
                    .from("matches")
                    .select("*, match_participants(user_id, team, goals, is_mvp, has_paid, profiles(username, position))")
                    .eq("id", input.match_id)
                    .eq("season_id", season.id)
                    .single();
                if (error || !data) return { error: "No se encontró el partido" };
                return { partido: data };
            },
        }),

        get_my_stats: tool({
            description: "Estadísticas del usuario autenticado en la temporada seleccionada: ELO, goles, partidos y posición en el ranking.",
            inputSchema: jsonSchema<SeasonInput>({
                type: "object",
                properties: seasonInputProperties,
                required: [],
            }),
            execute: async (input) => {
                const season = await resolveToolSeason(input.season_slug);
                if (!season) return { error: "Temporada inválida" };

                const admin = createAdminClient();
                const { data: stats, error } = await admin
                    .from("season_player_stats")
                    .select("elo_rating, matches_played, goals_scored, profiles!inner(username, position, avatar_url)")
                    .eq("season_id", season.id)
                    .eq("user_id", userId)
                    .maybeSingle();

                const profile = stats ? profileFromRow(stats) : null;
                if (error || !stats || !profile) {
                    console.error("[tools] get_my_stats error:", error?.code, error?.message, "userId:", userId);
                    return { error: "No se pudieron obtener tus estadísticas" };
                }

                const { count } = await admin
                    .from("season_player_stats")
                    .select("user_id", { count: "exact", head: true })
                    .eq("season_id", season.id)
                    .gt("elo_rating", stats.elo_rating)
                    .gte("matches_played", 3);

                return {
                    mis_stats: {
                        ...profile,
                        elo_rating: stats.elo_rating,
                        matches_played: stats.matches_played,
                        goals_scored: stats.goals_scored,
                        rank: (count ?? 0) + 1,
                    },
                };
            },
        }),

        get_my_matches: tool({
            description: "Historial de partidos del usuario autenticado en la temporada seleccionada con fecha, goles, equipo y MVP en cada partido. Úsalo para calcular ritmo de goles por mes, progresión, racha reciente o cualquier análisis temporal.",
            inputSchema: jsonSchema<SeasonInput & { limit?: number }>({
                type: "object",
                properties: { ...seasonInputProperties, limit: { type: "number" } },
                required: [],
            }),
            execute: async (input) => {
                const season = await resolveToolSeason(input.season_slug);
                if (!season) return { error: "Temporada inválida" };

                const admin = createAdminClient();
                const { data, error } = await admin
                    .from("match_participants")
                    .select("goals, team, is_mvp, matches!inner(id, season_id, date, location, status, team_a_score, team_b_score)")
                    .eq("user_id", userId)
                    .eq("matches.season_id", season.id)
                    .order("matches(date)", { ascending: false })
                    .limit(input.limit ?? 20);

                if (error) {
                    console.error("[tools] get_my_matches error:", error?.code, error?.message);
                    return { error: "No se pudo obtener el historial de partidos" };
                }

                const partidos = (data ?? []).map((row) => {
                    const match = Array.isArray(row.matches) ? row.matches[0] : row.matches;
                    return { ...match, goles: row.goals, equipo: row.team, mvp: row.is_mvp };
                }).filter((p) => p.date);

                return { partidos };
            },
        }),

        get_players_history_together: tool({
            description: "Partidos de la temporada seleccionada en los que dos jugadores coincidieron.",
            inputSchema: jsonSchema<SeasonInput & { player_a: string; player_b: string }>({
                type: "object",
                properties: {
                    ...seasonInputProperties,
                    player_a: { type: "string" },
                    player_b: { type: "string" },
                },
                required: ["player_a", "player_b"],
            }),
            execute: async (input) => {
                const season = await resolveToolSeason(input.season_slug);
                if (!season) return { error: "Temporada inválida" };

                const { player_a, player_b } = input;
                const admin = createAdminClient();
                const [{ player: profileA, error: errA }, { player: profileB, error: errB }] = await Promise.all([
                    resolveSeasonalPlayer(admin, season.id, player_a),
                    resolveSeasonalPlayer(admin, season.id, player_b),
                ]);

                if (errA || errB || !profileA || !profileB)
                    return { error: `No se encontraron ambos jugadores: "${player_a}" y "${player_b}"` };

                const { data: matchesA } = await admin
                    .from("match_participants")
                    .select("match_id, team, goals, is_mvp, matches!inner(season_id)")
                    .eq("user_id", profileA.id)
                    .eq("matches.season_id", season.id);

                if (!matchesA || matchesA.length === 0) return { partidos_juntos: [] };

                const matchIds = matchesA.map((m) => m.match_id);
                const { data: matchesB } = await admin
                    .from("match_participants")
                    .select("match_id, team, goals, is_mvp, matches!inner(season_id)")
                    .eq("user_id", profileB.id)
                    .eq("matches.season_id", season.id)
                    .in("match_id", matchIds);

                if (!matchesB || matchesB.length === 0) return { partidos_juntos: [] };

                const sharedIds = matchesB.map((m) => m.match_id);
                const { data: matches } = await admin
                    .from("matches")
                    .select("id, season_id, date, location, team_a_score, team_b_score, status")
                    .eq("season_id", season.id)
                    .in("id", sharedIds)
                    .order("date", { ascending: false });

                const result = (matches ?? []).map((match) => {
                    const partA = matchesA.find((m) => m.match_id === match.id);
                    const partB = matchesB.find((m) => m.match_id === match.id);
                    return {
                        ...match,
                        [player_a]: { equipo: partA?.team, goles: partA?.goals, mvp: partA?.is_mvp },
                        [player_b]: { equipo: partB?.team, goles: partB?.goals, mvp: partB?.is_mvp },
                    };
                });

                return { partidos_juntos: result };
            },
        }),
    };
}
