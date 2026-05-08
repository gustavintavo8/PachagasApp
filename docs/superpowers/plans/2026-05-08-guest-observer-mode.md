# Modo Observador Invitado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir un botón "Ver demo como invitado" en el login que crea una sesión anónima de Supabase, permitiendo navegar toda la app y usar Panenka sin poder realizar escrituras.

**Architecture:** Supabase Anonymous Sign-in emite un JWT con `is_anonymous: true`. El middleware ya valida la sesión sin cambios. Los server actions rechazan usuarios anónimos con un guard explícito. Los server page components calculan `isGuest` y lo pasan como prop `boolean` a los client components que ocultan botones de acción.

**Tech Stack:** Next.js 15 App Router, Supabase SSR, TypeScript, Playwright (E2E)

---

## File Map

| Archivo | Acción |
|---------|--------|
| `src/app/login/actions.ts` | Modify — añadir `loginAsGuest()` |
| `src/app/login/page.tsx` | Modify — añadir botón demo |
| `src/lib/permissions.ts` | Modify — añadir `isGuestUser()` helper |
| `src/app/matches/actions.ts` | Modify — guards en `createMatch`, `joinMatch`, `leaveMatch`, `voteForMvp` |
| `src/app/profile/actions.ts` | Modify — guards en `updateProfile`, `updateAvatar` |
| `src/app/matches/new/NewMatchForm.tsx` | Create — extraer client component del form |
| `src/app/matches/new/page.tsx` | Modify — convertir a server component con redirect |
| `src/app/matches/[id]/page.tsx` | Modify — calcular y pasar `isGuest` |
| `src/app/matches/[id]/MatchDetail.tsx` | Modify — aceptar `isGuest`, ocultar Join/Leave, pasar a hijos |
| `src/components/MatchChat.tsx` | Modify — aceptar `isGuest`, ocultar input |
| `src/components/MatchPhotos.tsx` | Modify — aceptar `isGuest`, ocultar upload |
| `src/components/MvpVoting.tsx` | Modify — aceptar `isGuest`, ocultar botones de voto |
| `src/app/profile/page.tsx` | Modify — calcular y pasar `isGuest` |
| `src/app/profile/ProfileForm.tsx` | Modify — aceptar `isGuest`, ocultar formulario |
| `e2e/guest.spec.ts` | Create — E2E del flujo de invitado |

---

### Task 1: `loginAsGuest` action + botón en login

**Files:**
- Modify: `src/app/login/actions.ts`
- Modify: `src/app/login/page.tsx`

- [ ] **Step 1: Añadir `loginAsGuest` en `actions.ts`**

Añadir al final del archivo `src/app/login/actions.ts`:

```ts
export async function loginAsGuest(): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInAnonymously();
    if (error) throw new Error(error.message);
    redirect("/");
}
```

También añadir `loginAsGuest` al import de la función `login` en `page.tsx` — se hace en el paso siguiente.

- [ ] **Step 2: Añadir el botón en `login/page.tsx`**

Añadir `loginAsGuest` al import al inicio:

```ts
import { login, signup, signInWithOAuth, loginAsGuest } from "./actions";
```

Añadir estado de loading para el botón demo, justo después de `const [oauthLoading, setOauthLoading] = useState<string | null>(null);`:

```ts
const [guestLoading, setGuestLoading] = useState(false);
```

Añadir la función handler justo antes del `return`:

```ts
async function handleGuestLogin() {
    setGuestLoading(true);
    try {
        await loginAsGuest();
    } catch {
        setError("Error al entrar en modo demo");
        setGuestLoading(false);
    }
}
```

Añadir el botón al final del JSX, después del div de cierre del card (`</div>`) que contiene el formulario y antes del cierre del `w-full max-w-md`:

```tsx
{/* Guest Demo */}
<div className="mt-4">
    <div className="relative mb-4">
        <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-800" />
        </div>
        <div className="relative flex justify-center text-xs">
            <span className="bg-zinc-950 px-3 text-zinc-600">o sin cuenta</span>
        </div>
    </div>
    <button
        type="button"
        onClick={handleGuestLogin}
        disabled={guestLoading || loading || !!oauthLoading}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-transparent px-4 py-3 text-sm font-medium text-zinc-400 transition-all hover:border-zinc-500 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
    >
        {guestLoading ? <Spinner /> : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
        )}
        {guestLoading ? "Entrando..." : "Ver demo como invitado"}
    </button>
</div>
```

