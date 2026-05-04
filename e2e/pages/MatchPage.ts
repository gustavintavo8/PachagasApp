// e2e/pages/MatchPage.ts
import { type Page, type Locator, expect } from "@playwright/test";

export class MatchPage {
    readonly page: Page;
    readonly joinButton: Locator;
    readonly leaveButton: Locator;
    readonly participantsList: Locator;

    constructor(page: Page) {
        this.page = page;
        this.joinButton = page.locator('button:has-text("Unirse"), button:has-text("Apuntarme")');
        this.leaveButton = page.locator('button:has-text("Salir"), button:has-text("Abandonar")');
        this.participantsList = page.locator('[data-testid="participants-list"], .participants-list, [aria-label*="participantes"]');
    }

    async goto(matchId: string) {
        await this.page.goto(`/matches/${matchId}`);
        await this.page.waitForLoadState("networkidle");
    }

    async join() {
        await this.joinButton.click();
        await expect(this.leaveButton).toBeVisible({ timeout: 5_000 });
    }

    async leave() {
        await this.leaveButton.click();
        await expect(this.joinButton).toBeVisible({ timeout: 5_000 });
    }

    async markAsPaid() {
        const pendingBadge = this.page.locator('[title="Marcar como pagado"]').first();
        await expect(pendingBadge).toBeVisible({ timeout: 5_000 });
        await pendingBadge.click();
        await expect(this.page.locator('[title="Marcar como no pagado"]').first()).toBeVisible({ timeout: 5_000 });
    }

    async markAsUnpaid() {
        const paidBadge = this.page.locator('[title="Marcar como no pagado"]').first();
        await expect(paidBadge).toBeVisible({ timeout: 5_000 });
        await paidBadge.click();
        await expect(this.page.locator('[title="Marcar como pagado"]').first()).toBeVisible({ timeout: 5_000 });
    }

    async expectPaidCount(paid: number, total: number) {
        await expect(
            this.page.locator(`text=${paid} / ${total} pagados`).or(
                this.page.locator(`text=/ ${total} pagados`)
            )
        ).toBeVisible({ timeout: 5_000 });
    }

    /** Crea un partido desde la UI y retorna su ID desde la URL */
    async createMatch(location: string, minutesFromNow = 2880): Promise<string> {
        await this.page.goto("/");
        await this.page
            .locator("text=Nuevo partido")
            .or(this.page.locator("text=Crear partido"))
            .click();

        const futureDate = new Date(Date.now() + minutesFromNow * 60 * 1000);
        await this.page
            .locator('input[type="datetime-local"]')
            .fill(futureDate.toISOString().slice(0, 16));
        await this.page
            .locator('input[placeholder*="ubicación"], input[placeholder*="lugar"], input[name="location"]')
            .fill(location);
        await this.page.locator('button[type="submit"]').click();

        await this.page.waitForURL(/\/matches\/[a-f0-9-]+/, { timeout: 10_000 });
        return this.page.url().split("/matches/")[1];
    }
}
