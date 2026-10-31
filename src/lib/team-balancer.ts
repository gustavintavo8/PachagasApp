/**
 * Team Balancing Algorithm — ELO-Based Position Distribution
 *
 * Strategy (3 phases):
 * 1. DRAFT: Group by position, sort by ELO desc, zigzag assign.
 *    On positional tie → assign to team with lower AVERAGE ELO (not sum).
 * 2. EQUALISE: If teams are uneven in size, move the single player whose
 *    transfer minimises the resulting average-ELO difference (not random pop).
 * 3. OPTIMISE: Swap-pass — iteratively try every pair of players (one from
 *    each team) and keep the swap if it reduces the average-ELO delta.
 *    Repeat until no swap improves balance (converges in 2-3 iterations).
 *
 * Result: near-optimal ELO balance with positional awareness.
 */

export type Position = "GK" | "DEF" | "MID" | "FWD";

export interface TeamPlayer {
    user_id: string;
    position: Position;
    elo_rating: number;
}

export interface BalanceResult {
    teamA: TeamPlayer[];
    teamB: TeamPlayer[];
    assignments: { user_id: string; team: "A" | "B" }[];
    avgEloA: number;
    avgEloB: number;
    eloDelta: number;
}

function avgElo(team: TeamPlayer[]): number {
    if (team.length === 0) return 0;
    return team.reduce((s, p) => s + p.elo_rating, 0) / team.length;
}

function eloDelta(teamA: TeamPlayer[], teamB: TeamPlayer[]): number {
    return Math.abs(avgElo(teamA) - avgElo(teamB));
}

function resultado(teamA: TeamPlayer[], teamB: TeamPlayer[]): BalanceResult {
    const finalAvgA = avgElo(teamA);
    const finalAvgB = avgElo(teamB);

    return {
        teamA,
        teamB,
        assignments: [
            ...teamA.map((p) => ({ user_id: p.user_id, team: "A" as const })),
            ...teamB.map((p) => ({ user_id: p.user_id, team: "B" as const })),
        ],
        avgEloA: Math.round(finalAvgA),
        avgEloB: Math.round(finalAvgB),
        eloDelta: Math.round(Math.abs(finalAvgA - finalAvgB)),
    };
}

export function balanceTeams(participants: TeamPlayer[]): BalanceResult {
    // ── Phase 1: Draft ───────────────────────────────────────────────────────
    const groups: Record<Position, TeamPlayer[]> = { GK: [], DEF: [], MID: [], FWD: [] };
    for (const p of participants) groups[p.position].push(p);

    const teamA: TeamPlayer[] = [];
    const teamB: TeamPlayer[] = [];
    const positionOrder: Position[] = ["GK", "DEF", "MID", "FWD"];

    for (const pos of positionOrder) {
        const sorted = [...groups[pos]].sort((a, b) => b.elo_rating - a.elo_rating);

        for (const player of sorted) {
            const aCount = teamA.filter((p) => p.position === pos).length;
            const bCount = teamB.filter((p) => p.position === pos).length;

            if (aCount < bCount) {
                teamA.push(player);
            } else if (bCount < aCount) {
                teamB.push(player);
            } else {
                // Tie in positional count → assign to team with lower AVERAGE ELO
                if (avgElo(teamA) <= avgElo(teamB)) {
                    teamA.push(player);
                } else {
                    teamB.push(player);
                }
            }
        }
    }

    // ── Phase 2: Smart size equalisation ────────────────────────────────────
    // If teams differ by more than 1, move the player whose transfer
    // produces the smallest resulting average-ELO delta (not just pop()).
    while (Math.abs(teamA.length - teamB.length) > 1) {
        const donor   = teamA.length > teamB.length ? teamA : teamB;
        const receiver = teamA.length > teamB.length ? teamB : teamA;

        let bestIdx = 0;
        let bestDelta = Infinity;

        for (let i = 0; i < donor.length; i++) {
            const testDonor    = donor.filter((_, j) => j !== i);
            const testReceiver = [...receiver, donor[i]];
            const d = Math.abs(avgElo(testDonor) - avgElo(testReceiver));
            if (d < bestDelta) { bestDelta = d; bestIdx = i; }
        }

        receiver.push(donor.splice(bestIdx, 1)[0]);
    }

    // ── Phase 3: Swap-optimisation pass ─────────────────────────────────────
    // Repeatedly try every A↔B player swap; keep it if it reduces delta.
    // Stop when a full pass produces zero improvements (local optimum).
    let improved = true;
    while (improved) {
        improved = false;
        const currentDelta = eloDelta(teamA, teamB);

        outer:
        for (let i = 0; i < teamA.length; i++) {
            for (let j = 0; j < teamB.length; j++) {
                // Simulate swap
                const newA = teamA.map((p, idx) => idx === i ? teamB[j] : p);
                const newB = teamB.map((p, idx) => idx === j ? teamA[i] : p);
                const newDelta = eloDelta(newA, newB);

                if (newDelta < currentDelta - 0.5) { // 0.5 threshold avoids infinite micro-swaps
                    // Commit swap
                    const tmp = teamA[i];
                    teamA[i] = teamB[j];
                    teamB[j] = tmp;
                    improved = true;
                    break outer; // Restart pass after a change
                }
            }
        }
    }

    return resultado(teamA, teamB);
}

