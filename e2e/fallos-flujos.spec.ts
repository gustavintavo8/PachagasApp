import { test, expect, type Page } from "@playwright/test";
import {
    DUMMY_PASSWORD,
    createDummyUsers,
    createLoginUser,
    createTestMatch,
    deleteDummyUsers,
    deleteMatch,
    getAdminClient,
    getTestUserId,
    seedParticipants,
} from "./helpers/db";
import { MatchPage } from "./pages/MatchPage";

async function entrar(page: Page, email: string) {
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', DUMMY_PASSWORD);
    await page.click('button[type="submit"]');
}

const irAlLogin = async (page: Page, email: string) => {
    await page.goto("/login");
    await entrar(page, email);
    await page.waitForURL("http://localhost:3000/");
};

async function ponerEnPasado(matchId: string) {
    const { error } = await getAdminClient()
        .from("matches")
        .update({ date: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() })
        .eq("id", matchId);
    if (error) throw new Error(error.message);
}

test.describe("Volver a donde ibas", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("un enlace de partido sin sesión lleva al partido al entrar", async ({ page }) => {
        const usuario = await createLoginUser();
        const matchId = await createTestMatch({ createdBy: usuario.id });
        try {
            await page.goto(`/matches/${matchId}`);
            await page.waitForURL(/\/login\?next=/);
            await entrar(page, usuario.email);
            await page.waitForURL(`**/matches/${matchId}`);
        } finally {
            await deleteMatch(matchId);
            await deleteDummyUsers([usuario.id]);
        }
    });

    test("sin acceso, el destino sigue ahí después del código", async ({ page }) => {
        const usuario = await createLoginUser({ acceso: false });
        const organizador = await createLoginUser();
        const matchId = await createTestMatch({ createdBy: organizador.id });
        try {
            await page.goto(`/matches/${matchId}`);
            await page.waitForURL(/\/login\?next=/);
            await entrar(page, usuario.email);
            await page.waitForURL(/\/access\?next=/);
            await page.getByLabel(/código/i).fill(process.env.PACHANGA_ACCESS_CODE!);
            await page.getByRole("button", { name: /entrar/i }).click();
            await page.waitForURL(`**/matches/${matchId}`);
        } finally {
            await deleteMatch(matchId);
            await deleteDummyUsers([usuario.id, organizador.id]);
        }
    });

    test("next no saca de la app", async ({ page }) => {
        const usuario = await createLoginUser();
        try {
            await page.goto("/login?next=https://example.com/");
            await entrar(page, usuario.email);
            await page.waitForURL("http://localhost:3000/");
        } finally {
            await deleteDummyUsers([usuario.id]);
        }
    });

    test("la flecha vuelve a donde estabas", async ({ page }) => {
        const usuario = await createLoginUser();
        const matchId = await createTestMatch({ createdBy: usuario.id });
        try {
            await irAlLogin(page, usuario.email);
            const barra = page.locator(".barra-superior");

            await page.goto("/profile");
            await page.getByRole("link", { name: /historial/i }).first().click();
            await page.waitForURL("**/history");
            // La primera es la flecha: en escritorio la barra también enlaza las pestañas
            await expect(barra.getByRole("link", { name: "Perfil" }).first()).toHaveClass(/pulsable/);

            await page.goto(`/matches/${matchId}`);
            await page.getByRole("link", { name: "Organizas tú" }).click();
            await page.waitForURL("**/players/**");
            await barra.getByRole("link", { name: "Partido", exact: true }).click();
            await page.waitForURL(`**/matches/${matchId}`);
        } finally {
            await deleteMatch(matchId);
            await deleteDummyUsers([usuario.id]);
        }
    });
});

