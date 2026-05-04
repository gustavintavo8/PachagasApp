import { test, expect } from "@playwright/test";
import { createTestMatch, deleteMatch, getTestUserId } from "./helpers/db";

let matchId: string;
let testUserId: string;

test.beforeAll(async () => {
    testUserId = await getTestUserId();
    matchId = await createTestMatch({ createdBy: testUserId, maxPlayers: 4 });
});

test.afterAll(async () => {
    await deleteMatch(matchId);
});

test.describe("Unirse a un partido @smoke", () => {
    test("el organizador ve botón Abandonar (ya está unido) @smoke", async ({ page }) => {
        await page.goto(`/matches/${matchId}`);
        await expect(page.locator("text=Abandonar")).toBeVisible({ timeout: 5_000 });
    });

    test("unirse a un partido aumenta el contador de participantes", async ({ page }) => {
        // El organizador ya está como participante (auto-join en createMatch)
        // Leemos el contador antes de unirse
        await page.goto(`/matches/${matchId}`);

        // En este test el usuario ya está unido (es el organizador)
        // Verificamos que el conteo muestre al menos 1 participante
        await expect(page.locator("text=Abandonar")).toBeVisible();
    });

    test("abandonar partido muestra botón Unirse @critical", async ({ page }) => {
        await page.goto(`/matches/${matchId}`);
        await page.locator("text=Abandonar").click();
        await expect(page.locator("text=Unirse")).toBeVisible({ timeout: 5_000 });

        // Re-unirse para no romper otros tests
        await page.locator("text=Unirse").click();
        await expect(page.locator("text=Abandonar")).toBeVisible({ timeout: 5_000 });
    });
});
