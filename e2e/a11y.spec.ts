// e2e/a11y.spec.ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Accesibilidad WCAG 2.2 @smoke", () => {
    test("leaderboard no tiene violaciones de accesibilidad @smoke", async ({ page }) => {
        await page.goto("/leaderboard");
        await page.waitForLoadState("networkidle");

        const results = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
            .analyze();

        expect(
            results.violations,
            `Violaciones de accesibilidad encontradas:\n${results.violations
                .map((v) => `  [${v.impact}] ${v.id}: ${v.description}`)
                .join("\n")}`
        ).toEqual([]);
    });

    test("página de jugadores no tiene violaciones de accesibilidad @smoke", async ({ page }) => {
        await page.goto("/players");
        await page.waitForLoadState("networkidle");

        const results = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
            .analyze();

        expect(
            results.violations,
            `Violaciones de accesibilidad encontradas:\n${results.violations
                .map((v) => `  [${v.impact}] ${v.id}: ${v.description}`)
                .join("\n")}`
        ).toEqual([]);
    });

    test("dashboard no tiene violaciones de accesibilidad @smoke", async ({ page }) => {
        await page.goto("/");
        await page.waitForLoadState("networkidle");

        const results = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
            .analyze();

        expect(
            results.violations,
            `Violaciones de accesibilidad encontradas:\n${results.violations
                .map((v) => `  [${v.impact}] ${v.id}: ${v.description}`)
                .join("\n")}`
        ).toEqual([]);
    });
});
