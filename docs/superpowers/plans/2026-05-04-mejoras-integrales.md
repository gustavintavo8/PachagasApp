# Mejoras Integrales de Pachanga App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mejorar rendimiento, calidad de código, cobertura de tests y accesibilidad/SEO de Pachanga App en cuatro workstreams independientes.

**Architecture:** Plan dividido en 4 fases. Las fases 1 y 2 comparten `src/app/matches/actions.ts` — ejecutarlas en secuencia o coordinar ese archivo. Las fases 3 y 4 son completamente independientes. Cada fase produce código funcional y testeable por sí sola.

**Tech Stack:** Next.js 16.1.6, React 19, Supabase (PostgreSQL + Auth), TypeScript, Tailwind CSS 4, Playwright, Zod

---

## File Map

### Fase 1 — Rendimiento
- **Create:** `supabase/migrations/20260504_add_indexes.sql`
- **Modify:** `next.config.ts`
- **Modify:** `src/app/leaderboard/page.tsx`
- **Modify:** `src/app/players/page.tsx`
- **Modify:** `src/app/players/[id]/page.tsx`
- **Modify:** `src/app/matches/actions.ts`
- **Modify:** `src/app/matches/[id]/MatchDetail.tsx`

### Fase 2 — Calidad de Código
- **Modify:** `src/lib/types.ts`
- **Create:** `src/lib/errors.ts`
- **Create:** `src/lib/notifications.ts`
- **Modify:** `src/app/matches/actions.ts`
- **Modify:** `src/app/login/actions.ts`
- **Modify:** `src/app/profile/actions.ts`
- **Modify:** `src/app/fantasy/actions.ts`

### Fase 3 — Testing
- **Create:** `e2e/pages/MatchPage.ts`
- **Create:** `e2e/pages/LeaderboardPage.ts`
- **Create:** `e2e/fixtures/auth.ts`
- **Modify:** `playwright.config.ts`
- **Modify:** `e2e/matches-join.spec.ts`
- **Modify:** `e2e/matches-payment.spec.ts`
- **Modify:** `e2e/matches-score.spec.ts`
- **Create:** `e2e/a11y.spec.ts`

### Fase 4 — Visibilidad y UX
- **Modify:** `src/app/layout.tsx`
- **Modify:** `src/components/BottomNav.tsx`
- **Modify:** `src/components/Navbar.tsx`
- **Modify:** `src/app/globals.css`
- **Create:** `src/app/robots.ts`
- **Create:** `src/app/sitemap.ts`
- **Modify:** `src/app/matches/[id]/page.tsx`
- **Modify:** `src/app/players/[id]/page.tsx`

---

## FASE 1 — Rendimiento y Escalabilidad

---

### Task 1: Índices de base de datos

**Files:**
- Create: `supabase/migrations/20260504_add_indexes.sql`

- [ ] **Crear el archivo de migración**

```sql
-- supabase/migrations/20260504_add_indexes.sql

-- Consultas de participantes por partido (match detail, score, teams)
CREATE INDEX IF NOT EXISTS idx_match_participants_match_id
  ON match_participants(match_id);

-- Consultas de participantes por usuario (dashboard, history)
CREATE INDEX IF NOT EXISTS idx_match_participants_user_id
  ON match_participants(user_id);

-- Votos MVP por partido
CREATE INDEX IF NOT EXISTS idx_mvp_votes_match_id
  ON mvp_votes(match_id);

-- Notificaciones no leídas del usuario
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, read) WHERE read = false;

-- Historial de ELO por usuario (gráfica en perfil)
CREATE INDEX IF NOT EXISTS idx_rp_history_user_id
  ON rp_history(user_id);
```

- [ ] **Aplicar migración en Supabase local**

```bash
npx supabase db push
```

Expected: `Applied 1 migration` o `Migration already applied`

- [ ] **Verificar que los índices existen**

```bash
npx supabase db query "SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%' ORDER BY tablename;"
```

Expected: Los 5 índices aparecen en la lista.

- [ ] **Commit**

```bash
git add supabase/migrations/20260504_add_indexes.sql
git commit -m "perf(db): añadir índices en match_participants, mvp_votes, notifications, rp_history"
```

---

### Task 2: Activar Cache Components (PPR)

**Files:**
- Modify: `next.config.ts`

- [ ] **Actualizar next.config.ts**

Reemplazar el contenido actual:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  cacheComponents: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
```

- [ ] **Verificar que el build funciona**

```bash
npm run build
```

Expected: Build exitoso. Las páginas sin `'use cache'` siguen siendo dinámicas.

- [ ] **Commit**

```bash
git add next.config.ts
git commit -m "perf(config): activar cacheComponents para PPR"
```

---

### Task 3: Cachear datos del Leaderboard

**Files:**
- Modify: `src/app/leaderboard/page.tsx`

El check de auth permanece dinámico (usa cookies). La lógica de datos se extrae a una función con `'use cache'` que usa el admin client (no depende de cookies).

- [ ] **Actualizar leaderboard/page.tsx**

```typescript
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { LeaderboardTabs } from "./LeaderboardTabs";
import { getAdminUserIds } from "@/lib/permissions";
import { cacheLife, cacheTag } from "next/cache";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
    title: "Ranking — Pachanga",
    description: "Clasificación de los mejores jugadores de la comunidad.",
};

const PAGE_SIZE = 20;

export default async function LeaderboardPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string }>;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { page: pageParam } = await searchParams;
    const page = Math.max(1, parseInt(pageParam ?? "1", 10));

    const { leaderboardData, totalPages, adminUserIds } = await getLeaderboardData(page);

    return (
        <div className="mx-auto max-w-5xl px-4 py-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-foreground">Ranking</h1>
                <p className="text-muted">Los mejores jugadores de la comunidad</p>
            </div>
            <LeaderboardTabs data={leaderboardData} currentUserId={user.id} adminUserIds={adminUserIds} />
            {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                    {page > 1 && (
                        <Link href={`/leaderboard?page=${page - 1}`} className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-accent/30 hover:text-foreground">
                            ← Anterior
                        </Link>
                    )}
                    <span className="text-sm text-muted">{page} / {totalPages}</span>
                    {page < totalPages && (
                        <Link href={`/leaderboard?page=${page + 1}`} className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-accent/30 hover:text-foreground">
                            Siguiente →
                        </Link>
                    )}
                </div>
            )}
        </div>
    );
}

