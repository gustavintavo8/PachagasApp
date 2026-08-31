import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });
test.use({ storageState: { cookies: [], origins: [] } });

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
