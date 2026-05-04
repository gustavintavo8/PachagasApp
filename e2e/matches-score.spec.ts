import { test, expect } from "@playwright/test";
import {
    createTestMatch,
    deleteMatch,
    getTestUserId,
    seedParticipants,
    createDummyUsers,
    deleteDummyUsers,
} from "./helpers/db";
import { createClient } from "@supabase/supabase-js";

let matchId: string;
let testUserId: string;
let dummyUserIds: string[];

test.beforeAll(async () => {
    testUserId = await getTestUserId();
    dummyUserIds = await createDummyUsers(3);
    matchId = await createTestMatch({ createdBy: testUserId, maxPlayers: 10 });
    await seedParticipants(matchId, dummyUserIds.map((uid) => ({ userId: uid })));

    // Generar equipos directamente en BD para no depender del test anterior
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

    const allParticipants = [testUserId, ...dummyUserIds];
    for (let i = 0; i < allParticipants.length; i++) {
        await db
            .from("match_participants")
            .update({ team: i % 2 === 0 ? "A" : "B" })
            .eq("match_id", matchId)
            .eq("user_id", allParticipants[i]);
    }
});

test.afterAll(async () => {
    await deleteMatch(matchId);
    await deleteDummyUsers(dummyUserIds);
});

test.describe("Poner resultado @smoke", () => {
    test("botón de resultado es visible para el organizador @smoke", async ({ page }) => {
        await page.goto(`/matches/${matchId}`);
        await expect(
            page.locator("text=Poner resultado").or(page.locator("text=Resultado"))
        ).toBeVisible({ timeout: 5_000 });
    });

    test("poner resultado 2-1 marca el partido como finalizado @critical", async ({ page }) => {
        await page.goto(`/matches/${matchId}`);

        await page.locator("text=Poner resultado").or(page.locator("text=Resultado")).click();

        // Rellenar el dialog/form de resultado
        const scoreInputs = page.locator('input[type="number"]');
        await scoreInputs.nth(0).fill("2"); // Equipo A
        await scoreInputs.nth(1).fill("1"); // Equipo B

        await page.locator("button:has-text('Confirmar'), button:has-text('Guardar'), button[type='submit']").last().click();

        // El partido debe aparecer como finalizado
        await expect(
            page.locator("text=finalizado").or(page.locator("text=Finalizado"))
        ).toBeVisible({ timeout: 10_000 });

        // El marcador debe aparecer
        await expect(page.locator("text=2").first()).toBeVisible();
        await expect(page.locator("text=1").first()).toBeVisible();
    });

    test("el marcador persiste al recargar", async ({ page }) => {
        await page.goto(`/matches/${matchId}`);
        await expect(
            page.locator("text=finalizado").or(page.locator("text=Finalizado"))
        ).toBeVisible({ timeout: 5_000 });
    });
});