- [ ] **Step 3: Verificar que compila**

```bash
npm run build
```

Esperado: sin errores de TypeScript ni de compilación.

- [ ] **Step 4: Probar manualmente en dev**

```bash
npm run dev
```

Ir a `http://localhost:3000/login`. Verificar que aparece el botón "Ver demo como invitado". Clicar — debe redirigir al home `/`.

- [ ] **Step 5: Commit**

```bash
git add src/app/login/actions.ts src/app/login/page.tsx
git commit -m "feat: añadir botón 'Ver demo como invitado' con anonymous auth"
```

---

### Task 2: Helper `isGuestUser` + guards en server actions

**Files:**
- Modify: `src/lib/permissions.ts`
- Modify: `src/app/matches/actions.ts`
- Modify: `src/app/profile/actions.ts`

- [ ] **Step 1: Añadir helper `isGuestUser` en `permissions.ts`**

Añadir al final del archivo `src/lib/permissions.ts`:

```ts
/**
 * Returns true if the user is an anonymous (guest) session.
 * Anonymous users have is_anonymous: true in their JWT.
 */
export function isGuestUser(user: { is_anonymous?: boolean } | null): boolean {
    return user?.is_anonymous === true;
}
```

- [ ] **Step 2: Añadir guard en `matches/actions.ts` — `createMatch`**

En `src/app/matches/actions.ts`, añadir `isGuestUser` al import de `@/lib/permissions`:

```ts
import { isAdmin, isGuestUser } from "@/lib/permissions";
```

En la función `createMatch`, inmediatamente después del check `if (!user) return { success: false, error: "No autenticado" };`, añadir:

```ts
if (isGuestUser(user)) return { success: false, error: "Esta acción no está disponible en modo demo" };
```

- [ ] **Step 3: Añadir guard en `matches/actions.ts` — `joinMatch`, `leaveMatch`, `voteForMvp`**

En `joinMatch`, después de `if (!user) return { success: false, error: "No autenticado" };`:

```ts
if (isGuestUser(user)) return { success: false, error: "Esta acción no está disponible en modo demo" };
```

En `leaveMatch`, después de `if (!user) return { success: false, error: "No autenticado" };`:

```ts
if (isGuestUser(user)) return { success: false, error: "Esta acción no está disponible en modo demo" };
```

En `voteForMvp`, después de `if (!user) return { success: false, error: "No autenticado" };`:

```ts
if (isGuestUser(user)) return { success: false, error: "Esta acción no está disponible en modo demo" };
```

- [ ] **Step 4: Añadir guards en `profile/actions.ts`**

En `src/app/profile/actions.ts`, añadir import:

```ts
import { isGuestUser } from "@/lib/permissions";
```

En `updateProfile`, después de `if (authError || !user) { return { success: false, error: 'No estás autenticado' } }`:

```ts
if (isGuestUser(user)) return { success: false, error: "Esta acción no está disponible en modo demo" };
```

En `updateAvatar`, después de `if (!user) { return { success: false, error: "No autenticado" }; }`:

```ts
if (isGuestUser(user)) return { success: false, error: "Esta acción no está disponible en modo demo" };
```

- [ ] **Step 5: Verificar que compila**

```bash
npm run build
```

Esperado: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/lib/permissions.ts src/app/matches/actions.ts src/app/profile/actions.ts
git commit -m "feat: guards en server actions para usuarios anónimos"
```

---

### Task 3: Redirigir invitados en `/matches/new`

La página `matches/new/page.tsx` es actualmente un client component porque usa `useSearchParams()`. Hay que extraer el form a un archivo separado y convertir `page.tsx` en server component.

**Files:**
- Create: `src/app/matches/new/NewMatchForm.tsx`
- Modify: `src/app/matches/new/page.tsx`

- [ ] **Step 1: Crear `NewMatchForm.tsx`**

Crear `src/app/matches/new/NewMatchForm.tsx` con el contenido del form actual (todo excepto el export default de la página):

```tsx
"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createMatch } from "../actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { CalendarDays, MapPin, Users } from "lucide-react";

function NewMatchSkeleton() {
    return (
        <div className="mx-auto max-w-lg px-4 py-8">
            <div className="skeleton mb-2 h-8 w-48 rounded-lg" />
            <div className="skeleton mb-8 h-5 w-64 rounded-lg" />
            <div className="skeleton h-96 rounded-2xl" />
        </div>
    );
}