async function getLeaderboardData(page: number) {
    "use cache";
    cacheLife("hours");
    cacheTag("leaderboard");

    const admin = createAdminClient();
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const [{ data: profiles, count }, adminUserIds] = await Promise.all([
        admin
            .from("profiles")
            .select("*", { count: "exact" })
            .order("elo_rating", { ascending: false })
            .order("matches_played", { ascending: false })
            .range(from, to),
        getAdminUserIds(),
    ]);

    const profileIds = (profiles || []).map((p) => p.id);

    const { data: allParticipations } = profileIds.length > 0
        ? await admin
            .from("match_participants")
            .select("user_id, team, goals, is_mvp, matches(status, team_a_score, team_b_score)")
            .in("user_id", profileIds)
        : { data: [] };

    const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

    const statsMap: Record<string, { wins: number; draws: number; losses: number; mvps: number }> = {};

    if (allParticipations) {
        for (const p of allParticipations) {
            const match = p.matches as unknown as { status: string; team_a_score: number | null; team_b_score: number | null };
            if (!match || match.status !== "finished" || match.team_a_score === null || match.team_b_score === null || !p.team) continue;
            if (!statsMap[p.user_id]) statsMap[p.user_id] = { wins: 0, draws: 0, losses: 0, mvps: 0 };
            const myScore = p.team === "A" ? match.team_a_score : match.team_b_score;
            const oppScore = p.team === "A" ? match.team_b_score : match.team_a_score;
            if (myScore > oppScore) statsMap[p.user_id].wins++;
            else if (myScore === oppScore) statsMap[p.user_id].draws++;
            else statsMap[p.user_id].losses++;
            if (p.is_mvp) statsMap[p.user_id].mvps++;
        }
    }

    const leaderboardData = (profiles || []).map((p) => ({
        id: p.id,
        username: p.username,
        avatar_url: p.avatar_url,
        position: p.position,
        skill_level: p.skill_level,
        elo_rating: p.elo_rating ?? 1000,
        matches_played: p.matches_played ?? 0,
        goals_scored: p.goals_scored ?? 0,
        wins: statsMap[p.id]?.wins ?? 0,
        draws: statsMap[p.id]?.draws ?? 0,
        losses: statsMap[p.id]?.losses ?? 0,
        mvps: statsMap[p.id]?.mvps ?? 0,
    }));

    return { leaderboardData, totalPages, adminUserIds };
}
```

- [ ] **Verificar que la página sigue funcionando**

```bash
npm run dev
```

Navegar a `http://localhost:3000/leaderboard`. Expected: la tabla de ranking carga correctamente.

- [ ] **Verificar que la invalidación funciona**

Tras un `markAsPaid` u otro action que mute el ELO, añadir al action correspondiente:

```typescript
import { revalidateTag } from "next/cache";
// Al final del action que cambia ELO:
revalidateTag("leaderboard");
revalidateTag("players");
```

Por ahora esta línea se añadirá en Task 6 junto con el refactor de `setScore`.

- [ ] **Commit**

```bash
git add src/app/leaderboard/page.tsx
git commit -m "perf(leaderboard): cachear datos con use cache + cacheLife hours"
```

---

### Task 4: Cachear lista de jugadores

**Files:**
- Modify: `src/app/players/page.tsx`

- [ ] **Leer el archivo actual**

```bash
# Revisar el archivo para entender su estructura actual antes de modificar
```

- [ ] **Actualizar players/page.tsx**

El patrón es idéntico al leaderboard: auth check dinámico + datos cacheados con admin client.

```typescript
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { cacheLife, cacheTag } from "next/cache";
import { PlayersList } from "./PlayersList";

export default async function PlayersPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string; q?: string }>;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { page: pageParam, q } = await searchParams;
    const page = Math.max(1, parseInt(pageParam ?? "1", 10));
    const query = q ?? "";

    const { players, totalPages } = await getPlayersData(page, query);

    return <PlayersList players={players} totalPages={totalPages} currentPage={page} currentUserId={user.id} />;
}

async function getPlayersData(page: number, query: string) {
    "use cache";
    cacheLife("hours");
    cacheTag("players");

    const admin = createAdminClient();
    const PAGE_SIZE = 20;
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let req = admin
        .from("profiles")
        .select("*", { count: "exact" })
        .order("elo_rating", { ascending: false })
        .range(from, to);

    if (query) {
        req = req.ilike("username", `%${query}%`);
    }

    const { data: players, count } = await req;

    return {
        players: players ?? [],
        totalPages: Math.ceil((count ?? 0) / PAGE_SIZE),
    };
}
```

**Nota:** Si `PlayersList` recibe props diferentes, adaptar los nombres de props manteniendo la misma lógica de datos.

- [ ] **Verificar en navegador**

```bash
npm run dev
```

Navegar a `http://localhost:3000/players`. Expected: lista de jugadores carga.

- [ ] **Commit**

```bash
git add src/app/players/page.tsx
git commit -m "perf(players): cachear lista con use cache + cacheLife hours"
```

---

### Task 5: Paralelizar actualizaciones de ELO en setScore

**Files:**
- Modify: `src/app/matches/actions.ts` (solo el bucle de ELO, ~líneas 354-370)

- [ ] **Localizar el bucle secuencial**

En `src/app/matches/actions.ts`, buscar:

```typescript
// Bulk update ELO ratings and history
for (const update of eloUpdates) {
    const { error: updateError } = await adminSupabase
        .from("profiles")
        .update({ elo_rating: update.newRating, market_value: Math.max(1_000_000, (update.newRating - 800) * 50_000) })
        .eq("id", update.userId);

    if (!updateError) {
        await adminSupabase
            .from("rp_history")
            .insert({
                user_id: update.userId,
                match_id: validData.matchId,
                rp_change: update.delta,
                new_rp: update.newRating,
                created_at: new Date().toISOString()
            });
    }
}
```

- [ ] **Reemplazar con Promise.all**

```typescript
// Bulk update ELO ratings and history (paralelo)
await Promise.all(
    eloUpdates.map(async (update) => {
        const { error: updateError } = await adminSupabase
            .from("profiles")
            .update({
                elo_rating: update.newRating,
                market_value: Math.max(1_000_000, (update.newRating - 800) * 50_000),
            })
            .eq("id", update.userId);

        if (!updateError) {
            await adminSupabase
                .from("rp_history")
                .insert({
                    user_id: update.userId,
                    match_id: validData.matchId,
                    rp_change: update.delta,
                    new_rp: update.newRating,
                    created_at: new Date().toISOString(),
                });
        }
    })
);
```

- [ ] **Añadir revalidación de cache al final de setScore**

Al final de `setScore`, antes del `return { success: true }`, añadir:

```typescript
import { revalidateTag } from "next/cache";

// Al final de setScore, antes del return:
revalidateTag("leaderboard");
revalidateTag("players");
```

Asegurarse de que `revalidateTag` está importado en la parte superior del archivo.

- [ ] **Paralelizar también el bucle de generación de equipos**

En `generateTeams`, buscar:

```typescript
for (const assignment of assignments) {
    await supabase
        .from("match_participants")
        .update({ team: assignment.team })
        .eq("match_id", matchId)
        .eq("user_id", assignment.user_id);
}
```

Reemplazar por:

```typescript
await Promise.all(
    assignments.map((assignment) =>
        supabase
            .from("match_participants")
            .update({ team: assignment.team })
            .eq("match_id", matchId)
            .eq("user_id", assignment.user_id)
    )
);
```

- [ ] **Verificar que el flujo de resultado sigue funcionando**

```bash
npm run dev
```

Crear un partido de prueba, añadir jugadores, generar equipos, poner resultado. Verificar que el ELO se actualiza correctamente.

- [ ] **Commit**

```bash
git add src/app/matches/actions.ts
git commit -m "perf(actions): Promise.all en loops de ELO y equipos, revalidar cache tags"
```

---

### Task 6: Dynamic imports para componentes pesados

**Files:**
- Modify: `src/app/matches/[id]/MatchDetail.tsx`
- Modify: `src/app/players/[id]/page.tsx`

- [ ] **Añadir dynamic import de PlayerCharts en MatchDetail.tsx**

En `src/app/matches/[id]/MatchDetail.tsx`, localizar dónde se importa y usa `PlayerCharts` (si existe en ese componente). Si no está en MatchDetail, buscar en `src/app/players/[id]/page.tsx`.

En el archivo donde se usa `PlayerCharts`, cambiar:

```typescript
// Eliminar: import { PlayerCharts } from "@/components/PlayerCharts";

// Añadir en su lugar:
import dynamic from "next/dynamic";

const PlayerCharts = dynamic(
    () => import("@/components/PlayerCharts").then((m) => m.PlayerCharts ?? m.default),
    {
        ssr: false,
        loading: () => (
            <div className="h-48 w-full animate-pulse rounded-lg bg-surface" />
        ),
    }
);
```

- [ ] **Añadir dynamic import de WeatherWidget**

En el archivo donde se usa `WeatherWidget`:

```typescript
// Eliminar: import { WeatherWidget } from "@/components/WeatherWidget";

// Añadir:
const WeatherWidget = dynamic(
    () => import("@/components/WeatherWidget").then((m) => m.WeatherWidget ?? m.default),
    {
        ssr: false,
        loading: () => (
            <div className="h-20 w-full animate-pulse rounded-lg bg-surface" />
        ),
    }
);
```

- [ ] **Añadir dynamic import de SoccerPitch**

En el archivo donde se usa `SoccerPitch`:

```typescript
// Eliminar: import { SoccerPitch } from "@/components/SoccerPitch";

// Añadir:
const SoccerPitch = dynamic(
    () => import("@/components/SoccerPitch").then((m) => m.SoccerPitch ?? m.default),
    {
        ssr: false,
        loading: () => (
            <div className="aspect-video w-full animate-pulse rounded-lg bg-surface" />
        ),
    }
);
```

- [ ] **Verificar que los componentes cargan correctamente**

```bash
npm run dev
```

Navegar a una página de jugador y a un partido con equipos generados. Expected: los componentes aparecen tras un breve flash del skeleton.

- [ ] **Verificar el bundle con build**

```bash
npm run build
```

Expected: En el output de build, `PlayerCharts` aparece como un chunk separado (lazy loaded), no en el bundle principal.

- [ ] **Commit**

```bash
git add src/app/matches/[id]/MatchDetail.tsx src/app/players/[id]/page.tsx
git commit -m "perf(bundle): dynamic imports para PlayerCharts, WeatherWidget, SoccerPitch"
```

---

## FASE 2 — Calidad de Código

---

### Task 7: ActionResult<T> discriminated union y ParticipantProfile en types.ts

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Actualizar src/lib/types.ts**

Añadir al final del archivo existente (sin modificar los tipos ya existentes):

```typescript
// ─── Server Action Results ────────────────────────────────────────────────────

/**
 * Tipo de retorno estándar para server actions.
 * Usar narrowing: if (!result.success) { /* result.error disponible *\/ }
 */
export type ActionResult<T = void> =
    | { success: true; data: T }
    | { success: false; error: string };

// ─── Tipos internos de actions ────────────────────────────────────────────────

export type ParticipantProfile = {
    elo_rating: number | null;
    matches_played: number | null;
    position: string | null;
};
```

- [ ] **Verificar que TypeScript compila**

```bash
npx tsc --noEmit
```

Expected: Sin errores (los tipos nuevos aún no están en uso).

- [ ] **Commit**

```bash
git add src/lib/types.ts
git commit -m "types: añadir ActionResult<T> discriminated union y ParticipantProfile"
```

---

### Task 8: Crear src/lib/errors.ts

**Files:**
- Create: `src/lib/errors.ts`

- [ ] **Crear el módulo de errores**

```typescript
// src/lib/errors.ts
import type { PostgrestError } from "@supabase/supabase-js";

const PG_ERROR_MAP: Record<string, string> = {
    "23505": "Ya existe un registro con esos datos",
    "23503": "El recurso relacionado no existe",
    "23514": "Los datos no cumplen las restricciones requeridas",
    "42501": "No tienes permiso para realizar esta acción",
    "PGRST116": "Registro no encontrado",
};

/**
 * Traduce errores de Postgres/Supabase a mensajes en español orientados al usuario.
 * Los detalles técnicos solo van a console.error del servidor.
 */
export function mapSupabaseError(error: PostgrestError): string {
    console.error("[DB Error]", error.code, error.message, error.details);
    return PG_ERROR_MAP[error.code] ?? "Ha ocurrido un error inesperado";
}
```

- [ ] **Verificar que TypeScript compila**

```bash
npx tsc --noEmit
```

Expected: Sin errores.

- [ ] **Commit**

```bash
git add src/lib/errors.ts
git commit -m "feat(lib): añadir mapSupabaseError para mensajes de error en español"
```

---

### Task 9: Extraer sendNotification a src/lib/notifications.ts

**Files:**
- Create: `src/lib/notifications.ts`
- Modify: `src/app/matches/actions.ts`

- [ ] **Crear src/lib/notifications.ts**

```typescript
// src/lib/notifications.ts
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Envía notificaciones a múltiples usuarios.
 * Usa admin client para poder insertar en notifications sin restricciones RLS.
 */
export async function sendNotification(
    userIds: string[],
    type: string,
    title: string,
    message: string,
    matchId?: string
): Promise<void> {
    if (userIds.length === 0) return;
    const admin = createAdminClient();
    const rows = userIds.map((uid) => ({
        user_id: uid,
        type,
        title,
        message,
        match_id: matchId ?? null,
    }));
    const { error } = await admin.from("notifications").insert(rows);
    if (error) {
        console.error("[notifications] Error al enviar notificación:", error.message);
    }
}
```

- [ ] **Actualizar el import en matches/actions.ts**

En `src/app/matches/actions.ts`:

1. Eliminar la función `sendNotification` local (las ~15 líneas de la función interna).
2. Añadir al bloque de imports:

