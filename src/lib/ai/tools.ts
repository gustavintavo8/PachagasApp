import { tool, jsonSchema } from "ai";
import { createAdminClient } from "@/lib/supabase/admin";

export function buildTools(userId: string) {
    const admin = createAdminClient();

    return {
        get_players: tool({
            description: "Lista jugadores. Filtros opcionales: posición (GK/DEF/MID/FWD), rango ELO, límite.",
            inputSchema: jsonSchema<{
                position?: "GK" | "DEF" | "MID" | "FWD";
                min_elo?: number;
                max_elo?: number;
                limit?: number;
            }>({
                type: "object",
                properties: {
                    position: { type: "string", enum: ["GK", "DEF", "MID", "FWD"] },
                    min_elo: { type: "number" },
                    max_elo: { type: "number" },
                    limit: { type: "number" },
                },
                required: [],
            }),
            execute: async (input) => {
                const { position, min_elo, max_elo } = input;
                const limit = input.limit ?? 20;
                let query = admin
                    .from("profiles")
                    .select("username, position, elo_rating, matches_played, goals_scored, market_value")
                    .order("elo_rating", { ascending: false })
                    .limit(limit);

                if (position) query = query.eq("position", position);
                if (min_elo !== undefined) query = query.gte("elo_rating", min_elo);
                if (max_elo !== undefined) query = query.lte("elo_rating", max_elo);

                const { data, error } = await query;
                if (error) return { error: "No se pudo obtener la lista de jugadores" };
                return { jugadores: data ?? [] };
            },
        }),

        get_matches: tool({
            description: "Lista partidos. Filtros opcionales: estado (open/closed/finished/cancelled), fechas ISO 8601, límite.",
            inputSchema: jsonSchema<{
                status?: "open" | "closed" | "finished" | "cancelled";
                from_date?: string;
                to_date?: string;
                limit?: number;
            }>({
                type: "object",
                properties: {
                    status: { type: "string", enum: ["open", "closed", "finished", "cancelled"] },
                    from_date: { type: "string" },
                    to_date: { type: "string" },
                    limit: { type: "number" },
                },
                required: [],
            }),
            execute: async (input) => {
                const { status, from_date, to_date } = input;
                const limit = input.limit ?? 10;
                let query = admin
                    .from("matches")
                    .select("id, date, location, status, max_players, team_a_score, team_b_score")
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
            description: "Ranking de máximos goleadores.",
            inputSchema: jsonSchema<{ limit?: number }>({
                type: "object",
                properties: { limit: { type: "number" } },
                required: [],
            }),
            execute: async (input) => {
                const { data, error } = await admin
                    .from("profiles")
                    .select("username, goals_scored, matches_played, position")
                    .order("goals_scored", { ascending: false })
                    .limit(input.limit ?? 10);
                if (error) return { error: "No se pudo obtener el ranking de goleadores" };
                return { goleadores: data ?? [] };
            },
        }),

        get_leaderboard: tool({
            description: "Ranking ELO de jugadores con al menos 3 partidos.",
            inputSchema: jsonSchema<{ limit?: number }>({
                type: "object",
                properties: { limit: { type: "number" } },
                required: [],
            }),
            execute: async (input) => {
                const { data, error } = await admin
                    .from("profiles")
                    .select("username, elo_rating, matches_played, goals_scored, position")
                    .gte("matches_played", 3)
                    .order("elo_rating", { ascending: false })
                    .limit(input.limit ?? 10);
                if (error) return { error: "No se pudo obtener el ranking" };
                return { ranking: data ?? [] };
            },
        }),

        get_player_detail: tool({
            description: "Perfil completo y posición en el ranking de un jugador por username.",
            inputSchema: jsonSchema<{ username: string }>({
                type: "object",
                properties: { username: { type: "string" } },
                required: ["username"],
            }),
            execute: async (input) => {
                const { data: player, error } = await admin
                    .from("profiles")
                    .select("username, position, skill_level, elo_rating, matches_played, goals_scored, market_value")
                    .ilike("username", `%${input.username}%`)
                    .order("elo_rating", { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (error || !player)
                    return { error: `No se encontró al jugador "${input.username}"` };

                const { count } = await admin
                    .from("profiles")
                    .select("id", { count: "exact", head: true })
                    .gt("elo_rating", player.elo_rating)
                    .gte("matches_played", 3);

                return { jugador: { ...player, rank: (count ?? 0) + 1 } };
            },
        }),

        get_match_detail: tool({
            description: "Detalles completos de un partido: resultado, participantes, goles y MVP.",
            inputSchema: jsonSchema<{ match_id: string }>({
                type: "object",
                properties: { match_id: { type: "string" } },
                required: ["match_id"],
            }),
            execute: async (input) => {
                const { data, error } = await admin
                    .from("matches")
                    .select("*, match_participants(user_id, team, goals, is_mvp, has_paid, profiles(username, position))")
                    .eq("id", input.match_id)
                    .single();
                if (error || !data) return { error: "No se encontró el partido" };
                return { partido: data };
            },
        }),

        get_my_stats: tool({
            description: "Estadísticas del usuario autenticado: ELO, goles, partidos y posición en el ranking.",
            inputSchema: jsonSchema<Record<string, never>>({
                type: "object",
                properties: {},
                required: [],
            }),
            execute: async () => {
                const { data: profile, error } = await admin
                    .from("profiles")
                    .select("username, position, elo_rating, matches_played, goals_scored, market_value")
                    .eq("id", userId)
                    .single();

                if (error || !profile) {
                    console.error("[tools] get_my_stats error:", error?.code, error?.message, "userId:", userId);
                    return { error: "No se pudieron obtener tus estadísticas" };
                }

                const { count } = await admin
                    .from("profiles")
                    .select("id", { count: "exact", head: true })
                    .gt("elo_rating", profile.elo_rating)
                    .gte("matches_played", 3);

                return { mis_stats: { ...profile, rank: (count ?? 0) + 1 } };
            },
        }),

        get_my_matches: tool({
            description: "Historial de partidos del usuario autenticado con fecha, goles, equipo y MVP en cada partido. Úsalo para calcular ritmo de goles por mes, progresión, racha reciente o cualquier análisis temporal.",
            inputSchema: jsonSchema<{ limit?: number }>({
                type: "object",
                properties: { limit: { type: "number" } },
                required: [],
            }),
            execute: async (input) => {
                const { data, error } = await admin
                    .from("match_participants")
                    .select("goals, team, is_mvp, matches(id, date, location, status, team_a_score, team_b_score)")
                    .eq("user_id", userId)
                    .limit(input.limit ?? 20);

                if (error) {
                    console.error("[tools] get_my_matches error:", error?.code, error?.message);
                    return { error: "No se pudo obtener el historial de partidos" };
                }

                const partidos = (data ?? [])
                    .map((row) => {
                        const match = Array.isArray(row.matches) ? row.matches[0] : row.matches;
                        return { ...match, goles: row.goals, equipo: row.team, mvp: row.is_mvp };
                    })
                    .filter((p) => p.date)
                    .sort((a, b) => new Date(b.date as string).getTime() - new Date(a.date as string).getTime());

                return { partidos };
            },
        }),

        get_fantasy_standings: tool({
            description: "Clasificación de equipos fantasy por puntos.",
            inputSchema: jsonSchema<{ limit?: number }>({
                type: "object",
                properties: { limit: { type: "number" } },
                required: [],
            }),
            execute: async (input) => {
                const { data, error } = await admin
                    .from("fantasy_teams")
                    .select("name, total_points, budget, profiles(username)")
                    .order("total_points", { ascending: false })
                    .limit(input.limit ?? 10);
                if (error) return { error: "No se pudo obtener la clasificación fantasy" };
                return { clasificacion: data ?? [] };
            },
        }),

        get_my_fantasy_team: tool({
            description: "Equipo fantasy del usuario autenticado con plantilla completa.",
            inputSchema: jsonSchema<Record<string, never>>({
                type: "object",
                properties: {},
                required: [],
            }),
            execute: async () => {
                const { data: team, error: teamError } = await admin
                    .from("fantasy_teams")
                    .select("id, name, total_points, budget")
                    .eq("user_id", userId)
                    .single();

                if (teamError || !team)
                    return { error: "No tienes un equipo fantasy o no se pudo obtener" };

                const { data: roster, error: rosterError } = await admin
                    .from("fantasy_rosters")
                    .select("is_captain, is_starter, profiles(username, position, elo_rating)")
                    .eq("team_id", team.id);

                if (rosterError) return { error: "No se pudo obtener la plantilla" };
                return { equipo: { ...team, plantilla: roster ?? [] } };
            },
        }),

        get_players_history_together: tool({
            description: "Partidos en los que dos jugadores coincidieron.",
            inputSchema: jsonSchema<{ player_a: string; player_b: string }>({
                type: "object",
                properties: {
                    player_a: { type: "string" },
                    player_b: { type: "string" },
                },
                required: ["player_a", "player_b"],
            }),
            execute: async (input) => {
                const { player_a, player_b } = input;
                const { data: profilesA } = await admin
                    .from("profiles").select("id, username").ilike("username", `%${player_a}%`).limit(1).maybeSingle();
                const { data: profilesB } = await admin
                    .from("profiles").select("id, username").ilike("username", `%${player_b}%`).limit(1).maybeSingle();
                const profiles = [profilesA, profilesB].filter(Boolean) as { id: string; username: string }[];
                const profilesError = null;

                if (profilesError || !profiles || profiles.length < 2)
                    return { error: `No se encontraron ambos jugadores: "${player_a}" y "${player_b}"` };

                const profileA = profiles.find((p) => p.username?.toLowerCase() === player_a.toLowerCase());
                const profileB = profiles.find((p) => p.username?.toLowerCase() === player_b.toLowerCase());

                if (!profileA || !profileB)
                    return { error: `No se encontraron ambos jugadores: "${player_a}" y "${player_b}"` };

                const { data: matchesA } = await admin
                    .from("match_participants")
                    .select("match_id, team, goals, is_mvp")
                    .eq("user_id", profileA.id);

                if (!matchesA || matchesA.length === 0) return { partidos_juntos: [] };

                const matchIds = matchesA.map((m) => m.match_id);

                const { data: matchesB } = await admin
                    .from("match_participants")
                    .select("match_id, team, goals, is_mvp")
                    .eq("user_id", profileB.id)
                    .in("match_id", matchIds);

                if (!matchesB || matchesB.length === 0) return { partidos_juntos: [] };

                const sharedIds = matchesB.map((m) => m.match_id);

                const { data: matches } = await admin
                    .from("matches")
                    .select("id, date, location, team_a_score, team_b_score, status")
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
