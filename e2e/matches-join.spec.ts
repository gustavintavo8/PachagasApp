import { test, expect } from "@playwright/test";
import {
    createDummyUsers,
    createTestMatch,
    deleteDummyUsers,
    deleteMatch,
    getTestUserId,
    seedParticipants,
} from "./helpers/db";
import { MatchPage } from "./pages/MatchPage";

let matchId: string;
let ownMatchId: string;
let testUserId: string;
let organizerIds: string[];

test.beforeAll(async () => {
    testUserId = await getTestUserId();
    organizerIds = await createDummyUsers(1);

    // Partido de otro: aquí el usuario de test es un jugador cualquiera
    matchId = await createTestMatch({ createdBy: organizerIds[0], maxPlayers: 4 });
    await seedParticipants(matchId, [{ userId: organizerIds[0] }, { userId: testUserId }]);

    // Partido propio: createMatch apunta al organizador, el helper no
    ownMatchId = await createTestMatch({ createdBy: testUserId, maxPlayers: 4 });
    await seedParticipants(ownMatchId, [{ userId: testUserId }]);
});

test.afterAll(async () => {
    await deleteMatch(matchId);
    await deleteMatch(ownMatchId);
    await deleteDummyUsers(organizerIds);
});

test.describe("Unirse a un partido @smoke", () => {
    // Comparten partido y plazas
    test.describe.configure({ mode: "serial" });

    test("el organizador organiza y no puede borrarse @smoke", async ({ page }) => {
        const matchPage = new MatchPage(page);
        await page.goto(`/matches/${ownMatchId}`);
        await expect(matchPage.organizeButton).toBeVisible({ timeout: 5_000 });
        await expect(matchPage.leaveButton).toHaveCount(0);
        await expect(matchPage.joinButton).toHaveCount(0);
    });

    test("un jugador apuntado ve botón Me borro @smoke", async ({ page }) => {
        const matchPage = new MatchPage(page);
        await page.goto(`/matches/${matchId}`);
        await expect(matchPage.leaveButton).toBeVisible({ timeout: 5_000 });
        await expect(matchPage.joinButton).toHaveCount(0);
    });

    test("unirse a un partido aumenta el contador de participantes", async ({ page }) => {
        const matchPage = new MatchPage(page);
        const leyenda = page.getByRole("list", { name: "Leyenda de plazas" });
        await page.goto(`/matches/${matchId}`);

        // Dentro quedan 2 de 4 plazas; al borrarse y volver cambian
        await expect(leyenda.getByText("2 libres")).toBeVisible();
        await matchPage.leave();
        await expect(leyenda.getByText("3 libres")).toBeVisible();
        await page.reload();
        await expect(leyenda.getByText("3 libres")).toBeVisible();
        await page.waitForLoadState("networkidle");
        await matchPage.join();
        await expect(leyenda.getByText("2 libres")).toBeVisible();
        await page.reload();
        await expect(leyenda.getByText("2 libres")).toBeVisible();
    });

    test("borrarse del partido muestra botón Me apunto @critical", async ({ page }) => {
        const matchPage = new MatchPage(page);
        await page.goto(`/matches/${matchId}`);
        await page.waitForLoadState("networkidle");
        await matchPage.leave();

        // Re-unirse para no romper otros tests
        await matchPage.join();
    });
});