```typescript
import { sendNotification } from "@/lib/notifications";
```

- [ ] **Verificar que TypeScript compila**

```bash
npx tsc --noEmit
```

Expected: Sin errores. Las llamadas a `sendNotification` en actions.ts siguen funcionando.

- [ ] **Commit**

```bash
git add src/lib/notifications.ts src/app/matches/actions.ts
git commit -m "refactor(notifications): extraer sendNotification a lib/notifications.ts"
```

---

### Task 10: Extraer helpers de setScore

**Files:**
- Modify: `src/app/matches/actions.ts`

`setScore` actualmente hace 4 cosas en ~300 líneas. Se extrae cada responsabilidad a una función interna tipada. La función orquestadora queda < 60 líneas.

- [ ] **Añadir la función applyEloUpdates justo antes de setScore**

```typescript
// ─── Helper: actualizar ELO de participantes ──────────────────────────────────
async function applyEloUpdates(
    adminSupabase: ReturnType<typeof createAdminClient>,
    matchId: string,
    teamAScore: number,
    teamBScore: number,
    participants: Array<{
        user_id: string;
        team: "A" | "B" | null;
        goals: number | null;
        is_mvp: boolean | null;
        profiles: ParticipantProfile | ParticipantProfile[] | null;
    }>
): Promise<void> {
    const eloInputs = participants
        .filter((p) => p.team === "A" || p.team === "B")
        .map((p) => {
            const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
            return {
                userId: p.user_id,
                currentRating: profile?.elo_rating ?? ELO_BASE,
                matchesPlayed: profile?.matches_played ?? 0,
                team: p.team as "A" | "B",
                position: (profile?.position ?? "MID") as "GK" | "DEF" | "MID" | "FWD",
                goalsScored: p.goals ?? 0,
                isMvp: p.is_mvp ?? false,
            };
        });

    if (eloInputs.length === 0) return;

    const eloUpdates = computeMatchEloUpdates(eloInputs, teamAScore, teamBScore);

    await Promise.all(
        eloUpdates.map(async (update) => {
            const { error: updateError } = await adminSupabase
                .from("profiles")
                .update({
                    elo_rating: update.newRating,
                    market_value: Math.max(1_000_000, (update.newRating - 800) * 50_000),
                })
                .eq("id", update.userId);

            if (!updateError) {
                await adminSupabase.from("rp_history").insert({
                    user_id: update.userId,
                    match_id: matchId,
                    rp_change: update.delta,
                    new_rp: update.newRating,
                    created_at: new Date().toISOString(),
                });
            }
        })
    );
}
```

- [ ] **Añadir la función applyFantasyPoints**

```typescript
// ─── Helper: calcular y asignar puntos fantasy ────────────────────────────────
async function applyFantasyPoints(
    adminSupabase: ReturnType<typeof createAdminClient>,
    matchId: string,
    teamAScore: number,
    teamBScore: number,
    participants: Array<{
        user_id: string;
        team: "A" | "B" | null;
        goals: number | null;
        profiles: ParticipantProfile | ParticipantProfile[] | null;
    }>
): Promise<void> {
    const mvpParticipant = await adminSupabase
        .from("match_participants")
        .select("user_id")
        .eq("match_id", matchId)
        .eq("is_mvp", true)
        .maybeSingle();

    const mvpUserId = mvpParticipant.data?.user_id ?? null;
    const teamPointsMap: Record<string, number> = {};

    for (const p of participants) {
        const pTeam = p.team as "A" | "B" | null;
        if (pTeam !== "A" && pTeam !== "B") continue;

        const goals = p.goals ?? 0;
        const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
        const position = profile?.position ?? "MID";
        const conceded = pTeam === "A" ? teamBScore : teamAScore;

        let pts = 2;
        if (teamAScore === teamBScore) pts += 1;
        else if ((pTeam === "A" && teamAScore > teamBScore) || (pTeam === "B" && teamBScore > teamAScore)) pts += 3;
        pts += goals * 3;
        if ((position === "GK" || position === "DEF") && conceded === 0) pts += 4;

        const { data: rosterEntries } = await adminSupabase
            .from("fantasy_rosters")
            .select("team_id, is_captain, is_starter")
            .eq("player_id", p.user_id);

        if (!rosterEntries) continue;

        for (const entry of rosterEntries) {
            if (!entry.is_starter) continue;
            let earned = pts;
            if (entry.is_captain) {
                const isMvp = p.user_id === mvpUserId;
                const multiplier = (position === "GK" && conceded === 0) || isMvp ? 3 : 2;
                earned = pts * multiplier;
            }
            teamPointsMap[entry.team_id] = (teamPointsMap[entry.team_id] ?? 0) + earned;
        }
    }

    await Promise.all(
        Object.entries(teamPointsMap).map(async ([teamId, earned]) => {
            const { data: ft } = await adminSupabase
                .from("fantasy_teams")
                .select("total_points")
                .eq("id", teamId)
                .single();
            await adminSupabase
                .from("fantasy_teams")
                .update({ total_points: (ft?.total_points ?? 0) + earned })
                .eq("id", teamId);
        })
    );
}
```

- [ ] **Simplificar la función setScore para que use los helpers**

La sección del bloque ELO+Fantasy de `setScore` (que empieza con `if (!isAlreadyFinished)`) se reemplaza por:

```typescript
if (!isAlreadyFinished) {
    const { data: eloParticipants } = await adminSupabase
        .from("match_participants")
        .select("user_id, team, goals, is_mvp, profiles(elo_rating, matches_played, position)")
        .eq("match_id", validData.matchId);

    if (eloParticipants && eloParticipants.length > 0) {
        await applyEloUpdates(
            adminSupabase,
            validData.matchId,
            validData.teamAScore,
            validData.teamBScore,
            eloParticipants as Parameters<typeof applyEloUpdates>[4]
        );

        await applyFantasyPoints(
            adminSupabase,
            validData.matchId,
            validData.teamAScore,
            validData.teamBScore,
            eloParticipants as Parameters<typeof applyFantasyPoints>[4]
        );
    }
}
```

- [ ] **Eliminar el import de ParticipantProfile local** (ya viene de `@/lib/types`)

Al inicio de `actions.ts`, el tipo `interface ParticipantProfile` definido inline debe eliminarse y en su lugar importar desde tipos:

```typescript
import type { ParticipantProfile } from "@/lib/types";
```

- [ ] **Verificar que TypeScript compila**

```bash
npx tsc --noEmit
```

Expected: Sin errores.

- [ ] **Verificar que el flujo de resultado sigue funcionando manualmente**

```bash
npm run dev
```

Poner resultado en un partido. Verificar que el ELO se actualiza en el leaderboard.

- [ ] **Commit**

```bash
git add src/app/matches/actions.ts src/lib/types.ts
git commit -m "refactor(actions): extraer applyEloUpdates y applyFantasyPoints de setScore"
```

