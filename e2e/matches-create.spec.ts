import { test, expect } from "@playwright/test";
import { deleteMatch } from "./helpers/db";

let createdMatchId: string | null = null;

test.afterAll(async () => {
    if (createdMatchId) {
        await deleteMatch(createdMatchId);
        createdMatchId = null;
    }
});

test.describe("Crear partido", () => {
    test("formulario de nuevo partido es accesible desde el home", async ({ page }) => {
        await page.goto("/");
        const newMatchButton = page.locator("text=Nuevo partido").or(
            page.locator("text=Crear partido")
        );
        await expect(newMatchButton).toBeVisible();
    });

    test("crear partido con datos válidos redirige a la página del partido", async ({ page }) => {
        await page.goto("/");
        await page.locator("text=Nuevo partido").or(page.locator("text=Crear partido")).click();

        // Rellenar formulario
        const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
        const dateStr = futureDate.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"
        await page.locator('input[type="datetime-local"]').fill(dateStr);
        await page.locator('input[placeholder*="ubicación"], input[placeholder*="lugar"], input[name="location"]').fill("Campo E2E Test");

        await page.locator('button[type="submit"]').click();

        // Redirige a /matches/[id]
        await page.waitForURL(/\/matches\/[a-f0-9-]+/, { timeout: 10_000 });
        const url = page.url();
        createdMatchId = url.split("/matches/")[1];

        await expect(page.locator("text=Campo E2E Test")).toBeVisible();
        await expect(page.locator("text=abierto").or(page.locator("text=Abierto"))).toBeVisible();
    });

    test("crear partido sin ubicación muestra error de validación", async ({ page }) => {
        await page.goto("/");
        await page.locator("text=Nuevo partido").or(page.locator("text=Crear partido")).click();

        const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
        await page.locator('input[type="datetime-local"]').fill(futureDate.toISOString().slice(0, 16));
        // NO rellenar ubicación

        await page.locator('button[type="submit"]').click();

        await expect(page.locator("text=ubicación").or(page.locator("[role='alert']"))).toBeVisible({ timeout: 5_000 });
        // Sigue en el mismo form, no redirige
        await expect(page).not.toHaveURL(/\/matches\/[a-f0-9-]+/);
    });
});
