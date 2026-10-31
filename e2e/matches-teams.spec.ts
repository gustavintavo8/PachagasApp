import { test, expect } from "@playwright/test";
import {
    createTestMatch,
    deleteMatch,
    getTestUserId,
    seedParticipants,
    createDummyUsers,
    deleteDummyUsers,
} from "./helpers/db";
import { MatchPage } from "./pages/MatchPage";

let matchId: string;
let testUserId: string;
let dummyUserIds: string[];

test.beforeAll(async () => {
    testUserId = await getTestUserId();
    dummyUserIds = await createDummyUsers(3); // 3 extra + el organizador = 4 total

    matchId = await createTestMatch({ createdBy: testUserId, maxPlayers: 10 });

    // Seed: createMatch apunta al organizador, el helper no; añadir los 4
    await seedParticipants(matchId, [testUserId, ...dummyUserIds].map((uid) => ({ userId: uid })));
});

test.afterAll(async () => {
    await deleteMatch(matchId);
    await deleteDummyUsers(dummyUserIds);
});

test.describe("Generar equipos @smoke", () => {
    test.describe.configure({ mode: "serial" });

    test("botón Generar equipos es visible para el organizador @smoke", async ({ page }) => {
        const matchPage = new MatchPage(page);
        await page.goto(`/matches/${matchId}`);
        await matchPage.openOrganizer();
        await expect(matchPage.organizerAction(/^(Generar|Barajar) equipos/)).toBeVisible({ timeout: 5_000 });
    });

    test("generar equipos asigna participantes al Rojo y al Azul @critical", async ({ page }) => {
        const matchPage = new MatchPage(page);
        await page.goto(`/matches/${matchId}`);
        await matchPage.openOrganizer();
        await matchPage.organizerAction(/^(Generar|Barajar) equipos/).click();

        // Los dos equipos deben aparecer en el campo, repartidos a medias
        const campo = page.getByRole("group", { name: "Equipos sobre el campo" });
        await expect(campo).toBeVisible({ timeout: 8_000 });
        await expect(campo.getByText("Rojo", { exact: true })).toBeVisible();
        await expect(campo.getByText("Azul", { exact: true })).toBeVisible();
        await expect(campo.getByRole("button", { name: /^Ver ficha de / })).toHaveCount(4);
    });
});
