import { test, expect } from "@playwright/test";

test.describe("Modo invitado (anonymous)", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("botón de demo aparece en login", async ({ page }) => {
        await page.goto("/login");
        await expect(page.getByRole("button", { name: /ver demo como invitado/i })).toBeVisible();
    });

    test("clic en demo redirige al home", async ({ page }) => {
        await page.goto("/login");
        await page.getByRole("button", { name: /ver demo como invitado/i }).click();
        await page.waitForURL("**/");
        await expect(page).toHaveURL("http://localhost:3000/");
    });

    test("invitado puede ver la lista de partidos", async ({ page }) => {
        await page.goto("/login");
        await page.getByRole("button", { name: /ver demo como invitado/i }).click();
        await page.waitForURL("**/");
        await page.goto("/matches");
        await expect(page).toHaveURL("http://localhost:3000/matches");
        await expect(page.locator('input[type="email"]')).not.toBeVisible();
    });

    test("invitado es redirigido fuera de /matches/new", async ({ page }) => {
        await page.goto("/login");
        await page.getByRole("button", { name: /ver demo como invitado/i }).click();
        await page.waitForURL("**/");
        await page.goto("/matches/new");
        await page.waitForURL("**/matches");
        await expect(page).toHaveURL("http://localhost:3000/matches");
    });

    test("invitado puede acceder al asistente", async ({ page }) => {
        await page.goto("/login");
        await page.getByRole("button", { name: /ver demo como invitado/i }).click();
        await page.waitForURL("**/");
        await page.goto("/asistente");
        await expect(page).toHaveURL("http://localhost:3000/asistente");
        await expect(page.locator('input[type="email"]')).not.toBeVisible();
    });

    test("invitado puede ver el ranking", async ({ page }) => {
        await page.goto("/login");
        await page.getByRole("button", { name: /ver demo como invitado/i }).click();
        await page.waitForURL("**/");
        await page.goto("/leaderboard");
        await expect(page).toHaveURL("http://localhost:3000/leaderboard");
        await expect(page.locator('input[type="email"]')).not.toBeVisible();
    });
});
