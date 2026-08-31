import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import {
    createDummyUsers,
    createTestMatch,
    deleteDummyUsers,
    deleteMatch,
    getTestUserId,
    seedParticipants,
} from "./helpers/db";

function getLocalAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

test("un partido nuevo pertenece a la temporada activa", async ({ page }) => {
    const admin = getLocalAdminClient();

    await page.goto("/matches/new");
    const date = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().slice(0, 16);
    await page.locator('input[type="datetime-local"]').fill(date);
    await page.locator('input[name="location"]').fill("Campo temporada E2E");
    await page.getByRole("button", { name: /crear/i }).click();
    await page.waitForURL(/\/matches\/[a-f0-9-]+/);

    const matchId = page.url().split("/matches/")[1];

    const { data: match } = await admin
        .from("matches")
        .select("id, season_id")
        .eq("id", matchId)
        .single();
    const { data: season } = await admin
        .from("seasons")
        .select("id, status")
        .eq("status", "active")
        .single();

    expect(match?.season_id).toBe(season?.id);

    await deleteMatch(matchId);
});

test.describe("writes season stats on match finalization", () => {
    let matchId: string;
    let seasonId: string;
    let organizerId: string;
    let dummyUserIds: string[];
    let organizerSeasonSnapshot: {
        elo_rating: number;
        matches_played: number;
        goals_scored: number;
        wins: number;
        draws: number;
        losses: number;
        mvps: number;
    } | null;
    let organizerProfileSnapshot: {
        elo_rating: number;
        matches_played: number;
        goals_scored: number;
        market_value: number | null;
    } | null;

    test.beforeAll(async () => {
        const admin = getLocalAdminClient();
        organizerId = await getTestUserId();
        dummyUserIds = await createDummyUsers(3);

        const { data: season } = await admin
            .from("seasons")
            .select("id")
            .eq("status", "active")
            .single();

        seasonId = season!.id;
        const { data: seasonStat } = await admin
            .from("season_player_stats")
            .select("elo_rating, matches_played, goals_scored, wins, draws, losses, mvps")
            .eq("season_id", seasonId)
            .eq("user_id", organizerId)
            .single();
        const { data: profile } = await admin
            .from("profiles")
            .select("elo_rating, matches_played, goals_scored, market_value")
            .eq("id", organizerId)
            .single();
        organizerSeasonSnapshot = seasonStat;
        organizerProfileSnapshot = profile;
        matchId = await createTestMatch({
            createdBy: organizerId,
            location: "Campo temporada finalizacion E2E",
            maxPlayers: 10,
        });

        const participantIds = [organizerId, ...dummyUserIds];
        await seedParticipants(
            matchId,
            participantIds.map((userId, index) => ({
                userId,
                team: index % 2 === 0 ? "A" : "B",
            }))
        );
    });

    test.afterAll(async () => {
        const admin = getLocalAdminClient();
        await deleteMatch(matchId);
        if (organizerSeasonSnapshot) {
            const { error } = await admin
                .from("season_player_stats")
                .update(organizerSeasonSnapshot)
                .eq("season_id", seasonId)
                .eq("user_id", organizerId);
            if (error) throw new Error(`restore season stats: ${error.message}`);
        }
        if (organizerProfileSnapshot) {
            const { error } = await admin
                .from("profiles")
                .update(organizerProfileSnapshot)
                .eq("id", organizerId);
            if (error) throw new Error(`restore profile stats: ${error.message}`);
        }
        await deleteDummyUsers(dummyUserIds);
    });

    test("guarda historial RP y contadores en season_player_stats", async ({ page }) => {
        const admin = getLocalAdminClient();

        await page.goto(`/matches/${matchId}`);
        await page.getByRole("button", { name: "Poner Resultado" }).click();

        const scoreInputs = page.locator('input[type="number"]');
        await scoreInputs.nth(0).fill("2");
        await scoreInputs.nth(1).fill("1");

        await page.getByRole("button", { name: "Guardar Resultado y Finalizar" }).click();

        await expect
            .poll(
                async () => {
                    const { data } = await admin
                        .from("matches")
                        .select("status")
                        .eq("id", matchId)
                        .single();
                    return data?.status;
                },
                { timeout: 10_000 }
            )
            .toBe("finished");

        const participantIds = [organizerId, ...dummyUserIds];
        const { data: stats } = await admin
            .from("season_player_stats")
            .select("season_id, user_id, elo_rating, matches_played, wins, draws, losses")
            .eq("season_id", seasonId)
            .in("user_id", participantIds);
        const { data: history } = await admin
            .from("rp_history")
            .select("season_id, user_id, match_id")
            .eq("match_id", matchId);

        expect(stats?.length).toBe(participantIds.length);
        for (const userId of participantIds) {
            const stat = stats?.find((entry) => entry.user_id === userId);
            expect(stat?.season_id).toBe(seasonId);
            expect(stat?.matches_played).toBe(1);
            expect((stat?.wins ?? 0) + (stat?.draws ?? 0) + (stat?.losses ?? 0)).toBe(1);
        }

        expect(history?.length).toBe(participantIds.length);
        for (const row of history ?? []) {
            expect(row.season_id).toBe(seasonId);
            expect(participantIds).toContain(row.user_id);
            expect(row.match_id).toBe(matchId);
        }
    });
});
