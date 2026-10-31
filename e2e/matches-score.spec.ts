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
import { MatchPage } from "./pages/MatchPage";

let matchId: string;
let testUserId: string;
let dummyUserIds: string[];

test.beforeAll(async () => {
    testUserId = await getTestUserId();
    dummyUserIds = await createDummyUsers(3);
    matchId = await createTestMatch({ createdBy: testUserId, maxPlayers: 10 });
    await seedParticipants(matchId, [testUserId, ...dummyUserIds].map((uid) => ({ userId: uid })));

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
    // El segundo termina el partido y el tercero comprueba que sigue terminado
    test.describe.configure({ mode: "serial" });

    test("botón de resultado es visible para el organizador @smoke", async ({ page }) => {
        const matchPage = new MatchPage(page);
        await page.goto(`/matches/${matchId}`);
        await matchPage.openOrganizer();
        await expect(matchPage.organizerAction(/^Poner resultado/)).toBeVisible({ timeout: 5_000 });
    });

    test("poner resultado 2-1 marca el partido como finalizado @critical", async ({ page }) => {
        const matchPage = new MatchPage(page);
        await page.goto(`/matches/${matchId}`);

        await matchPage.openOrganizer();
        await matchPage.organizerAction(/^Poner resultado/).click();

        // Rellenar el dialog/form de resultado
        const scoreInputs = page.locator('input[type="number"]');
        await scoreInputs.nth(0).fill("2"); // Equipo A
        await scoreInputs.nth(1).fill("1"); // Equipo B

        await page.getByRole("button", { name: /Guardar resultado y finalizar/i }).click();

        // El partido debe aparecer como terminado y con su marcador
        await expect(page.getByText(/^Terminado ·/)).toBeVisible({ timeout: 10_000 });
        await expect(page.getByLabel("Rojo 2, Azul 1").first()).toBeVisible();
    });

    test("el marcador persiste al recargar", async ({ page }) => {
        await page.goto(`/matches/${matchId}`);
        await expect(page.getByText(/^Terminado ·/)).toBeVisible({ timeout: 5_000 });
        await expect(page.getByLabel("Rojo 2, Azul 1").first()).toBeVisible();
    });
});
