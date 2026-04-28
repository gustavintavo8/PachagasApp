import { test, expect } from "@playwright/test";
import { deleteMatch } from "./helpers/db";

let createdMatchId: string | null = null;

test.afterAll(async () => {
    if (createdMatchId) {
        await deleteMatch(createdMatchId);
        createdMatchId = null;
    }
});

test.describe("Sistema de pagos (anti-morosidad)", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/");
        await page.locator("text=Nuevo partido").or(page.locator("text=Crear partido")).click();
        const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
        await page.locator('input[type="datetime-local"]').fill(futureDate.toISOString().slice(0, 16));
        await page.locator('input[placeholder*="ubicación"], input[placeholder*="lugar"], input[name="location"]').fill("Campo Pago Test");
        await page.locator('button[type="submit"]').click();
        await page.waitForURL(/\/matches\/[a-f0-9-]+/, { timeout: 10_000 });
        const url = page.url();
        createdMatchId = url.split("/matches/")[1];
    });

    test("el organizador ve el badge de pago pendiente para sí mismo", async ({ page }) => {
        const pendingBadge = page.locator('[title="Marcar como pagado"]').first();
        await expect(pendingBadge).toBeVisible({ timeout: 5_000 });
    });

    test("el organizador puede marcar un jugador como pagado", async ({ page }) => {
        const pendingBadge = page.locator('[title="Marcar como pagado"]').first();
        await expect(pendingBadge).toBeVisible({ timeout: 5_000 });
        await pendingBadge.click();

        const paidBadge = page.locator('[title="Marcar como no pagado"]').first();
        await expect(paidBadge).toBeVisible({ timeout: 5_000 });
    });

    test("el contador X / Y pagados es visible para el organizador", async ({ page }) => {
        await expect(page.locator("text=/ 1 pagados").or(page.locator("text=0 / 1 pagados"))).toBeVisible({ timeout: 5_000 });
    });

    test("el organizador puede desmarcar un jugador como pagado", async ({ page }) => {
        const pendingBadge = page.locator('[title="Marcar como pagado"]').first();
        await pendingBadge.click();
        const paidBadge = page.locator('[title="Marcar como no pagado"]').first();
        await expect(paidBadge).toBeVisible({ timeout: 5_000 });

        await paidBadge.click();
        await expect(page.locator('[title="Marcar como pagado"]').first()).toBeVisible({ timeout: 5_000 });
    });
});