function NewMatchFormInner() {
    const searchParams = useSearchParams();
    const prefillLocation = searchParams.get("location") ?? "";
    const prefillMaxPlayers = searchParams.get("max_players") ?? "10";

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const formData = new FormData(e.currentTarget);
        const localDate = formData.get("date") as string;
        if (localDate) {
            formData.set("date", new Date(localDate).toISOString());
        }

        const result = await createMatch(formData);

        if (!result.success) {
            setError(result.error);
            setLoading(false);
        }
    }

    return (
        <div className="mx-auto max-w-lg px-4 py-8">
            <h1 className="mb-2 text-2xl font-bold text-foreground">
                Crear Partido
            </h1>
            <p className="mb-8 text-muted">Organiza la próxima pachanga</p>

            <Card>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label
                            htmlFor="date"
                            className="flex items-center gap-2 text-sm font-medium text-zinc-300"
                        >
                            <CalendarDays size={16} />
                            Fecha y Hora
                        </label>
                        <input
                            id="date"
                            name="date"
                            type="datetime-local"
                            required
                            className="block w-full min-w-0 appearance-none rounded-xl border border-border bg-zinc-800 px-2 py-3 sm:px-4 text-base text-foreground transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent [color-scheme:dark]"
                        />
                    </div>

                    <div className="space-y-2">
                        <label
                            htmlFor="location"
                            className="flex items-center gap-2 text-sm font-medium text-zinc-300"
                        >
                            <MapPin size={16} />
                            Ubicación
                        </label>
                        <Input
                            id="location"
                            name="location"
                            placeholder="ej. Campo Municipal, Pista 3"
                            defaultValue={prefillLocation}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label
                            htmlFor="max_players"
                            className="flex items-center gap-2 text-sm font-medium text-zinc-300"
                        >
                            <Users size={16} />
                            Máximo de Jugadores
                        </label>
                        <Input
                            id="max_players"
                            name="max_players"
                            type="number"
                            min="4"
                            max="30"
                            defaultValue={prefillMaxPlayers}
                            required
                        />
                    </div>

                    {error && (
                        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                            {error}
                        </div>
                    )}

                    <Button type="submit" loading={loading} size="lg" className="w-full">
                        Crear Partido
                    </Button>
                </form>
            </Card>
        </div>
    );
}

export function NewMatchForm() {
    return (
        <Suspense fallback={<NewMatchSkeleton />}>
            <NewMatchFormInner />
        </Suspense>
    );
}
```

- [ ] **Step 2: Reemplazar `matches/new/page.tsx`**

Reemplazar todo el contenido de `src/app/matches/new/page.tsx` con:

```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NewMatchForm } from "./NewMatchForm";

export default async function NewMatchPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");
    if (user.is_anonymous) redirect("/matches");

    return <NewMatchForm />;
}
```

- [ ] **Step 3: Verificar build**

```bash
npm run build
```

Esperado: sin errores. El split en dos archivos no debe afectar el comportamiento para usuarios normales.

- [ ] **Step 4: Commit**

```bash
git add src/app/matches/new/NewMatchForm.tsx src/app/matches/new/page.tsx
git commit -m "feat: redirigir invitados anónimos fuera de /matches/new"
```

---

### Task 4: Propagar `isGuest` por el árbol de componentes de partidos

Esta tarea cubre todo el árbol `page → MatchDetail → MatchChat/Photos/MvpVoting` de una vez para evitar builds con errores de TypeScript intermedios.

**Files:**
- Modify: `src/app/matches/[id]/page.tsx`
- Modify: `src/app/matches/[id]/MatchDetail.tsx`
- Modify: `src/components/MatchChat.tsx`
- Modify: `src/components/MatchPhotos.tsx`
- Modify: `src/components/MvpVoting.tsx`

- [ ] **Step 1: Calcular `isGuest` en `matches/[id]/page.tsx`**

En `src/app/matches/[id]/page.tsx`, después de `if (!user) redirect("/login");`, añadir:

```ts
const isGuest = user.is_anonymous === true;
```

Modificar el componente `<MatchDetail ...>` para añadir la prop:

```tsx
<MatchDetail
    match={match}
    participants={participants || []}
    currentUserId={user.id}
    organizerName={organizerProfile?.username || "Desconocido"}
    organizerAvatarUrl={organizerProfile?.avatar_url || null}
    currentUserProfile={{
        username: currentProfile?.username ?? null,
        avatar_url: currentProfile?.avatar_url ?? null,
    }}
    isAdmin={userIsAdmin}
    adminUserIds={adminUserIds}
    isGuest={isGuest}
