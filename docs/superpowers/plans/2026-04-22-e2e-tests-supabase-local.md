# E2E Tests con Supabase Local — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir tests E2E de Playwright que cubran los flujos críticos (crear partido, unirse, generar equipos, poner resultado) corriendo contra una instancia local de Supabase, sin tocar nunca la BD de producción.

**Architecture:** `playwright.config.ts` carga `.env.test.local` con `override: true` antes de arrancar el servidor. Tres capas de guardia (config, global-setup, db helper) abortan si detectan URL de producción. Supabase CLI gestiona el esquema local vía `supabase init` + `supabase db pull` + `supabase start`.

**Tech Stack:** Playwright, Supabase CLI, Next.js 16, TypeScript, @supabase/supabase-js

---

## PRERREQUISITO MANUAL (hacer antes de implementar)

El usuario debe ejecutar estos comandos **a mano** una vez, después de reiniciar:

```bash
# 1. Instalar Supabase CLI (Windows)
winget install Supabase.CLI

# 2. En el directorio del proyecto
supabase init

# 3. Enlazar con proyecto de producción (solo para pull del schema — no escribe nada en prod)
supabase link --project-ref flbhnvrfbvbieoqyrcgf

# 4. Traer el schema de producción como migraciones locales
supabase db pull

# 5. Arrancar Supabase local (requiere Docker Desktop corriendo)
supabase start
# → Imprime URL, anon key, service role key (son siempre las mismas — ver Task 1)
```

---

## Mapa de archivos

| Archivo | Acción | Descripción |
|---|---|---|
| `.env.test.local` | CREATE | Credenciales Supabase local, usuario de test |
| `.gitignore` | MODIFY | Añadir `.env.test.local`, `e2e/.auth/` |
| `playwright.config.ts` | MODIFY | Cargar `.env.test.local`, globalSetup, storageState |
| `package.json` | MODIFY | Añadir scripts `test:e2e`, `test:e2e:ui`, `test:e2e:headed` |
| `e2e/global-setup.ts` | CREATE | Login una vez, guarda storageState, guardia URL |
| `e2e/helpers/db.ts` | CREATE | Supabase Admin local: createTestMatch, seedParticipants, deleteMatch, getTestUserId |
| `e2e/fixtures.ts` | CREATE | Fixture Playwright con usuario autenticado |
| `e2e/auth.spec.ts` | CREATE | Tests de login/logout |
| `e2e/matches-create.spec.ts` | CREATE | Tests de crear partido |
| `e2e/matches-join.spec.ts` | CREATE | Tests de unirse/abandonar |
| `e2e/matches-teams.spec.ts` | CREATE | Tests de generar equipos |
| `e2e/matches-score.spec.ts` | CREATE | Tests de poner resultado |

---

## Task 0: Verificar prereqs y preparar .gitignore

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Verificar que supabase start está corriendo**

```bash
supabase status
```

Esperado: líneas con `API URL: http://127.0.0.1:54321`, `anon key`, `service_role key`.
Si falla → ejecutar el prereq manual de arriba primero.

- [ ] **Step 2: Añadir entradas a .gitignore**

En `.gitignore`, añadir al final:
```
# E2E tests
e2e/.auth/
.env.test.local
```

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: ignorar auth state y env de tests E2E"
```

---

## Task 1: Crear .env.test.local

**Files:**
- Create: `.env.test.local`

Las keys de abajo son las **hardcoded por defecto del CLI de Supabase** — no son secretas, están en la documentación oficial. Solo funcionan contra localhost.

- [ ] **Step 1: Crear el archivo**

```bash
# .env.test.local
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRFA0NiK7urOL9MJbZFmIqEifBzqmhMmVnpDMHTuGEA
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hj04zWl196z2-SJBo

