import { expect, test, type Page } from "@playwright/test";
import { deleteCommunityGrant, getGatedTestUserId } from "./helpers/db";

test.describe.configure({ mode: "serial" });
test.use({ storageState: { cookies: [], origins: [] } });

test.afterEach(async () => {
    await deleteCommunityGrant(await getGatedTestUserId());
});

async function loginAsGatedUser(page: Page) {
    await page.goto("/login");
    await page.fill('input[type="email"]', process.env.E2E_GATED_TEST_EMAIL!);
    await page.fill('input[type="password"]', process.env.E2E_GATED_TEST_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/access");
}

test("una cuenta sin permiso llega a acceso privado", async ({ page }) => {
    await loginAsGatedUser(page);
    await expect(page.getByRole("heading", { name: /acceso privado/i })).toBeVisible();
});

test("el login no ofrece el demo como invitado", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /demo como invitado/i })).toHaveCount(0);
});

test("la API de Panenka no acepta una cuenta sin permiso", async ({ page }) => {
    await loginAsGatedUser(page);
    const response = await page.evaluate(async () => {
        const request = await fetch("/api/asistente", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                messages: [{ role: "user", parts: [{ type: "text", text: "hola" }] }],
            }),
        });

        return {
            status: request.status,
            body: await request.json(),
        };
    });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: "Acceso no autorizado" });
});

test("las rutas parecidas a públicas no omiten la protección", async ({ page }) => {
    await page.goto("/access-anything");
    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/login-anything");
    await expect(page).toHaveURL(/\/login$/);
});

test("el código incorrecto no concede acceso y el correcto sí", async ({ page }) => {
    await loginAsGatedUser(page);
    await page.goto("/access");
    await page.getByLabel(/código/i).fill("codigo-equivocado");
    await page.getByRole("button", { name: /entrar/i }).click();
    await expect(page.getByRole("alert").filter({ hasText: /incorrecto|inválido/i })).toContainText(/incorrecto|inválido/i);

    await page.getByLabel(/código/i).fill(process.env.PACHANGA_ACCESS_CODE!);
    await page.getByRole("button", { name: /entrar/i }).click();
    await page.waitForURL("**/");
    await expect(page).not.toHaveURL(/\/access$/);
});
