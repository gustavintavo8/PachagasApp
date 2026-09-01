import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { computeMatchEloUpdates } from "../src/lib/elo";
import { balanceTeams } from "../src/lib/team-balancer";
import { assertLocalSupabaseUrl } from "./helpers/local-supabase-url.mjs";
import {
    createDummyUsers,
    createTestMatch,
    deleteDummyUsers,
    deleteMatch,
    getSeasonStatsTestUserId,
    getSeasonTestUserId,
    seedParticipants,
} from "./helpers/db";

test.use({ storageState: "e2e/.auth/seasons.json" });

function getLocalAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    assertLocalSupabaseUrl(url);
    return createClient(
        url,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

test("el historial acepta selector de temporada", async ({ page }) => {
    await page.goto("/history");
    await expect(page.getByRole("combobox", { name: /temporada/i })).toHaveValue("season-2");

    await page.getByRole("combobox", { name: /temporada/i }).selectOption("season-1");

    await expect(page).toHaveURL(/season=season-1/);
    await expect(page.getByText(/Temporada 1/i)).toBeVisible();
});

test("Temporada 2 no hereda estadísticas de Temporada 1", async ({ page }) => {
    await page.goto("/history?season=season-2");
    await expect(page.getByText(/Temporada 2/i)).toBeVisible();
    await expect(page.getByText("Aún no has jugado partidos")).toBeVisible();
});

test("el usuario normal conserva el acceso después de refrescar", async ({ page }) => {
    await page.goto("/");
    await page.reload();
    await expect(page).toHaveURL("http://localhost:3000/");
});

test("un partido nuevo pertenece a la temporada activa", async ({ page }) => {
    const admin = getLocalAdminClient();
    const seasonUserId = await getSeasonTestUserId();
    let matchId: string | undefined;

    try {
        await page.goto("/matches/new");
        const date = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().slice(0, 16);
        await page.locator('input[type="datetime-local"]').fill(date);
        await page.locator('input[name="location"]').fill("Campo temporada E2E");
        await page.getByRole("button", { name: /crear/i }).click();
        await page.waitForURL(/\/matches\/[a-f0-9-]+/);

        matchId = page.url().split("/matches/")[1];

        const { data: match } = await admin
            .from("matches")
            .select("id, season_id, created_by")
            .eq("id", matchId)
            .single();
        const { data: season } = await admin
            .from("seasons")
            .select("id, status")
            .eq("status", "active")
            .single();

        expect(match?.season_id).toBe(season?.id);
        expect(match?.created_by).toBe(seasonUserId);
    } finally {
        if (matchId) await deleteMatch(matchId);
    }
});

test.describe("writes season stats on match finalization", () => {
    test.use({ storageState: "e2e/.auth/seasons-stats.json" });

    let matchId: string;
    let seasonId: string;
    let organizerId: string;
    let dummyUserIds: string[];
    let seasonSnapshots: Map<string, Record<string, unknown> | null>;
    let profileSnapshots: Map<string, Record<string, unknown> | null>;

    test.beforeAll(async () => {
        const admin = getLocalAdminClient();
        organizerId = await getSeasonStatsTestUserId();
        dummyUserIds = await createDummyUsers(3);

        const { data: season } = await admin
            .from("seasons")
            .select("id")
            .eq("status", "active")
            .single();

        seasonId = season!.id;
        const participantIds = [organizerId, ...dummyUserIds];
        seasonSnapshots = new Map();
        profileSnapshots = new Map();

        for (const userId of participantIds) {
            const { data: seasonStat } = await admin
                .from("season_player_stats")
                .select("season_id, user_id, elo_rating, matches_played, goals_scored, wins, draws, losses, mvps")
                .eq("season_id", seasonId)
                .eq("user_id", userId)
                .maybeSingle();
            const { data: profile } = await admin
                .from("profiles")
                .select("id, elo_rating, matches_played, goals_scored, market_value")
                .eq("id", userId)
                .single();
            seasonSnapshots.set(userId, seasonStat);
            profileSnapshots.set(userId, profile);
        }

        const seasonalRatings = [1600, 1000, 1200, 1400];
        await admin.from("season_player_stats").upsert(
            participantIds.map((userId, index) => ({
                season_id: seasonId,
                user_id: userId,
                elo_rating: seasonalRatings[index],
                matches_played: 0,
                goals_scored: 0,
                wins: 0,
                draws: 0,
                losses: 0,
                mvps: 0,
            })),
            { onConflict: "season_id,user_id" }
        );
        await admin.from("profiles").upsert(
            participantIds.map((userId) => ({
                id: userId,
                elo_rating: 800,
                matches_played: 0,
                goals_scored: 0,
                market_value: 1_000_000,
            })),
            { onConflict: "id" }
        );

        matchId = await createTestMatch({
            createdBy: organizerId,
            location: "Campo temporada finalizacion E2E",
            maxPlayers: 10,
        });

        await seedParticipants(
            matchId,
            participantIds.map((userId) => ({ userId }))
        );
    });

    test.afterAll(async () => {
        const admin = getLocalAdminClient();
        if (matchId) await deleteMatch(matchId);
        for (const [userId, snapshot] of seasonSnapshots ?? new Map()) {
            if (snapshot) {
                const { error } = await admin
                    .from("season_player_stats")
                    .update(snapshot)
                    .eq("season_id", seasonId)
                    .eq("user_id", userId);
                if (error) throw new Error(`restore season stats: ${error.message}`);
            } else {
                const { error } = await admin
                    .from("season_player_stats")
                    .delete()
                    .eq("season_id", seasonId)
                    .eq("user_id", userId);
                if (error) throw new Error(`delete season stats: ${error.message}`);
            }
        }
        for (const [userId, snapshot] of profileSnapshots ?? new Map()) {
            if (!snapshot) continue;
            const { error } = await admin
                .from("profiles")
                .update(snapshot)
                .eq("id", userId);
            if (error) throw new Error(`restore profile stats: ${error.message}`);
        }
        await deleteDummyUsers(dummyUserIds ?? []);
    });

    test("guarda historial RP y contadores en season_player_stats", async ({ page }) => {
        const admin = getLocalAdminClient();
        const participantIds = [organizerId, ...dummyUserIds];

        await page.goto(`/matches/${matchId}`);
        await page.getByRole("button", { name: "Generar Equipos" }).click();

        await expect
            .poll(
                async () => {
                    const { data } = await admin
                        .from("match_participants")
                        .select("user_id, team")
                        .eq("match_id", matchId);
                    return data?.filter((participant) => participant.team === "A" || participant.team === "B").length ?? 0;
                },
                { timeout: 10_000 }
            )
            .toBe(participantIds.length);

        const { data: assignments } = await admin
            .from("match_participants")
            .select("user_id, team")
            .eq("match_id", matchId);
        const { data: profiles } = await admin
            .from("profiles")
            .select("id, position")
            .in("id", participantIds);
        const expectedAssignments = balanceTeams(
            participantIds.map((userId, index) => ({
                user_id: userId,
                position: (profiles?.find((profile) => profile.id === userId)?.position ?? "MID") as "GK" | "DEF" | "MID" | "FWD",
                elo_rating: [1600, 1000, 1200, 1400][index],
            }))
        ).assignments;
        expect(assignments?.map(({ user_id, team }) => ({ user_id, team })).sort((a, b) => a.user_id.localeCompare(b.user_id)))
            .toEqual(expectedAssignments.sort((a, b) => a.user_id.localeCompare(b.user_id)));

        const secondPage = await page.context().newPage();
        const finalize = async (targetPage: typeof page) => {
            await targetPage.goto(`/matches/${matchId}`);
            await targetPage.getByRole("button", { name: "Poner Resultado" }).click();
            const targetScoreInputs = targetPage.locator('input[type="number"]');
            await targetScoreInputs.nth(0).fill("2");
            await targetScoreInputs.nth(1).fill("1");
            await targetPage.getByRole("button", { name: "Guardar Resultado y Finalizar" }).click();
        };

        await Promise.all([finalize(page), finalize(secondPage)]);
        await secondPage.close();

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

        const { data: stats } = await admin
            .from("season_player_stats")
            .select("season_id, user_id, elo_rating, matches_played, goals_scored, wins, draws, losses")
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
            expect(stat?.goals_scored).toBe(0);
            expect((stat?.wins ?? 0) + (stat?.draws ?? 0) + (stat?.losses ?? 0)).toBe(1);
        }

        const assignmentMap = new Map(assignments?.map((assignment) => [assignment.user_id, assignment.team]));
        const expectedElo = computeMatchEloUpdates(
            participantIds.map((userId, index) => ({
                userId,
                currentRating: [1600, 1000, 1200, 1400][index],
                matchesPlayed: 0,
                team: assignmentMap.get(userId) as "A" | "B",
                position: (profiles?.find((profile) => profile.id === userId)?.position ?? "MID") as "GK" | "DEF" | "MID" | "FWD",
                goalsScored: 0,
                isMvp: false,
            })),
            2,
            1
        );
        for (const update of expectedElo) {
            expect(stats?.find((stat) => stat.user_id === update.userId)?.elo_rating).toBe(update.newRating);
        }

        const { data: goalBefore } = await admin
            .from("match_participants")
            .select("goals")
            .eq("match_id", matchId)
            .eq("user_id", organizerId)
            .single();
        const retry = await admin.rpc("finalize_match_with_elo", {
            p_match_id: matchId,
            p_team_a_score: 9,
            p_team_b_score: 0,
            p_finished_at: new Date().toISOString(),
            p_goal_scorers: [{ user_id: organizerId, goals: 99 }],
            p_elo_updates: [],
        });
        expect(retry.error).toBeNull();
        expect(retry.data).toBe(false);
        const { data: goalAfter } = await admin
            .from("match_participants")
            .select("goals")
            .eq("match_id", matchId)
            .eq("user_id", organizerId)
            .single();
        expect(goalAfter?.goals).toBe(goalBefore?.goals);

        const firstMvpResolution = await admin.rpc("resolve_mvp_with_stats", {
            p_match_id: matchId,
            p_winner_id: organizerId,
        });
        expect(firstMvpResolution.error).toBeNull();
        expect(firstMvpResolution.data).toBe(true);

        const secondMvpResolution = await admin.rpc("resolve_mvp_with_stats", {
            p_match_id: matchId,
            p_winner_id: organizerId,
        });
        expect(secondMvpResolution.error).toBeNull();
        expect(secondMvpResolution.data).toBe(false);

        const { data: mvpStat } = await admin
            .from("season_player_stats")
            .select("mvps")
            .eq("season_id", seasonId)
            .eq("user_id", organizerId)
            .single();
        expect(mvpStat?.mvps).toBe(1);

        expect(history?.length).toBe(participantIds.length);
        for (const row of history ?? []) {
            expect(row.season_id).toBe(seasonId);
            expect(participantIds).toContain(row.user_id);
            expect(row.match_id).toBe(matchId);
        }
    });
});
