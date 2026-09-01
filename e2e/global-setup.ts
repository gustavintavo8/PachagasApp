import { chromium, type Browser } from "@playwright/test";
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
    const seasonEmail = process.env.E2E_SEASONS_TEST_EMAIL;
    const seasonPassword = process.env.E2E_SEASONS_TEST_PASSWORD;
    const seasonStatsEmail = process.env.E2E_SEASONS_STATS_TEST_EMAIL;
    const seasonStatsPassword = process.env.E2E_SEASONS_STATS_TEST_PASSWORD;

    if (
        !supabaseUrl ||
        !serviceKey ||
        !email ||
        !password ||
        !gatedEmail ||
        !gatedPassword ||
        !seasonEmail ||
        !seasonPassword ||
        !seasonStatsEmail ||
        !seasonStatsPassword
    ) {
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
    const seasonUserId = await ensureConfirmedUser({
        email: seasonEmail,
        password: seasonPassword,
        username: "seasons-e2e",
    });
    const seasonStatsUserId = await ensureConfirmedUser({
        email: seasonStatsEmail,
        password: seasonStatsPassword,
        username: "seasons-stats-e2e",
    });

    async function ensureCommunityGrant(userId: string, label: string) {
        const { error } = await admin.from("community_access_grants").upsert(
            {
                user_id: userId,
                granted_at: new Date().toISOString(),
                revoked_at: null,
            },
            { onConflict: "user_id" }
        );
        if (error) {
            throw new Error(`No se pudo activar el grant del usuario ${label}: ${error.message}`);
        }
    }

    await ensureCommunityGrant(testUserId, "regular");
    await ensureCommunityGrant(seasonUserId, "de temporadas");
    await ensureCommunityGrant(seasonStatsUserId, "de estadísticas de temporadas");

    const { error: gatedGrantError } = await admin
        .from("community_access_grants")
        .delete()
        .eq("user_id", gatedUserId);
    if (gatedGrantError) {
        throw new Error(`No se pudo limpiar el grant del usuario gated: ${gatedGrantError.message}`);
    }

    // Limpiar rate limits de los fixtures para evitar bloqueos entre ejecuciones.
    for (const [label, loginEmail] of [
        ["regular", email],
        ["gated", gatedEmail],
        ["de temporadas", seasonEmail],
        ["de estadísticas de temporadas", seasonStatsEmail],
    ] as const) {
        const { error } = await admin.from("rate_limits").delete().like("key", `login:${loginEmail}%`);
        if (error) {
            throw new Error(`No se pudo limpiar el rate limit del usuario ${label}: ${error.message}`);
        }
    }

    // El usuario de historia debe arrancar sin estadísticas persistidas de otras ejecuciones.
    const { error: seasonStatsCleanupError } = await admin
        .from("season_player_stats")
        .delete()
        .eq("user_id", seasonUserId);
    if (seasonStatsCleanupError) {
        throw new Error(`No se pudieron limpiar las estadísticas del fixture de temporadas: ${seasonStatsCleanupError.message}`);
    }

    // Login vía UI y guardar un storageState por fixture.
    const authDir = path.resolve("e2e/.auth");
    if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

    const browser = await chromium.launch();
    try {
        await saveStorageState(browser, {
            email,
            password,
            storagePath: "e2e/.auth/user.json",
        });
        await saveStorageState(browser, {
            email: seasonEmail,
            password: seasonPassword,
            storagePath: "e2e/.auth/seasons.json",
        });
        await saveStorageState(browser, {
            email: seasonStatsEmail,
            password: seasonStatsPassword,
            storagePath: "e2e/.auth/seasons-stats.json",
        });
    } finally {
        await browser.close();
    }
}

async function saveStorageState(
    browser: Browser,
    params: { email: string; password: string; storagePath: string }
) {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        await page.goto("http://localhost:3000/login");
        await page.fill('input[type="email"]', params.email);
        await page.fill('input[type="password"]', params.password);
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
        await context.storageState({ path: params.storagePath });
    } finally {
        await context.close();
    }
}

export default globalSetup;