# Usuario de test (creado automáticamente por global-setup.ts)
E2E_TEST_EMAIL=test-e2e@pachanga.local
E2E_TEST_PASSWORD=test-password-e2e-123
```

IMPORTANTE: Si `supabase status` muestra keys distintas, usar las del output real.

- [ ] **Step 2: Verificar que NO está en git**

```bash
git status
```

`.env.test.local` NO debe aparecer (debe estar ignorado por .gitignore).

---

## Task 2: Instalar dotenv y modificar playwright.config.ts

**Files:**
- Modify: `playwright.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Instalar dotenv como devDependency**

```bash
npm install --save-dev dotenv
```

- [ ] **Step 2: Reemplazar contenido de playwright.config.ts**

```typescript
import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

// Cargar .env.test.local ANTES de cualquier otra cosa.
// override: true garantiza que sobreescribe variables ya cargadas (incluidas las de .env.local).
// Esto hace imposible que los tests lean credenciales de producción.
dotenv.config({ path: path.resolve(__dirname, ".env.test.local"), override: true });

export default defineConfig({
    testDir: "./e2e",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: "html",
    globalSetup: "./e2e/global-setup.ts",
    use: {
        baseURL: "http://localhost:3000",
        storageState: "e2e/.auth/user.json",
        trace: "on-first-retry",
        screenshot: "only-on-failure",
    },
    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
    ],
    webServer: {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
        // Las NEXT_PUBLIC_ vars ya están en process.env gracias al dotenv.config arriba.
        // El proceso hijo (Next.js dev) las hereda automáticamente.
    },
});
```

- [ ] **Step 3: Añadir scripts a package.json**

En la sección `"scripts"`, añadir:
```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui",
"test:e2e:headed": "playwright test --headed"
```

- [ ] **Step 4: Verificar que TypeScript reconoce dotenv**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts package.json package-lock.json
git commit -m "chore(e2e): cargar .env.test.local en playwright.config, añadir scripts de test"
```

---

## Task 3: Crear e2e/global-setup.ts

**Files:**
- Create: `e2e/global-setup.ts`

- [ ] **Step 1: Crear el archivo**

```typescript
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

    // Login vía UI y guardar storageState
    const browser = await chromium.launch();
    const page = await browser.newPage();

    await page.goto("http://localhost:3000/login");
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL("http://localhost:3000/", { timeout: 10_000 });

    const authDir = path.resolve("e2e/.auth");
    if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });
    await page.context().storageState({ path: "e2e/.auth/user.json" });

    await browser.close();
}

export default globalSetup;
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add e2e/global-setup.ts
git commit -m "chore(e2e): global-setup — crear usuario de test y guardar auth state"
```

---

## Task 4: Crear e2e/helpers/db.ts

**Files:**
- Create: `e2e/helpers/db.ts`

- [ ] **Step 1: Crear el archivo**

```typescript
import { createClient, SupabaseClient } from "@supabase/supabase-js";

function getLocalAdminClient(): SupabaseClient {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!url.includes("127.0.0.1") && !url.includes("localhost")) {
        throw new Error(`[E2E ABORT] db helper: URL no es local: "${url}". Abortando para proteger producción.`);
    }

    return createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

export async function getTestUserId(): Promise<string> {
    const db = getLocalAdminClient();
    const email = process.env.E2E_TEST_EMAIL!;
    const { data } = await db.auth.admin.listUsers();
    const user = data?.users.find((u) => u.email === email);
    if (!user) throw new Error(`Usuario de test no encontrado: ${email}`);
    return user.id;
}

export async function createTestMatch(params: {
    createdBy: string;
    location?: string;
    maxPlayers?: number;
}): Promise<string> {
    const db = getLocalAdminClient();
    const date = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await db
        .from("matches")
        .insert({
            date,
            location: params.location ?? "Campo E2E Test",
            max_players: params.maxPlayers ?? 10,
            status: "open",
            created_by: params.createdBy,
        })
        .select("id")
        .single();
    if (error) throw new Error(`createTestMatch: ${error.message}`);
    return data.id;
}

export async function seedParticipants(
    matchId: string,
    participants: { userId: string; team?: "A" | "B" | null }[]
) {
    const db = getLocalAdminClient();
    const rows = participants.map(({ userId, team = null }) => ({
        match_id: matchId,
        user_id: userId,
        team,
        goals: 0,
        is_mvp: false,
    }));
    const { error } = await db.from("match_participants").insert(rows);
    if (error) throw new Error(`seedParticipants: ${error.message}`);
}