---

### Task 11: Actualizar server actions con ActionResult<T>

**Files:**
- Modify: `src/app/matches/actions.ts`
- Modify: `src/app/login/actions.ts`
- Modify: `src/app/profile/actions.ts`

- [ ] **Actualizar el tipo en matches/actions.ts**

1. Eliminar la línea `type ActionResult = { success: boolean; error?: string; data?: unknown };`
2. Añadir al bloque de imports:

```typescript
import type { ActionResult } from "@/lib/types";
```

3. Las firmas de funciones actuales como `Promise<ActionResult>` ahora usan el tipo genérico. Para funciones que no retornan datos: `Promise<ActionResult<void>>`. Para funciones que retornan el ID del match creado: `Promise<ActionResult<{ id: string }>>`.

4. Los `return { success: true }` sin data se quedan igual (TypeScript inferirá `ActionResult<void>`). Los `return { success: false, error: "..." }` también se quedan igual.

- [ ] **Actualizar login/actions.ts**

```typescript
import type { ActionResult } from "@/lib/types";
// Eliminar cualquier definición local de ActionResult
// Las firmas de funciones pasan a: Promise<ActionResult<void>>
```

- [ ] **Actualizar profile/actions.ts**

```typescript
import type { ActionResult } from "@/lib/types";
// Mismo patrón
```

- [ ] **Verificar compilación**

```bash
npx tsc --noEmit
```

Expected: Sin errores. Si hay errores de tipo en call sites (componentes que leen `.data`), actualizar el narrowing:

```typescript
// Antes
const result = await someAction()
if (result.success) { /* ok */ }

// Después (igual, funciona porque el discriminated union es compatible)
const result = await someAction()
if (!result.success) { showError(result.error); return; }
// Aquí result.data está disponible con su tipo correcto
```

- [ ] **Commit**

```bash
git add src/app/matches/actions.ts src/app/login/actions.ts src/app/profile/actions.ts
git commit -m "refactor(types): usar ActionResult<T> discriminated union en server actions"
```

---

## FASE 3 — Testing

---

### Task 12: Crear Page Object Model — MatchPage

**Files:**
- Create: `e2e/pages/MatchPage.ts`

- [ ] **Crear e2e/pages/MatchPage.ts**

```typescript
// e2e/pages/MatchPage.ts
import { type Page, type Locator, expect } from "@playwright/test";

export class MatchPage {
    readonly page: Page;
    readonly joinButton: Locator;
    readonly leaveButton: Locator;
    readonly participantsList: Locator;

    constructor(page: Page) {
        this.page = page;
        this.joinButton = page.locator('button:has-text("Unirse"), button:has-text("Apuntarme")');
        this.leaveButton = page.locator('button:has-text("Salir"), button:has-text("Abandonar")');
        this.participantsList = page.locator('[data-testid="participants-list"], .participants-list, [aria-label*="participantes"]');
    }

    async goto(matchId: string) {
        await this.page.goto(`/matches/${matchId}`);
        await this.page.waitForLoadState("networkidle");
    }

    async join() {
        await this.joinButton.click();
        await expect(this.leaveButton).toBeVisible({ timeout: 5_000 });
    }

    async leave() {
        await this.leaveButton.click();
        await expect(this.joinButton).toBeVisible({ timeout: 5_000 });
    }

    async markAsPaid() {
        const pendingBadge = this.page.locator('[title="Marcar como pagado"]').first();
        await expect(pendingBadge).toBeVisible({ timeout: 5_000 });
        await pendingBadge.click();
        await expect(this.page.locator('[title="Marcar como no pagado"]').first()).toBeVisible({ timeout: 5_000 });
    }

    async markAsUnpaid() {
        const paidBadge = this.page.locator('[title="Marcar como no pagado"]').first();
        await expect(paidBadge).toBeVisible({ timeout: 5_000 });
        await paidBadge.click();
        await expect(this.page.locator('[title="Marcar como pagado"]').first()).toBeVisible({ timeout: 5_000 });
    }

    async expectPaidCount(paid: number, total: number) {
        await expect(
            this.page.locator(`text=${paid} / ${total} pagados`).or(
                this.page.locator(`text=/ ${total} pagados`)
            )
        ).toBeVisible({ timeout: 5_000 });
    }

    /** Crea un partido desde la UI y retorna su ID desde la URL */
    async createMatch(location: string, minutesFromNow = 2880): Promise<string> {
        await this.page.goto("/");
        await this.page
            .locator("text=Nuevo partido")
            .or(this.page.locator("text=Crear partido"))
            .click();

        const futureDate = new Date(Date.now() + minutesFromNow * 60 * 1000);
        await this.page
            .locator('input[type="datetime-local"]')
            .fill(futureDate.toISOString().slice(0, 16));
        await this.page
            .locator('input[placeholder*="ubicación"], input[placeholder*="lugar"], input[name="location"]')
            .fill(location);
        await this.page.locator('button[type="submit"]').click();

        await this.page.waitForURL(/\/matches\/[a-f0-9-]+/, { timeout: 10_000 });
        return this.page.url().split("/matches/")[1];
    }
}
```

- [ ] **Crear e2e/pages/LeaderboardPage.ts**

```typescript
// e2e/pages/LeaderboardPage.ts
import { type Page, type Locator, expect } from "@playwright/test";

export class LeaderboardPage {
    readonly page: Page;
    readonly rankingTable: Locator;
    readonly nextPageLink: Locator;
    readonly prevPageLink: Locator;

    constructor(page: Page) {
        this.page = page;
        this.rankingTable = page.locator("table, [role='table'], .leaderboard");
        this.nextPageLink = page.locator("text=Siguiente");
        this.prevPageLink = page.locator("text=Anterior");
    }

    async goto() {
        await this.page.goto("/leaderboard");
        await this.page.waitForLoadState("networkidle");
    }

    async expectHeading() {
        await expect(this.page.locator("h1")).toContainText("Ranking");
    }

    async goToNextPage() {
        await this.nextPageLink.click();
        await this.page.waitForLoadState("networkidle");
    }
}
```

- [ ] **Verificar que los archivos se crean correctamente**

```bash
npx tsc --noEmit --project tsconfig.json
```

Expected: Sin errores de TypeScript en los nuevos archivos.

- [ ] **Commit**

```bash
git add e2e/pages/
git commit -m "test(pom): añadir MatchPage y LeaderboardPage (Page Object Model)"
```

---

### Task 13: Refactorizar tests existentes para usar MatchPage + añadir tags

**Files:**
- Modify: `e2e/matches-payment.spec.ts`
- Modify: `e2e/matches-join.spec.ts`

- [ ] **Actualizar matches-payment.spec.ts**

