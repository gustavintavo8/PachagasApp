import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminUserIds } from "@/lib/permissions";
import type { FilaRanking } from "./tabla";

/**
 * Toda la temporada de una vez: el grupo cabe en una lectura, y así las pestañas,
 * los puestos y la búsqueda de jugadores trabajan sobre todos y no sobre 20.
 * "minutes" porque solo terminar un partido invalida estas etiquetas: un cambio de
 * apodo o de foto, o un MVP resuelto, llegan aquí por caducidad.
 */
export async function getTemporada(seasonId: string) {
    "use cache";
    cacheLife("minutes");
    cacheTag("leaderboard", `leaderboard:${seasonId}`, "players", `players:${seasonId}`);

    const admin = createAdminClient();
    const [{ data: stats, error }, { data: ultimos }, adminUserIds] = await Promise.all([
        admin
            .from("season_player_stats")
            .select(`
                user_id, elo_rating, matches_played, goals_scored,
                wins, draws, losses, mvps,
                profiles!inner(id, username, avatar_url, position)
            `)
            .eq("season_id", seasonId),
        admin
            .from("matches")
            .select("id, team_a_score, team_b_score")
            .eq("season_id", seasonId)
            .eq("status", "finished")
            .order("date", { ascending: false })
            .limit(12),
        getAdminUserIds(),
    ]);

    // Sin esto, un fallo se pintaría como una temporada vacía
    if (error) throw new Error(`No se pudo leer la temporada: ${error.message}`);

    const filas: FilaRanking[] = (stats ?? []).map((stat) => {
        const perfil = (Array.isArray(stat.profiles) ? stat.profiles[0] : stat.profiles) as {
            username: string | null;
            avatar_url: string | null;
            position: FilaRanking["position"];
        } | null;

        return {
            id: stat.user_id,
            username: perfil?.username ?? null,
            avatar_url: perfil?.avatar_url ?? null,
            position: perfil?.position ?? null,
            elo_rating: stat.elo_rating ?? 1000,
            matches_played: stat.matches_played ?? 0,
            goals_scored: stat.goals_scored ?? 0,
            wins: stat.wins ?? 0,
            draws: stat.draws ?? 0,
            losses: stat.losses ?? 0,
            mvps: stat.mvps ?? 0,
        };
    });

    return {
        filas,
        adminUserIds,
        ultimoPartidoId: ultimos?.[0]?.id ?? null,
        resultados: (ultimos ?? []).map((m) => ({ rojo: m.team_a_score, azul: m.team_b_score })),
    };
}
