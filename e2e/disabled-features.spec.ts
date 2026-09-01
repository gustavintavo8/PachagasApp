import { expect, test } from "@playwright/test";

test.describe("Fantasy y guest mode deshabilitados", () => {
    test.describe("login público", () => {
        test.use({ storageState: { cookies: [], origins: [] } });

        test("login ya no muestra demo como invitado", async ({ page }) => {
            await page.goto("/login");
            await expect(page.getByRole("button", { name: /ver demo como invitado/i })).toHaveCount(0);
        });
    });

    test("la navegación autenticada ya no expone Fantasy", async ({ page }) => {
        await page.goto("/");
        await expect(page.getByRole("link", { name: /^Fantasy$/i })).toHaveCount(0);
    });

    for (const path of ["/fantasy", "/fantasy/mercado", "/fantasy/clasificacion"]) {
        test(`Fantasy no es accesible por URL: ${path}`, async ({ page }) => {
            const response = await page.goto(path);
            expect(response?.status()).toBe(404);
        });
    }

    test.describe("backend", () => {
        test.use({ storageState: { cookies: [], origins: [] } });

        test("Panenka rechaza requests sin sesión", async ({ page }) => {
            await page.goto("/login");
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
    });
});