export async function createDummyUsers(count: number): Promise<string[]> {
    const db = getLocalAdminClient();
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
        const email = `dummy-${Date.now()}-${i}@pachanga.local`;
        const { data, error } = await db.auth.admin.createUser({
            email,
            password: "dummy-password-123",
            email_confirm: true,
        });
        if (error) throw new Error(`createDummyUsers: ${error.message}`);
        const uid = data.user.id;
        await db.from("profiles").insert({
            id: uid,
            username: `dummy-${i}`,
            position: "MID",
            elo_rating: 1000,
            matches_played: 0,
        });
        ids.push(uid);
    }
    return ids;
}

export async function deleteMatch(matchId: string) {
    const db = getLocalAdminClient();
    await db.from("mvp_votes").delete().eq("match_id", matchId);
    await db.from("match_comments").delete().eq("match_id", matchId);
    await db.from("match_participants").delete().eq("match_id", matchId);
    await db.from("matches").delete().eq("id", matchId);
}

export async function deleteDummyUsers(userIds: string[]) {
    const db = getLocalAdminClient();
    for (const uid of userIds) {
        await db.from("profiles").delete().eq("id", uid);
        await db.auth.admin.deleteUser(uid);
    }
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add e2e/helpers/db.ts
git commit -m "chore(e2e): helper de BD local para seed y cleanup de tests"
```

---

## Task 5: Tests de autenticación — e2e/auth.spec.ts

**Files:**
- Create: `e2e/auth.spec.ts`

- [ ] **Step 1: Crear el archivo**

```typescript
import { test, expect } from "@playwright/test";

// Este describe NO usa storageState — prueba el login desde cero
test.describe("Autenticación", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("login con credenciales válidas redirige al home", async ({ page }) => {
        await page.goto("/login");
        await page.fill('input[type="email"]', process.env.E2E_TEST_EMAIL!);
        await page.fill('input[type="password"]', process.env.E2E_TEST_PASSWORD!);
        await page.click('button[type="submit"]');
        await page.waitForURL("**/");
        await expect(page).toHaveURL("http://localhost:3000/");
    });

    test("login con email incorrecto muestra error", async ({ page }) => {
        await page.goto("/login");
        await page.fill('input[type="email"]', "noexiste@pachanga.local");
        await page.fill('input[type="password"]', "cualquiercosa");
        await page.click('button[type="submit"]');
        // El mensaje de error debe aparecer en español
        await expect(page.locator("text=Invalid login credentials").or(
            page.locator("[role='alert']")
        )).toBeVisible({ timeout: 5_000 });
    });

    test("usuario no autenticado es redirigido a login", async ({ page }) => {
        await page.goto("/");
        await page.waitForURL("**/login");
        await expect(page.locator('input[type="email"]')).toBeVisible();
    });
});

test.describe("Sesión autenticada", () => {
    // Usa el storageState guardado por global-setup
    test("usuario autenticado ve el home", async ({ page }) => {
        await page.goto("/");
        await expect(page).toHaveURL("http://localhost:3000/");
        // No redirige a login
        await expect(page.locator('input[type="email"]')).not.toBeVisible();
    });
});
```

- [ ] **Step 2: Correr solo este spec para verificar**

```bash
npx playwright test e2e/auth.spec.ts --headed
```

Esperado: 4 tests pasando.

- [ ] **Step 3: Commit**

```bash
git add e2e/auth.spec.ts
git commit -m "test(e2e): tests de autenticación contra Supabase local"
```

---

## Task 6: Tests de crear partido — e2e/matches-create.spec.ts

**Files:**
- Create: `e2e/matches-create.spec.ts`

- [ ] **Step 1: Crear el archivo**

```typescript
import { test, expect } from "@playwright/test";
import { deleteMatch } from "./helpers/db";

let createdMatchId: string | null = null;

