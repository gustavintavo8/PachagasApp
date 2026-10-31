import { test, expect } from "@playwright/test";
import { deleteMatch } from "./helpers/db";
import { MatchPage } from "./pages/MatchPage";

const createdMatchIds: string[] = [];

test.afterAll(async () => {
    for (const id of createdMatchIds.splice(0)) await deleteMatch(id);
});

test.describe("Sistema de pagos (anti-morosidad) @smoke @critical", () => {
    test.beforeEach(async ({ page }) => {
        const matchPage = new MatchPage(page);
        createdMatchIds.push(await matchPage.createMatch("Campo Pago Test"));
    });

    test("el organizador ve el badge de pago pendiente para sí mismo @smoke", async ({ page }) => {
        await new MatchPage(page).openPayments();
        const pendingBadge = page.locator('[title="Marcar como pagado"]').first();
        await expect(pendingBadge).toBeVisible({ timeout: 5_000 });
    });

    test("el organizador puede marcar un jugador como pagado @critical", async ({ page }) => {
        const matchPage = new MatchPage(page);
        await matchPage.openPayments();
        await matchPage.markAsPaid();
    });

    test("el contador X / Y pagados es visible para el organizador @smoke", async ({ page }) => {
        const matchPage = new MatchPage(page);
        await matchPage.openOrganizer();
        await matchPage.expectPaidCount(0, 1);
    });

    test("el organizador puede desmarcar un jugador como pagado @critical", async ({ page }) => {
        const matchPage = new MatchPage(page);
        await matchPage.openPayments();
        await matchPage.markAsPaid();
        await matchPage.markAsUnpaid();
    });
});
