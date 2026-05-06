import { tool, zodSchema } from "ai";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

export function buildTools(userId: string) {
    const admin = createAdminClient();

    return {
        get_players: tool({
            description: "Lista jugadores. Filtros opcionales: posición (GK/DEF/MID/FWD), rango ELO, límite.",
            inputSchema: zodSchema(
                z.object({
                    position: z.enum(["GK", "DEF", "MID", "FWD"]).optional(),
                    min_elo: z.number().optional(),
                    max_elo: z.number().optional(),
                    limit: z.number().default(20),
                })
            ),
            execute: async (input) => {
                const { position, min_elo, max_elo, limit } = input;
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
            inputSchema: zodSchema(
                z.object({
                    status: z.enum(["open", "closed", "finished", "cancelled"]).optional(),
                    from_date: z.string().optional(),
                    to_date: z.string().optional(),
                    limit: z.number().default(10),
                })
            ),
            execute: async (input) => {
                const { status, from_date, to_date, limit } = input;
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
            inputSchema: zodSchema(z.object({ limit: z.number().default(10) })),
            execute: async (input) => {
                const { data, error } = await admin
                    .from("profiles")
                    .select("username, goals_scored, matches_played, position")
                    .order("goals_scored", { ascending: false })
                    .limit(input.limit);
                if (error) return { error: "No se pudo obtener el ranking de goleadores" };
                return { goleadores: data ?? [] };
            },
        }),

        get_leaderboard: tool({
            description: "Ranking ELO de jugadores con al menos 3 partidos.",
            inputSchema: zodSchema(z.object({ limit: z.number().default(10) })),
            execute: async (input) => {
                const { data, error } = await admin
                    .from("profiles")
                    .select("username, elo_rating, matches_played, goals_scored, position")
                    .gte("matches_played", 3)
                    .order("elo_rating", { ascending: false })
                    .limit(input.limit);
                if (error) return { error: "No se pudo obtener el ranking" };
                return { ranking: data ?? [] };
            },
        }),

        get_player_detail: tool({
            description: "Perfil completo y posición en el ranking de un jugador por username.",
            inputSchema: zodSchema(z.object({ username: z.string() })),
            execute: async (input) => {
                const { data: player, error } = await admin
                    .from("profiles")
                    .select("username, position, skill_level, elo_rating, matches_played, goals_scored, market_value")
                    .ilike("username", input.username)
                    .single();

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
            inputSchema: zodSchema(z.object({ match_id: z.string() })),
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
            inputSchema: zodSchema(z.object({})),
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

        get_fantasy_standings: tool({
            description: "Clasificación de equipos fantasy por puntos.",
            inputSchema: zodSchema(z.object({ limit: z.number().default(10) })),
            execute: async (input) => {
                const { data, error } = await admin
                    .from("fantasy_teams")
                    .select("name, total_points, budget, profiles(username)")
                    .order("total_points", { ascending: false })
                    .limit(input.limit);
                if (error) return { error: "No se pudo obtener la clasificación fantasy" };
                return { clasificacion: data ?? [] };
            },
        }),

        get_my_fantasy_team: tool({
            description: "Equipo fantasy del usuario autenticado con plantilla completa.",
            inputSchema: zodSchema(z.object({})),
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
            inputSchema: zodSchema(
                z.object({
                    player_a: z.string(),
                    player_b: z.string(),
                })
            ),
            execute: async (input) => {
                const { player_a, player_b } = input;
                const { data: profiles, error: profilesError } = await admin
                    .from("profiles")
                    .select("id, username")
                    .in("username", [player_a, player_b]);

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
