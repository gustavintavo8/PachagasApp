// e2e/pages/LeaderboardPage.ts
import { type Page, type Locator, expect } from "@playwright/test";

export class LeaderboardPage {
    readonly page: Page;
    readonly rankingTable: Locator;
    readonly nextPageLink: Locator;
    readonly prevPageLink: Locator;

    constructor(page: Page) {
        this.page = page;
        this.rankingTable = page.locator('[data-testid="leaderboard"]');
        // Los enlaces de paginación incluyen flechas: "← Anterior" y "Siguiente →"
        this.nextPageLink = page.locator("text=Siguiente");
        this.prevPageLink = page.locator("text=Anterior");
    }

    async goto() {
        await this.page.goto("/leaderboard");
        await this.page.waitForLoadState("networkidle");
    }

    async expectHeading() {
        await expect(this.page.locator("h1")).toContainText("Ranking");
    }

    async goToNextPage() {
        await this.nextPageLink.click();
        await this.page.waitForLoadState("networkidle");
    }
}
