type GoalScorer = {
    userId: string;
    goals: number;
};

type EloUpdate = {
    userId: string;
    newRating: number;
    delta: number;
};

type FinalizeMatchInput = {
    matchId: string;
    teamAScore: number;
    teamBScore: number;
    finishedAt: string;
    goalScorers: GoalScorer[];
    eloUpdates: EloUpdate[];
};

export function createFinalizeMatchRpcPayload(input: FinalizeMatchInput) {
    return {
        p_match_id: input.matchId,
        p_team_a_score: input.teamAScore,
        p_team_b_score: input.teamBScore,
        p_finished_at: input.finishedAt,
        p_goal_scorers: input.goalScorers.map((scorer) => ({
            user_id: scorer.userId,
            goals: scorer.goals,
        })),
        p_elo_updates: input.eloUpdates.map((update) => ({
            user_id: update.userId,
            new_rating: update.newRating,
            rp_change: update.delta,
        })),
    };
}