// ── Barajar ──────────────────────────────────────────────────────────────────

/** Los mismos dos equipos con los colores cambiados siguen siendo el mismo reparto. */
function huellaReparto(teamA: { user_id: string }[], teamB: { user_id: string }[]): string {
    const ids = (equipo: { user_id: string }[]) => equipo.map((p) => p.user_id).sort();
    return [ids(teamA).join(), ids(teamB).join()].sort().join("|");
}

function barajar<T>(lista: T[], azar: () => number): T[] {
    const copia = [...lista];
    for (let i = copia.length - 1; i > 0; i--) {
        const j = Math.floor(azar() * (i + 1));
        [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia;
}

/** Cada posición a medias entre los dos, en orden al azar. El sobrante va al equipo más corto. */
function repartoAlAzar(participants: TeamPlayer[], azar: () => number) {
    const teamA: TeamPlayer[] = [];
    const teamB: TeamPlayer[] = [];

    for (const pos of ["GK", "DEF", "MID", "FWD"] as const) {
        let aCount = 0;
        let bCount = 0;
        for (const player of barajar(participants.filter((p) => p.position === pos), azar)) {
            const alAzar = azar() < 0.5 ? teamA : teamB;
            const corto = teamA.length === teamB.length ? alAzar : teamA.length < teamB.length ? teamA : teamB;
            const destino = aCount === bCount ? corto : aCount < bCount ? teamA : teamB;
            destino.push(player);
            if (destino === teamA) aCount++;
            else bCount++;
        }
    }
    return { teamA, teamB };
}

/** Cambia jugadores de la misma posición mientras eso acerque las medias. */
function afinar(teamA: TeamPlayer[], teamB: TeamPlayer[]) {
    let mejora = true;
    while (mejora) {
        mejora = false;
        for (let i = 0; i < teamA.length && !mejora; i++) {
            for (let j = 0; j < teamB.length && !mejora; j++) {
                if (teamA[i].position !== teamB[j].position) continue;
                const previo = eloDelta(teamA, teamB);
                [teamA[i], teamB[j]] = [teamB[j], teamA[i]];
                if (eloDelta(teamA, teamB) < previo - 0.5) mejora = true;
                else [teamA[i], teamB[j]] = [teamB[j], teamA[i]];
            }
        }
    }
}

const INTENTOS_BARAJAR = 300;
/** Diferencia de media que se acepta de más frente al reparto más igualado. */
const HOLGURA_RP = 25;

/**
 * Otro reparto, distinto del actual e igual de repartido por posiciones.
 * Se queda con el primero que no se aleje del más igualado; si no hay ninguno, con el
 * mejor de los distintos. Null si no existe otro reparto posible: con dos jugadores, por ejemplo.
 */
export function barajarEquipos(
    participants: TeamPlayer[],
    actual: { user_id: string; team: "A" | "B" | null }[],
    azar: () => number = Math.random
): BalanceResult | null {
    const delEquipo = (team: "A" | "B") => actual.filter((p) => p.team === team);
    const huellaActual = huellaReparto(delEquipo("A"), delEquipo("B"));
    const tope = balanceTeams(participants).eloDelta + HOLGURA_RP;

    let mejor: BalanceResult | null = null;
    // Con pocos jugadores afinar puede llevar siempre al reparto actual: esto es lo que había antes de afinar
    let reserva: BalanceResult | null = null;
    for (let intento = 0; intento < INTENTOS_BARAJAR; intento++) {
        const { teamA, teamB } = repartoAlAzar(participants, azar);
        if (!reserva && huellaReparto(teamA, teamB) !== huellaActual) reserva = resultado([...teamA], [...teamB]);

        afinar(teamA, teamB);
        if (huellaReparto(teamA, teamB) === huellaActual) continue;

        const reparto = resultado(teamA, teamB);
        if (reparto.eloDelta <= tope) return reparto;
        if (!mejor || reparto.eloDelta < mejor.eloDelta) mejor = reparto;
    }
    return mejor ?? reserva;
}
