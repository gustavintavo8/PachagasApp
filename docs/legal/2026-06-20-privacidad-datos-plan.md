# Plan de Implementación — Privacidad y Protección de Datos (Pachanga)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan checkboxes (`- [ ]`) para seguimiento.

**Goal:** Dotar a Pachanga de una capa de privacidad RGPD/LOPDGDD pragmática: cerrar la fuga de emails, dar a los usuarios borrado y exportación de sus datos, publicar textos legales, capturar consentimiento y edad en el alta, hacer transparente el uso de IA y dejar la documentación interna de cumplimiento.

**Architecture:** Cambios mínimos y aislados sobre el stack existente (Next.js 16 App Router + Supabase). La protección de datos se aplica en la capa que ya es autoridad: RLS/esquema en PostgreSQL para el dato, Server Actions (patrón `ActionResult`) para los derechos del usuario, páginas estáticas Server Components para los textos legales, y constantes compartidas en `src/lib/legal.ts` para identidad/versión. No se introduce banner de cookies ni librerías nuevas.

**Tech Stack:** Next.js 16 (App Router, Server Components, Server Actions), React 19, TypeScript, Supabase (PostgreSQL + Auth + Storage), Playwright (E2E), Tailwind CSS 4.

## Global Constraints

Estos requisitos aplican implícitamente a TODAS las tareas:

- **Responsable del tratamiento:** persona física con un email de contacto. Sin razón social.
- **Sin DPO, sin DPIA formal, sin banner de cookies** (solo cookies estrictamente necesarias).
- **IA (Panenka):** se mantiene Groq con enfoque *informar + minimizar* (no migrar proveedor).
- **Borrado de cuenta = autoservicio**, no por solicitud manual.
- **Server Actions** devuelven `ActionResult<T>` desde `@/lib/types` (`{ success: true, data } | { success: false, error }`).
- **Guard de invitado:** las acciones sensibles deben rechazar usuarios anónimos con `isGuestUser(user)` de `@/lib/permissions`.
- **Rate limiting:** usar `rateLimit(key, maxTokens, intervalMs)` de `@/lib/rate-limit` en acciones de escritura/coste.
- **Idioma UI:** todo el texto de cara al usuario en español.
- **Versión de políticas:** constante `PRIVACY_POLICY_VERSION` (formato `"YYYY-MM-DD"`) en `src/lib/legal.ts`.
- **Edad mínima:** 14 años (LOPDGDD art. 7).
- **Migraciones:** un archivo SQL nuevo por cambio en `supabase/migrations/<timestamp>_*.sql`; aplicar con `npx supabase db push` o el SQL Editor del dashboard.
- **Tests:** Playwright en `e2e/`. La suite por defecto usa el `storageState` autenticado de `e2e/global-setup.ts`. No escribir tests que borren el usuario de fixture.

---

## File Structure

**Se crean:**
- `supabase/migrations/<ts>_drop_redundant_email_and_privacy_columns.sql` — esquema: quitar `profiles.email`, añadir columnas de consentimiento, actualizar trigger.
- `src/lib/legal.ts` — constantes de identidad del responsable, contacto y versión de políticas.
- `src/components/Footer.tsx` — pie con enlaces legales.
- `src/app/privacidad/page.tsx` — Política de Privacidad (incluye sección de cookies).
- `src/app/aviso-legal/page.tsx` — Aviso legal (LSSI).
- `src/app/terminos/page.tsx` — Términos / uso aceptable.
- `src/app/profile/AccountDataPanel.tsx` — UI cliente: exportar + eliminar cuenta.
- `src/app/profile/data-actions.ts` — Server Actions: exportar y eliminar cuenta.
- `docs/legal/RAT.md`, `docs/legal/bases-juridicas.md`, `docs/legal/procedimiento-brechas.md`, `docs/legal/retencion.md`, `docs/legal/etica.md`, `docs/legal/nota-riesgo-fotos.md` — documentación interna.
- `e2e/privacidad.spec.ts` — tests E2E de la capa de privacidad.

**Se modifican:**
- `src/app/auth/callback/route.ts` — dejar de leer/escribir `profiles.email`; sembrar consentimiento en alta OAuth.
- `src/app/login/actions.ts` — capturar consentimiento/edad en `signup`.
- `src/app/login/page.tsx` — checkbox de consentimiento + confirmación de edad en la pestaña Registro.
- `src/app/layout.tsx` — montar `<Footer />`.
- `src/app/profile/page.tsx` — renderizar `<AccountDataPanel />` para no-invitados.
- `src/components/MatchPhotos.tsx` — aviso de derechos de imagen junto a la subida.
- `src/app/asistente/AsistenteChat.tsx` — aviso de IA + procesamiento por terceros.
- `src/app/api/asistente/route.ts` — comentario/guard de minimización (documentar invariante).

---

## Task 1: Bloque 0 — Eliminar el email redundante de `profiles` (P0)

**Por qué:** `profiles.email` es legible por el rol `anon` (policy `profiles_select_public USING (true)`) y duplica el email que ya vive en `auth.users`. La corrección por minimización (RGPD art. 5.1.c / 25) es **eliminar la columna**, no parchear RLS por columnas. Verificado: ninguna lectura de cliente depende de `profiles.email`; solo lo usa `auth/callback` (vía admin client) y el trigger `handle_new_user`.

**Files:**
- Create: `supabase/migrations/<ts>_drop_redundant_email_and_privacy_columns.sql`
- Modify: `src/app/auth/callback/route.ts` (líneas ~20–61, lectura/escritura de `email`)
- Test: `e2e/privacidad.spec.ts` (nuevo, test de no-exposición)

**Interfaces:**
- Produces: la tabla `public.profiles` deja de tener columna `email`. El trigger `handle_new_user` ya no inserta `email`. Las columnas de consentimiento (`accepted_privacy_version text`, `accepted_privacy_at timestamptz`) quedan disponibles para las Tasks 7/8.

- [ ] **Step 1: Escribir el test de no-exposición (falla)**

Crear `e2e/privacidad.spec.ts`:

