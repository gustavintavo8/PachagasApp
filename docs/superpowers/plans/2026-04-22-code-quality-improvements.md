# Code Quality Improvements — Pachanga App

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir todos los problemas de calidad de código identificados en el análisis del 2026-04-22, priorizando seguridad (rate limiting, fallbacks peligrosos), luego tipado TypeScript, luego deuda técnica (duplicación de código, constantes mágicas).

**Architecture:** Cada tarea es independiente y produce un commit atómico. El orden importa: primero las utilidades compartidas (timeAgo, constantes), luego los consumidores. No se toca lógica de negocio ni esquema de Supabase.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase, Zod, Tailwind CSS 4

---

## Mapa de archivos

| Archivo | Cambios |
|---|---|
| `src/lib/utils.ts` | Añadir `timeAgo()` centralizada |
| `src/lib/constantes.ts` | NUEVO — constantes de negocio compartidas |
| `src/lib/rate-limit.ts` | Arreglar fallback peligroso |
| `src/app/profile/actions.ts` | Añadir rate limit + validación Zod |
| `src/app/login/actions.ts` | Añadir rate limit a login y signup |
| `src/components/MatchChat.tsx` | Eliminar `timeAgo()` local, usar utils |
| `src/components/MatchPhotos.tsx` | Eliminar `timeAgo()` local, usar utils |
| `src/components/NotificationBell.tsx` | Eliminar `timeAgo()` local, usar utils |
| `src/components/MvpVoting.tsx` | Usar `MVP_VOTING_WINDOW_MS` de constantes |
| `src/app/matches/actions.ts` | Usar `MVP_VOTING_WINDOW_MS` de constantes, arreglar casts, await sendNotification |
| `src/components/AvatarUpload.tsx` | Validar `fileExt`, manejar error de upload |
| `src/components/WeatherWidget.tsx` | Eliminar prop `location` no usado del tipo |
| `src/components/PlayerCharts.tsx` | Reemplazar `any` con `number` en formatters |

---

## Task 1: Centralizar `timeAgo()` en utils y crear archivo de constantes

**Files:**
- Modify: `src/lib/utils.ts`
- Create: `src/lib/constantes.ts`

- [ ] **Step 1: Añadir `timeAgo` a utils.ts**

Abre `src/lib/utils.ts` y añade al final:

```typescript
export function timeAgo(dateStr: string): string {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return "ahora";
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
}
```

- [ ] **Step 2: Crear `src/lib/constantes.ts`**

```typescript
export const MVP_VOTING_WINDOW_MS = 24 * 60 * 60 * 1000;

export const SQUAD_POS_LIMITS: Record<string, number> = {
    GK: 2,
    DEF: 4,
    MID: 4,
    FWD: 3,
};

export const FANTASY_MAX_SQUAD_SIZE = 11;
export const FANTASY_INITIAL_BUDGET = 115_000_000;
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/utils.ts src/lib/constantes.ts
git commit -m "refactor: centralizar timeAgo y constantes de negocio en utils y constantes.ts"
```

---

## Task 2: Eliminar `timeAgo()` duplicada en los tres componentes

**Files:**
- Modify: `src/components/MatchChat.tsx`
- Modify: `src/components/MatchPhotos.tsx`
- Modify: `src/components/NotificationBell.tsx`

- [ ] **Step 1: Actualizar MatchChat.tsx**

En `src/components/MatchChat.tsx`:

1. En el bloque de imports, añadir `timeAgo` desde utils:
```typescript
import { getAvatarUrl, timeAgo } from "@/lib/utils";
```

2. Borrar la función local (líneas 30-38):
```typescript
// ELIMINAR ESTO:
function timeAgo(dateStr: string) {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = Math.floor((now - then) / 1000);
    if (diff < 60) return "ahora";
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
}
```

- [ ] **Step 2: Actualizar MatchPhotos.tsx**

En `src/components/MatchPhotos.tsx`:

1. Añadir al import de utils:
```typescript
import { getAvatarUrl, timeAgo } from "@/lib/utils";
```

