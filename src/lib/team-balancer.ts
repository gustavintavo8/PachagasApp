/**
 * Team Balancing Algorithm — ELO-Based Position Distribution
 *
 * Strategy:
 * 1. Group players by position (GK, DEF, MID, FWD).
 * 2. For each position group, sort by elo_rating descending.
 * 3. Distribute in "snake draft" / zigzag order: best→A, 2nd→B, 3rd→A...
 *    This ensures the two best players in each position end up on different teams.
 * 4. If teams are still uneven in total size, move a player from the bigger team.
 *
 * Result: both teams have roughly equal ELO sum, guaranteeing fairer matches.
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
}

export function balanceTeams(participants: TeamPlayer[]): BalanceResult {
    // Group by position
    const groups: Record<Position, TeamPlayer[]> = {
        GK: [],
        DEF: [],
        MID: [],
        FWD: [],
    };

    for (const p of participants) {
        groups[p.position].push(p);
    }

    const teamA: TeamPlayer[] = [];
    const teamB: TeamPlayer[] = [];

    const positionOrder: Position[] = ["GK", "DEF", "MID", "FWD"];

    for (const pos of positionOrder) {
        // Sort by ELO descending so the best players are distributed first
        const sorted = [...groups[pos]].sort((a, b) => b.elo_rating - a.elo_rating);

        for (let i = 0; i < sorted.length; i++) {
            const aCount = teamA.filter((p) => p.position === pos).length;
            const bCount = teamB.filter((p) => p.position === pos).length;
            
            if (aCount < bCount) {
                teamA.push(sorted[i]);
            } else if (bCount < aCount) {
                teamB.push(sorted[i]);
            } else {
                // If positional count is tied, assign to the team with the LOWER total ELO
                const aElo = teamA.reduce((sum, p) => sum + p.elo_rating, 0);
                const bElo = teamB.reduce((sum, p) => sum + p.elo_rating, 0);
                
                if (aElo <= bElo) {
                    teamA.push(sorted[i]);
                } else {
                    teamB.push(sorted[i]);
                }
            }
        }
    }

    // Equalise overall sizes if needed
    while (Math.abs(teamA.length - teamB.length) > 1) {
        if (teamA.length > teamB.length) {
            teamB.push(teamA.pop()!);
        } else {
            teamA.push(teamB.pop()!);
        }
    }

    const assignments: { user_id: string; team: "A" | "B" }[] = [
        ...teamA.map((p) => ({ user_id: p.user_id, team: "A" as const })),
        ...teamB.map((p) => ({ user_id: p.user_id, team: "B" as const })),
    ];

    return { teamA, teamB, assignments };
}