```ts
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
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `npx playwright test e2e/privacidad.spec.ts --project=chromium -g "no puede seleccionar"`
Expected: FAIL — hoy la consulta de `email` devuelve datos (error es `null`), así que la aserción `expect(error).not.toBeNull()` falla.

- [ ] **Step 3: Crear la migración SQL**

Crear `supabase/migrations/<ts>_drop_redundant_email_and_privacy_columns.sql` (usar timestamp `date +%Y%m%d%H%M%S`):

```sql
-- Bloque 0: minimización — el email vive en auth.users; quitar duplicado público.
-- Bloque 3 (prep): columnas de evidencia de consentimiento.

-- 1) Columnas de consentimiento (usadas por Tasks 7/8)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS accepted_privacy_version text,
  ADD COLUMN IF NOT EXISTS accepted_privacy_at timestamptz;

-- 2) Recrear el trigger de alta SIN insertar email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
begin
  insert into public.profiles (id, username, position, accepted_privacy_version, accepted_privacy_at)
  values (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    'MID',
    new.raw_user_meta_data->>'accepted_privacy_version',
    case
      when new.raw_user_meta_data->>'accepted_privacy_version' is not null then now()
      else null
    end
  );
  return new;
end;
$$;

-- 3) Eliminar la columna redundante (el email sigue en auth.users)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;
```

- [ ] **Step 4: Aplicar la migración**

Run: `npx supabase db push`
(Alternativa: pegar el SQL en el SQL Editor del dashboard de Supabase y ejecutarlo.)
Expected: la migración se aplica sin error; `profiles` ya no tiene `email`.

- [ ] **Step 5: Adaptar `auth/callback/route.ts`**

Abrir `src/app/auth/callback/route.ts`. Eliminar toda lectura/escritura de `profiles.email`:
- En la rama donde existe `existingProfile`, quitar `email: existingProfile.email || email` del `update`.
- Eliminar el bloque `else if (!existingProfile.email && email) { ... update({ email }) ... }` por completo.
- En el `insert` de perfil nuevo (líneas ~39-46), quitar `email: email` y, en su lugar, sembrar el consentimiento del alta OAuth:

```ts
await adminClient.from("profiles").insert({
    id: data.user.id,
    username: googleUsername,
    position: "MID",
    accepted_privacy_version: PRIVACY_POLICY_VERSION,
    accepted_privacy_at: new Date().toISOString(),
});
```

Añadir el import al principio del archivo:

```ts
import { PRIVACY_POLICY_VERSION } from "@/lib/legal";
```

> Nota: `src/lib/legal.ts` se crea en la Task 4. Si se ejecuta esta task antes que la 4, crear primero el archivo con al menos `export const PRIVACY_POLICY_VERSION = "2026-06-20";` (la Task 4 lo completa).

- [ ] **Step 6: Ejecutar el test y verificar que pasa**

Run: `npx playwright test e2e/privacidad.spec.ts --project=chromium -g "email"`
Expected: PASS — ambos tests (no-exposición y campos públicos OK) en verde.

- [ ] **Step 7: Verificar que la app sigue compilando**

Run: `npm run build`
Expected: build sin errores de tipos. (`profile/page.tsx` y demás `select("*")` siguen válidos: devuelven las columnas restantes; `Profile` en `types.ts` nunca tuvo `email`.)

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations src/app/auth/callback/route.ts e2e/privacidad.spec.ts
git commit -m "fix(privacy): eliminar email redundante de profiles (minimizacion RGPD)"
```

---

## Task 2: Bloque 1 — Borrado de cuenta autoservicio (P1)

**Files:**
- Create: `src/app/profile/data-actions.ts`
- Create: `src/app/profile/AccountDataPanel.tsx`
- Modify: `src/app/profile/page.tsx` (renderizar el panel para no-invitados)
- Test: `e2e/privacidad.spec.ts` (añadir tests de UI de borrado)

**Interfaces:**
- Produces: `deleteAccount(): Promise<ActionResult>` (server action) y `<AccountDataPanel />` (client). `deleteAccount` borra `auth.users` del usuario autenticado (cascada limpia el resto), cierra sesión y el cliente redirige a `/login`.
- Consumes: `createAdminClient` (`@/lib/supabase/admin`), `createClient` (`@/lib/supabase/server`), `isGuestUser` (`@/lib/permissions`), `rateLimit` (`@/lib/rate-limit`), `ActionResult` (`@/lib/types`).

- [ ] **Step 1: Escribir el test de la UI de borrado (falla)**

Añadir a `e2e/privacidad.spec.ts` (usa el `storageState` autenticado por defecto):

```ts
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
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx playwright test e2e/privacidad.spec.ts --project=chromium -g "borrado de cuenta"`
Expected: FAIL — el botón "Eliminar mi cuenta" no existe todavía.

- [ ] **Step 3: Crear la server action de borrado**

Crear `src/app/profile/data-actions.ts`:

```ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGuestUser } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import type { ActionResult } from "@/lib/types";

export async function deleteAccount(): Promise<ActionResult> {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) return { success: false, error: "No estás autenticado" };
    if (isGuestUser(user)) return { success: false, error: "Acción no disponible en modo demo" };

    const { allowed } = await rateLimit(`delete-account:${user.id}`, 3, 3_600_000);
    if (!allowed) return { success: false, error: "Demasiados intentos. Espera un momento." };

    // Borra el usuario de auth.users; el ON DELETE CASCADE limpia profiles y todo lo dependiente.
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) return { success: false, error: "No se pudo eliminar la cuenta. Inténtalo de nuevo." };

    await supabase.auth.signOut();
    return { success: true, data: undefined };
}
```

- [ ] **Step 4: Crear el panel cliente (con la exportación ya prevista para Task 3)**

Crear `src/app/profile/AccountDataPanel.tsx`. En esta task implementa solo la parte de borrado; la de exportar se añade en la Task 3 (deja el botón "Descargar mis datos" listo pero su handler lo completa la Task 3):

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { deleteAccount } from "./data-actions";