2. Buscar y borrar la función local `timeAgo` dentro del componente (es similar a la de MatchChat).

- [ ] **Step 3: Actualizar NotificationBell.tsx**

En `src/components/NotificationBell.tsx`:

1. Añadir import:
```typescript
import { timeAgo } from "@/lib/utils";
```

2. Borrar la función local (líneas 80-86):
```typescript
// ELIMINAR ESTO:
function timeAgo(dateStr: string) {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return "ahora";
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
}
```

- [ ] **Step 4: Verificar que compila**

```bash
npx tsc --noEmit
```

Esperado: 0 errores relacionados con `timeAgo`.

- [ ] **Step 5: Commit**

```bash
git add src/components/MatchChat.tsx src/components/MatchPhotos.tsx src/components/NotificationBell.tsx
git commit -m "refactor: eliminar duplicados de timeAgo, usar la versión centralizada de utils"
```

---

## Task 3: Usar `MVP_VOTING_WINDOW_MS` de constantes en los dos sitios donde está duplicada

**Files:**
- Modify: `src/components/MvpVoting.tsx`
- Modify: `src/app/matches/actions.ts`

- [ ] **Step 1: Actualizar MvpVoting.tsx**

En `src/components/MvpVoting.tsx`:

1. Añadir import:
```typescript
import { MVP_VOTING_WINDOW_MS } from "@/lib/constantes";
```

2. Eliminar la línea local (línea 34):
```typescript
// ELIMINAR ESTO:
const MVP_VOTING_WINDOW_MS = 24 * 60 * 60 * 1000;
```

- [ ] **Step 2: Actualizar matches/actions.ts**

En `src/app/matches/actions.ts`:

1. Añadir import al inicio del archivo:
```typescript
import { MVP_VOTING_WINDOW_MS } from "@/lib/constantes";
```

2. Eliminar la declaración local (línea 788):
```typescript
// ELIMINAR ESTO:
const MVP_VOTING_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
```

- [ ] **Step 3: Verificar que compila**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/MvpVoting.tsx src/app/matches/actions.ts
git commit -m "refactor: usar MVP_VOTING_WINDOW_MS desde constantes, eliminar duplicado"
```

---

## Task 4: Arreglar el fallback peligroso en rate-limit.ts

**Files:**
- Modify: `src/lib/rate-limit.ts`

El problema: cuando la BD falla, devuelve `{ allowed: true }`, desactivando toda protección.
La solución: devolver `{ allowed: false }` en caso de error (fail-closed), igual que cualquier middleware de seguridad bien diseñado.

- [ ] **Step 1: Cambiar fallback a fail-closed**

Reemplazar el contenido de `src/lib/rate-limit.ts`:

```typescript
import { createAdminClient } from "@/lib/supabase/admin";

export async function rateLimit(
    key: string,
    maxTokens: number = 10,
    refillIntervalMs: number = 60_000
): Promise<{ allowed: boolean; remaining: number }> {
    try {
        const admin = createAdminClient();
        const { data, error } = await admin.rpc("consume_rate_limit", {
            p_key: key,
            p_max_tokens: maxTokens,
            p_refill_interval_ms: refillIntervalMs
        });

        if (error) {
            // Fail-closed: si la BD falla, bloqueamos para evitar abuso
            return { allowed: false, remaining: 0 };
        }

        return { allowed: data === true, remaining: 0 };
    } catch {
        // Fail-closed
        return { allowed: false, remaining: 0 };
    }
}
```

- [ ] **Step 2: Verificar que compila**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/rate-limit.ts
git commit -m "fix(security): rate-limit fail-closed — bloquear en vez de permitir cuando la BD falla"
```

---

## Task 5: Añadir rate limiting a profile/actions.ts

**Files:**
- Modify: `src/app/profile/actions.ts`

- [ ] **Step 1: Añadir rate limit a updateProfile y updateAvatar**