```typescript
import { test, expect } from "@playwright/test";
import { deleteMatch } from "./helpers/db";
import { MatchPage } from "./pages/MatchPage";

let createdMatchId: string | null = null;

test.afterAll(async () => {
    if (createdMatchId) {
        await deleteMatch(createdMatchId);
        createdMatchId = null;
    }
});

test.describe("Sistema de pagos (anti-morosidad) @smoke @critical", () => {
    test.beforeEach(async ({ page }) => {
        const matchPage = new MatchPage(page);
        createdMatchId = await matchPage.createMatch("Campo Pago Test");
    });

    test("el organizador ve el badge de pago pendiente para sí mismo @smoke", async ({ page }) => {
        const pendingBadge = page.locator('[title="Marcar como pagado"]').first();
        await expect(pendingBadge).toBeVisible({ timeout: 5_000 });
    });

    test("el organizador puede marcar un jugador como pagado @critical", async ({ page }) => {
        const matchPage = new MatchPage(page);
        await matchPage.markAsPaid();
    });

    test("el contador X / Y pagados es visible para el organizador", async ({ page }) => {
        const matchPage = new MatchPage(page);
        await matchPage.expectPaidCount(0, 1);
    });

    test("el organizador puede desmarcar un jugador como pagado @critical", async ({ page }) => {
        const matchPage = new MatchPage(page);
        await matchPage.markAsPaid();
        await matchPage.markAsUnpaid();
    });
});
```

- [ ] **Añadir tags a matches-join.spec.ts**

Abrir `e2e/matches-join.spec.ts` y añadir `@smoke` al describe y `@critical` a los tests de join/leave:

```typescript
test.describe("Unirse y abandonar partidos @smoke", () => {
    test("el usuario puede unirse a un partido @smoke @critical", async ({ page }) => {
        // ... contenido existente sin cambios
    });
    // ... etc
});
```

- [ ] **Añadir tags a matches-score.spec.ts**

```typescript
test.describe("Resultado de partido @critical", () => {
    test("el organizador puede establecer el resultado @critical", async ({ page }) => {
        // ... contenido existente sin cambios
    });
});
```

- [ ] **Ejecutar los tests modificados para verificar que siguen pasando**

```bash
npx playwright test e2e/matches-payment.spec.ts e2e/matches-join.spec.ts --reporter=list
```

Expected: Todos los tests pasan.

- [ ] **Commit**

```bash
git add e2e/matches-payment.spec.ts e2e/matches-join.spec.ts e2e/matches-score.spec.ts
git commit -m "test: refactorizar specs de pagos y join para usar MatchPage + añadir tags @smoke @critical"
```

---

### Task 14: Añadir proyectos móviles y test de accesibilidad

**Files:**
- Modify: `playwright.config.ts`
- Create: `e2e/a11y.spec.ts`

- [ ] **Actualizar playwright.config.ts para añadir proyectos móviles y filtrado por tags**

```typescript
import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

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
            // En CI, solo correr @smoke si se pasa --grep @smoke
        },
        {
            name: "mobile-chrome",
            use: { ...devices["Pixel 5"] },
            grep: /@mobile|@smoke/,
        },
        {
            name: "mobile-safari",
            use: { ...devices["iPhone 13"] },
            grep: /@mobile|@smoke/,
        },
    ],
    webServer: {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
    },
});
```

- [ ] **Instalar @axe-core/playwright**

```bash
npm install --save-dev @axe-core/playwright
```

Expected: Paquete instalado sin errores.

- [ ] **Crear e2e/a11y.spec.ts**

```typescript
// e2e/a11y.spec.ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Accesibilidad WCAG 2.2 @smoke", () => {
    test("leaderboard no tiene violaciones de accesibilidad @smoke", async ({ page }) => {
        await page.goto("/leaderboard");
        await page.waitForLoadState("networkidle");

        const results = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
            .analyze();

        expect(
            results.violations,
            `Violaciones de accesibilidad encontradas:\n${results.violations
                .map((v) => `  [${v.impact}] ${v.id}: ${v.description}`)
                .join("\n")}`
        ).toEqual([]);
    });

    test("página de jugadores no tiene violaciones de accesibilidad @smoke", async ({ page }) => {
        await page.goto("/players");
        await page.waitForLoadState("networkidle");

        const results = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
            .analyze();

        expect(
            results.violations,
            `Violaciones de accesibilidad encontradas:\n${results.violations
                .map((v) => `  [${v.impact}] ${v.id}: ${v.description}`)
                .join("\n")}`
        ).toEqual([]);
    });

    test("dashboard no tiene violaciones de accesibilidad @smoke", async ({ page }) => {
        await page.goto("/");
        await page.waitForLoadState("networkidle");

        const results = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
            .analyze();

        expect(
            results.violations,
            `Violaciones de accesibilidad encontradas:\n${results.violations
                .map((v) => `  [${v.impact}] ${v.id}: ${v.description}`)
                .join("\n")}`
        ).toEqual([]);
    });
});
```

- [ ] **Ejecutar los tests de a11y (esperan fallar inicialmente — documentar las violaciones)**

```bash
npx playwright test e2e/a11y.spec.ts --reporter=list
```

Expected en este punto: Los tests pueden fallar con lista de violaciones. Anotar las violaciones encontradas; se corregirán en la Fase 4.

- [ ] **Commit**

```bash
git add playwright.config.ts e2e/a11y.spec.ts package.json package-lock.json
git commit -m "test(a11y): añadir tests axe-core WCAG 2.2 y proyectos móviles en Playwright"
```

---

## FASE 4 — Visibilidad y UX

---

### Task 15: Corregir layout.tsx — userScalable, skip link, main id

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Actualizar src/app/layout.tsx**

```typescript
// src/app/layout.tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { Navbar } from "@/components/Navbar";
import { NavbarSkeleton } from "@/components/NavbarSkeleton";
import { BottomNav } from "@/components/BottomNav";
import { ToastProvider } from "@/components/ui/Toast";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Pachanga — Organiza tus partidos de fútbol",
    description: "Organiza partidos de fútbol, equilibra equipos, lleva tus estadísticas y disfruta del deporte.",
};

export const viewport = {
    width: "device-width",
    initialScale: 1,
    // userScalable: false eliminado — viola WCAG 1.4.4 (Resize text)
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="es" className="dark">
            <head>
                <link rel="manifest" href="/manifest.json" />
                <meta name="theme-color" content="#ccff00" />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
            </head>
            <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
                {/* Skip link para usuarios de teclado/lectores de pantalla */}
                <a
                    href="#main-content"
                    className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-black focus:outline-none"
                >
                    Saltar al contenido principal
                </a>
                <ToastProvider>
                    <Suspense fallback={<NavbarSkeleton />}>
                        <Navbar />
                    </Suspense>
                    <main id="main-content" className="min-h-[calc(100vh-4rem)] pb-20 md:pb-0">
                        {children}
                    </main>
                    <BottomNav />
                </ToastProvider>
                <SpeedInsights />
            </body>
        </html>
    );
}
```

