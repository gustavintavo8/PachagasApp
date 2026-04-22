import { test, expect } from "@playwright/test";

// Este describe NO usa storageState — prueba el login desde cero
test.describe("Autenticación", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("login con credenciales válidas redirige al home", async ({ page }) => {
        await page.goto("/login");
        await page.fill('input[type="email"]', process.env.E2E_TEST_EMAIL!);
        await page.fill('input[type="password"]', process.env.E2E_TEST_PASSWORD!);
        await page.click('button[type="submit"]');
        await page.waitForURL("**/");
        await expect(page).toHaveURL("http://localhost:3000/");
    });

    test("login con email incorrecto muestra error", async ({ page }) => {
        await page.goto("/login");
        await page.fill('input[type="email"]', "noexiste@pachanga.local");
        await page.fill('input[type="password"]', "cualquiercosa");
        await page.click('button[type="submit"]');
        // El mensaje de error debe aparecer en español
        await expect(page.locator("text=Invalid login credentials").or(
            page.locator("[role='alert']")
        )).toBeVisible({ timeout: 5_000 });
    });

    test("usuario no autenticado es redirigido a login", async ({ page }) => {
        await page.goto("/");
        await page.waitForURL("**/login");
        await expect(page.locator('input[type="email"]')).toBeVisible();
    });
});

test.describe("Sesión autenticada", () => {
    // Usa el storageState guardado por global-setup
    test("usuario autenticado ve el home", async ({ page }) => {
        await page.goto("/");
        await expect(page).toHaveURL("http://localhost:3000/");
        // No redirige a login
        await expect(page.locator('input[type="email"]')).not.toBeVisible();
    });
});