Reemplazar el contenido completo de `src/app/profile/actions.ts`:

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { rateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

type ActionResult = { success: boolean; error?: string };

const UpdateProfileSchema = z.object({
    username: z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(30, "Máximo 30 caracteres"),
    position: z.enum(["GK", "DEF", "MID", "FWD"], { message: "Posición inválida" }),
    avatar_url: z.string().optional(),
});

export async function updateProfile(formData: FormData): Promise<ActionResult> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'No estás autenticado' }
    }

    const { allowed } = await rateLimit(`update-profile:${user.id}`, 5, 60_000);
    if (!allowed) return { success: false, error: "Demasiadas actualizaciones. Espera un momento." };

    const parsed = UpdateProfileSchema.safeParse({
        username: formData.get('username'),
        position: formData.get('position'),
        avatar_url: formData.get('avatar_url') ?? undefined,
    });

    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message };
    }

    const { username, position, avatar_url } = parsed.data;

    const { error } = await supabase
        .from('profiles')
        .update({
            username,
            position,
            ...(avatar_url && { avatar_url }),
            updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

    if (error) {
        return { success: false, error: 'Error al actualizar el perfil. Inténtalo de nuevo.' }
    }

    revalidatePath('/profile')
    revalidatePath('/')

    return { success: true }
}

export async function updateAvatar(path: string): Promise<ActionResult> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { success: false, error: "No autenticado" };
    }

    const { allowed } = await rateLimit(`update-avatar:${user.id}`, 10, 60_000);
    if (!allowed) return { success: false, error: "Demasiadas subidas. Espera un momento." };

    const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: path })
        .eq("id", user.id);

    if (error) {
        return { success: false, error: "Error al guardar el avatar." };
    }

    revalidatePath("/profile");
    revalidatePath("/");
    return { success: true };
}
```

- [ ] **Step 2: Verificar que compila**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/profile/actions.ts
git commit -m "fix(security): añadir rate limiting y validación Zod a profile actions"
```

---

## Task 6: Añadir rate limiting a login/actions.ts

**Files:**
- Modify: `src/app/login/actions.ts`

El ataque de fuerza bruta contra login y el spam de signup son los dos vectores más obvios sin rate limit.

- [ ] **Step 1: Añadir rate limit a login y signup**

En `src/app/login/actions.ts`:

1. Añadir import al inicio:
```typescript
import { rateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";
```

(Nota: `headers` ya existe en el import original)

2. En la función `login`, después de validar email/password y antes de llamar a `signInWithPassword`, añadir:

```typescript
const { allowed } = await rateLimit(`login:${email}`, 5, 60_000);
if (!allowed) return { success: false, error: "Demasiados intentos. Espera un minuto." };
```

3. En la función `signup`, después de validar email/password y antes de la lógica de orphan cleanup, añadir:

```typescript
const { allowed } = await rateLimit(`signup:${email}`, 3, 3_600_000);
if (!allowed) return { success: false, error: "Demasiados intentos de registro. Espera una hora." };
```

El resultado final de las funciones `login` y `signup` (solo los comienzos con la adición):

```typescript
export async function login(formData: FormData): Promise<ActionResult> {
    const supabase = await createClient();

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
        return { success: false, error: "Email y contraseña son obligatorios" };
    }

    const { allowed } = await rateLimit(`login:${email}`, 5, 60_000);
    if (!allowed) return { success: false, error: "Demasiados intentos. Espera un minuto." };

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    // ... resto igual
```

```typescript
export async function signup(formData: FormData): Promise<ActionResult> {
    const supabase = await createClient();
    const headersList = await headers();
    // ... (headers ya existentes)

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
        return { success: false, error: "Email y contraseña son obligatorios" };
    }

    if (password.length < 6) {
        return { success: false, error: "La contraseña debe tener al menos 6 caracteres" };
    }

    const { allowed } = await rateLimit(`signup:${email}`, 3, 3_600_000);
    if (!allowed) return { success: false, error: "Demasiados intentos de registro. Espera una hora." };

    // Clean up orphaned auth users...
    // ... resto igual
```

