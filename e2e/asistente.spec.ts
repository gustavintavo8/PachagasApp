import { test, expect } from "@playwright/test";
import { buildTools } from "../src/lib/ai/tools";
import type { Season } from "../src/lib/types";

const TEST_SEASON: Season = {
    id: "season-1-id",
    name: "Season 1",
    slug: "season-1",
    status: "active",
    starts_at: "2026-01-01T00:00:00.000Z",
    ends_at: null,
};

test.describe("Asistente Panenka — no autenticado", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("usuario no autenticado es redirigido a login @smoke", async ({ page }) => {
        await page.goto("/asistente");
        await page.waitForURL("**/login");
        await expect(page.locator('input[type="email"]')).toBeVisible();
    });
});

test.describe("Asistente Panenka", () => {
    test("Panenka no anuncia Fantasy", async ({ page }) => {
        await page.goto("/asistente");
        await expect(page.getByText(/Fantasy/i)).toHaveCount(0);
    });

    test("Fantasy tools contract: Panenka no expone herramientas Fantasy", async () => {
        const tools = buildTools("test-user", TEST_SEASON);
        expect(Object.keys(tools)).not.toContain("get_fantasy_standings");
        expect(Object.keys(tools)).not.toContain("get_my_fantasy_team");
        expect(buildTools.length).toBe(2);

        const execute = tools.get_matches.execute;
        expect(execute).toBeDefined();
        if (!execute) throw new Error("get_matches debe tener execute");
        const invalidSeason = await execute(
            { season_slug: "not-a-season" },
            { toolCallId: "contract-test", messages: [] }
        );
        expect(invalidSeason).toEqual({ error: "Temporada inválida" });
    });

    test("usuario autenticado ve la página de Panenka @smoke", async ({ page }) => {
        await page.goto("/asistente");
        await expect(page.getByText("Panenka")).toBeVisible();
        await expect(page.getByText("Tu asistente futbolero")).toBeVisible();
        await expect(page.getByPlaceholder("Pregunta a Panenka...")).toBeVisible();
    });

    test("las sugerencias rápidas aparecen en estado vacío @smoke", async ({ page }) => {
        await page.goto("/asistente");
        await expect(page.getByText("¿Quién lidera el ranking?")).toBeVisible();
        await expect(page.getByText("¿Cuáles son mis estadísticas?")).toBeVisible();
    });

    test("la ruta POST /api/asistente rechaza requests no autenticados", async ({ request }) => {
        const response = await request.post("http://localhost:3000/api/asistente", {
            data: { messages: [{ role: "user", content: "hola" }] },
            headers: { "Cookie": "" },
        });
        expect(response.status()).toBe(401);
    });
});
