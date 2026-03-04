/**
 * Team Balancing Algorithm — Position-Based Random Assignment
 *
 * Strategy:
 * 1. Group players by position (GK, DEF, MID, FWD).
 * 2. For each position group, shuffle randomly.
 * 3. Distribute evenly: alternate between Team A and Team B.
 *    This ensures, e.g., 2 GKs → 1 per team.
 * 4. No skill weighting — purely random within each position group.
 */

export type Position = "GK" | "DEF" | "MID" | "FWD";

export interface TeamPlayer {
    user_id: string;
    position: Position;
}

export interface BalanceResult {
    teamA: TeamPlayer[];
    teamB: TeamPlayer[];
    assignments: { user_id: string; team: "A" | "B" }[];
}

/** Fisher-Yates shuffle (in place) */
function shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
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

    // Process each position group: shuffle then alternate A/B
    const positionOrder: Position[] = ["GK", "DEF", "MID", "FWD"];

    for (const pos of positionOrder) {
        const players = shuffle([...groups[pos]]);
        for (let i = 0; i < players.length; i++) {
            if (teamA.filter((p) => p.position === pos).length <=
                teamB.filter((p) => p.position === pos).length) {
                teamA.push(players[i]);
            } else {
                teamB.push(players[i]);
            }
        }
    }

    // If teams are uneven overall, move a player from the larger team
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