- [ ] **Step 2: Verificar que compila**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/login/actions.ts
git commit -m "fix(security): añadir rate limiting a login y signup"
```

---

## Task 7: Corregir casts `as unknown as` en matches/actions.ts

**Files:**
- Modify: `src/app/matches/actions.ts`

El cast `p.profiles as unknown as { elo_rating: ... }` y similares se producen porque Supabase devuelve tipos genéricos para joins. La solución correcta es tipar explícitamente la variable intermedia con una interfaz local.

- [ ] **Step 1: Definir interfaces locales en matches/actions.ts**

Al inicio del archivo, después de los imports existentes, añadir:

```typescript
interface ParticipantProfile {
    elo_rating: number | null;
    matches_played: number | null;
    position: string | null;
}

interface EloParticipantRow {
    user_id: string;
    team: string | null;
    goals: number | null;
    is_mvp: boolean | null;
    profiles: ParticipantProfile | ParticipantProfile[] | null;
}
```

- [ ] **Step 2: Reemplazar los casts en setScore**

En `src/app/matches/actions.ts`, dentro de `setScore` (alrededor de la línea 329), reemplazar:

```typescript
// ANTES:
const profile = p.profiles as unknown as {
    elo_rating: number | null;
    matches_played: number | null;
    position: string | null;
};
```

```typescript
// DESPUÉS:
const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles as ParticipantProfile | null;
```

Y más abajo (alrededor de línea 391), reemplazar:

```typescript
// ANTES:
const prof = p.profiles as unknown as { position: string | null } | null;
const position = prof?.position ?? "MID";
```

```typescript
// DESPUÉS:
const profileData = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles as ParticipantProfile | null;
const position = profileData?.position ?? "MID";
```

- [ ] **Step 3: Verificar que compila**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/matches/actions.ts
git commit -m "refactor: reemplazar casts as unknown as con interfaces tipadas en matches/actions"
```

---

## Task 8: Corregir tipos `any` en PlayerCharts.tsx

**Files:**
- Modify: `src/components/PlayerCharts.tsx`

- [ ] **Step 1: Reemplazar `any` con `number` en los formatters de Recharts**

En `src/components/PlayerCharts.tsx`, línea ~139, reemplazar:

```typescript
// ANTES:
formatter={(value: any) => [`${(Number(value) ?? 0).toFixed(0)}%`, "Tasa de Victoria"]}
```

```typescript
// DESPUÉS:
formatter={(value: number) => [`${value.toFixed(0)}%`, "Tasa de Victoria"]}
```

En línea ~185, reemplazar:

```typescript
// ANTES:
formatter={(value: any) => [`${value} RP`, "Rating"]}
```

```typescript
// DESPUÉS:
formatter={(value: number) => [`${value} RP`, "Rating"]}
```

- [ ] **Step 2: Verificar que compila**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/PlayerCharts.tsx
git commit -m "fix: reemplazar any con number en formatters de Recharts"
```

---

## Task 9: Validar fileExt en AvatarUpload.tsx

**Files:**
- Modify: `src/components/AvatarUpload.tsx`

El problema: si `compressedFile.name` no tiene extensión, `fileExt` es `undefined` y la ruta queda como `uid/timestamp.undefined`.

- [ ] **Step 1: Añadir validación de extensión**

En `src/components/AvatarUpload.tsx`, dentro de `handleUpload`, reemplazar:

```typescript
// ANTES:
const fileExt = compressedFile.name.split(".").pop();
const filePath = `${uid}/${Date.now()}.${fileExt}`;
```

```typescript
// DESPUÉS:
const fileExt = compressedFile.name.split(".").pop();
if (!fileExt) {
    setUploading(false);
    return;
}
const filePath = `${uid}/${Date.now()}.${fileExt}`;
```

- [ ] **Step 2: Verificar que compila**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/AvatarUpload.tsx
git commit -m "fix: validar extensión de archivo antes de subir avatar"
```

---

## Task 10: Limpiar WeatherWidget — eliminar prop `location` no usado

