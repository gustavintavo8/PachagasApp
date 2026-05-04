import { test, expect } from "@playwright/test";
import {
    createTestMatch,
    deleteMatch,
    getTestUserId,
    seedParticipants,
    createDummyUsers,
    deleteDummyUsers,
} from "./helpers/db";

let matchId: string;
let testUserId: string;
let dummyUserIds: string[];

test.beforeAll(async () => {
    testUserId = await getTestUserId();
    dummyUserIds = await createDummyUsers(3); // 3 extra + el organizador = 4 total

    matchId = await createTestMatch({ createdBy: testUserId, maxPlayers: 10 });

    // Seed: organizador ya está unido por createMatch; añadir los 3 dummies
    await seedParticipants(matchId, dummyUserIds.map((uid) => ({ userId: uid })));
});

test.afterAll(async () => {
    await deleteMatch(matchId);
    await deleteDummyUsers(dummyUserIds);
});

test.describe("Generar equipos @smoke", () => {
    test("botón Generar equipos es visible para el organizador @smoke", async ({ page }) => {
        await page.goto(`/matches/${matchId}`);
        await expect(
            page.locator("text=Generar equipos").or(page.locator("text=Barajar equipos"))
        ).toBeVisible({ timeout: 5_000 });
    });

    test("generar equipos asigna participantes a Equipo A y Equipo B @critical", async ({ page }) => {
        await page.goto(`/matches/${matchId}`);
        await page.locator("text=Generar equipos").or(page.locator("text=Barajar equipos")).click();

        // Esperar confirmación / toast
        await page.waitForTimeout(2_000);

        // Los equipos deben aparecer en la UI
        await expect(page.locator("text=Equipo A").or(page.locator("text=Team A"))).toBeVisible({ timeout: 8_000 });
        await expect(page.locator("text=Equipo B").or(page.locator("text=Team B"))).toBeVisible({ timeout: 8_000 });
    });
});