- [ ] **Verificar que el skip link funciona**

```bash
npm run dev
```

En `http://localhost:3000`, presionar Tab en el teclado. Expected: aparece el link "Saltar al contenido principal" visible en la esquina superior izquierda.

- [ ] **Commit**

```bash
git add src/app/layout.tsx
git commit -m "fix(a11y): eliminar userScalable:false, añadir skip link y main id"
```

---

### Task 16: Añadir aria-current y aria-hidden en BottomNav y Navbar

**Files:**
- Modify: `src/components/BottomNav.tsx`
- Modify: `src/components/Navbar.tsx`

- [ ] **Actualizar BottomNav.tsx**

```typescript
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Calendar, Users, Trophy, User } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
    { href: "/",        label: "Inicio",    Icon: Home     },
    { href: "/matches", label: "Partidos",  Icon: Calendar },
    { href: "/players", label: "Jugadores", Icon: Users    },
    { href: "/fantasy", label: "Fantasy",   Icon: Trophy   },
    { href: "/profile", label: "Perfil",    Icon: User     },
] as const;

export function BottomNav() {
    const pathname = usePathname();

    return (
        <nav
            aria-label="Navegación principal"
            className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface/95 backdrop-blur-xl md:hidden"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
            <div className="flex items-stretch">
                {tabs.map(({ href, label, Icon }) => {
                    const active =
                        href === "/"
                            ? pathname === "/"
                            : pathname === href || pathname.startsWith(href + "/");
                    return (
                        <Link
                            key={href}
                            href={href}
                            aria-current={active ? "page" : undefined}
                            aria-label={label}
                            className={cn(
                                "flex flex-1 flex-col items-center gap-1 py-2 transition-colors",
                                active ? "text-accent" : "text-muted"
                            )}
                        >
                            <span className={cn(
                                "flex h-8 w-8 items-center justify-center rounded-xl transition-colors",
                                active && "bg-accent/15"
                            )}>
                                <Icon size={18} aria-hidden="true" />
                            </span>
                            <span className={cn(
                                "text-[10px] font-medium",
                                active ? "text-accent" : "text-muted"
                            )}>
                                {label}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
```

- [ ] **Actualizar Navbar.tsx — añadir aria-current en los links activos**

En `src/components/Navbar.tsx` (o `NavbarClient.tsx`), localizar los links de navegación y añadir:

```typescript
// En cada link de la navbar, añadir:
aria-current={pathname === href ? "page" : undefined}
```

Si los iconos de la navbar no tienen texto visible, añadir `aria-label` con el nombre de la acción (ej: notificaciones, perfil).

- [ ] **Verificar con axe-core**

```bash
npx playwright test e2e/a11y.spec.ts --reporter=list
```

Expected: Los tests de a11y pasan (o las violaciones relacionadas con `aria-current` desaparecen).

- [ ] **Commit**

```bash
git add src/components/BottomNav.tsx src/components/Navbar.tsx src/components/NavbarClient.tsx
git commit -m "fix(a11y): añadir aria-current, aria-hidden y aria-label en navegación"
```

---

### Task 17: Añadir reduced-motion y content-visibility en globals.css

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Añadir al final de globals.css**

```css
/* ─── Accesibilidad: movimiento reducido ──────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* ─── Rendimiento: virtualización CSS en listas largas ───────────────────── */
/* Aplicar a filas del leaderboard y items del historial de partidos */
.leaderboard-row {
  content-visibility: auto;
  contain-intrinsic-size: 0 56px;
}

.match-history-item {
  content-visibility: auto;
  contain-intrinsic-size: 0 80px;
}

/* ─── Focus: scroll-margin para compensar el BottomNav fijo ─────────────── */
:focus-visible {
  scroll-margin-bottom: 80px;
  scroll-margin-top: 72px;
}
```

- [ ] **Añadir la clase CSS a los componentes correspondientes**

En `LeaderboardTabs.tsx`, añadir `className="leaderboard-row"` a cada fila de la tabla.

En el componente de historial de partidos, añadir `className="match-history-item"` a cada item.

- [ ] **Verificar que las animaciones se desactivan con prefers-reduced-motion**

En Chrome DevTools → Rendering → Emulate CSS media feature `prefers-reduced-motion: reduce`. Navegar la app. Expected: no hay transiciones ni animaciones visibles.

- [ ] **Commit**

```bash
git add src/app/globals.css
git commit -m "fix(a11y): añadir prefers-reduced-motion, content-visibility y scroll-margin"
```

---

### Task 18: Crear robots.ts y sitemap.ts

**Files:**
- Create: `src/app/robots.ts`
- Create: `src/app/sitemap.ts`

- [ ] **Crear src/app/robots.ts**

```typescript
// src/app/robots.ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: "*",
            allow: ["/", "/leaderboard", "/players", "/matches"],
            disallow: ["/api/", "/auth/", "/profile", "/fantasy"],
        },
        sitemap: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://pachanga.app"}/sitemap.xml`,
    };
}
```

- [ ] **Crear src/app/sitemap.ts**

```typescript
// src/app/sitemap.ts
import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://pachanga.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const admin = createAdminClient();

    // Partidos recientes y abiertos (públicos para SEO)
    const { data: matches } = await admin
        .from("matches")
        .select("id, date")
        .in("status", ["open", "finished"])
        .order("date", { ascending: false })
        .limit(50);

    const matchUrls: MetadataRoute.Sitemap = (matches ?? []).map((m) => ({
        url: `${BASE_URL}/matches/${m.id}`,
        lastModified: new Date(m.date),
        changeFrequency: "weekly" as const,
        priority: 0.6,
    }));

    // Perfiles de jugadores
    const { data: players } = await admin
        .from("profiles")
        .select("id")
        .not("username", "is", null)
        .limit(200);

    const playerUrls: MetadataRoute.Sitemap = (players ?? []).map((p) => ({
        url: `${BASE_URL}/players/${p.id}`,
        changeFrequency: "weekly" as const,
        priority: 0.5,
    }));

    return [
        {
            url: BASE_URL,
            changeFrequency: "daily",
            priority: 1.0,
        },
        {
            url: `${BASE_URL}/leaderboard`,
            changeFrequency: "daily",
            priority: 0.9,
        },
        {
            url: `${BASE_URL}/players`,
            changeFrequency: "daily",
            priority: 0.8,
        },
        {
            url: `${BASE_URL}/matches`,
            changeFrequency: "hourly",
            priority: 0.8,
        },
        ...matchUrls,
        ...playerUrls,
    ];
}
```

- [ ] **Añadir NEXT_PUBLIC_APP_URL al .env.local si no existe**

```bash
# Añadir al archivo .env.local (si no está ya):
echo "NEXT_PUBLIC_APP_URL=http://localhost:3000" >> .env.local
```

- [ ] **Verificar que sitemap.xml se genera**

```bash
npm run dev
```

Navegar a `http://localhost:3000/sitemap.xml`. Expected: XML con URLs de la app.
Navegar a `http://localhost:3000/robots.txt`. Expected: archivo robots.txt correctamente formateado.

