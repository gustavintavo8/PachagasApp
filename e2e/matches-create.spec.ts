import { test, expect, type Page } from "@playwright/test";
import { deleteMatch } from "./helpers/db";

let createdMatchId: string | null = null;

test.afterAll(async () => {
    if (createdMatchId) {
        await deleteMatch(createdMatchId);
        createdMatchId = null;
    }
});

async function openNewMatchForm(page: Page) {
    await page.getByRole("link", { name: "Montar partido" }).click();
    await page.waitForURL("**/matches/new");
    // La fecha es un campo controlado: lo escrito antes de hidratar se pierde
    await page.waitForLoadState("networkidle");
}

test.describe("Crear partido @smoke", () => {
    test("formulario de nuevo partido es accesible desde el home @smoke", async ({ page }) => {
        await page.goto("/");
        await expect(page.getByRole("link", { name: "Montar partido" })).toBeVisible();
    });

    test("crear partido con datos válidos redirige a la página del partido @critical", async ({ page }) => {
        await page.goto("/");
        await openNewMatchForm(page);

        // Rellenar formulario
        const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
        const dateStr = futureDate.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"
        await page.locator('input[type="datetime-local"]').fill(dateStr);
        await page.locator('input[name="location"]').fill("Campo E2E Test");

        await page.locator('button[type="submit"]').click();

        // Redirige a /matches/[id]
        await page.waitForURL(/\/matches\/[a-f0-9-]+/, { timeout: 10_000 });
        const url = page.url();
        createdMatchId = url.split("/matches/")[1];

        await expect(page.getByText("Campo E2E Test")).toBeVisible();
        await expect(page.getByText(/^Abierto ·/)).toBeVisible();
    });

    test("crear partido sin ubicación muestra error de validación", async ({ page }) => {
        await page.goto("/");
        await openNewMatchForm(page);

        const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
        await page.locator('input[type="datetime-local"]').fill(futureDate.toISOString().slice(0, 16));
        // NO rellenar ubicación

        const location = page.locator('input[name="location"]');
        await location.clear();
        await page.locator('button[type="submit"]').click();

        // Vacía la para el navegador
        expect(await location.evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
        await expect(page).toHaveURL(/\/matches\/new/);

        // Demasiado corta también
        await location.fill("x");
        await page.locator('button[type="submit"]').click();
        expect(await location.evaluate((input: HTMLInputElement) => input.validity.tooShort)).toBe(true);
        await expect(page).toHaveURL(/\/matches\/new/);
    });
});
