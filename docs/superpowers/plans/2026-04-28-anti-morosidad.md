# Anti-Morosidad (Pagos Manuales) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir un toggle manual de pago (`has_paid`) por participante en partidos abiertos, visible para todos y accionable solo por el organizador y el admin.

**Architecture:** Se añade una columna `has_paid boolean DEFAULT false` a `match_participants`. Un nuevo server action `markAsPaid` valida permisos y actualiza la fila via admin client. La UI muestra un badge Lucide en cada `PlayerRow` (solo visual para participantes normales, clickable con estado optimista para organizador/admin) y un contador "X / Y pagados" exclusivo para quien gestiona.

**Tech Stack:** Next.js App Router, Supabase (PostgreSQL + RLS + admin client), TypeScript, Zod, Tailwind CSS 4, Lucide React, Playwright (E2E).

---

## Mapa de ficheros

| Fichero | Acción | Propósito |
|---------|--------|-----------|
| `supabase/migrations/20260428000001_add_has_paid_to_match_participants.sql` | Crear | Migración que añade la columna |
| `src/lib/types.ts` | Modificar | Añadir `has_paid: boolean` a `MatchParticipant` |
| `src/app/matches/actions.ts` | Modificar | Añadir server action `markAsPaid` |
| `src/app/matches/[id]/MatchDetail.tsx` | Modificar | Estado optimista, badge de pago, contador |
| `e2e/matches-payment.spec.ts` | Crear | Test E2E del toggle de pago |

---

## Task 1: Migración de base de datos

**Files:**
- Create: `supabase/migrations/20260428000001_add_has_paid_to_match_participants.sql`

- [ ] **Step 1: Crear el fichero de migración**

```sql
-- supabase/migrations/20260428000001_add_has_paid_to_match_participants.sql
ALTER TABLE public.match_participants
  ADD COLUMN IF NOT EXISTS has_paid boolean NOT NULL DEFAULT false;
```

- [ ] **Step 2: Aplicar la migración en Supabase**

Opción A — CLI local (si `supabase` CLI está configurado):
```bash
npx supabase db push
```

Opción B — Dashboard de Supabase:
Ir a **SQL Editor** → pegar el SQL anterior → ejecutar.

Verificar que la columna aparece en `Table Editor > match_participants`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260428000001_add_has_paid_to_match_participants.sql
git commit -m "feat(db): añadir has_paid a match_participants"
```

---

## Task 2: Tipos TypeScript

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Escribir el test que fallará**

Abrir `src/lib/types.ts` y verificar que `MatchParticipant` NO tiene `has_paid` todavía (comprobación visual — no hay runner de tipos unitario).

- [ ] **Step 2: Añadir `has_paid` a `MatchParticipant`**

En `src/lib/types.ts`, cambiar:

```ts
export type MatchParticipant = {
    match_id: string;
    user_id: string;
    team: "A" | "B" | null;
    goals: number;
    is_mvp: boolean;
    has_paid: boolean;
};
```

- [ ] **Step 3: Verificar que TypeScript compila**

```bash
npx tsc --noEmit
```

Esperado: sin errores relacionados con `has_paid`. Si hay errores en `MatchDetail.tsx` por la nueva prop, son esperados y se resuelven en Task 4.

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(types): añadir has_paid a MatchParticipant"
```

---

## Task 3: Server Action `markAsPaid`

**Files:**
- Modify: `src/app/matches/actions.ts`

- [ ] **Step 1: Añadir el server action al final de `actions.ts`**

Justo antes del último `}` de cierre del fichero, añadir:

```ts
export async function markAsPaid(
    matchId: string,
    targetUserId: string,
    paid: boolean
): Promise<ActionResult> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "No autenticado" };

    const MarkPaidSchema = z.object({
        matchId: z.string().uuid("ID de partido inválido"),
        targetUserId: z.string().uuid("ID de usuario inválido"),
    });
    const parsed = MarkPaidSchema.safeParse({ matchId, targetUserId });
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

    const { allowed } = await rateLimit(`mark-paid:${user.id}`, 20, 60_000);
    if (!allowed) return { success: false, error: "Demasiadas acciones. Espera un momento." };

    const { data: match } = await supabase
        .from("matches")
        .select("status, created_by")
        .eq("id", parsed.data.matchId)
        .single();

    if (!match) return { success: false, error: "Partido no encontrado" };
    if (match.status !== "open") return { success: false, error: "Solo se puede marcar pagos en partidos abiertos" };

    const admin = await isAdmin(user.id);
    if (match.created_by !== user.id && !admin)
        return { success: false, error: "Solo el organizador puede marcar pagos" };

    const adminClient = createAdminClient();
    const { error } = await adminClient
        .from("match_participants")
        .update({ has_paid: paid })
        .eq("match_id", parsed.data.matchId)
        .eq("user_id", parsed.data.targetUserId);

    if (error) return { success: false, error: error.message };

    revalidatePath(`/matches/${parsed.data.matchId}`);
    return { success: true };
}
```