/>
```

- [ ] **Step 2: Añadir `isGuest` a `MatchDetailProps` y ocultar Join/Leave**

En `src/app/matches/[id]/MatchDetail.tsx`, añadir `isGuest: boolean` a la interfaz:

```ts
interface MatchDetailProps {
    match: Match;
    participants: Participant[];
    currentUserId: string;
    organizerName: string;
    organizerAvatarUrl: string | null;
    currentUserProfile: {
        username: string | null;
        avatar_url: string | null;
    };
    isAdmin: boolean;
    adminUserIds: string[];
    isGuest: boolean;
}
```

Añadir `isGuest` al destructuring de la función `MatchDetail`.

Buscar los botones "Unirse" y "Abandonar" para añadir la condición `!isGuest`:

```bash
grep -n "joinMatch\|leaveMatch\|Unirse\|Abandonar\|hasJoined" src/app/matches/[id]/MatchDetail.tsx
```

El patrón a buscar y modificar será similar a esto (el código exacto puede diferir ligeramente):

```tsx
{/* ANTES */}
{!hasJoined && match.status === "open" && (
    <Button onClick={() => handleAction(() => joinMatch(match.id), "join")}>
        Unirse
    </Button>
)}
{hasJoined && match.status !== "finished" && (
    <Button onClick={() => handleAction(() => leaveMatch(match.id), "leave")}>
        Abandonar
    </Button>
)}

