import { test, expect } from "@playwright/test";

test.describe("Asistente Panenka — no autenticado", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("usuario no autenticado es redirigido a login @smoke", async ({ page }) => {
        await page.goto("/asistente");
        await page.waitForURL("**/login");
        await expect(page.locator('input[type="email"]')).toBeVisible();
    });
});

test.describe("Asistente Panenka", () => {
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