- [ ] **Commit**

```bash
git add src/app/robots.ts src/app/sitemap.ts
git commit -m "feat(seo): añadir robots.ts y sitemap.ts dinámico"
```

---

### Task 19: Metadata dinámica y JSON-LD en página de partido

**Files:**
- Modify: `src/app/matches/[id]/page.tsx`

- [ ] **Añadir generateMetadata y JSON-LD**

En `src/app/matches/[id]/page.tsx`, añadir antes del export default:

```typescript
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://pachanga.app";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ id: string }>;
}): Promise<Metadata> {
    const { id } = await params;
    const admin = createAdminClient();

    const { data: match } = await admin
        .from("matches")
        .select("location, date, max_players, status")
        .eq("id", id)
        .single();

    if (!match) {
        return { title: "Partido — Pachanga" };
    }

    const formattedDate = new Date(match.date).toLocaleDateString("es-ES", {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
    });

    const title = `Partido en ${match.location} — Pachanga`;
    const description = `${formattedDate} · Hasta ${match.max_players} jugadores`;

    return {
        title,
        description,
        alternates: { canonical: `${BASE_URL}/matches/${id}` },
        openGraph: {
            title,
            description,
            type: "website",
            url: `${BASE_URL}/matches/${id}`,
        },
    };
}
```

- [ ] **Añadir el componente JSON-LD en el JSX de la página**

En el return de la página de partido, añadir justo después del opening div:

```typescript
{/* JSON-LD SportsEvent para SEO */}
<script
    type="application/ld+json"
    dangerouslySetInnerHTML={{
        __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SportsEvent",
            name: `Partido de fútbol en ${match?.location ?? ""}`,
            startDate: match?.date,
            location: {
                "@type": "Place",
                name: match?.location ?? "",
            },
            sport: "Fútbol",
            url: `${BASE_URL}/matches/${id}`,
        }),
    }}
/>
```

Donde `match` e `id` son variables ya disponibles en el componente de la página.

- [ ] **Verificar que el metadata aparece en el HTML**

```bash
npm run dev
```

Navegar a `http://localhost:3000/matches/[id-de-un-partido]` y ver el source (Ctrl+U). Expected: `<title>Partido en [location] — Pachanga</title>` y `<meta name="description" ...>` con la descripción dinámica.

- [ ] **Commit**

```bash
git add src/app/matches/[id]/page.tsx
git commit -m "feat(seo): generateMetadata y JSON-LD SportsEvent en página de partido"
```

---

### Task 20: Metadata dinámica y JSON-LD en página de jugador

**Files:**
- Modify: `src/app/players/[id]/page.tsx`

- [ ] **Añadir generateMetadata**

```typescript
import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://pachanga.app";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ id: string }>;
}): Promise<Metadata> {
    const { id } = await params;
    const supabase = await createClient();

    const { data: profile } = await supabase
        .from("profiles")
        .select("username, elo_rating, matches_played, position")
        .eq("id", id)
        .single();

    if (!profile) {
        return { title: "Jugador — Pachanga" };
    }

    const positionLabels: Record<string, string> = {
        GK: "Portero",
        DEF: "Defensa",
        MID: "Centrocampista",
        FWD: "Delantero",
    };
    const posLabel = profile.position ? positionLabels[profile.position] ?? profile.position : "Jugador";

    const title = `${profile.username ?? "Jugador"} — ${posLabel} · Pachanga`;
    const description = `ELO ${profile.elo_rating ?? 1000} · ${profile.matches_played ?? 0} partidos jugados`;

    return {
        title,
        description,
        alternates: { canonical: `${BASE_URL}/players/${id}` },
        openGraph: {
            title,
            description,
            type: "profile",
            url: `${BASE_URL}/players/${id}`,
        },
    };
}
```

- [ ] **Añadir JSON-LD Person en el JSX**

El `posLabel` se calcula en el cuerpo del componente de página (que ya tiene `profile` disponible de su propia query). Añadir a nivel de módulo en `players/[id]/page.tsx`:

```typescript
const POSITION_LABELS: Record<string, string> = {
    GK: "Portero",
    DEF: "Defensa",
    MID: "Centrocampista",
    FWD: "Delantero",
};

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://pachanga.app";
```

Y en el return de la página, donde `profile` y `id` ya están disponibles:

```typescript
{/* JSON-LD Person para SEO */}
<script
    type="application/ld+json"
    dangerouslySetInnerHTML={{
        __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Person",
            name: profile?.username ?? "",
            url: `${BASE_URL}/players/${id}`,
            description: `${POSITION_LABELS[profile?.position ?? ""] ?? "Jugador"} con ELO ${profile?.elo_rating ?? 1000}`,
        }),
    }}
/>
```

- [ ] **Verificar**

```bash
npm run dev
```

Navegar a `http://localhost:3000/players/[id]`. Ver source. Expected: `<title>` con el nombre del jugador.

- [ ] **Ejecutar suite de tests final**

```bash
npx playwright test --reporter=list
```

Expected: Todos los tests @smoke pasan.

- [ ] **Commit final**

```bash
git add src/app/players/[id]/page.tsx
git commit -m "feat(seo): generateMetadata y JSON-LD Person en página de jugador"
```

---

## Verificación Final por Fase

### Fase 1 — Comandos de verificación
```bash
npm run build            # Sin errores de build
# Revisar que los índices existen en Supabase dashboard
```

### Fase 2 — Comandos de verificación
```bash
npx tsc --noEmit         # Sin errores de TypeScript
npm run build            # Sin errores de build
```

### Fase 3 — Comandos de verificación
```bash
npx playwright test --grep @smoke --reporter=list
# Expected: todos los @smoke pasan en < 2 minutos
```

### Fase 4 — Comandos de verificación
```bash
npx playwright test e2e/a11y.spec.ts --reporter=list
# Expected: 0 violaciones WCAG 2.2
curl http://localhost:3000/robots.txt
curl http://localhost:3000/sitemap.xml
```

---

## Criterios de Éxito

| Área | Métrica | Objetivo |
|------|---------|----------|
| Rendimiento | Lighthouse Performance (móvil) | ≥ 85 |
| Rendimiento | Tiempo de respuesta leaderboard | < 200ms (cacheado) |
| Calidad | `tsc --noEmit` | 0 errores |
| Testing | Tests @smoke | Pasan en < 2 min |
| Accesibilidad | Lighthouse Accessibility | ≥ 90 |
| SEO | Lighthouse SEO | 100 |
| SEO | OG image en WhatsApp | Preview visible |
