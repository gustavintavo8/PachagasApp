import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// No requiere sesión: probamos el rol anónimo directamente contra PostgREST.
test.describe("Bloque 0 — el email no es público", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("el rol anónimo no puede seleccionar profiles.email", async () => {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { error } = await supabase.from("profiles").select("email").limit(1);
        // Tras eliminar la columna, PostgREST responde con error de columna inexistente.
        expect(error).not.toBeNull();
        expect(error?.message ?? "").toMatch(/email/i);
    });

    test("el rol anónimo sigue viendo los campos públicos", async () => {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { error } = await supabase
            .from("profiles")
            .select("username, avatar_url, elo_rating")
            .limit(1);
        expect(error).toBeNull();
    });
});

test.describe("Bloque 1 — borrado de cuenta (UI)", () => {
    test("el boton de borrar esta deshabilitado hasta escribir ELIMINAR", async ({ page }) => {
        await page.goto("/profile");
        await page.getByRole("button", { name: "Eliminar mi cuenta" }).click();
        const confirmBtn = page.getByRole("button", { name: "Confirmar borrado" });
        await expect(confirmBtn).toBeDisabled();
        await page.getByPlaceholder("ELIMINAR").fill("ELIMINAR");
        await expect(confirmBtn).toBeEnabled();
    });
});

test.describe("Bloque 1 — exportacion de datos", () => {
    test("descargar mis datos genera un JSON", async ({ page }) => {
        await page.goto("/profile");
        const [download] = await Promise.all([
            page.waitForEvent("download"),
            page.getByRole("button", { name: "Descargar mis datos" }).click(),
        ]);
        expect(download.suggestedFilename()).toMatch(/\.json$/);
    });
});

test.describe("Bloque 2 — enlaces legales", () => {
    test("el footer enlaza las paginas legales", async ({ page }) => {
        await page.goto("/");
        await expect(page.getByRole("link", { name: "Privacidad" })).toBeVisible();
        await expect(page.getByRole("link", { name: "Aviso legal" })).toBeVisible();
        await expect(page.getByRole("link", { name: "Términos" })).toBeVisible();
    });
});

test.describe("Bloque 2 — pagina de privacidad", () => {
    test.use({ storageState: { cookies: [], origins: [] } });
    test("la pagina de privacidad carga con sus secciones", async ({ page }) => {
        await page.goto("/privacidad");
        await expect(page.getByRole("heading", { name: "Política de Privacidad" })).toBeVisible();
        await expect(page.getByRole("heading", { name: "Cookies" })).toBeVisible();
        await expect(page.getByText("Groq")).toBeVisible();
    });
});

test.describe("Bloque 2 — aviso legal y terminos", () => {
    test.use({ storageState: { cookies: [], origins: [] } });
    test("aviso legal carga", async ({ page }) => {
        await page.goto("/aviso-legal");
        await expect(page.getByRole("heading", { name: "Aviso Legal" })).toBeVisible();
    });
    test("terminos cargan y mencionan las fotos", async ({ page }) => {
        await page.goto("/terminos");
        await expect(page.getByRole("heading", { name: "Términos de Uso" })).toBeVisible();
        await expect(page.getByText(/derechos de imagen/i)).toBeVisible();
    });
});