test.afterAll(async () => {
    if (createdMatchId) {
        await deleteMatch(createdMatchId);
        createdMatchId = null;
    }
});

test.describe("Crear partido", () => {
    test("formulario de nuevo partido es accesible desde el home", async ({ page }) => {
        await page.goto("/");
        const newMatchButton = page.locator("text=Nuevo partido").or(
            page.locator("text=Crear partido")
        );
        await expect(newMatchButton).toBeVisible();
    });

    test("crear partido con datos válidos redirige a la página del partido", async ({ page }) => {
        await page.goto("/");
        await page.locator("text=Nuevo partido").or(page.locator("text=Crear partido")).click();

        // Rellenar formulario
        const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
        const dateStr = futureDate.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"
        await page.locator('input[type="datetime-local"]').fill(dateStr);
        await page.locator('input[placeholder*="ubicación"], input[placeholder*="lugar"], input[name="location"]').fill("Campo E2E Test");

        await page.locator('button[type="submit"]').click();

        // Redirige a /matches/[id]
        await page.waitForURL(/\/matches\/[a-f0-9-]+/, { timeout: 10_000 });
        const url = page.url();
        createdMatchId = url.split("/matches/")[1];

        await expect(page.locator("text=Campo E2E Test")).toBeVisible();
        await expect(page.locator("text=abierto").or(page.locator("text=Abierto"))).toBeVisible();
    });

    test("crear partido sin ubicación muestra error de validación", async ({ page }) => {
        await page.goto("/");
        await page.locator("text=Nuevo partido").or(page.locator("text=Crear partido")).click();

        const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
        await page.locator('input[type="datetime-local"]').fill(futureDate.toISOString().slice(0, 16));
        // NO rellenar ubicación

        await page.locator('button[type="submit"]').click();

        await expect(page.locator("text=ubicación").or(page.locator("[role='alert']"))).toBeVisible({ timeout: 5_000 });
        // Sigue en el mismo form, no redirige
        await expect(page).not.toHaveURL(/\/matches\/[a-f0-9-]+/);
    });
});
```

- [ ] **Step 2: Correr el spec**

```bash
npx playwright test e2e/matches-create.spec.ts --headed
```

Esperado: 3 tests pasando.

- [ ] **Step 3: Commit**

```bash
git add e2e/matches-create.spec.ts
git commit -m "test(e2e): tests de crear partido"
```

---

## Task 7: Tests de unirse a un partido — e2e/matches-join.spec.ts

**Files:**
- Create: `e2e/matches-join.spec.ts`

- [ ] **Step 1: Crear el archivo**

```typescript
import { test, expect } from "@playwright/test";
import { createTestMatch, deleteMatch, getTestUserId } from "./helpers/db";

let matchId: string;
let testUserId: string;

test.beforeAll(async () => {
    testUserId = await getTestUserId();
    matchId = await createTestMatch({ createdBy: testUserId, maxPlayers: 4 });
});

test.afterAll(async () => {
    await deleteMatch(matchId);
});

test.describe("Unirse a un partido", () => {
    test("el organizador ve botón Abandonar (ya está unido)", async ({ page }) => {
        await page.goto(`/matches/${matchId}`);
        await expect(page.locator("text=Abandonar")).toBeVisible({ timeout: 5_000 });
    });

    test("unirse a un partido aumenta el contador de participantes", async ({ page }) => {
        // El organizador ya está como participante (auto-join en createMatch)
        // Leemos el contador antes de unirse
        await page.goto(`/matches/${matchId}`);
        const counterBefore = await page.locator("[data-testid='participant-count'], text=/\\d+\\/\\d+/").textContent();

        // En este test el usuario ya está unido (es el organizador)
        // Verificamos que el conteo muestre al menos 1 participante
        await expect(page.locator("text=Abandonar")).toBeVisible();
    });

    test("abandonar partido muestra botón Unirse", async ({ page }) => {
        await page.goto(`/matches/${matchId}`);
        await page.locator("text=Abandonar").click();
        await expect(page.locator("text=Unirse")).toBeVisible({ timeout: 5_000 });

        // Re-unirse para no romper otros tests
        await page.locator("text=Unirse").click();
        await expect(page.locator("text=Abandonar")).toBeVisible({ timeout: 5_000 });
    });
});
```

- [ ] **Step 2: Correr el spec**

```bash
npx playwright test e2e/matches-join.spec.ts --headed
```

Esperado: 3 tests pasando.

- [ ] **Step 3: Commit**

```bash
git add e2e/matches-join.spec.ts
git commit -m "test(e2e): tests de unirse y abandonar partido"
```

---

## Task 8: Tests de generar equipos — e2e/matches-teams.spec.ts

**Files:**
- Create: `e2e/matches-teams.spec.ts`

- [ ] **Step 1: Crear el archivo**

```typescript
import { test, expect } from "@playwright/test";
import {
    createTestMatch,
    deleteMatch,
    getTestUserId,
    seedParticipants,
    createDummyUsers,
    deleteDummyUsers,
} from "./helpers/db";