test.describe("Registro", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("el apodo es el que escribes, y con sesión abierta pasa directo", async ({ page }) => {
        const email = `alta-${Date.now()}@pachanga.local`;
        await page.goto("/login");
        await page.getByRole("button", { name: "Registrarse" }).click();
        await page.getByLabel("Apodo").fill("El Rubio");
        await page.fill('input[type="email"]', email);
        await page.fill('input[type="password"]', DUMMY_PASSWORD);
        await page.getByLabel(/acepto la Política de Privacidad/i).check();
        await page.getByLabel(/14 años/i).check();
        await page.getByRole("button", { name: "Crear cuenta" }).click();
        await page.waitForURL("**/access");

        const db = getAdminClient();
        const { data } = await db.auth.admin.listUsers();
        const creado = data.users.find((u) => u.email === email);
        const { data: perfil } = await db.from("profiles").select("username").eq("id", creado!.id).single();
        expect(perfil?.username).toBe("El Rubio");
        await deleteDummyUsers([creado!.id]);
    });

    test("un correo repetido no se contesta con «no me suena»", async ({ page }) => {
        const usuario = await createLoginUser();
        try {
            await page.goto("/login");
            await page.getByRole("button", { name: "Registrarse" }).click();
            await page.getByLabel("Apodo").fill("Repetido");
            await page.fill('input[type="email"]', usuario.email);
            await page.fill('input[type="password"]', DUMMY_PASSWORD);
            await page.getByLabel(/acepto la Política de Privacidad/i).check();
            await page.getByLabel(/14 años/i).check();
            await page.getByRole("button", { name: "Crear cuenta" }).click();
            await expect(page.getByRole("alert").filter({ hasText: "ya está registrado" })).toBeVisible();
            await expect(page.getByText(/no me suena|no está en la lista|ni con enchufe|no tengo prisa/i)).toHaveCount(0);
        } finally {
            await deleteDummyUsers([usuario.id]);
        }
    });
});

test.describe("Borrarse", () => {
    test("un admin apuntado al partido de otro puede borrarse", async ({ browser, baseURL }) => {
        const admin = await createLoginUser({ admin: true });
        const organizador = await createLoginUser();
        const matchId = await createTestMatch({ createdBy: organizador.id });
        await seedParticipants(matchId, [{ userId: organizador.id }, { userId: admin.id }]);
        const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
        const page = await context.newPage();
        try {
            await irAlLogin(page, admin.email);
            const matchPage = new MatchPage(page);
            await matchPage.goto(matchId);
            await matchPage.leave();
        } finally {
            await context.close();
            await deleteMatch(matchId);
            await deleteDummyUsers([admin.id, organizador.id]);
        }
    });

    test("con peto, Me borro pregunta y dice lo que pierdes", async ({ page }) => {
        const testUserId = await getTestUserId();
        const [organizador] = await createDummyUsers(1);
        const matchId = await createTestMatch({ createdBy: organizador });
        await seedParticipants(matchId, [{ userId: organizador, team: "A" }, { userId: testUserId, team: "B" }]);
        try {
            const matchPage = new MatchPage(page);
            await matchPage.goto(matchId);
            await matchPage.leaveButton.click();
            const hoja = page.getByRole("dialog", { name: "¿Te borras?" });
            await expect(hoja).toContainText("Pierdes el peto azul");
            await hoja.getByRole("button", { name: "Volver" }).click();
            await expect(matchPage.leaveButton).toBeVisible();

            await matchPage.leaveButton.click();
            await page.getByRole("button", { name: "Sí, me borro" }).click();
            await expect(matchPage.joinButton).toBeVisible();
        } finally {
            await deleteMatch(matchId);
            await deleteDummyUsers([organizador]);
        }
    });

    test("un partido ya empezado no tiene Me borro", async ({ page }) => {
        const testUserId = await getTestUserId();
        const [organizador] = await createDummyUsers(1);
        const matchId = await createTestMatch({ createdBy: organizador });
        await seedParticipants(matchId, [{ userId: organizador }, { userId: testUserId }]);
        await ponerEnPasado(matchId);
        try {
            const matchPage = new MatchPage(page);
            await matchPage.goto(matchId);
            await expect(page.getByText("Falta el resultado")).toBeVisible();
            await expect(matchPage.leaveButton).toHaveCount(0);
        } finally {
            await deleteMatch(matchId);
            await deleteDummyUsers([organizador]);
        }
    });
});

