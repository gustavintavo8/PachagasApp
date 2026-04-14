/**
 * Rating Pachanga (RP) — Sistema ELO adaptado a fútbol informal
 *
 * Fórmula base ELO + bonus por rendimiento individual:
 *  - K=30 (K=60 para los primeros 5 partidos — incertidumbre alta)
 *  - Bonus: +3 por gol, +10 por MVP, ±5 por goleada (≥4 goles de diferencia)
 *  - GK bonus: +8 portería imbatida, +4 si encajan solo 1 gol, -3 si encajan ≥5
 *  - Límite: ±50 RP por partido
 *  - Mínimo global: 100 RP (nadie cae por debajo)
 *  - Jugadores con <3 partidos son considerados "provisionales"
 */

export const ELO_BASE = 1000;
export const PROVISIONAL_THRESHOLD = 3; // Menos de 3 partidos = provisional

const K_FACTOR = 30;
const K_FACTOR_NEW = 60; // Para jugadores con < 5 partidos
const NEW_PLAYER_THRESHOLD = 5;
const BLOWOUT_THRESHOLD = 4; // Diferencia de goles para considerar goleada
const MAX_CHANGE_PER_MATCH = 50;
const MIN_RATING = 100;

// GK bonuses
const GK_CLEAN_SHEET_BONUS = 8;   // 0 goles en contra
const GK_SOLID_DEFENSE_BONUS = 4; // 1 gol en contra
const GK_HEAVY_CONCEDE_PENALTY = -3; // ≥5 goles en contra

/** Resultado esperado para el jugador propio dado el RP medio de ambos equipos */
export function calcExpected(ownAvgRating: number, oppAvgRating: number): number {
    return 1 / (1 + Math.pow(10, (oppAvgRating - ownAvgRating) / 400));
}

/** Resultado real del partido desde el punto de vista del jugador */
export function matchResult(myScore: number, oppScore: number): number {
    if (myScore > oppScore) return 1;
    if (myScore === oppScore) return 0.5;
    return 0;
}

export interface EloInput {
    userId: string;
    currentRating: number;
    matchesPlayed: number; // partidos ANTES de este
    team: "A" | "B";
    position: "GK" | "DEF" | "MID" | "FWD";
    goalsScored: number;
    isMvp: boolean;
}

export interface EloOutput {
    userId: string;
    oldRating: number;
    newRating: number;
    delta: number;
}

/**
 * Calcula los nuevos ratings para todos los participantes de un partido.
 * Se llama DESPUÉS de guardar el resultado.
 */
export function computeMatchEloUpdates(
    participants: EloInput[],
    teamAScore: number,
    teamBScore: number
): EloOutput[] {
    const teamA = participants.filter((p) => p.team === "A");
    const teamB = participants.filter((p) => p.team === "B");

    const avgRatingA =
        teamA.length > 0
            ? teamA.reduce((s, p) => s + p.currentRating, 0) / teamA.length
            : ELO_BASE;

    const avgRatingB =
        teamB.length > 0
            ? teamB.reduce((s, p) => s + p.currentRating, 0) / teamB.length
            : ELO_BASE;

    const goalDiff = Math.abs(teamAScore - teamBScore);
    const isBlowout = goalDiff >= BLOWOUT_THRESHOLD;

    const results: EloOutput[] = [];

    for (const p of participants) {
        const isTeamA = p.team === "A";
        const myTeamScore = isTeamA ? teamAScore : teamBScore;
        const oppTeamScore = isTeamA ? teamBScore : teamAScore;

        // RP medio del rival
        const ownAvg = isTeamA ? avgRatingA : avgRatingB;
        const oppAvg = isTeamA ? avgRatingB : avgRatingA;

        // Factor K ajustado por veteranía
        const K = p.matchesPlayed < NEW_PLAYER_THRESHOLD ? K_FACTOR_NEW : K_FACTOR;

        // Base ELO
        const expected = calcExpected(ownAvg, oppAvg);
        const actual = matchResult(myTeamScore, oppTeamScore);
        let delta = Math.round(K * (actual - expected));

        // Bonus individual: goles (aplica a todos)
        delta += p.goalsScored * 3;

        // Bonus MVP
        if (p.isMvp) delta += 10;

        // ── Bonus específico para porteros ──
        if (p.position === "GK") {
            if (oppTeamScore === 0) {
                delta += GK_CLEAN_SHEET_BONUS; // Portería imbatida
            } else if (oppTeamScore === 1) {
                delta += GK_SOLID_DEFENSE_BONUS; // Solo 1 gol encajado
            }
            if (oppTeamScore >= 5) {
                delta += GK_HEAVY_CONCEDE_PENALTY; // Goleada en contra
            }
        }

        // Bonus/Penalización por goleada (aplica a todos)
        if (isBlowout) {
            if (myTeamScore > oppTeamScore) delta += 5;
            else if (myTeamScore < oppTeamScore) delta -= 5;
        }

        // Limitar cambio por partido
        delta = Math.max(-MAX_CHANGE_PER_MATCH, Math.min(MAX_CHANGE_PER_MATCH, delta));

        const newRating = Math.max(MIN_RATING, p.currentRating + delta);

        results.push({
            userId: p.userId,
            oldRating: p.currentRating,
            newRating,
            delta: newRating - p.currentRating, // delta real después del clamp
        });
    }

    return results;
}
