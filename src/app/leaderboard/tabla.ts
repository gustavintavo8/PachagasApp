import { PROVISIONAL_THRESHOLD } from "@/lib/elo";
import type { Profile } from "@/lib/types";

export const TITULARES = 7;

export type FilaRanking = {
    id: string;
    username: string | null;
    avatar_url: string | null;
    position: Profile["position"];
    elo_rating: number;
    matches_played: number;
    goals_scored: number;
    wins: number;
    draws: number;
    losses: number;
    mvps: number;
};

/** La palabra de la fila: el filtro dice «Medios», así que aquí no puede decir «Mediocampista». */
export const POSICION: Record<NonNullable<Profile["position"]>, string> = {
    GK: "Portero",
    DEF: "Defensa",
    MID: "Medio",
    FWD: "Delantero",
};

export type Orden = "rp" | "goles" | "mvps" | "partidos" | "victorias";

export const ETIQUETAS: Record<Orden, string> = {
    rp: "RP",
    goles: "Pichichi",
    mvps: "MVP",
    partidos: "Partidos",
    victorias: "Victorias",
};

const CRITERIOS: Record<Orden, (a: FilaRanking, b: FilaRanking) => number> = {
    rp: (a, b) => b.elo_rating - a.elo_rating || b.matches_played - a.matches_played,
    goles: (a, b) => b.goals_scored - a.goals_scored || a.matches_played - b.matches_played,
    mvps: (a, b) => b.mvps - a.mvps || b.wins - a.wins,
    partidos: (a, b) => b.matches_played - a.matches_played || b.wins - a.wins,
    victorias: (a, b) => b.wins - a.wins || b.matches_played - a.matches_played,
};

/**
 * Toda la temporada, nunca una página. El id desempata al final para que el orden
 * sea el mismo en el servidor y en el navegador.
 */
export function ordenar(filas: readonly FilaRanking[], orden: Orden): FilaRanking[] {
    return [...filas].sort(
        (a, b) => CRITERIOS[orden](a, b) || b.elo_rating - a.elo_rating || (a.id < b.id ? -1 : 1)
    );
}

export function cuenta(fila: Pick<FilaRanking, "matches_played">): boolean {
    return fila.matches_played >= PROVISIONAL_THRESHOLD;
}

/** La tabla de RP: solo quien cuenta. Con menos de 3 partidos no se tiene puesto. */
export function clasificados(filas: readonly FilaRanking[]): FilaRanking[] {
    return ordenar(filas.filter(cuenta), "rp");
}

/** Han jugado, pero todavía no entran en la tabla de RP. */
export function provisionales(filas: readonly FilaRanking[]): FilaRanking[] {
    return ordenar(
        filas.filter((fila) => fila.matches_played > 0 && !cuenta(fila)),
        "rp"
    );
}
