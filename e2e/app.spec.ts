import { test, expect } from "@playwright/test";

test.describe("Public pages", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("login page loads", async ({ page }) => {
        await page.goto("/login");
        await expect(page).toHaveTitle(/Pachanga/);
        await expect(page.locator("form")).toBeVisible();
        await expect(page.locator('input[type="email"]')).toBeVisible();
        await expect(page.locator('input[type="password"]')).toBeVisible();
    });

    test("unauthenticated user is redirected to login", async ({ page }) => {
        await page.goto("/");
        await page.waitForURL("**/login");
        await expect(page.locator("form")).toBeVisible();
    });

    test("matches page redirects to login", async ({ page }) => {
        await page.goto("/matches");
        await page.waitForURL("**/login");
    });
});

test.describe("Navigation", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("login page has correct form elements", async ({ page }) => {
        await page.goto("/login");
        const emailInput = page.locator('input[type="email"]');
        const passwordInput = page.locator('input[type="password"]');
        await expect(emailInput).toBeVisible();
        await expect(passwordInput).toBeVisible();
        const submitButton = page.locator('button[type="submit"]');
        await expect(submitButton).toBeVisible();
    });
});

test.describe("PWA", () => {
    test("manifest.json returns a response", async ({ request }) => {
        const response = await request.get("/manifest.json");
        // Middleware may redirect, but the file should still be served
        expect(response.status()).toBeLessThan(500);
    });

    test("PWA icons are accessible", async ({ page, request }) => {
        const icon192 = await request.get("/icon-192.png");
        expect(icon192.status()).toBe(200);
        const icon512 = await request.get("/icon-512.png");
        expect(icon512.status()).toBe(200);
    });

    test("service worker is accessible", async ({ request }) => {
        const response = await request.get("/sw.js");
        expect(response.status()).toBe(200);
    });
});

test.describe("SEO", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("login page has lang=es", async ({ page }) => {
        await page.goto("/login");
        const lang = await page.locator("html").getAttribute("lang");
        expect(lang).toBe("es");
    });

    test("manifest link is present", async ({ page }) => {
        await page.goto("/login");
        const manifest = page.locator('link[rel="manifest"]');
        await expect(manifest).toHaveAttribute("href", "/manifest.json");
    });

    test("theme-color meta tag is present", async ({ page }) => {
        await page.goto("/login");
        const themeColor = page.locator('meta[name="theme-color"]');
        await expect(themeColor).toHaveAttribute("content", "#ccff00");
    });
});
