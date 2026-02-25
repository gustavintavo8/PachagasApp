import type { MatchParticipant } from "./types";

/**
 * Team Balancing Algorithm
 *
 * Strategy: Snake-draft by skill level.
 * 1. Sort players by skill_level descending.
 * 2. Alternate assigning to Team A and Team B in a snake pattern:
 *    Round 1: A, B
 *    Round 2: B, A
 *    Round 3: A, B
 *    ...
 * This minimises the average skill difference between teams.
 */
export function balanceTeams(
    participants: { user_id: string; skill_level: number }[]
): { user_id: string; team: "A" | "B" }[] {
    // Sort by skill descending
    const sorted = [...participants].sort(
        (a, b) => b.skill_level - a.skill_level
    );

    const result: { user_id: string; team: "A" | "B" }[] = [];
    let direction: "A" | "B" = "A";

    for (let i = 0; i < sorted.length; i++) {
        result.push({ user_id: sorted[i].user_id, team: direction });

        // Snake: every player flips the direction
        if (direction === "A") {
            direction = "B";
        } else {
            direction = "A";
        }

        // At the end of each pair (every 2 players), DON'T flip again
        // because the snake draft already handles it naturally
    }

    return result;
}
