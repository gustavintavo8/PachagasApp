import assert from "node:assert/strict";
import test from "node:test";

let matchFinalization = {};
try {
    matchFinalization = await import("../src/lib/match-finalization.ts");
} catch {
    // The first TDD run must express the missing contract as an assertion failure.
}

test("serializa los goleadores con el nombre de campo que espera la RPC", () => {
    const scorerId = "11111111-1111-4111-8111-111111111111";
    const payload = matchFinalization.createFinalizeMatchRpcPayload?.({
        matchId: "22222222-2222-4222-8222-222222222222",
        teamAScore: 2,
        teamBScore: 1,
        finishedAt: "2026-09-03T20:00:00.000Z",
        goalScorers: [{ userId: scorerId, goals: 2 }],
        eloUpdates: [],
    });

    assert.deepEqual(payload?.p_goal_scorers, [
        { user_id: scorerId, goals: 2 },
    ]);
});
