/**
 * Team Balancing Algorithm — Snake Draft
 *
 * Strategy:
 * 1. Sort players by skill_level descending.
 * 2. Distribute using snake draft: A, B, B, A, A, B, B, A...
 *    - Round 1 (pair 0): picks go to A, B
 *    - Round 2 (pair 1): picks go to B, A   ← reversed
 *    - Round 3 (pair 2): picks go to A, B
 *    - ...
 * 3. This minimises the total skill sum difference between teams.
 */

export interface TeamPlayer {
    user_id: string;
    skill_level: number;
}

export interface BalanceResult {
    teamA: TeamPlayer[];
    teamB: TeamPlayer[];
    assignments: { user_id: string; team: "A" | "B" }[];
    balanceScore: number; // absolute difference in avg skill (lower = better)
}

export function balanceTeams(participants: TeamPlayer[]): BalanceResult {
    // Sort by skill descending
    const sorted = [...participants].sort(
        (a, b) => b.skill_level - a.skill_level
    );

    const teamA: TeamPlayer[] = [];
    const teamB: TeamPlayer[] = [];

    // Snake draft: A, B, B, A, A, B, B, A...
    for (let i = 0; i < sorted.length; i++) {
        const round = Math.floor(i / 2); // which pair we're in
        const posInPair = i % 2;         // 0 = first pick, 1 = second pick

        // Even rounds: first→A, second→B
        // Odd rounds:  first→B, second→A
        const goesToA =
            (round % 2 === 0 && posInPair === 0) ||
            (round % 2 === 1 && posInPair === 1);

        if (goesToA) {
            teamA.push(sorted[i]);
        } else {
            teamB.push(sorted[i]);
        }
    }

    const sumA = teamA.reduce((s, p) => s + p.skill_level, 0);
    const sumB = teamB.reduce((s, p) => s + p.skill_level, 0);
    const avgA = teamA.length > 0 ? sumA / teamA.length : 0;
    const avgB = teamB.length > 0 ? sumB / teamB.length : 0;
    const balanceScore = Math.abs(avgA - avgB);

    const assignments: { user_id: string; team: "A" | "B" }[] = [
        ...teamA.map((p) => ({ user_id: p.user_id, team: "A" as const })),
        ...teamB.map((p) => ({ user_id: p.user_id, team: "B" as const })),
    ];

    return { teamA, teamB, assignments, balanceScore };
}
