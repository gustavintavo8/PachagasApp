// e2e/pages/MatchPage.ts
import { type Page, type Locator, expect } from "@playwright/test";

export class MatchPage {
    readonly page: Page;
    readonly joinButton: Locator;
    readonly leaveButton: Locator;
    readonly organizeButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.joinButton = page.getByRole("button", { name: "Me apunto", exact: true });
        this.leaveButton = page.getByRole("button", { name: "Me borro", exact: true });
        this.organizeButton = page.getByRole("button", { name: "Organizar", exact: true });
    }

    async goto(matchId: string) {
        await this.page.goto(`/matches/${matchId}`);
        await this.page.waitForLoadState("networkidle");
    }

    async join() {
        await this.joinButton.click();
        await expect(this.leaveButton).toBeVisible({ timeout: 5_000 });
        // La barra cambia al momento y queda deshabilitada hasta que responde el servidor
        await expect(this.leaveButton).toBeEnabled({ timeout: 10_000 });
    }

    async leave() {
        await this.leaveButton.click();
        await expect(this.joinButton).toBeVisible({ timeout: 5_000 });
        await expect(this.joinButton).toBeEnabled({ timeout: 10_000 });
    }

    /** Las acciones del organizador viven en la hoja Organizar. */
    async openOrganizer() {
        await this.organizeButton.click();
        await expect(this.page.getByRole("dialog", { name: "Organizar" })).toBeVisible();
    }

    /** Fila de la hoja Organizar: el nombre accesible incluye su detalle. */
    organizerAction(name: RegExp): Locator {
        return this.page.getByRole("dialog", { name: "Organizar" }).getByRole("button", { name });
    }

    async openPayments() {
        await this.openOrganizer();
        await this.organizerAction(/^Cobros/).click();
        await expect(this.page.getByRole("dialog", { name: "Cobros" })).toBeVisible();
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
        await expect(this.page.getByText(`${paid} / ${total} pagados`)).toBeVisible({ timeout: 5_000 });
    }

    /** Crea un partido desde la UI y retorna su ID desde la URL */
    async createMatch(location: string, minutesFromNow = 2880): Promise<string> {
        await this.page.goto("/");
        await this.page.getByRole("link", { name: "Montar partido" }).click();
        await this.page.waitForURL("**/matches/new");
        // La fecha es un campo controlado: lo escrito antes de hidratar se pierde
        await this.page.waitForLoadState("networkidle");

        const futureDate = new Date(Date.now() + minutesFromNow * 60 * 1000);
        await this.page
            .locator('input[type="datetime-local"]')
            .fill(futureDate.toISOString().slice(0, 16));
        await this.page.locator('input[name="location"]').fill(location);
        await this.page.getByRole("button", { name: /Crear Partido/i }).click();

        await this.page.waitForURL(/\/matches\/[a-f0-9-]+/, { timeout: 10_000 });
        return this.page.url().split("/matches/")[1];
    }
}