test.describe("Organizar", () => {
    test("barajar cambia el reparto y lo dice", async ({ page }) => {
        const testUserId = await getTestUserId();
        const otros = await createDummyUsers(7);
        const matchId = await createTestMatch({ createdBy: testUserId, maxPlayers: 8 });
        await seedParticipants(matchId, [testUserId, ...otros].map((userId) => ({ userId })));

        const db = getAdminClient();
        const rojos = async () => {
            const { data } = await db.from("match_participants").select("user_id").eq("match_id", matchId).eq("team", "A");
            return (data ?? []).map((p) => p.user_id).sort().join();
        };
        const azules = async () => {
            const { data } = await db.from("match_participants").select("user_id").eq("match_id", matchId).eq("team", "B");
            return (data ?? []).map((p) => p.user_id).sort().join();
        };

        try {
            const matchPage = new MatchPage(page);
            await matchPage.goto(matchId);
            await matchPage.openOrganizer();
            await matchPage.organizerAction(/^Generar equipos/).click();
            await expect(page.getByRole("group", { name: "Equipos sobre el campo" })).toBeVisible({ timeout: 8_000 });
            const [rojoAntes, azulAntes] = [await rojos(), await azules()];

            await matchPage.openOrganizer();
            await matchPage.organizerAction(/^Barajar equipos/).click();
            await expect(page.getByText("Equipos barajados")).toBeVisible({ timeout: 8_000 });

            const rojoDespues = await rojos();
            expect(rojoDespues).not.toBe(rojoAntes);
            expect(rojoDespues).not.toBe(azulAntes);
        } finally {
            await deleteMatch(matchId);
            await deleteDummyUsers(otros);
        }
    });

    test("pasado y con un solo apuntado, la hoja dice cómo salir", async ({ page }) => {
        const testUserId = await getTestUserId();
        const matchId = await createTestMatch({ createdBy: testUserId });
        await seedParticipants(matchId, [{ userId: testUserId }]);
        await ponerEnPasado(matchId);
        try {
            const matchPage = new MatchPage(page);
            await matchPage.goto(matchId);
            await expect(page.getByText("No se jugó")).toBeVisible();
            await matchPage.openOrganizer();
            const hoja = page.getByRole("dialog", { name: "Organizar" });
            await expect(hoja.getByText("Hacen falta dos jugadores")).toBeVisible();
            await expect(hoja.getByRole("button", { name: /^Generar equipos/ })).toHaveCount(0);
            await expect(hoja.getByRole("button", { name: /^Cancelar partido/ })).toBeVisible();
        } finally {
            await deleteMatch(matchId);
        }
    });

    test("un sitio de solo espacios no crea un partido", async ({ page }) => {
        await page.goto("/matches/new");
        await page.waitForLoadState("networkidle");
        const fecha = new Date(Date.now() + 2880 * 60 * 1000).toISOString().slice(0, 16);
        await page.locator('input[type="datetime-local"]').fill(fecha);
        await page.locator('input[name="location"]').fill("     ");
        await page.getByRole("button", { name: /Crear Partido/i }).click();
        await expect(page.getByText(/ubicación debe tener/i)).toBeVisible();
        await expect(page).toHaveURL(/\/matches\/new/);
    });
});

test.describe("Partido en directo", () => {
    test("si te quitan la última plaza, la pantalla se pone al día", async ({ page }) => {
        const otros = await createDummyUsers(3);
        const matchId = await createTestMatch({ createdBy: otros[0], maxPlayers: 3 });
        await seedParticipants(matchId, otros.slice(0, 2).map((userId) => ({ userId })));
        try {
            const matchPage = new MatchPage(page);
            await matchPage.goto(matchId);
            await expect(page.getByText("Falta 1")).toBeVisible();

            await seedParticipants(matchId, [{ userId: otros[2] }]);
            await matchPage.joinButton.click();
            await expect(page.getByText("El partido está completo")).toBeVisible();
            await expect(page.getByText("Completo", { exact: true })).toBeVisible({ timeout: 8_000 });
            await expect(matchPage.joinButton).toHaveCount(0);
        } finally {
            await deleteMatch(matchId);
            await deleteDummyUsers(otros);
        }
    });

    test("el chat llega al otro sin recargar", async ({ page, browser, baseURL }) => {
        const testUserId = await getTestUserId();
        const otro = await createLoginUser();
        const matchId = await createTestMatch({ createdBy: testUserId });
        await seedParticipants(matchId, [{ userId: testUserId }, { userId: otro.id }]);
        const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
        const suya = await context.newPage();
        try {
            await irAlLogin(suya, otro.email);
            const abrirChat = async (pagina: Page) => {
                await new MatchPage(pagina).goto(matchId);
                await pagina.getByRole("button", { name: "Chat", exact: true }).click();
                await expect(pagina.getByRole("textbox")).toBeVisible();
            };
            await abrirChat(page);
            await abrirChat(suya);
            // El canal tarda un momento en quedar suscrito
            await suya.waitForTimeout(1500);

            const mensaje = `En directo ${Date.now()}`;
            await page.getByRole("textbox").fill(mensaje);
            await page.keyboard.press("Enter");
            await expect(suya.getByText(mensaje)).toBeVisible({ timeout: 8_000 });
        } finally {
            await context.close();
            await deleteMatch(matchId);
            await deleteDummyUsers([otro.id]);
        }
    });

    test("cerrar una votación empatada no promete un MVP", async ({ page }) => {
        const testUserId = await getTestUserId();
        const otros = await createDummyUsers(3);
        const matchId = await createTestMatch({ createdBy: testUserId });
        await seedParticipants(matchId, [
            { userId: testUserId, team: "A" },
            { userId: otros[0], team: "A" },
            { userId: otros[1], team: "B" },
            { userId: otros[2], team: "B" },
        ]);
        const db = getAdminClient();
        await db
            .from("matches")
            .update({ status: "finished", team_a_score: 2, team_b_score: 1, finished_at: new Date().toISOString() })
            .eq("id", matchId);
        await db.from("mvp_votes").insert([
            { match_id: matchId, voter_id: otros[0], voted_for: otros[1] },
            { match_id: matchId, voter_id: otros[1], voted_for: otros[0] },
        ]);
        try {
            await page.goto(`/matches/${matchId}`);
            await page.getByRole("button", { name: "Finalizar ya" }).click();
            const hoja = page.getByRole("dialog", { name: "Ahora mismo hay empate" });
            await expect(hoja).toContainText("no habrá MVP");
            await expect(hoja.getByRole("button", { name: "Finalizar ya" })).toHaveCount(0);
        } finally {
            await deleteMatch(matchId);
            await deleteDummyUsers(otros);
        }
    });
});