{/* DESPUÉS */}
{!hasJoined && match.status === "open" && !isGuest && (
    <Button onClick={() => handleAction(() => joinMatch(match.id), "join")}>
        Unirse
    </Button>
)}
{hasJoined && match.status !== "finished" && !isGuest && (
    <Button onClick={() => handleAction(() => leaveMatch(match.id), "leave")}>
        Abandonar
    </Button>
)}
```

- [ ] **Step 3: Pasar `isGuest` a los hijos en `MatchDetail.tsx`**

Buscar los renders de `<MatchChat>`, `<MatchPhotos>` y `<MvpVoting>` en `MatchDetail.tsx`:

```bash
grep -n "MatchChat\|MatchPhotos\|MvpVoting" src/app/matches/[id]/MatchDetail.tsx
```

Añadir `isGuest={isGuest}` a cada uno.

- [ ] **Step 4: Añadir `isGuest` a `MatchChatProps` y ocultar input**

En `src/components/MatchChat.tsx`, añadir a la interfaz:

```ts
interface MatchChatProps {
    matchId: string;
    currentUserId: string;
    currentUserProfile: {
        username: string | null;
        avatar_url: string | null;
    };
    isGuest?: boolean;
}
```

Añadir `isGuest = false` al destructuring.

Localizar el bloque del input de mensaje (buscar con grep):

```bash
grep -n "message\|Send\|send\|setSending" src/components/MatchChat.tsx
```

Envolver el área de input + botón enviar:

```tsx
{!isGuest && (
    /* bloque del input de mensaje y botón enviar */
)}
```

- [ ] **Step 5: Añadir `isGuest` a `MatchPhotosProps` y ocultar upload**

En `src/components/MatchPhotos.tsx`, añadir a la interfaz:

```ts
interface MatchPhotosProps {
    matchId: string;
    currentUserId: string;
    isGuest?: boolean;
}
```

Añadir `isGuest = false` al destructuring.

Localizar el botón de upload:

```bash
grep -n "fileInput\|handleUpload\|Camera\|Plus" src/components/MatchPhotos.tsx
```

Envolver el botón de subir foto y el `<input type="file">` oculto:

```tsx
{!isGuest && (
    /* botón de subir foto e input[type=file] */
)}
```

- [ ] **Step 6: Añadir `isGuest` a `MvpVotingProps` y ocultar botones de voto**

En `src/components/MvpVoting.tsx`, añadir a la interfaz:

```ts
interface MvpVotingProps {
    matchId: string;
    currentUserId: string;
    participants: Participant[];
    matchFinishedAt: string | null;
    matchDate: string;
    canManage?: boolean;
    isGuest?: boolean;
}
```

Añadir `isGuest = false` al destructuring.

Localizar los botones de votación:

```bash
grep -n "voteForMvp\|Votar\|handleVote\|voted_for" src/components/MvpVoting.tsx
```

Envolver los botones de votar con `{!isGuest && (...)}`.

- [ ] **Step 7: Verificar build limpio**

```bash
npm run build
```

Esperado: compilación sin errores de TypeScript. Todos los componentes del árbol aceptan `isGuest`.

- [ ] **Step 8: Commit**

```bash
git add src/app/matches/[id]/page.tsx src/app/matches/[id]/MatchDetail.tsx src/components/MatchChat.tsx src/components/MatchPhotos.tsx src/components/MvpVoting.tsx
git commit -m "feat: ocultar acciones de escritura en partidos para usuarios invitados"
```

---

### Task 5: Guard en `ProfileForm` — ocultar formulario de edición

**Files:**
- Modify: `src/app/profile/page.tsx`
- Modify: `src/app/profile/ProfileForm.tsx`

- [ ] **Step 1: Calcular `isGuest` en `profile/page.tsx`**

En `src/app/profile/page.tsx`, después de `if (!user) redirect("/login");`, añadir:

```ts
const isGuest = user.is_anonymous === true;
```

Modificar el render de `<ProfileForm>`:

```tsx
<ProfileForm userId={user.id} profile={profile} isGuest={isGuest} />
```

- [ ] **Step 2: Añadir `isGuest` a `ProfileFormProps`**

En `src/app/profile/ProfileForm.tsx`, modificar la interfaz:

```ts
interface ProfileFormProps {
    userId: string;
    profile: Profile | null;
    isGuest?: boolean;
}
```

Añadir `isGuest = false` al destructuring:

```ts
export function ProfileForm({ userId, profile, isGuest = false }: ProfileFormProps) {
```

- [ ] **Step 3: Ocultar formulario para invitados**

En el JSX de `ProfileForm`, envolver todo el contenido del formulario (el `<form>`, `AvatarUpload`, campos de username y posición, y el botón guardar) con:

```tsx
{isGuest ? (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-center text-sm text-zinc-500">
        El perfil no es editable en modo demo
    </div>
) : (
    /* todo el formulario actual */
)}
```

- [ ] **Step 4: Verificar build completo**

```bash
npm run build
```

Esperado: compilación limpia sin ningún error de TypeScript.

- [ ] **Step 5: Commit**

```bash
git add src/app/profile/page.tsx src/app/profile/ProfileForm.tsx
git commit -m "feat: ocultar formulario de perfil para usuarios invitados"
```

---

### Task 6: E2E test del flujo de invitado

**Files:**
- Create: `e2e/guest.spec.ts`

- [ ] **Step 1: Crear `e2e/guest.spec.ts`**

```ts
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
        // No redirige a login
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
```

- [ ] **Step 2: Ejecutar los tests con el servidor activo**

En una terminal separada:
```bash
npm run dev
```

En otra terminal:
```bash
npx playwright test e2e/guest.spec.ts --headed
```

Esperado: todos los tests pasan. Si alguno falla por timing, revisar que el botón tenga el texto exacto y que las URLs coincidan.

- [ ] **Step 3: Commit**

```bash
git add e2e/guest.spec.ts
git commit -m "test: E2E flujo de modo invitado anónimo"
```

---

### Task 7: Verificación final + build de producción

- [ ] **Step 1: Build de producción limpio**

```bash
npm run build
```

Esperado: `✓ Compiled successfully` sin errores ni warnings de TypeScript.

- [ ] **Step 2: Smoke test manual completo**

Con `npm run dev`:

1. Ir a `/login` → verificar que aparece el botón "Ver demo como invitado"
2. Clicar → verificar redirección al home `/`
3. Navegar a `/matches` → verificar que se ven partidos (datos reales)
4. Entrar a un partido → verificar que NO aparecen botones "Unirse" ni "Abandonar"
5. Ir a la pestaña Chat del partido → verificar que no hay input de mensaje
6. Ir a la pestaña Fotos → verificar que no hay botón de subir
7. Navegar a `/matches/new` → verificar redirección a `/matches`
8. Ir a `/profile` → verificar que aparece "El perfil no es editable en modo demo"
9. Ir a `/leaderboard` → verificar que se ven datos
10. Ir a `/players` → verificar que se ven jugadores
11. Ir a `/asistente` → verificar que Panenka responde (puede que diga que no tiene historial, es correcto)

- [ ] **Step 3: Commit final si hay ajustes menores**

```bash
git add -A
git commit -m "fix: ajustes menores tras verificación del modo invitado"
```