**Files:**
- Modify: `src/components/WeatherWidget.tsx`

El componente declara `location` en `WeatherWidgetProps` pero nunca lo usa (siempre usa coordenadas hardcodeadas de Mieres). Hay dos opciones: usar el prop o eliminarlo. Como la lógica de geolocalización sería un cambio de funcionalidad, simplemente eliminamos el prop no usado del tipo para que la interfaz sea honesta.

- [ ] **Step 1: Verificar qué recibe el componente en su sitio de uso**

```bash
grep -r "WeatherWidget" src/ --include="*.tsx" --include="*.ts"
```

Revisar cada llamada para saber si se pasa `location`. Si se pasa, eliminarlo del JSX también.

- [ ] **Step 2: Actualizar la firma del componente**

En `src/components/WeatherWidget.tsx`, cambiar:

```typescript
// ANTES:
interface WeatherWidgetProps {
    location: string;
    date: string;
}
export function WeatherWidget({ date }: { date: string }) {
```

```typescript
// DESPUÉS:
export function WeatherWidget({ date }: { date: string }) {
```

(Si había una interfaz separada, eliminarla también.)

- [ ] **Step 3: Verificar y corregir cada llamada**

Buscar en el codebase si algún componente pasa `location` a `WeatherWidget` y eliminar ese prop de las llamadas.

- [ ] **Step 4: Verificar que compila**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/components/WeatherWidget.tsx
git commit -m "fix: eliminar prop location no usado de WeatherWidget"
```

---

## Task 11: Await `sendNotification` en setScore y resolveMvp

**Files:**
- Modify: `src/app/matches/actions.ts`

`sendNotification` se llama sin `await` en dos lugares, haciendo que los errores se pierdan silenciosamente.

- [ ] **Step 1: Añadir await a sendNotification en setScore**

En `src/app/matches/actions.ts`, alrededor de línea 482, reemplazar:

```typescript
// ANTES:
sendNotification(
    participantIds,
    "score",
    ...
);
```

```typescript
// DESPUÉS:
await sendNotification(
    participantIds,
    "score",
    ...
);
```

- [ ] **Step 2: Añadir await a sendNotification en resolveMvp**

En `src/app/matches/actions.ts`, dentro de `resolveMvp` (alrededor de línea 844), reemplazar:

```typescript
// ANTES:
sendNotification(
    [winnerId],
    "mvp",
    ...
);
```

```typescript
// DESPUÉS:
await sendNotification(
    [winnerId],
    "mvp",
    ...
);
```

- [ ] **Step 3: Verificar que compila**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/matches/actions.ts
git commit -m "fix: await sendNotification para no perder errores de notificaciones"
```

---

## Task 12: Eliminar console.error y console.log innecesarios

**Files:**
- Modify: `src/app/matches/actions.ts`
- Modify: `src/app/auth/callback/route.ts`
- Modify: `src/components/AvatarUpload.tsx`

Los `console.error` en producción no aportan valor (no hay logging estructurado) y pueden filtrar detalles internos en logs públicos. Se eliminan. Los errores ya están manejados devolviendo `{ success: false, error }` al caller.

- [ ] **Step 1: Limpiar matches/actions.ts**

Buscar y eliminar estas líneas:

```typescript
// ELIMINAR:
if (error) console.error("Error sending notifications:", error.message);
// (en sendNotification)

if (joinError) console.error("Error auto-joining creator:", joinError.message);
// (en createMatch)

if (scorerError) console.error("Error updating scorer:", scorer.userId, scorerError.message);
// (en setScore)
```

Para `sendNotification`, como ya no loguea, la función queda así:
```typescript
async function sendNotification(
    userIds: string[],
    type: string,
    title: string,
    message: string,
    matchId?: string
) {
    if (userIds.length === 0) return;
    const admin = createAdminClient();
    const rows = userIds.map((uid) => ({
        user_id: uid,
        type,
        title,
        message,
        match_id: matchId ?? null,
    }));
    await admin.from("notifications").insert(rows);
}
```

