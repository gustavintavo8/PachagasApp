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

    // ── Build output ─────────────────────────────────────────────────────────
    const assignments: { user_id: string; team: "A" | "B" }[] = [
        ...teamA.map((p) => ({ user_id: p.user_id, team: "A" as const })),
        ...teamB.map((p) => ({ user_id: p.user_id, team: "B" as const })),
    ];

    const finalAvgA = avgElo(teamA);
    const finalAvgB = avgElo(teamB);

    return {
        teamA,
        teamB,
        assignments,
        avgEloA: Math.round(finalAvgA),
        avgEloB: Math.round(finalAvgB),
        eloDelta: Math.round(Math.abs(finalAvgA - finalAvgB)),
    };
}