test.describe("Borrar la cuenta", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("funciona aunque hayas jugado, y se lleva tus ficheros", async ({ page }) => {
        const usuario = await createLoginUser();
        const organizador = await createLoginUser();
        const ajeno = await createTestMatch({ createdBy: organizador.id });
        const propio = await createTestMatch({ createdBy: usuario.id });
        await seedParticipants(ajeno, [{ userId: organizador.id }, { userId: usuario.id }]);

        const db = getAdminClient();
        const imagen = new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });
        const rutaAvatar = `${usuario.id}/1.png`;
        const rutaFoto = `${ajeno}/${usuario.id}-1.png`;
        await db.storage.from("avatars").upload(rutaAvatar, imagen);
        await db.storage.from("match_photos").upload(rutaFoto, imagen);
        const { data: publica } = db.storage.from("match_photos").getPublicUrl(rutaFoto);
        await db.from("match_photos").insert({ match_id: ajeno, user_id: usuario.id, photo_url: publica.publicUrl });
        await db.from("match_comments").insert({ match_id: ajeno, user_id: usuario.id, content: "Hola" });

        try {
            await irAlLogin(page, usuario.email);
            await page.goto("/profile");
            await page.getByRole("button", { name: "Eliminar mi cuenta" }).click();
            await page.getByPlaceholder("ELIMINAR").fill("ELIMINAR");
            await page.getByRole("button", { name: "Confirmar borrado" }).click();
            await page.waitForURL("**/login**");

            const { data: perfil } = await db.from("profiles").select("id").eq("id", usuario.id).maybeSingle();
            expect(perfil).toBeNull();
            const { data: avatares } = await db.storage.from("avatars").list(usuario.id);
            expect(avatares ?? []).toHaveLength(0);
            const { data: fotos } = await db.storage.from("match_photos").list(ajeno);
            expect(fotos ?? []).toHaveLength(0);
            const { data: partido } = await db.from("matches").select("created_by").eq("id", propio).single();
            expect(partido?.created_by).toBeNull();
        } finally {
            await deleteMatch(ajeno);
            await deleteMatch(propio);
            await deleteDummyUsers([organizador.id]);
        }
    });

    test("un partido sin organizador se ve bien", async ({ page }) => {
        const usuario = await createLoginUser();
        const matchId = await createTestMatch({ createdBy: usuario.id });
        const db = getAdminClient();
        await db.from("matches").update({ created_by: null }).eq("id", matchId);
        try {
            await irAlLogin(page, usuario.email);
            await page.goto(`/matches/${matchId}`);
            await expect(page.getByText("Sin organizador")).toBeVisible();
        } finally {
            await deleteMatch(matchId);
            await deleteDummyUsers([usuario.id]);
        }
    });
});
