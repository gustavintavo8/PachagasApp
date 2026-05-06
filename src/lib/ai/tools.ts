import { tool } from "ai";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

export function buildTools(userId: string) {
    const admin = createAdminClient();

    return {
        get_players: tool({
            description:
                "Busca jugadores con filtros opcionales de posición y rango ELO. Devuelve lista con estadísticas.",
            inputSchema: z.object({
                position: z
                    .enum(["GK", "DEF", "MID", "FWD"])
                    .optional()
                    .describe("Posición del jugador"),
                min_elo: z.number().optional().describe("ELO mínimo"),
                max_elo: z.number().optional().describe("ELO máximo"),
                limit: z.number().default(20).describe("Número máximo de resultados"),
            }),
            execute: async (input) => {
                const { position, min_elo, max_elo, limit } = input;
                let query = admin
                    .from("profiles")
                    .select(
                        "username, position, elo_rating, matches_played, goals_scored, market_value"
                    )
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
            description:
                "Busca partidos con filtros opcionales de estado y rango de fechas (ISO 8601).",
            inputSchema: z.object({
                status: z
                    .enum(["open", "closed", "finished", "cancelled"])
                    .optional()
                    .describe("Estado del partido"),
                from_date: z.string().optional().describe("Fecha de inicio (ISO 8601)"),
                to_date: z.string().optional().describe("Fecha de fin (ISO 8601)"),
                limit: z.number().default(10).describe("Número máximo de resultados"),
            }),
            execute: async (input) => {
                const { status, from_date, to_date, limit } = input;
                let query = admin
                    .from("matches")
                    .select(
                        "id, date, location, status, max_players, team_a_score, team_b_score"
                    )
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
            description: "Devuelve el ranking de máximos goleadores de la app.",
            inputSchema: z.object({
                limit: z.number().default(10).describe("Número de goleadores a devolver"),
            }),
            execute: async (input) => {
                const { limit } = input;
                const { data, error } = await admin
                    .from("profiles")
                    .select("username, goals_scored, matches_played, position")
                    .order("goals_scored", { ascending: false })
                    .limit(limit);
                if (error) return { error: "No se pudo obtener el ranking de goleadores" };
                return { goleadores: data ?? [] };
            },
        }),

        get_leaderboard: tool({
            description:
                "Devuelve el ranking ELO de jugadores con al menos 3 partidos jugados.",
            inputSchema: z.object({
                limit: z.number().default(10).describe("Número de jugadores a devolver"),
            }),
            execute: async (input) => {
                const { limit } = input;
                const { data, error } = await admin
                    .from("profiles")
                    .select("username, elo_rating, matches_played, goals_scored, position")
                    .gte("matches_played", 3)
                    .order("elo_rating", { ascending: false })
                    .limit(limit);
                if (error) return { error: "No se pudo obtener el ranking" };
                return { ranking: data ?? [] };
            },
        }),

        get_player_detail: tool({
            description:
                "Obtiene el perfil completo y posición en el ranking de un jugador por su nombre de usuario.",
            inputSchema: z.object({
                username: z.string().describe("Nombre de usuario del jugador"),
            }),
            execute: async (input) => {
                const { username } = input;
                const { data: player, error } = await admin
                    .from("profiles")
                    .select(
                        "username, position, skill_level, elo_rating, matches_played, goals_scored, market_value"
                    )
                    .ilike("username", username)
                    .single();

                if (error || !player)
                    return { error: `No se encontró al jugador "${username}"` };

                const { count } = await admin
                    .from("profiles")
                    .select("id", { count: "exact", head: true })
                    .gt("elo_rating", player.elo_rating)
                    .gte("matches_played", 3);

                return { jugador: { ...player, rank: (count ?? 0) + 1 } };
            },
        }),

        get_match_detail: tool({
            description:
                "Obtiene los detalles completos de un partido: resultado, participantes, goles y MVP.",
            inputSchema: z.object({
                match_id: z.string().describe("ID del partido"),
            }),
            execute: async (input) => {
                const { match_id } = input;
                const { data, error } = await admin
                    .from("matches")
                    .select(
                        "*, match_participants(user_id, team, goals, is_mvp, has_paid, profiles(username, position))"
                    )
                    .eq("id", match_id)
                    .single();
                if (error || !data) return { error: "No se encontró el partido" };
                return { partido: data };
            },
        }),

        get_my_stats: tool({
            description:
                "Devuelve las estadísticas del usuario autenticado: ELO, goles, partidos jugados y posición en el ranking.",
            inputSchema: z.object({}),
            execute: async () => {
                const { data: profile, error } = await admin
                    .from("profiles")
                    .select(
                        "username, position, elo_rating, matches_played, goals_scored, market_value"
                    )
                    .eq("id", userId)
                    .single();

                if (error || !profile)
                    return { error: "No se pudieron obtener tus estadísticas" };

                const { count } = await admin
                    .from("profiles")
                    .select("id", { count: "exact", head: true })
                    .gt("elo_rating", profile.elo_rating)
                    .gte("matches_played", 3);

                return { mis_stats: { ...profile, rank: (count ?? 0) + 1 } };
            },
        }),

        get_fantasy_standings: tool({
            description:
                "Devuelve la clasificación de equipos fantasy ordenada por puntos totales.",
            inputSchema: z.object({
                limit: z.number().default(10).describe("Número de equipos a devolver"),
            }),
            execute: async (input) => {
                const { limit } = input;
                const { data, error } = await admin
                    .from("fantasy_teams")
                    .select("name, total_points, budget, profiles(username)")
                    .order("total_points", { ascending: false })
                    .limit(limit);
                if (error)
                    return { error: "No se pudo obtener la clasificación fantasy" };
                return { clasificacion: data ?? [] };
            },
        }),

        get_my_fantasy_team: tool({
            description:
                "Devuelve el equipo fantasy del usuario autenticado con su plantilla completa (titulares, suplentes, capitán).",
            inputSchema: z.object({}),
            execute: async () => {
                const { data: team, error: teamError } = await admin
                    .from("fantasy_teams")
                    .select("id, name, total_points, budget")
                    .eq("user_id", userId)
                    .single();

                if (teamError || !team)
                    return {
                        error: "No tienes un equipo fantasy o no se pudo obtener",
                    };

                const { data: roster, error: rosterError } = await admin
                    .from("fantasy_rosters")
                    .select(
                        "is_captain, is_starter, profiles(username, position, elo_rating)"
                    )
                    .eq("team_id", team.id);

                if (rosterError) return { error: "No se pudo obtener la plantilla" };

                return { equipo: { ...team, plantilla: roster ?? [] } };
            },
        }),

        get_players_history_together: tool({
            description:
                "Devuelve los partidos en los que dos jugadores coincidieron, con el equipo y goles de cada uno.",
            inputSchema: z.object({
                player_a: z.string().describe("Nombre de usuario del primer jugador"),
                player_b: z.string().describe("Nombre de usuario del segundo jugador"),
            }),
            execute: async (input) => {
                const { player_a, player_b } = input;
                const { data: profiles, error: profilesError } = await admin
                    .from("profiles")
                    .select("id, username")
                    .or(
                        `username.ilike.${player_a},username.ilike.${player_b}`
                    );

                if (profilesError || !profiles || profiles.length < 2)
                    return {
                        error: `No se encontraron ambos jugadores: "${player_a}" y "${player_b}"`,
                    };

                const profileA = profiles.find(
                    (p) => p.username?.toLowerCase() === player_a.toLowerCase()
                );
                const profileB = profiles.find(
                    (p) => p.username?.toLowerCase() === player_b.toLowerCase()
                );

                if (!profileA || !profileB)
                    return {
                        error: `No se encontraron ambos jugadores: "${player_a}" y "${player_b}"`,
                    };

                const { data: matchesA } = await admin
                    .from("match_participants")
                    .select("match_id, team, goals, is_mvp")
                    .eq("user_id", profileA.id);

                if (!matchesA || matchesA.length === 0)
                    return { partidos_juntos: [] };

                const matchIds = matchesA.map((m) => m.match_id);

                const { data: matchesB } = await admin
                    .from("match_participants")
                    .select("match_id, team, goals, is_mvp")
                    .eq("user_id", profileB.id)
                    .in("match_id", matchIds);

                if (!matchesB || matchesB.length === 0)
                    return { partidos_juntos: [] };

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
                        [player_a]: {
                            equipo: partA?.team,
                            goles: partA?.goals,
                            mvp: partA?.is_mvp,
                        },
                        [player_b]: {
                            equipo: partB?.team,
                            goles: partB?.goals,
                            mvp: partB?.is_mvp,
                        },
                    };
                });

                return { partidos_juntos: result };
            },
        }),
    };
}