Para el error de `joinError` en `createMatch`, dado que es un error secundario (el partido ya se creó), es aceptable ignorarlo silenciosamente. Simplemente quitar el `console.error`.

Para `scorerError`, quitar el `console.error` — el loop continuará con el siguiente scorer.

- [ ] **Step 2: Limpiar auth/callback/route.ts**

Buscar y eliminar:
```typescript
// ELIMINAR:
console.error("Error creating profile:", insertError)
```

- [ ] **Step 3: Limpiar AvatarUpload.tsx**

Reemplazar:
```typescript
// ANTES:
if (uploadError) {
    console.error("Upload error:", uploadError);
    setUploading(false);
    return;
}
```

```typescript
// DESPUÉS:
if (uploadError) {
    setUploading(false);
    return;
}
```

- [ ] **Step 4: Verificar que compila**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/app/matches/actions.ts src/app/auth/callback/route.ts src/components/AvatarUpload.tsx
git commit -m "fix: eliminar console.error innecesarios en producción"
```

---

## Task 13: Usar constantes de `constantes.ts` en fantasy/actions.ts

**Files:**
- Modify: `src/app/fantasy/actions.ts`

- [ ] **Step 1: Añadir import de constantes**

En `src/app/fantasy/actions.ts`, añadir import:

```typescript
import { SQUAD_POS_LIMITS, FANTASY_MAX_SQUAD_SIZE, FANTASY_INITIAL_BUDGET } from "@/lib/constantes";
```

- [ ] **Step 2: Reemplazar valores hardcodeados**

Buscar y reemplazar:

```typescript
// ANTES:
const SQUAD_POS_LIMITS: Record<string, number> = { GK: 2, DEF: 4, MID: 4, FWD: 3 };
```
→ Eliminar esta línea (ahora viene del import).

```typescript
// ANTES:
if ((rosterCount ?? 0) >= 11)
```
```typescript
// DESPUÉS:
if ((rosterCount ?? 0) >= FANTASY_MAX_SQUAD_SIZE)
```

```typescript
// ANTES:
budget: 115_000_000,
```
```typescript
// DESPUÉS:
budget: FANTASY_INITIAL_BUDGET,
```

- [ ] **Step 3: Verificar que compila**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/fantasy/actions.ts
git commit -m "refactor: usar constantes centralizadas en fantasy/actions en vez de valores magic"
```

---

## Task 14: Verificación final — build completo

- [ ] **Step 1: Build completo sin errores**

```bash
npm run build
```

Esperado: build exitoso sin errores TypeScript ni de compilación.

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: 0 errores.

- [ ] **Step 3: Si hay errores de lint, corregirlos**

```bash
npx eslint src/ --ext .ts,.tsx
```

Corregir cualquier error reportado.

---

## Autoreview

**Cobertura del spec:**
- [x] Rate limiting en profile/actions (Task 5)
- [x] Rate limiting en login/actions (Task 6)
- [x] Fallback peligroso rate-limit (Task 4)
- [x] Código duplicado timeAgo (Tasks 1, 2)
- [x] MVP_VOTING_WINDOW_MS duplicada (Tasks 1, 3)
- [x] Tipos `any` en PlayerCharts (Task 8)
- [x] Casts `as unknown as` en matches/actions (Task 7)
- [x] fileExt undefined en AvatarUpload (Task 9)
- [x] WeatherWidget prop no usado (Task 10)
- [x] console.error en producción (Task 12)
- [x] await en sendNotification (Task 11)
- [x] Constantes mágicas en fantasy (Task 13)

**Fuera de scope (deliberadamente excluido):**
- Dividir MatchDetail.tsx en sub-componentes (riesgo alto de regresiones visuales, candidato a tarea independiente)
- Logging estructurado (requiere decidir herramienta: Sentry, Axiom, etc. — decisión de arquitectura)
- Tests unitarios para ELO (CLAUDE.md dice no modificar lógica de ELO sin confirmación)