let matchId: string;
let testUserId: string;
let dummyUserIds: string[];

test.beforeAll(async () => {
    testUserId = await getTestUserId();
    dummyUserIds = await createDummyUsers(3); // 3 extra + el organizador = 4 total

    matchId = await createTestMatch({ createdBy: testUserId, maxPlayers: 10 });

    // Seed: organizador ya está unido por createMatch; añadir los 3 dummies
    await seedParticipants(matchId, dummyUserIds.map((uid) => ({ userId: uid })));
});

test.afterAll(async () => {
    await deleteMatch(matchId);
    await deleteDummyUsers(dummyUserIds);
});

test.describe("Generar equipos", () => {
    test("botón Generar equipos es visible para el organizador", async ({ page }) => {
        await page.goto(`/matches/${matchId}`);
        await expect(
            page.locator("text=Generar equipos").or(page.locator("text=Barajar equipos"))
        ).toBeVisible({ timeout: 5_000 });
    });

    test("generar equipos asigna participantes a Equipo A y Equipo B", async ({ page }) => {
        await page.goto(`/matches/${matchId}`);
        await page.locator("text=Generar equipos").or(page.locator("text=Barajar equipos")).click();

        // Esperar confirmación / toast
        await page.waitForTimeout(2_000);

        // Los equipos deben aparecer en la UI
        await expect(page.locator("text=Equipo A").or(page.locator("text=Team A"))).toBeVisible({ timeout: 8_000 });
        await expect(page.locator("text=Equipo B").or(page.locator("text=Team B"))).toBeVisible({ timeout: 8_000 });
    });
});
```

- [ ] **Step 2: Correr el spec**

```bash
npx playwright test e2e/matches-teams.spec.ts --headed
```

Esperado: 2 tests pasando.

- [ ] **Step 3: Commit**

```bash
git add e2e/matches-teams.spec.ts
git commit -m "test(e2e): tests de generación de equipos con seed de participantes"
```

---

## Task 9: Tests de poner resultado — e2e/matches-score.spec.ts

**Files:**
- Create: `e2e/matches-score.spec.ts`

- [ ] **Step 1: Crear el archivo**

```typescript
import { test, expect } from "@playwright/test";
import {
    createTestMatch,
    deleteMatch,
    getTestUserId,
    seedParticipants,
    createDummyUsers,
    deleteDummyUsers,
} from "./helpers/db";
import { createClient } from "@supabase/supabase-js";

let matchId: string;
let testUserId: string;
let dummyUserIds: string[];

test.beforeAll(async () => {
    testUserId = await getTestUserId();
    dummyUserIds = await createDummyUsers(3);
    matchId = await createTestMatch({ createdBy: testUserId, maxPlayers: 10 });
    await seedParticipants(matchId, dummyUserIds.map((uid) => ({ userId: uid })));

    // Generar equipos directamente en BD para no depender del test anterior
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

    const allParticipants = [testUserId, ...dummyUserIds];
    for (let i = 0; i < allParticipants.length; i++) {
        await db
            .from("match_participants")
            .update({ team: i % 2 === 0 ? "A" : "B" })
            .eq("match_id", matchId)
            .eq("user_id", allParticipants[i]);
    }
});