- [ ] **Step 2: Verificar que TypeScript compila**

```bash
npx tsc --noEmit
```

Esperado: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add src/app/matches/actions.ts
git commit -m "feat(actions): añadir server action markAsPaid"
```

---

## Task 4: UI — Badge de pago y estado optimista en `MatchDetail.tsx`

**Files:**
- Modify: `src/app/matches/[id]/MatchDetail.tsx`

### 4a: Actualizar imports y la interfaz `Participant`

- [ ] **Step 1: Añadir `CheckCircle2` y `CircleDashed` a los imports de Lucide**

Localizar el bloque de imports de Lucide (empieza con `import { Calendar, ...`) y añadir `CheckCircle2, CircleDashed` a la lista:

```ts
import {
    Calendar,
    MapPin,
    Users,
    Shield,
    Shuffle,
    Trophy,
    LogOut as LeaveIcon,
    UserPlus,
    ChevronDown,
    Copy,
    MessageCircle,
    Camera,
    Share2,
    ExternalLink,
    Ban,
    CalendarClock,
    XCircle,
    X,
    Crown,
    Target,
    CheckCircle2,
    CircleDashed,
} from "lucide-react";
```

- [ ] **Step 2: Añadir `markAsPaid` a los imports de actions**

```ts
import {
    joinMatch,
    leaveMatch,
    setScore,
    generateTeams,
    cancelMatch,
    rescheduleMatch,
    kickPlayer,
    markAsPaid,
} from "../actions";
```

- [ ] **Step 3: Añadir `has_paid` a la interfaz `Participant`**

Cambiar:

```ts
interface Participant {
    match_id: string;
    user_id: string;
    team: "A" | "B" | null;
    goals: number;
    is_mvp: boolean;
    has_paid: boolean;
    profiles: Profile;
}
```

### 4b: Estado optimista en `MatchDetail`

- [ ] **Step 4: Añadir estado de pagos en `MatchDetail`**

Justo después de la línea `const [cancelDialogOpen, setCancelDialogOpen] = useState(false);`, añadir:

```ts
const [paidState, setPaidState] = useState<Record<string, boolean>>(
    () => Object.fromEntries(participants.map((p) => [p.user_id, p.has_paid]))
);
```

- [ ] **Step 5: Añadir el handler optimista de pago**

Justo después de la función `setPlayerGoals`, añadir:

```ts
async function handleTogglePaid(userId: string) {
    const current = paidState[userId] ?? false;
    setPaidState((prev) => ({ ...prev, [userId]: !current }));
    const result = await markAsPaid(match.id, userId, !current);
    if (result?.error) {
        setPaidState((prev) => ({ ...prev, [userId]: current }));
        toast(result.error, "error");
    }
}
```

### 4c: Contador de pagos para organizador/admin

- [ ] **Step 6: Añadir el contador "X / Y pagados"**

Localizar el bloque de action buttons (`{/* Action Buttons */}`). Justo después del cierre `</div>` de ese bloque, añadir:

```tsx
{canManage && match.status === "open" && participants.length > 0 && (
    <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-surface px-4 py-2.5 text-sm">
        <CheckCircle2 size={16} className="text-[#ccff00]" />
        <span className="text-muted">
            <span className="font-bold text-foreground">
                {Object.values(paidState).filter(Boolean).length}
            </span>
            {" / "}
            <span className="font-bold text-foreground">{participants.length}</span>
            {" pagados"}
        </span>
    </div>
)}
```

### 4d: Actualizar `PlayerRow` para recibir el badge de pago

- [ ] **Step 7: Añadir props de pago a `PlayerRow`**

Cambiar la firma de la función `PlayerRow`:

```ts
function PlayerRow({
    participant,
    adminUserIds,
    organizerId,
    onKick,
    showPaid,
    isPaid,
    onTogglePaid,
}: {
    participant: Participant;
    adminUserIds?: string[];
    organizerId?: string;
    onKick?: () => void;
    showPaid?: boolean;
    isPaid?: boolean;
    onTogglePaid?: () => Promise<void>;
}) {
```

- [ ] **Step 8: Añadir estado local de toggling en `PlayerRow`**

Dentro de `PlayerRow`, justo después de `const [kicking, setKicking] = useState(false);`, añadir:

```ts
const [toggling, setToggling] = useState(false);
```

- [ ] **Step 9: Añadir el badge de pago en el JSX de `PlayerRow`**

Localizar el bloque `{participant.goals > 0 && ...}`. Justo antes de ese bloque, añadir:

```tsx
{showPaid && (
    onTogglePaid ? (
        <button
            onClick={async () => {
                setToggling(true);
                await onTogglePaid();
                setToggling(false);
            }}
            disabled={toggling}
            title={isPaid ? "Marcar como no pagado" : "Marcar como pagado"}
            className={`flex h-6 items-center gap-1 rounded-full border px-1.5 transition-all disabled:opacity-50 ${
                isPaid
                    ? "border-[#ccff00]/30 bg-[#ccff00]/10 text-[#ccff00] hover:bg-[#ccff00]/20"
                    : "border-border bg-surface-hover text-muted hover:border-[#ccff00]/40 hover:text-[#ccff00]/70"
            }`}
        >
            {isPaid
                ? <CheckCircle2 size={12} />
                : <CircleDashed size={12} />
            }
        </button>
    ) : (
        <div
            title={isPaid ? "Pagado" : "Pendiente de pago"}
            className={`flex h-6 items-center gap-1 rounded-full border px-1.5 ${
                isPaid
                    ? "border-[#ccff00]/30 bg-[#ccff00]/10 text-[#ccff00]"
                    : "border-border bg-surface-hover text-muted"
            }`}
        >
            {isPaid
                ? <CheckCircle2 size={12} />
                : <CircleDashed size={12} />
            }
        </div>
    )
)}
```

### 4e: Pasar las nuevas props a todos los usos de `PlayerRow`

Hay tres lugares donde se usa `PlayerRow`:

1. Lista de jugadores sin equipos (línea ~402)
2. Lista de jugadores sin equipo cuando hay equipos generados (`unassigned`, línea ~372)
3. `TeamCard` (línea ~630)

- [ ] **Step 10: Actualizar la lista principal de jugadores (sin equipos)**

Cambiar el `map` de participantes en el bloque sin equipos:

```tsx
{participants.map((p) => (
    <PlayerRow
        key={p.user_id}
        participant={p}
        adminUserIds={adminUserIds}
        organizerId={match.created_by}
        showPaid={match.status === "open"}
        isPaid={paidState[p.user_id] ?? false}
        onTogglePaid={
            canManage && match.status === "open"
                ? () => handleTogglePaid(p.user_id)
                : undefined
        }
        onKick={
            isAdmin && match.status === "open" && p.user_id !== currentUserId
                ? async () => {
                    const result = await kickPlayer(match.id, p.user_id);
                    if (result?.error) toast(result.error, "error");
                    else toast(`${p.profiles?.username || "Jugador"} expulsado`, "success");
                }
                : undefined
        }
    />
))}
```

- [ ] **Step 11: Actualizar la lista `unassigned` (jugadores sin equipo cuando hay equipos)**

```tsx
{unassigned.map((p) => (
    <PlayerRow
        key={p.user_id}
        participant={p}
        adminUserIds={adminUserIds}
        organizerId={match.created_by}
        showPaid={match.status === "open"}
        isPaid={paidState[p.user_id] ?? false}
        onTogglePaid={
            canManage && match.status === "open"
                ? () => handleTogglePaid(p.user_id)
                : undefined
        }
        onKick={
            isAdmin && match.status === "open" && p.user_id !== currentUserId
                ? async () => {
                    const result = await kickPlayer(match.id, p.user_id);
                    if (result?.error) toast(result.error, "error");
                    else toast(`${p.profiles?.username || "Jugador"} expulsado`, "success");
                }
                : undefined
        }
    />
))}
```

- [ ] **Step 12: Actualizar `TeamCard` — no hay toggle de pago en la vista de equipos**

`TeamCard` se usa para mostrar equipos una vez generados. En ese estado el partido puede seguir abierto, pero la vista del campo no es el lugar para gestionar pagos (el contador ya está visible arriba). Dejar `TeamCard` sin props de pago — no requiere cambios.

- [ ] **Step 13: Verificar que TypeScript compila**

```bash
npx tsc --noEmit
```

Esperado: sin errores.

- [ ] **Step 14: Commit**

```bash
git add src/app/matches/[id]/MatchDetail.tsx
git commit -m "feat(ui): badge y toggle de pago en lista de participantes"
```

---

## Task 5: Test E2E

**Files:**
- Create: `e2e/matches-payment.spec.ts`

- [ ] **Step 1: Crear el fichero de test**

```ts
import { test, expect } from "@playwright/test";
import { deleteMatch } from "./helpers/db";

let createdMatchId: string | null = null;

test.afterAll(async () => {
    if (createdMatchId) {
        await deleteMatch(createdMatchId);
        createdMatchId = null;
    }
});

test.describe("Sistema de pagos (anti-morosidad)", () => {
    test.beforeEach(async ({ page }) => {
        // Crear un partido de prueba
        await page.goto("/");
        await page.locator("text=Nuevo partido").or(page.locator("text=Crear partido")).click();
        const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
        await page.locator('input[type="datetime-local"]').fill(futureDate.toISOString().slice(0, 16));
        await page.locator('input[placeholder*="ubicación"], input[placeholder*="lugar"], input[name="location"]').fill("Campo Pago Test");
        await page.locator('button[type="submit"]').click();
        await page.waitForURL(/\/matches\/[a-f0-9-]+/, { timeout: 10_000 });
        const url = page.url();
        createdMatchId = url.split("/matches/")[1];
    });

    test("el organizador ve el badge de pago pendiente para sí mismo", async ({ page }) => {
        // El organizador se auto-une al crear el partido
        // Debe ver al menos un badge CircleDashed (pendiente)
        const pendingBadge = page.locator('[title="Marcar como pagado"]').first();
        await expect(pendingBadge).toBeVisible({ timeout: 5_000 });
    });

    test("el organizador puede marcar un jugador como pagado", async ({ page }) => {
        // Click en el badge pendiente del organizador (se unió automáticamente)
        const pendingBadge = page.locator('[title="Marcar como pagado"]').first();
        await expect(pendingBadge).toBeVisible({ timeout: 5_000 });
        await pendingBadge.click();

        // El badge cambia a pagado
        const paidBadge = page.locator('[title="Marcar como no pagado"]').first();
        await expect(paidBadge).toBeVisible({ timeout: 5_000 });
    });

    test("el contador X / Y pagados es visible para el organizador", async ({ page }) => {
        await expect(page.locator("text=/ 1 pagados").or(page.locator("text=0 / 1 pagados"))).toBeVisible({ timeout: 5_000 });
    });

    test("el organizador puede desmarcar un jugador como pagado", async ({ page }) => {
        // Marcar primero
        const pendingBadge = page.locator('[title="Marcar como pagado"]').first();
        await pendingBadge.click();
        const paidBadge = page.locator('[title="Marcar como no pagado"]').first();
        await expect(paidBadge).toBeVisible({ timeout: 5_000 });

        // Desmarcar
        await paidBadge.click();
        await expect(page.locator('[title="Marcar como pagado"]').first()).toBeVisible({ timeout: 5_000 });
    });
});
```

- [ ] **Step 2: Ejecutar los tests**

```bash
npx playwright test e2e/matches-payment.spec.ts --headed
```

Esperado: los 4 tests pasan. Si alguno falla, revisar que la migración está aplicada y que el servidor está corriendo (`npm run dev`).

- [ ] **Step 3: Commit**

```bash
git add e2e/matches-payment.spec.ts
git commit -m "test(e2e): tests del sistema de pagos anti-morosidad"
```

---

## Task 6: Push y verificación final

- [ ] **Step 1: Verificar build de producción**

```bash
npm run build
```

Esperado: sin errores de compilación.

- [ ] **Step 2: Push**

```bash
git push origin main
```

- [ ] **Step 3: Verificación manual**

1. Abrir un partido abierto como organizador → ver badge `CircleDashed` gris junto a cada jugador y contador "0 / N pagados"
2. Hacer click en el badge de un jugador → badge cambia a `CheckCircle2` verde, contador sube a "1 / N"
3. Hacer click de nuevo → vuelve a gris, contador baja
4. Abrir la misma URL en incógnito (usuario diferente) → ver los badges pero sin poder hacer click (solo visual)
5. Cambiar el estado del partido a `closed` o `finished` → los badges desaparecen
