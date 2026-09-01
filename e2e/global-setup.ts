import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { assertLocalSupabaseUrl } from "./helpers/local-supabase-url.mjs";

async function globalSetup() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const email = process.env.E2E_TEST_EMAIL;
    const password = process.env.E2E_TEST_PASSWORD;
    const gatedEmail = process.env.E2E_GATED_TEST_EMAIL;
    const gatedPassword = process.env.E2E_GATED_TEST_PASSWORD;

    if (!supabaseUrl || !serviceKey || !email || !password || !gatedEmail || !gatedPassword) {
        throw new Error(
            "[E2E ABORT] Faltan variables de entorno para los usuarios E2E. " +
                "Configura .env.test.local con valores locales de prueba."
        );
    }

    // GUARDIA: abortar si por cualquier razón apunta a producción
    assertLocalSupabaseUrl(supabaseUrl);

    // Crear usuario de test vía Admin (idempotente)
    const admin = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    async function ensureConfirmedUser(params: {
        email: string;
        password: string;
        username: string;
    }) {
        const { email, password, username } = params;
        const { error: createError } = await admin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
        });

        if (
            createError &&
            !createError.message.includes("already been registered") &&
            !createError.message.includes("already exists")
        ) {
            throw new Error(`No se pudo crear el usuario de test ${email}: ${createError.message}`);
        }

        const { data: authUsers, error: listUsersError } = await admin.auth.admin.listUsers();
        if (listUsersError) {
            throw new Error(`No se pudieron listar los usuarios de test: ${listUsersError.message}`);
        }
        const user = authUsers?.users.find((candidate) => candidate.email === email);
        if (!user) {
            throw new Error(`Usuario de test no encontrado tras creación: ${email}`);
        }

        const { error: profileError } = await admin.from("profiles").upsert(
            {
                id: user.id,
                username,
                position: "MID",
                elo_rating: 1000,
                matches_played: 0,
            },
            { onConflict: "id" }
        );
        if (profileError) {
            throw new Error(`No se pudo preparar el perfil de test ${email}: ${profileError.message}`);
        }

        return user.id;
    }

    const testUserId = await ensureConfirmedUser({
        email,
        password,
        username: "test-e2e",
    });
    const gatedUserId = await ensureConfirmedUser({
        email: gatedEmail,
        password: gatedPassword,
        username: "gated-e2e",
    });

    const { error: regularGrantError } = await admin.from("community_access_grants").upsert(
        {
            user_id: testUserId,
            granted_at: new Date().toISOString(),
            revoked_at: null,
        },
        { onConflict: "user_id" }
    );
    if (regularGrantError) {
        throw new Error(`No se pudo activar el grant del usuario regular: ${regularGrantError.message}`);
    }

    const { error: gatedGrantError } = await admin
        .from("community_access_grants")
        .delete()
        .eq("user_id", gatedUserId);
    if (gatedGrantError) {
        throw new Error(`No se pudo limpiar el grant del usuario gated: ${gatedGrantError.message}`);
    }

    // Limpiar rate limits del usuario test para evitar bloqueos entre ejecuciones
    const { error: regularRateLimitError } = await admin.from("rate_limits").delete().like("key", `login:${email}%`);
    if (regularRateLimitError) {
        throw new Error(`No se pudo limpiar el rate limit del usuario regular: ${regularRateLimitError.message}`);
    }
    const { error: gatedRateLimitError } = await admin.from("rate_limits").delete().like("key", `login:${gatedEmail}%`);
    if (gatedRateLimitError) {
        throw new Error(`No se pudo limpiar el rate limit del usuario gated: ${gatedRateLimitError.message}`);
    }

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
    ).catch(async () => {
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