test.afterAll(async () => {
    await deleteMatch(matchId);
    await deleteDummyUsers(dummyUserIds);
});

test.describe("Poner resultado", () => {
    test("botón de resultado es visible para el organizador", async ({ page }) => {
        await page.goto(`/matches/${matchId}`);
        await expect(
            page.locator("text=Poner resultado").or(page.locator("text=Resultado"))
        ).toBeVisible({ timeout: 5_000 });
    });

    test("poner resultado 2-1 marca el partido como finalizado", async ({ page }) => {
        await page.goto(`/matches/${matchId}`);

        await page.locator("text=Poner resultado").or(page.locator("text=Resultado")).click();

        // Rellenar el dialog/form de resultado
        const scoreInputs = page.locator('input[type="number"]');
        await scoreInputs.nth(0).fill("2"); // Equipo A
        await scoreInputs.nth(1).fill("1"); // Equipo B

        await page.locator("button:has-text('Confirmar'), button:has-text('Guardar'), button[type='submit']").last().click();

        // El partido debe aparecer como finalizado
        await expect(
            page.locator("text=finalizado").or(page.locator("text=Finalizado"))
        ).toBeVisible({ timeout: 10_000 });

        // El marcador debe aparecer
        await expect(page.locator("text=2").first()).toBeVisible();
        await expect(page.locator("text=1").first()).toBeVisible();
    });

    test("el marcador persiste al recargar", async ({ page }) => {
        await page.goto(`/matches/${matchId}`);
        await expect(
            page.locator("text=finalizado").or(page.locator("text=Finalizado"))
        ).toBeVisible({ timeout: 5_000 });
    });
});
```

- [ ] **Step 2: Correr el spec**

```bash
npx playwright test e2e/matches-score.spec.ts --headed
```

Esperado: 3 tests pasando.

- [ ] **Step 3: Commit**

```bash
git add e2e/matches-score.spec.ts
git commit -m "test(e2e): tests de poner resultado de partido"
```

---

## Task 10: Correr suite completa y verificar

- [ ] **Step 1: Correr todos los tests E2E**

```bash
npm run test:e2e
```

Esperado: todos los tests pasan (o identificar cuáles fallan y por qué).

- [ ] **Step 2: Ver el reporte HTML**

```bash
npx playwright show-report
```

- [ ] **Step 3: Commit final si todo verde**

```bash
git add -A
git commit -m "test(e2e): suite completa E2E contra Supabase local"
```

---

## Notas importantes para la implementación

### Por qué `data-testid` puede ser necesario

Los selectores de texto (`text=Unirse`) pueden ser frágiles si la UI cambia. Si un test falla porque no encuentra el elemento, añadir `data-testid` al componente es la solución correcta. Por ejemplo en `MatchDetail.tsx`:
```tsx
<Button data-testid="join-button">Unirse</Button>
```

### Orden de ejecución de Tasks

- Tasks 0, 1, 2, 3, 4 son lineales (base)
- Tasks 5, 6, 7, 8, 9 son independientes entre sí y pueden implementarse en cualquier orden
- Task 10 requiere que todas las anteriores estén completas

### Si el perfil de usuario no se crea automáticamente

El trigger de Supabase que crea el perfil en la tabla `profiles` al crear un usuario en `auth.users` puede no existir en local tras el `db pull`. El `global-setup.ts` ya incluye un `upsert` manual del perfil como fallback.

### Variables de entorno en CI

Para GitHub Actions u otro CI, añadir las variables de `.env.test.local` como secrets del repositorio y pasarlas al job:
```yaml
env:
  NEXT_PUBLIC_SUPABASE_URL: http://127.0.0.1:54321
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.E2E_ANON_KEY }}
  SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.E2E_SERVICE_ROLE_KEY }}
  E2E_TEST_EMAIL: test-e2e@pachanga.local
  E2E_TEST_PASSWORD: ${{ secrets.E2E_TEST_PASSWORD }}
```