export function AccountDataPanel() {
    const router = useRouter();
    const [confirming, setConfirming] = useState(false);
    const [confirmText, setConfirmText] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleDelete() {
        setLoading(true);
        setError(null);
        const result = await deleteAccount();
        if (!result.success) {
            setError(result.error);
            setLoading(false);
            return;
        }
        router.push("/login");
    }

    return (
        <Card className="mt-6 border border-border/80 bg-surface">
            <h2 className="text-lg font-semibold text-foreground">Tus datos y privacidad</h2>
            <p className="mt-1 text-sm text-muted">
                Descarga una copia de tus datos o elimina tu cuenta permanentemente.
            </p>

            <div className="mt-4 flex flex-col gap-3">
                {/* El handler de exportación lo conecta la Task 3 */}
                <Button id="export-data-btn" variant="secondary" className="w-full">
                    Descargar mis datos
                </Button>

                {!confirming ? (
                    <Button
                        variant="danger"
                        className="w-full"
                        onClick={() => setConfirming(true)}
                    >
                        Eliminar mi cuenta
                    </Button>
                ) : (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
                        <p className="text-sm text-red-300">
                            Esta acción es irreversible. Escribe <strong>ELIMINAR</strong> para confirmar.
                        </p>
                        <input
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder="ELIMINAR"
                            className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-red-500 focus:outline-none"
                        />
                        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
                        <div className="mt-3 flex gap-2">
                            <Button
                                variant="danger"
                                loading={loading}
                                disabled={confirmText !== "ELIMINAR"}
                                onClick={handleDelete}
                            >
                                Confirmar borrado
                            </Button>
                            <Button variant="secondary" onClick={() => setConfirming(false)}>
                                Cancelar
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
}
```

> Si `Button` no soporta `variant="danger"`, revisar `src/components/ui/Button.tsx` y añadir la variante (rojo) siguiendo el patrón existente; si no soporta `variant="secondary"`, usar la clase/variante equivalente ya presente.

- [ ] **Step 5: Renderizar el panel en el perfil**

Modificar `src/app/profile/page.tsx`: importar y montar el panel para no-invitados, debajo de `<ProfileForm />`:

```tsx
import { AccountDataPanel } from "./AccountDataPanel";
```

```tsx
            <ProfileForm userId={user.id} profile={profile} isGuest={isGuest} />
            {!isGuest && <AccountDataPanel />}
```

- [ ] **Step 6: Ejecutar y verificar que el test pasa**

Run: `npx playwright test e2e/privacidad.spec.ts --project=chromium -g "borrado de cuenta"`
Expected: PASS — el botón aparece, el diálogo gatea hasta escribir "ELIMINAR".

- [ ] **Step 7: Verificación manual del borrado real (con cuenta desechable)**

Crear una cuenta de prueba nueva (no la de fixture), iniciar sesión, ir a `/profile`, eliminarla y confirmar. Verificar en el dashboard de Supabase que el usuario desaparece de `auth.users` y no quedan filas suyas en `profiles`/`match_participants`. Expected: cuenta y filas dependientes eliminadas; redirección a `/login`.

- [ ] **Step 8: Commit**

```bash
git add src/app/profile/data-actions.ts src/app/profile/AccountDataPanel.tsx src/app/profile/page.tsx e2e/privacidad.spec.ts
git commit -m "feat(privacy): borrado de cuenta autoservicio (derecho de supresion)"
```

---

## Task 3: Bloque 1 — Exportación de datos (P1)

**Files:**
- Modify: `src/app/profile/data-actions.ts` (añadir `exportMyData`)
- Modify: `src/app/profile/AccountDataPanel.tsx` (conectar el botón de exportar)
- Test: `e2e/privacidad.spec.ts` (test de descarga)

**Interfaces:**
- Consumes: `deleteAccount` y el panel de la Task 2.
- Produces: `exportMyData(): Promise<ActionResult<string>>` que devuelve un string JSON con todos los datos personales del usuario autenticado.

- [ ] **Step 1: Escribir el test de descarga (falla)**

Añadir a `e2e/privacidad.spec.ts`:

```ts
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
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx playwright test e2e/privacidad.spec.ts --project=chromium -g "exportacion"`
Expected: FAIL — el botón aún no descarga nada (no hay handler).

- [ ] **Step 3: Implementar `exportMyData`**

Añadir a `src/app/profile/data-actions.ts`:

```ts
export async function exportMyData(): Promise<ActionResult<string>> {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) return { success: false, error: "No estás autenticado" };
    if (isGuestUser(user)) return { success: false, error: "Acción no disponible en modo demo" };

    const { allowed } = await rateLimit(`export-data:${user.id}`, 5, 60_000);
    if (!allowed) return { success: false, error: "Demasiadas descargas. Espera un momento." };

    const admin = createAdminClient();
    const uid = user.id;

    const [profile, participations, comments, photos, votes, notifications, rp, fantasy] =
        await Promise.all([
            admin.from("profiles").select("*").eq("id", uid).maybeSingle(),
            admin.from("match_participants").select("*").eq("user_id", uid),
            admin.from("match_comments").select("*").eq("user_id", uid),
            admin.from("match_photos").select("*").eq("user_id", uid),
            admin.from("mvp_votes").select("*").eq("voter_id", uid),
            admin.from("notifications").select("*").eq("user_id", uid),
            admin.from("rp_history").select("*").eq("user_id", uid),
            admin.from("fantasy_teams").select("*").eq("user_id", uid),
        ]);

    const exportObject = {
        exported_at: new Date().toISOString(),
        account: { id: uid, email: user.email },
        profile: profile.data ?? null,
        participations: participations.data ?? [],
        comments: comments.data ?? [],
        photos: photos.data ?? [],
        mvp_votes: votes.data ?? [],
        notifications: notifications.data ?? [],
        rp_history: rp.data ?? [],
        fantasy_teams: fantasy.data ?? [],
    };

    return { success: true, data: JSON.stringify(exportObject, null, 2) };
}
```

- [ ] **Step 4: Conectar el botón de exportar en el panel**

En `src/app/profile/AccountDataPanel.tsx`, importar `exportMyData` y reemplazar el botón placeholder por uno con handler que descarga el JSON vía Blob:

```tsx
import { deleteAccount, exportMyData } from "./data-actions";
```

Añadir dentro del componente:

```tsx
    const [exporting, setExporting] = useState(false);

    async function handleExport() {
        setExporting(true);
        setError(null);
        const result = await exportMyData();
        setExporting(false);
        if (!result.success) {
            setError(result.error);
            return;
        }
        const blob = new Blob([result.data], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "mis-datos-pachanga.json";
        a.click();
        URL.revokeObjectURL(url);
    }
```

Reemplazar el botón placeholder:

```tsx
                <Button variant="secondary" className="w-full" loading={exporting} onClick={handleExport}>
                    Descargar mis datos
                </Button>
```

- [ ] **Step 5: Ejecutar y verificar que pasa**

Run: `npx playwright test e2e/privacidad.spec.ts --project=chromium -g "exportacion"`
Expected: PASS — la descarga ocurre y el archivo termina en `.json`.

- [ ] **Step 6: Commit**

```bash
git add src/app/profile/data-actions.ts src/app/profile/AccountDataPanel.tsx e2e/privacidad.spec.ts
git commit -m "feat(privacy): exportacion de datos personales en JSON (derecho de acceso)"
```

---

## Task 4: Bloque 2 — Config legal compartida + Footer + wiring (P1)

**Files:**
- Create: `src/lib/legal.ts`
- Create: `src/components/Footer.tsx`
- Modify: `src/app/layout.tsx`
- Test: `e2e/privacidad.spec.ts` (enlaces del footer)

**Interfaces:**
- Produces: `LEGAL_CONTACT_EMAIL`, `LEGAL_CONTROLLER_NAME`, `PRIVACY_POLICY_VERSION`, `PRIVACY_LAST_UPDATED` (strings), consumidos por las páginas legales (Tasks 5/6), la captura de consentimiento (Tasks 7/8) y el callback (Task 1). `<Footer />` con enlaces a `/privacidad`, `/aviso-legal`, `/terminos`.

- [ ] **Step 1: Crear la configuración legal**

> **CONFIGURACIÓN REQUERIDA:** los valores de identidad y contacto son datos reales del responsable que el implementador (tú) debe rellenar antes del deploy. No inventarlos.

Crear `src/lib/legal.ts`:

```ts
/**
 * Identidad del responsable del tratamiento y versión de las políticas.
 * RELLENA estos valores con datos reales antes de publicar en producción.
 */
export const LEGAL_CONTROLLER_NAME = "Pachanga (responsable: [TU NOMBRE O ALIAS])";
export const LEGAL_CONTACT_EMAIL = "[TU-EMAIL-DE-CONTACTO@ejemplo.com]";

/** Se incrementa (nueva fecha) cuando cambian Política o Términos → exige re-consentimiento. */
export const PRIVACY_POLICY_VERSION = "2026-06-20";
export const PRIVACY_LAST_UPDATED = "20 de junio de 2026";
```

- [ ] **Step 2: Escribir el test de enlaces del footer (falla)**

Añadir a `e2e/privacidad.spec.ts`:

```ts
test.describe("Bloque 2 — enlaces legales", () => {
    test("el footer enlaza las paginas legales", async ({ page }) => {
        await page.goto("/");
        await expect(page.getByRole("link", { name: "Privacidad" })).toBeVisible();
        await expect(page.getByRole("link", { name: "Aviso legal" })).toBeVisible();
        await expect(page.getByRole("link", { name: "Términos" })).toBeVisible();
    });
});
```

- [ ] **Step 3: Ejecutar y verificar que falla**

Run: `npx playwright test e2e/privacidad.spec.ts --project=chromium -g "enlaces legales"`
Expected: FAIL — el footer aún no existe.

- [ ] **Step 4: Crear el Footer**

Crear `src/components/Footer.tsx`:

```tsx
import Link from "next/link";

export function Footer() {
    return (
        <footer className="border-t border-border bg-surface px-4 py-6 text-center text-xs text-muted">
            <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                <Link href="/privacidad" className="transition-colors hover:text-accent">Privacidad</Link>
                <Link href="/aviso-legal" className="transition-colors hover:text-accent">Aviso legal</Link>
                <Link href="/terminos" className="transition-colors hover:text-accent">Términos</Link>
            </nav>
            <p className="mt-3 text-muted/70">Pachanga · Organiza tus partidos de fútbol</p>
        </footer>
    );
}
```

- [ ] **Step 5: Montar el Footer en el layout**

Modificar `src/app/layout.tsx`: importar `Footer` y colocarlo tras `<main>` (antes de `<BottomNav />`), de forma que el contenido lo empuje al fondo:

```tsx
import { Footer } from "@/components/Footer";
```

```tsx
          <main id="main-content" className="min-h-[calc(100vh-4rem)] pb-20 md:pb-0">{children}</main>
          <Footer />
          <Suspense fallback={null}>
            <BottomNav />
          </Suspense>
```

- [ ] **Step 6: Ejecutar y verificar que pasa**

Run: `npx playwright test e2e/privacidad.spec.ts --project=chromium -g "enlaces legales"`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/legal.ts src/components/Footer.tsx src/app/layout.tsx e2e/privacidad.spec.ts
git commit -m "feat(privacy): config legal compartida y footer con enlaces"
```

---

## Task 5: Bloque 2 — Página de Política de Privacidad (P1)

**Files:**
- Create: `src/app/privacidad/page.tsx`
- Test: `e2e/privacidad.spec.ts` (render de la página)

**Interfaces:**
- Consumes: constantes de `@/lib/legal`.
- Produces: ruta `/privacidad` (Server Component estático) con las secciones de los arts. 13–14 RGPD + sección de cookies.

- [ ] **Step 1: Escribir el test de render (falla)**

Añadir a `e2e/privacidad.spec.ts`:

```ts
test.describe("Bloque 2 — pagina de privacidad", () => {
    test.use({ storageState: { cookies: [], origins: [] } });
    test("la pagina de privacidad carga con sus secciones", async ({ page }) => {
        await page.goto("/privacidad");
        await expect(page.getByRole("heading", { name: "Política de Privacidad" })).toBeVisible();
        await expect(page.getByRole("heading", { name: "Cookies" })).toBeVisible();
        await expect(page.getByText("Groq")).toBeVisible();
    });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx playwright test e2e/privacidad.spec.ts --project=chromium -g "pagina de privacidad"`
Expected: FAIL — la ruta `/privacidad` no existe (404).

- [ ] **Step 3: Crear la página**

Crear `src/app/privacidad/page.tsx` con contenido real (no placeholder; los datos del responsable vienen de las constantes):

```tsx
import type { Metadata } from "next";
import { LEGAL_CONTROLLER_NAME, LEGAL_CONTACT_EMAIL, PRIVACY_LAST_UPDATED } from "@/lib/legal";

export const metadata: Metadata = {
    title: "Política de Privacidad — Pachanga",
    description: "Cómo Pachanga trata tus datos personales.",
};

export default function PrivacidadPage() {
    return (
        <article className="mx-auto max-w-2xl px-4 py-10 text-sm leading-relaxed text-foreground [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:ml-5 [&_ul]:list-disc [&_a]:text-accent">
            <h1 className="text-2xl font-bold">Política de Privacidad</h1>
            <p className="text-muted">Última actualización: {PRIVACY_LAST_UPDATED}</p>

            <h2>1. Responsable del tratamiento</h2>
            <p>{LEGAL_CONTROLLER_NAME}. Contacto para privacidad:{" "}
                <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.</p>

            <h2>2. Qué datos tratamos</h2>
            <ul>
                <li>Datos de cuenta: email y, si usas Google, los datos básicos de ese acceso.</li>
                <li>Perfil: apodo, avatar, posición y nivel.</li>
                <li>Actividad: partidos, goles, valoraciones, votos MVP, estadísticas y ranking.</li>
                <li>Contenido que publicas: mensajes de chat y fotos de los partidos.</li>
                <li>Datos técnicos mínimos de funcionamiento y métricas de rendimiento agregadas.</li>
            </ul>

            <h2>3. Para qué los usamos y con qué base jurídica</h2>
            <ul>
                <li>Prestarte el servicio (cuenta, partidos, ranking, chat): ejecución del servicio que solicitas.</li>
                <li>Asistente de IA y mejoras de funcionamiento: interés legítimo.</li>
                <li>Comunicaciones opcionales y elementos basados en tu elección: consentimiento.</li>
            </ul>

            <h2>4. Quién accede a tus datos</h2>
            <p>Usamos proveedores que tratan datos por nuestra cuenta:</p>
            <ul>
                <li><strong>Supabase</strong> — base de datos, autenticación y almacenamiento.</li>
                <li><strong>Vercel</strong> — alojamiento y métricas de rendimiento (sin cookies).</li>
                <li><strong>Google</strong> — inicio de sesión con Google (si lo usas).</li>
                <li><strong>Groq</strong> — procesa las consultas del asistente de IA «Panenka».</li>
            </ul>

            <h2>5. Transferencias internacionales</h2>
            <p>El asistente de IA se procesa en <strong>Groq</strong>, con servidores en EE. UU.
                Solo se le envían datos de juego (apodos y estadísticas), nunca tu email. Esta
                transferencia se ampara en las garantías ofrecidas por el proveedor.</p>

            <h2>6. Cuánto tiempo los conservamos</h2>
            <p>Mientras tengas la cuenta activa. Si la eliminas, se borran tus datos asociados.
                Algunos registros pueden conservarse el tiempo mínimo exigido por ley.</p>

            <h2>7. Tus derechos</h2>
            <p>Puedes acceder, rectificar, suprimir, limitar u oponerte al tratamiento y a la
                portabilidad de tus datos. Desde tu perfil puedes <strong>descargar tus datos</strong> y
                <strong> eliminar tu cuenta</strong>. Para cualquier otra solicitud escribe a{" "}
                <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>. También puedes
                reclamar ante la Agencia Española de Protección de Datos (<a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer">aepd.es</a>).</p>

            <h2>8. Edad mínima</h2>
            <p>El servicio está dirigido a personas de 14 años o más.</p>

            <h2>Cookies</h2>
            <p>Solo usamos cookies estrictamente necesarias para mantener tu sesión iniciada
                (Supabase Auth). Las métricas de rendimiento (Vercel Speed Insights) no usan
                cookies. Al tratarse de cookies estrictamente necesarias, no requieren tu
                consentimiento previo y por eso no verás un banner.</p>
        </article>
    );
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npx playwright test e2e/privacidad.spec.ts --project=chromium -g "pagina de privacidad"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/privacidad/page.tsx e2e/privacidad.spec.ts
git commit -m "feat(privacy): pagina de Politica de Privacidad (arts. 13-14 RGPD)"
```

---

## Task 6: Bloque 2 — Aviso legal y Términos (P1)

**Files:**
- Create: `src/app/aviso-legal/page.tsx`
- Create: `src/app/terminos/page.tsx`
- Test: `e2e/privacidad.spec.ts` (render de ambas)

**Interfaces:**
- Consumes: constantes de `@/lib/legal`.
- Produces: rutas `/aviso-legal` y `/terminos`.

- [ ] **Step 1: Escribir los tests de render (fallan)**

Añadir a `e2e/privacidad.spec.ts`:

```ts
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
```

- [ ] **Step 2: Ejecutar y verificar que fallan**

Run: `npx playwright test e2e/privacidad.spec.ts --project=chromium -g "aviso legal y terminos"`
Expected: FAIL — ambas rutas dan 404.

- [ ] **Step 3: Crear `/aviso-legal`**

Crear `src/app/aviso-legal/page.tsx`:

```tsx
import type { Metadata } from "next";
import { LEGAL_CONTROLLER_NAME, LEGAL_CONTACT_EMAIL } from "@/lib/legal";

export const metadata: Metadata = {
    title: "Aviso Legal — Pachanga",
    description: "Información legal del prestador del servicio.",
};

export default function AvisoLegalPage() {
    return (
        <article className="mx-auto max-w-2xl px-4 py-10 text-sm leading-relaxed text-foreground [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mb-3 [&_a]:text-accent">
            <h1 className="text-2xl font-bold">Aviso Legal</h1>

            <h2>Titular del servicio</h2>
            <p>{LEGAL_CONTROLLER_NAME}.</p>
            <p>Contacto: <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.</p>

            <h2>Objeto</h2>
            <p>Pachanga es una aplicación para organizar partidos de fútbol entre amigos,
                ofrecida sin ánimo de lucro como proyecto personal.</p>

            <h2>Responsabilidad</h2>
            <p>El contenido publicado por los usuarios (mensajes y fotos) es responsabilidad de
                quien lo publica. Para retirar contenido que te afecte, escribe al contacto indicado.</p>

            <h2>Propiedad intelectual</h2>
            <p>El código y la marca del proyecto pertenecen a su autor. El contenido subido por
                cada usuario sigue siendo de quien lo aporta.</p>
        </article>
    );
}
```

- [ ] **Step 4: Crear `/terminos`**

Crear `src/app/terminos/page.tsx`:

```tsx
import type { Metadata } from "next";
import { LEGAL_CONTACT_EMAIL } from "@/lib/legal";

export const metadata: Metadata = {
    title: "Términos de Uso — Pachanga",
    description: "Condiciones de uso de Pachanga.",
};

export default function TerminosPage() {
    return (
        <article className="mx-auto max-w-2xl px-4 py-10 text-sm leading-relaxed text-foreground [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:ml-5 [&_ul]:list-disc [&_a]:text-accent">
            <h1 className="text-2xl font-bold">Términos de Uso</h1>

            <h2>1. Uso del servicio</h2>
            <p>Debes tener al menos 14 años para usar Pachanga. Te comprometes a usar la app de
                forma respetuosa con el resto de jugadores.</p>

            <h2>2. Contenido que publicas</h2>
            <ul>
                <li>Eres responsable de los mensajes y fotos que subes.</li>
                <li>No publiques contenido ofensivo, ilegal o que vulnere derechos de terceros.</li>
            </ul>

            <h2>3. Fotos y derechos de imagen</h2>
            <p>Solo debes subir fotos sobre las que tengas derechos y con el consentimiento de las
                personas que aparezcan en ellas. Si una foto te afecta y quieres retirarla, escribe a{" "}
                <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a> y la eliminaremos.</p>

            <h2>4. Asistente de IA</h2>
            <p>«Panenka» es un asistente automático: sus respuestas pueden contener errores y no
                deben tomarse como asesoramiento. Consulta la <a href="/privacidad">Política de Privacidad</a>{" "}
                para saber cómo se procesan tus consultas.</p>

            <h2>5. Cambios</h2>
            <p>Podemos actualizar estos términos. Si el cambio es relevante, te lo indicaremos en la app.</p>
        </article>
    );
}
```

- [ ] **Step 5: Ejecutar y verificar que pasan**

Run: `npx playwright test e2e/privacidad.spec.ts --project=chromium -g "aviso legal y terminos"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/aviso-legal/page.tsx src/app/terminos/page.tsx e2e/privacidad.spec.ts
git commit -m "feat(privacy): paginas de aviso legal y terminos de uso"
```

---

## Task 7: Bloque 3 — Capturar consentimiento y edad en `signup` (backend) (P2)

**Files:**
- Modify: `src/app/login/actions.ts` (función `signup`)
- Test: verificación de comportamiento (el flujo completo de email requiere confirmación; se valida la lógica de error de edad)

**Interfaces:**
- Consumes: `PRIVACY_POLICY_VERSION` (`@/lib/legal`); columnas `accepted_privacy_version`/`accepted_privacy_at` (Task 1).
- Produces: `signup` rechaza el alta si no se aceptan los términos o no se confirma edad ≥ 14, y propaga la evidencia de consentimiento a `auth.users.raw_user_meta_data` para que el trigger la persista.

- [ ] **Step 1: Modificar `signup` para leer y validar consentimiento**

En `src/app/login/actions.ts`, dentro de `signup`, tras leer email/password, leer los campos nuevos del formulario y validarlos antes del `signUp`. Añadir el import:

```ts
import { PRIVACY_POLICY_VERSION } from "@/lib/legal";
```

Añadir validación (después de la comprobación de longitud de password):

```ts
    const acceptedTerms = formData.get("accept_terms") === "on";
    const confirmedAge = formData.get("confirm_age") === "on";

    if (!acceptedTerms) {
        return { success: false, error: "Debes aceptar la Política de Privacidad y los Términos." };
    }
    if (!confirmedAge) {
        return { success: false, error: "Debes confirmar que tienes 14 años o más." };
    }
```

Y pasar la evidencia en las opciones del `signUp` (ampliar el objeto `options.data`):

```ts
    const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            emailRedirectTo: `${origin}/auth/callback`,
            data: {
                accepted_privacy_version: PRIVACY_POLICY_VERSION,
            },
        },
    });
```

- [ ] **Step 2: Verificar la validación de edad (manual/rápida)**

Run: `npm run build`
Expected: compila. Verificación funcional: llamar al flujo desde la UI (Task 8) y comprobar que sin marcar las casillas aparece el error. El trigger `handle_new_user` (Task 1) ya copia `accepted_privacy_version` a `profiles` al confirmarse el alta.

- [ ] **Step 3: Commit**

```bash
git add src/app/login/actions.ts
git commit -m "feat(privacy): validar y registrar consentimiento y edad en el alta"
```

---

## Task 8: Bloque 3 — UI de consentimiento y edad en Registro (P2)

**Files:**
- Modify: `src/app/login/page.tsx`
- Test: `e2e/privacidad.spec.ts` (gating del registro)

**Interfaces:**
- Consumes: `signup` (Task 7).
- Produces: en la pestaña «Registrarse», dos checkboxes (`name="accept_terms"`, `name="confirm_age"`) requeridos; el botón de registro y el de Google quedan deshabilitados hasta marcarlos.

- [ ] **Step 1: Escribir el test de gating (falla)**

Añadir a `e2e/privacidad.spec.ts`:

```ts
test.describe("Bloque 3 — consentimiento en el registro", () => {
    test.use({ storageState: { cookies: [], origins: [] } });
    test("el registro exige aceptar terminos y edad", async ({ page }) => {
        await page.goto("/login");
        await page.getByRole("button", { name: "Registrarse" }).click();
        const submit = page.getByRole("button", { name: "Crear Cuenta" });
        await expect(submit).toBeDisabled();
        await page.getByLabel(/acepto la Política de Privacidad/i).check();
        await page.getByLabel(/14 años/i).check();
        await expect(submit).toBeEnabled();
    });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx playwright test e2e/privacidad.spec.ts --project=chromium -g "consentimiento en el registro"`
Expected: FAIL — los checkboxes no existen y el botón no está gateado.

- [ ] **Step 3: Añadir estado de consentimiento**

En `src/app/login/page.tsx`, añadir estado y resetearlo al cambiar de pestaña:

```tsx
    const [consent, setConsent] = useState(false);
    const [ageOk, setAgeOk] = useState(false);
```

El gate solo aplica en modo registro: `const signupBlocked = isSignUp && (!consent || !ageOk);`

- [ ] **Step 4: Renderizar los checkboxes (solo en registro)**

Dentro del `<form onSubmit={handleSubmit}>`, antes del botón submit, añadir:

```tsx
                        {isSignUp && (
                            <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-3 text-sm text-zinc-300">
                                <label className="flex items-start gap-2">
                                    <input
                                        type="checkbox"
                                        name="accept_terms"
                                        checked={consent}
                                        onChange={(e) => setConsent(e.target.checked)}
                                        className="mt-0.5"
                                    />
                                    <span>
                                        He leído y acepto la{" "}
                                        <a href="/privacidad" target="_blank" className="text-accent underline">Política de Privacidad</a>{" "}
                                        y los{" "}
                                        <a href="/terminos" target="_blank" className="text-accent underline">Términos</a>.
                                    </span>
                                </label>
                                <label className="flex items-start gap-2">
                                    <input
                                        type="checkbox"
                                        name="confirm_age"
                                        checked={ageOk}
                                        onChange={(e) => setAgeOk(e.target.checked)}
                                        className="mt-0.5"
                                    />
                                    <span>Confirmo que tengo 14 años o más.</span>
                                </label>
                            </div>
                        )}
```

- [ ] **Step 5: Gatear el botón de submit y el de Google**

En el botón submit, ampliar el `disabled`:

```tsx
                            disabled={loading || signupBlocked}
```

En el botón de Google (`handleOAuth("google")`), gatear también cuando se está registrando:

```tsx
                            disabled={!!oauthLoading || signupBlocked}
```

Resetear los checkboxes en los `onClick` que cambian de pestaña (añadir junto a `setError(null)`):

```tsx
                            setConsent(false);
                            setAgeOk(false);
```

- [ ] **Step 6: Ejecutar y verificar que pasa**

Run: `npx playwright test e2e/privacidad.spec.ts --project=chromium -g "consentimiento en el registro"`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/login/page.tsx e2e/privacidad.spec.ts
git commit -m "feat(privacy): checkbox de consentimiento y confirmacion de edad en el alta"
```

---

## Task 9: Bloque 3 — Aviso de derechos de imagen en la subida de fotos (P2)

**Files:**
- Modify: `src/components/MatchPhotos.tsx`
- Test: `e2e/privacidad.spec.ts` (verificación ligera — opcional según fixture)

**Interfaces:**
- Produces: texto visible bajo el botón "Subir Foto" recordando los derechos de imagen.

- [ ] **Step 1: Añadir el aviso**

En `src/components/MatchPhotos.tsx`, dentro del bloque `{!isGuest && (...)}` de la subida (tras el `<button>` de "Subir Foto", antes de cerrar el `</div>` contenedor en la línea ~159), añadir:

```tsx
                    <p className="mt-2 text-center text-[11px] text-muted/70">
                        Sube solo fotos sobre las que tengas derechos y con permiso de quienes aparecen.
                    </p>
```

- [ ] **Step 2: Verificar render**

Run: `npm run build`
Expected: compila sin errores. Verificación visual: en un partido, bajo el botón de subir foto aparece el aviso.

- [ ] **Step 3: Commit**

```bash
git add src/components/MatchPhotos.tsx
git commit -m "feat(privacy): aviso de derechos de imagen al subir fotos"
```

---

## Task 10: Bloque 4 — Transparencia de IA + invariante de minimización (P2)

**Files:**
- Modify: `src/app/asistente/AsistenteChat.tsx`
- Modify: `src/app/api/asistente/route.ts` (comentario de invariante)
- Test: `e2e/privacidad.spec.ts` (aviso de IA visible)

**Interfaces:**
- Produces: aviso visible en el chat de que Panenka es IA y procesa en un tercero (Groq). Documentación del invariante de minimización en la API.

**Nota:** la minimización de datos a Groq **ya se cumple** — `src/lib/ai/tools.ts` selecciona solo `username`/stats, nunca `email`. Esta task lo blinda con un comentario-invariante y añade la transparencia.

- [ ] **Step 1: Escribir el test del aviso de IA (falla)**

Añadir a `e2e/privacidad.spec.ts` (usa sesión autenticada por defecto):

```ts
test.describe("Bloque 4 — transparencia de IA", () => {
    test("el chat avisa de que Panenka es IA y procesa en un tercero", async ({ page }) => {
        await page.goto("/asistente");
        await expect(page.getByText(/asistente de IA/i)).toBeVisible();
        await expect(page.getByText(/Groq/i)).toBeVisible();
    });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx playwright test e2e/privacidad.spec.ts --project=chromium -g "transparencia de IA"`
Expected: FAIL — el aviso aún no existe.

- [ ] **Step 3: Añadir el aviso en el chat**

En `src/app/asistente/AsistenteChat.tsx`, dentro del bloque de bienvenida `{messages.length === 0 && (...)}`, tras el `<div className="grid w-full grid-cols-2 gap-2">...</div>`, añadir un aviso (y/o ponerlo siempre visible bajo el header). Versión en la pantalla de bienvenida:

```tsx
                        <p className="max-w-xs text-[11px] leading-snug text-muted/70">
                            Panenka es un asistente de IA: puede equivocarse. Tus consultas se
                            procesan en un proveedor externo (Groq) y solo se le envían datos de
                            juego, nunca tu email.
                        </p>
```

- [ ] **Step 4: Documentar el invariante de minimización en la API**

En `src/app/api/asistente/route.ts`, justo encima de `const result = streamText({`, añadir el comentario:

```ts
    // INVARIANTE DE PRIVACIDAD: las tools (buildTools) solo deben exponer al modelo
    // datos de juego (username, stats). NUNCA email ni PII de auth. Ver src/lib/ai/tools.ts.
```

- [ ] **Step 5: Ejecutar y verificar que pasa**

Run: `npx playwright test e2e/privacidad.spec.ts --project=chromium -g "transparencia de IA"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/asistente/AsistenteChat.tsx src/app/api/asistente/route.ts e2e/privacidad.spec.ts
git commit -m "feat(privacy): aviso de IA en Panenka e invariante de minimizacion"
```

---

## Task 11: Bloque 5 — Documentación interna de cumplimiento (P3)

**Files:**
- Create: `docs/legal/RAT.md`, `docs/legal/bases-juridicas.md`, `docs/legal/procedimiento-brechas.md`, `docs/legal/retencion.md`, `docs/legal/etica.md`, `docs/legal/nota-riesgo-fotos.md`

**Interfaces:** documentos markdown; sin código. Deben ser coherentes con la `/privacidad` (Task 5) y con el esquema tras la Task 1.

- [ ] **Step 1: Crear el RAT simplificado**

Crear `docs/legal/RAT.md` con una tabla por tratamiento (cuenta, perfil/actividad, chat, fotos, asistente IA, notificaciones), cada uno con: finalidad, base jurídica, categorías de datos, destinatarios, transferencias, conservación. Contenido inicial:

```markdown
# Registro de Actividades de Tratamiento (RAT) — Pachanga (simplificado, art. 30 RGPD)

Responsable: ver `src/lib/legal.ts` (LEGAL_CONTROLLER_NAME / LEGAL_CONTACT_EMAIL).

| Tratamiento | Finalidad | Base jurídica | Categorías de datos | Destinatarios | Transferencias | Conservación |
|---|---|---|---|---|---|---|
| Cuenta y autenticación | Crear y dar acceso a la cuenta | Ejecución del servicio | Email, credenciales (auth.users) | Supabase | — | Hasta baja |
| Perfil y actividad | Ranking, stats, partidos | Ejecución del servicio | Apodo, avatar, posición, ELO, goles | Supabase, Vercel | — | Hasta baja |
| Chat de partido | Comunicación entre jugadores | Interés legítimo | Mensajes de texto | Supabase | — | Hasta baja / retirada |
| Fotos de partido | Galería social | Interés legítimo / consentimiento | Imágenes de personas | Supabase Storage | — | Hasta baja / takedown |
| Asistente IA (Panenka) | Responder consultas de juego | Interés legítimo | Apodo, stats (sin email) | Groq | EE. UU. (garantías del proveedor) | No persistente |
| Notificaciones | Avisar de eventos de la app | Ejecución del servicio | Mensajes dirigidos | Supabase | — | Limpieza periódica |
```

- [ ] **Step 2: Crear el mapa de bases jurídicas**

Crear `docs/legal/bases-juridicas.md`: para cada finalidad, base del art. 6 RGPD elegida y justificación de una línea (ejecución del servicio, interés legítimo, consentimiento). Incluir la ponderación de interés legítimo del chat/fotos/IA.

- [ ] **Step 3: Crear el mini-procedimiento de brechas**

Crear `docs/legal/procedimiento-brechas.md`: pasos ante una brecha (detectar, contener, evaluar riesgo, **notificar a la AEPD en 72 h si hay riesgo**, comunicar a afectados si alto riesgo, registrar), con el contacto de la AEPD.

- [ ] **Step 4: Crear la nota de retención**

Crear `docs/legal/retencion.md`: criterios de conservación y limpieza (notificaciones antiguas, cuentas anónimas/invitadas caducadas, cuentas inactivas), coherentes con la sección 6 de `/privacidad`.

- [ ] **Step 5: Crear la nota de ética**

Crear `docs/legal/etica.md`: breve declaración alineada con el Código Ético y Deontológico CCII (minimización, transparencia, no discriminación del balanceo/ELO, uso responsable de IA).

- [ ] **Step 6: Crear la nota de riesgo de fotos**

Crear `docs/legal/nota-riesgo-fotos.md`: análisis ligero (en lugar de DPIA) del riesgo de las fotos de personas y sus mitigaciones (aviso en subida, términos, takedown, bucket, posibilidad de borrado).

- [ ] **Step 7: Commit**

```bash
git add docs/legal/RAT.md docs/legal/bases-juridicas.md docs/legal/procedimiento-brechas.md docs/legal/retencion.md docs/legal/etica.md docs/legal/nota-riesgo-fotos.md
git commit -m "docs(privacy): documentacion interna de cumplimiento (RAT, brechas, etica)"
```

---

## Verificación final (tras todas las tasks)

- [ ] Ejecutar toda la suite de privacidad: `npx playwright test e2e/privacidad.spec.ts --project=chromium` → todos PASS.
- [ ] `npm run build` sin errores.
- [ ] Rellenados los valores reales en `src/lib/legal.ts` (`LEGAL_CONTROLLER_NAME`, `LEGAL_CONTACT_EMAIL`).
- [ ] Revisión manual: alta nueva exige consentimiento+edad; perfil permite exportar y borrar; footer enlaza las tres páginas legales; el chat muestra el aviso de IA.

---

## Self-Review (cobertura del spec)

- **Bloque 0 (fuga email)** → Task 1. ✔
- **Bloque 1 (supresión + acceso/portabilidad + rectificación + canal)** → Tasks 2, 3; rectificación ya existe (documentada en `/privacidad` §7, Task 5); canal de contacto/AEPD en `/privacidad` §7. ✔
- **Bloque 2 (privacidad, aviso legal, términos, cookies, footer)** → Tasks 4, 5, 6. ✔
- **Bloque 3 (consentimiento, edad 14, aviso fotos)** → Tasks 7, 8, 9. ✔
- **Bloque 4 (minimización IA, aviso IA, transferencia)** → Task 10 (minimización ya existente, blindada) + transferencia documentada en `/privacidad` §5 y RAT. ✔
- **Bloque 5 (RAT, bases, brechas, retención, ética, riesgo)** → Task 11. ✔

Sin placeholders de plan (los `[TU ...]` en `src/lib/legal.ts` son configuración real obligatoria, marcada como tal en Task 4). Tipos/firmas consistentes: `deleteAccount`/`exportMyData` (`ActionResult`), `AccountDataPanel`, `PRIVACY_POLICY_VERSION`, columnas `accepted_privacy_version`/`accepted_privacy_at` usadas igual en Tasks 1/7.
