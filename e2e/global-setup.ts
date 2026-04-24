import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

async function globalSetup() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const email = process.env.E2E_TEST_EMAIL!;
    const password = process.env.E2E_TEST_PASSWORD!;

    // GUARDIA: abortar si por cualquier razón apunta a producción
    if (!supabaseUrl.includes("127.0.0.1") && !supabaseUrl.includes("localhost")) {
        throw new Error(
            `[E2E ABORT] NEXT_PUBLIC_SUPABASE_URL apunta a "${supabaseUrl}". ` +
            `Los tests E2E solo pueden correr contra Supabase local (127.0.0.1). ` +
            `Verifica que .env.test.local está correctamente configurado.`
        );
    }

    // Crear usuario de test vía Admin (idempotente)
    const admin = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
    });

    // Ignorar error "already exists"
    if (createError && !createError.message.includes("already been registered") && !createError.message.includes("already exists")) {
        throw new Error(`No se pudo crear el usuario de test: ${createError.message}`);
    }

    // También crear el perfil si no existe (el trigger puede no estar en local)
    const { data: authUser } = await admin.auth.admin.listUsers();
    const testUser = authUser?.users.find((u) => u.email === email);
    if (testUser) {
        await admin.from("profiles").upsert({
            id: testUser.id,
            username: "test-e2e",
            position: "MID",
            elo_rating: 1000,
            matches_played: 0,
        }, { onConflict: "id" });
    }

    // Limpiar rate limits del usuario test para evitar bloqueos entre ejecuciones
    await admin.from("rate_limits").delete().like("key", `login:${email}%`);

    // Login vía UI y guardar storageState
    const browser = await chromium.launch();
    const page = await browser.newPage();

    await page.goto("http://localhost:3000/login");
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');

    // waitForFunction sondea window.location directamente, compatible con
    // las soft navigations del App Router (router.replace vía pushState).
    await page.waitForFunction(
        () => window.location.pathname === "/",
        { timeout: 30_000 }
    ).catch(async (e) => {
        const url = page.url();
        const errorText = await page.$eval(".text-red-400", (el) => el.textContent).catch(() => null);
        throw new Error(
            `[global-setup] Login no redirigió a /. URL actual: ${url}. ` +
            (errorText ? `Error en UI: ${errorText}` : "No hay error visible en la página.")
        );
    });

    await page.waitForLoadState("networkidle");

    const authDir = path.resolve("e2e/.auth");
    if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });
    await page.context().storageState({ path: "e2e/.auth/user.json" });

    await browser.close();
}

export default globalSetup;
