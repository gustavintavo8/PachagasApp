# Acceso privado y estadísticas por temporada — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restringir Pachanga a cuentas autorizadas, iniciar Temporada 2 sin perder el histórico y hacer que todas las estadísticas competitivas sean independientes por temporada.

**Architecture:** Se añade una capa de acceso global vinculada a cada cuenta y una capa de temporadas vinculada a partidos y estadísticas por jugador. El middleware y las Server Actions protegen el acceso; season_player_stats se convierte en la fuente de verdad para ELO, partidos, goles, resultados y MVPs, mientras profiles conserva únicamente identidad y datos personales después de una fase de compatibilidad.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Supabase SSR, PostgreSQL/RLS, Supabase Realtime existente, Server Actions, Playwright y scripts TypeScript ejecutados con tsx.

**Spec:** docs/superpowers/specs/2026-08-31-access-seasons-design.md

## Global Constraints

- El acceso a la comunidad se controla mediante un único código global.
- El código se solicita una sola vez por cuenta, no en cada inicio de sesión.
- Todos los partidos actuales pertenecen a Temporada 1.
- Temporada 2 se crea y activa en el momento de aplicar la migración.
- El siguiente partido nuevo pertenecerá automáticamente a Temporada 2.
- Las estadísticas de temporada son la fuente principal; las columnas estadísticas antiguas de profiles se conservan solo durante la transición.
- El modo invitado se elimina de la UI y se cierra también en backend.
- Fantasy se oculta de la navegación, se bloquea por URL y deja sus datos intactos para una decisión futura.
- No se eliminan datos actuales durante el cambio de temporada.
- No se cambia el algoritmo ELO.
- La migración se ejecuta primero en local y se verifica antes de producción.
- El despliegue requiere configurar PACHANGA_ACCESS_CODE solo en el entorno server-side de Vercel y local.

---

### Task 1: Crear el modelo SQL de acceso, temporadas y estadísticas

**Files:**
- Create: supabase/migrations/20260831000001_add_private_access_and_seasons.sql
- Create: src/scripts/verify-season-migration.ts

**Interfaces:**
- Produces community_access_grants, seasons, season_player_stats, matches.season_id, rp_history.season_id y sus claves, índices y políticas RLS.
- Produces exactamente dos filas iniciales en seasons: season-1 archivada y season-2 activa.
- Produces un comando verificable: npx tsx --env-file=.env.test.local src/scripts/verify-season-migration.ts.

- [ ] **Step 1: Write the failing verification script**

Create the script so it fails before the migration because seasons does not exist:

~~~ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Faltan credenciales Supabase");

const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
    const { data: seasons, error } = await admin
        .from("seasons")
        .select("id, slug, status, starts_at, ends_at")
        .order("starts_at", { ascending: true });
    if (error) throw new Error("No se pudo leer seasons: " + error.message);

    const season1 = seasons?.find((s) => s.slug === "season-1");
    const season2 = seasons?.find((s) => s.slug === "season-2");
    if (!season1 || season1.status !== "archived") {
        throw new Error("Falta Temporada 1 archivada");
    }
    if (!season2 || season2.status !== "active") {
        throw new Error("Falta Temporada 2 activa");
    }
    if (seasons?.filter((s) => s.status === "active").length !== 1) {
        throw new Error("Debe existir exactamente una temporada activa");
    }

    const [{ count: nullMatches }, { count: nullRp }, { count: seasonStats }] = await Promise.all([
        admin.from("matches").select("id", { count: "exact", head: true }).is("season_id", null),
        admin.from("rp_history").select("id", { count: "exact", head: true }).is("season_id", null),
        admin.from("season_player_stats").select("user_id", { count: "exact", head: true }).eq("season_id", season2.id),
    ]);

    if ((nullMatches ?? 0) !== 0) throw new Error("Quedan partidos sin temporada");
    if ((nullRp ?? 0) !== 0) throw new Error("Quedan eventos RP sin temporada");
    if ((seasonStats ?? 0) === 0) throw new Error("Temporada 2 no tiene filas iniciales");

    console.log(JSON.stringify({ seasons, season2Stats: seasonStats }, null, 2));
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
~~~

- [ ] **Step 2: Run the verifier to confirm it fails before the migration**

Run: npx tsx --env-file=.env.test.local src/scripts/verify-season-migration.ts

Expected: FAIL with an error indicating that seasons cannot be read because the table does not exist.

- [ ] **Step 3: Write the migration**

Create the tables, add nullable foreign-key columns for the backfill, seed both seasons, assign all existing rows to Season 1, initialize Season 1 from existing profile values plus raw match aggregates, initialize Season 2 at zero, then make the foreign keys non-nullable:

~~~sql
create table if not exists public.community_access_grants (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null check (status in ('active', 'archived')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists seasons_one_active_idx
  on public.seasons (status) where status = 'active';

create table if not exists public.season_player_stats (
  season_id uuid not null references public.seasons(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  elo_rating integer not null default 1000 check (elo_rating >= 100),
  matches_played integer not null default 0 check (matches_played >= 0),
  goals_scored integer not null default 0 check (goals_scored >= 0),
  wins integer not null default 0 check (wins >= 0),
  draws integer not null default 0 check (draws >= 0),
  losses integer not null default 0 check (losses >= 0),
  mvps integer not null default 0 check (mvps >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (season_id, user_id)
);

alter table public.matches
  add column if not exists season_id uuid references public.seasons(id);
alter table public.rp_history
  add column if not exists season_id uuid references public.seasons(id);

insert into public.seasons (name, slug, status, starts_at)
select 'Temporada 1', 'season-1', 'archived',
       coalesce((select min(date) from public.matches), now())
where not exists (select 1 from public.seasons where slug = 'season-1');

insert into public.seasons (name, slug, status, starts_at)
select 'Temporada 2', 'season-2', 'active', now()
where not exists (select 1 from public.seasons where slug = 'season-2');

update public.matches
set season_id = (select id from public.seasons where slug = 'season-1')
where season_id is null;

update public.rp_history
set season_id = (select id from public.seasons where slug = 'season-1')
where season_id is null;

with season_one as (
  select id from public.seasons where slug = 'season-1'
), aggregates as (
  select
    mp.user_id,
    count(*) filter (
      where m.status = 'finished' and mp.team in ('A', 'B')
    )::integer as played,
    coalesce(sum(mp.goals) filter (
      where m.status = 'finished' and mp.team in ('A', 'B')
    ), 0)::integer as goals,
    count(*) filter (
      where m.status = 'finished' and mp.team = 'A' and m.team_a_score > m.team_b_score
    )::integer
    + count(*) filter (
      where m.status = 'finished' and mp.team = 'B' and m.team_b_score > m.team_a_score
    )::integer as wins,
    count(*) filter (
      where m.status = 'finished' and mp.team in ('A', 'B') and m.team_a_score = m.team_b_score
    )::integer as draws,
    count(*) filter (
      where m.status = 'finished' and mp.team = 'A' and m.team_a_score < m.team_b_score
    )::integer
    + count(*) filter (
      where m.status = 'finished' and mp.team = 'B' and m.team_b_score < m.team_a_score
    )::integer as losses,
    count(*) filter (
      where m.status = 'finished' and mp.is_mvp
    )::integer as mvps
  from public.match_participants mp
  join public.matches m on m.id = mp.match_id
  group by mp.user_id
)
insert into public.season_player_stats
  (season_id, user_id, elo_rating, matches_played, goals_scored, wins, draws, losses, mvps)
select
  s.id,
  p.id,
  p.elo_rating,
  coalesce(p.matches_played, a.played, 0),
  coalesce(p.goals_scored, a.goals, 0),
  coalesce(a.wins, 0),
  coalesce(a.draws, 0),
  coalesce(a.losses, 0),
  coalesce(a.mvps, 0)
from public.profiles p
cross join season_one s
left join aggregates a on a.user_id = p.id
on conflict (season_id, user_id) do nothing;

insert into public.season_player_stats (season_id, user_id)
select s.id, p.id
from public.seasons s
cross join public.profiles p
where s.slug = 'season-2'
on conflict (season_id, user_id) do nothing;

alter table public.matches alter column season_id set not null;
alter table public.rp_history alter column season_id set not null;

create index if not exists idx_matches_season_date
  on public.matches (season_id, date desc);
create index if not exists idx_rp_history_season_user_created
  on public.rp_history (season_id, user_id, created_at);
create index if not exists idx_season_player_stats_season_elo
  on public.season_player_stats (season_id, elo_rating desc);

alter table public.community_access_grants enable row level security;
alter table public.seasons enable row level security;
alter table public.season_player_stats enable row level security;

create policy "access grants select own"
  on public.community_access_grants for select
  using (auth.uid() = user_id);
create policy "authenticated users can read seasons"
  on public.seasons for select to authenticated
  using (true);
create policy "authenticated users can read seasonal stats"
  on public.season_player_stats for select to authenticated
  using (true);
~~~

Add a SECURITY DEFINER SQL function rebuild_season_player_stats(p_season_id uuid, p_user_id uuid) in the same migration. It must recompute all counters from finished matches in that season and preserve only the current ELO value; the function is callable only by service_role. Its body must select the existing seasonal ELO (falling back to profiles.elo_rating and then 1000), aggregate matches/goals/wins/draws/losses/MVPs from match_participants joined to finished matches filtered by both p_season_id and p_user_id, and upsert only those counters into season_player_stats. Add `revoke all on function ... from public, anon, authenticated` and `grant execute ... to service_role`. This function is the repair path for any discrepancy found by the verifier.

- [ ] **Step 4: Run the migration and verifier locally**

Run:

~~~powershell
npx supabase db reset
npx tsx --env-file=.env.test.local src/scripts/verify-season-migration.ts
~~~

Expected: migration succeeds; the verifier prints season-1 as archived, season-2 as the only active season, zero nullable season_id values and a positive number of Season 2 stat rows.

- [ ] **Step 5: Commit the database foundation**

~~~powershell
git add supabase/migrations/20260831000001_add_private_access_and_seasons.sql src/scripts/verify-season-migration.ts
git commit -m "feat: add seasonal stats and community access schema"
~~~

### Task 2: Add typed season helpers and access-gate domain functions

**Files:**
- Create: src/lib/season-validation.ts
- Create: src/scripts/verify-season-helpers.ts
- Create: src/lib/seasons.ts
- Create: src/lib/access.ts
- Modify: src/lib/types.ts
- Modify: src/lib/permissions.ts

**Interfaces:**
- Produces Season, SeasonPlayerStats, getActiveSeason(), resolveSeasonSelection(value?: string), ensureSeasonPlayerStats(seasonId, userId), hasCommunityAccess(userId) and requireCommunityAccess(user).
- resolveSeasonSelection returns the active season when no selection is supplied and rejects unknown slugs instead of silently falling back to a different season.
- hasCommunityAccess returns true for an active grant or an administrator, and false for a revoked/missing grant.

- [ ] **Step 1: Write focused contract checks in the new helpers**

Create src/lib/season-validation.ts with pure validators and src/scripts/verify-season-helpers.ts using Node’s built-in `assert`. The script must run without Supabase and assert these exact contracts:

~~~ts
export function isSeasonSlug(value: string): boolean {
    return /^season-[1-9][0-9]*$/.test(value);
}

export function normalizeAccessCode(value: string): string {
    return value.trim();
}
~~~

The contracts are: isSeasonSlug("season-2") === true, isSeasonSlug("season-0") === false, and normalizeAccessCode("  PACHANGA  ") === "PACHANGA". Run `npx tsx src/scripts/verify-season-helpers.ts` and require it to pass before implementing the database helpers.

- [ ] **Step 2: Implement the typed helpers**

Add the seasonal types to src/lib/types.ts:

~~~ts
export type SeasonStatus = "active" | "archived";

export type Season = {
    id: string;
    name: string;
    slug: string;
    status: SeasonStatus;
    starts_at: string;
    ends_at: string | null;
};

export type SeasonPlayerStats = {
    season_id: string;
    user_id: string;
    elo_rating: number;
    matches_played: number;
    goals_scored: number;
    wins: number;
    draws: number;
    losses: number;
    mvps: number;
};
~~~

Implement getActiveSeason() using .from("seasons").select(...).eq("status", "active").single(). Implement resolveSeasonSelection(value) by validating a slug, querying it, and throwing a user-safe SeasonNotFoundError when the selection does not exist. Implement ensureSeasonPlayerStats with an admin upsert using { season_id, user_id } as the conflict target.

- [ ] **Step 3: Implement access checks without exposing the secret**

src/lib/access.ts must be server-only and use this public interface:

~~~ts
import "server-only";

export async function hasCommunityAccess(userId: string): Promise<boolean>;
export async function requireCommunityAccess(user: { id: string; is_anonymous?: boolean }): Promise<ActionResult<true>>;
export async function redeemAccessCode(code: string): Promise<ActionResult>;
~~~

redeemAccessCode must use node:crypto’s timingSafeEqual, return the same generic error for a missing or incorrect configured code, and call ensureSeasonPlayerStats for the active season after creating the grant. It must never include the configured code in a thrown error, response, or log.

- [ ] **Step 4: Run static verification**

Run: npx tsx src/scripts/verify-season-helpers.ts
npm run lint

Expected: both commands PASS with no server-only import or type errors.

- [ ] **Step 5: Commit the shared domain layer**

~~~powershell
git add src/lib/seasons.ts src/lib/access.ts src/lib/types.ts src/lib/permissions.ts
git commit -m "feat: add seasonal and community access helpers"
~~~

### Task 3: Build the private-access screen and central route protection

**Files:**
- Create: src/app/access/page.tsx
- Create: src/app/access/AccessForm.tsx
- Create: src/app/access/actions.ts
- Modify: src/middleware.ts
- Modify: src/app/login/actions.ts
- Modify: src/app/auth/callback/route.ts

**Interfaces:**
- Produces /access for authenticated users without an active grant.
- Produces redeemCommunityAccess(code: string): Promise<ActionResult> as the form action.
- Middleware allows /login, /auth/callback, legal pages and /access; all other application pages require a non-anonymous user with access or administrator status.

- [ ] **Step 1: Add the failing E2E access flow**

Create a gated E2E user in the ignored local environment with E2E_GATED_TEST_EMAIL, E2E_GATED_TEST_PASSWORD and PACHANGA_ACCESS_CODE. Add e2e/access.spec.ts:

~~~ts
import { test, expect } from "@playwright/test";

test.describe.configure({ mode: "serial" });
test.use({ storageState: { cookies: [], origins: [] } });

test("una cuenta sin permiso llega a acceso privado", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', process.env.E2E_GATED_TEST_EMAIL!);
    await page.fill('input[type="password"]', process.env.E2E_GATED_TEST_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/access");
    await expect(page.getByRole("heading", { name: /acceso privado/i })).toBeVisible();
});

test("el código incorrecto no concede acceso y el correcto sí", async ({ page }) => {
    await page.goto("/access");
    await page.getByLabel(/código/i).fill("codigo-equivocado");
    await page.getByRole("button", { name: /entrar/i }).click();
    await expect(page.getByRole("alert")).toContainText(/incorrecto|inválido/i);

    await page.getByLabel(/código/i).fill(process.env.PACHANGA_ACCESS_CODE!);
    await page.getByRole("button", { name: /entrar/i }).click();
    await page.waitForURL("**/");
    await expect(page).not.toHaveURL(/\/access$/);
});
~~~

- [ ] **Step 2: Run the focused E2E test to verify it fails**

Run: npx playwright test e2e/access.spec.ts --project=chromium

Expected: FAIL because /access and the grant check do not exist yet.

- [ ] **Step 3: Implement the access page and action**

Use existing Card, Input, Button and toast patterns. The action must be a server action:

~~~ts
"use server";

export async function redeemCommunityAccess(code: string): Promise<ActionResult> {
    const result = await redeemAccessCode(code);
    if (!result.success) return result;
    revalidatePath("/");
    return { success: true, data: undefined };
}
~~~

AccessForm keeps the input in client state only long enough to submit it, clears it after every response, disables the button while pending and renders failures with role="alert".

- [ ] **Step 4: Protect the middleware and both auth callbacks**

In src/middleware.ts, preserve the existing session refresh and add the ordered rules. Do not import src/lib/access.ts into middleware because it is server-only and depends on request headers. Instead, query `community_access_grants` and `profiles(is_admin)` with the middleware Supabase client already created in that file, then compute `allowed = Boolean(activeGrant || profile?.is_admin === true)`:

~~~ts
const publicRoutes = ["/login", "/auth/callback", "/privacidad", "/aviso-legal", "/terminos", "/access"];

if (!user && !isPublicRoute) return redirectTo("/login");
if (user?.is_anonymous === true) return redirectTo("/login");

const shouldCheckAccess = Boolean(user && (!isPublicRoute || pathname.startsWith("/access")));
if (shouldCheckAccess && user) {
    const [{ data: grant }, { data: profile }] = await Promise.all([
        supabase.from("community_access_grants").select("user_id").eq("user_id", user.id).is("revoked_at", null).maybeSingle(),
        supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle(),
    ]);
    const allowed = Boolean(grant || profile?.is_admin === true);
    if (pathname.startsWith("/access") && allowed) return redirectTo("/");
    if (!isPublicRoute && !allowed) return redirectTo("/access");
}
~~~

Create `redirectTo(pathname)` by cloning `request.nextUrl`, assigning the pathname and returning `NextResponse.redirect(url)`. Calculate `allowed` once for every authenticated non-anonymous user before the protected-route check, and skip the access query for public legal/auth routes. Avoid redirecting /access back to itself. login and the OAuth callback may continue redirecting to /; middleware will route an ungranted account to /access centrally.

- [ ] **Step 5: Run and commit**

Run: npx playwright test e2e/access.spec.ts --project=chromium

Expected: PASS for both tests.

~~~powershell
git add src/app/access src/middleware.ts src/app/login/actions.ts src/app/auth/callback/route.ts e2e/access.spec.ts
git commit -m "feat: gate the app behind community access code"
~~~

### Task 4: Apply access checks to API routes and Server Actions

**Files:**
- Modify: src/app/api/asistente/route.ts
- Modify: src/app/matches/actions.ts
- Modify: src/app/profile/data-actions.ts
- Modify: src/app/fantasy/actions.ts
- Modify: src/app/matches/new/page.tsx
- Modify: src/app/profile/page.tsx
- Modify: src/app/matches/page.tsx
- Modify: src/app/matches/[id]/page.tsx

**Interfaces:**
- No mutation or data API is usable by a user lacking hasCommunityAccess.
- Anonymous sessions return to /login and no longer receive a demo-specific response.

- [ ] **Step 1: Add the failing direct API assertion**

Extend e2e/access.spec.ts with a direct request using the gated user before redeeming the code:

~~~ts
test("la API de Panenka no acepta una cuenta sin permiso", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', process.env.E2E_GATED_TEST_EMAIL!);
    await page.fill('input[type="password"]', process.env.E2E_GATED_TEST_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/access");

    const response = await page.request.post("/api/asistente", {
        data: { messages: [{ role: "user", parts: [{ type: "text", text: "hola" }] }] },
    });
    expect(response.status()).toBe(403);
});
~~~

- [ ] **Step 2: Run the test to verify the API currently remains open**

Run: npx playwright test e2e/access.spec.ts --project=chromium -g "API"

Expected: FAIL because the route currently only checks authentication.

- [ ] **Step 3: Add the shared guard to server-side mutations**

Immediately after each action obtains user, call the shared guard and return its failure result. Preserve the existing validation and rate limiting order after authentication/access:

~~~ts
const access = await requireCommunityAccess(user);
if (!access.success) return access;
~~~

Use the same guard in api/asistente/route.ts and return 403 with { error: "Acceso no autorizado" }. Remove SYSTEM_PROMPT_DEMO, isAnonymous, and the branch that builds tools only for non-anonymous users.

- [ ] **Step 4: Verify direct requests and existing protected flows**

Run:

~~~powershell
npx playwright test e2e/access.spec.ts --project=chromium
npx playwright test e2e/auth.spec.ts e2e/matches-create.spec.ts --project=chromium
~~~

Expected: access tests pass and the normal E2E user continues to reach protected pages after global setup grants access.

- [ ] **Step 5: Commit the defense-in-depth guard**

~~~powershell
git add src/app/api/asistente/route.ts src/app/matches/actions.ts src/app/profile/data-actions.ts src/app/fantasy/actions.ts src/app/matches/new/page.tsx src/app/profile/page.tsx src/app/matches/page.tsx src/app/matches/[id]/page.tsx e2e/access.spec.ts
git commit -m "fix: enforce community access on server operations"
~~~

### Task 5: Move match finalization and ELO writes to seasonal stats

**Files:**
- Create: src/lib/season-stats.ts
- Modify: src/app/matches/actions.ts
- Create: supabase/migrations/20260831000002_add_season_stats_functions.sql
- Modify: src/scripts/recalculate-elo.ts

**Interfaces:**
- season-stats.ts exposes getStatsForUser(seasonId, userId), getStatsForUsers(seasonId, userIds) and upsertZeroStats(seasonId, userId).
- createMatch writes the active season_id to every new match.
- ELO reads/writes use the match’s season_id; rp_history inserts include that same ID.
- Match-finished SQL logic updates season_player_stats, never profiles counters.

- [ ] **Step 1: Add a failing season-assignment assertion**

Extend e2e/seasons.spec.ts with a test that creates a valid match and checks its foreign key:

~~~ts
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

test("un partido nuevo pertenece a la temporada activa", async ({ page }) => {
    await page.goto("/matches/new");
    const date = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().slice(0, 16);
    await page.locator('input[type="datetime-local"]').fill(date);
    await page.locator('input[name="location"]').fill("Campo temporada E2E");
    await page.getByRole("button", { name: /crear/i }).click();
    await page.waitForURL(/\/matches\/[a-f0-9-]+/);

    const matchId = page.url().split("/matches/")[1];
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: match } = await admin.from("matches").select("season_id").eq("id", matchId).single();
    const { data: season } = await admin.from("seasons").select("id, status").eq("status", "active").single();

    expect(match?.season_id).toBe(season?.id);
});
~~~

- [ ] **Step 2: Run the test to verify the current insert has no seasonal ID**

Run: npx playwright test e2e/seasons.spec.ts --project=chromium -g "temporada activa"

Expected: FAIL because createMatch does not currently insert season_id.

- [ ] **Step 3: Implement seasonal writes**

In createMatch, load getActiveSeason() before inserting and add season_id: season.id. In generateTeams, load profile positions and season_player_stats.elo_rating for match.season_id; do not read profiles.elo_rating.

In setScore, load the match’s season_id, use the seasonal ELO and matches_played values when building EloInput, update season_player_stats.elo_rating, and insert:

~~~ts
await adminSupabase.from("rp_history").insert({
    user_id: update.userId,
    match_id: matchId,
    season_id: seasonId,
    rp_change: update.delta,
    new_rp: update.newRating,
    created_at: new Date().toISOString(),
});
~~~

Create the second migration file with update_season_stats_on_match_finished(). The trigger must guard the transition to finished, read NEW.season_id, upsert each participant’s matches/goals/result, and leave ELO untouched because the action owns the ELO calculation. The trigger must replace the old profile-counter trigger and be attached to matches. The upsert must use `on conflict (season_id, user_id) do update` and increment only the counters for the one newly-finished match. Update mvps through an idempotent recomputation when MVP is resolved. Do not edit the already-created 20260831000001 migration after it has been applied.

Update resolveMvp to find the match season and recalculate the winner’s mvps count from all MVP participant rows in that season. Calling it twice must leave the same count.

- [ ] **Step 4: Run seasonal write tests**

Run:

~~~powershell
npx playwright test e2e/seasons.spec.ts --project=chromium
npm run lint
npm run build
~~~

Expected: the new match references season-2, ELO history rows contain season_id, and build/lint pass.

- [ ] **Step 5: Commit seasonal write behavior**

~~~powershell
git add src/lib/season-stats.ts src/app/matches/actions.ts src/scripts/recalculate-elo.ts supabase/migrations/20260831000002_add_season_stats_functions.sql e2e/seasons.spec.ts
git commit -m "feat: write match statistics per season"
~~~

### Task 6: Update dashboard, ranking, players, profiles and history reads

**Files:**
- Create: src/components/SeasonSelector.tsx
- Modify: src/app/page.tsx
- Modify: src/app/history/page.tsx
- Modify: src/app/leaderboard/page.tsx
- Modify: src/app/leaderboard/LeaderboardTabs.tsx
- Modify: src/app/players/page.tsx
- Modify: src/app/players/PlayersList.tsx
- Modify: src/app/players/[id]/page.tsx
- Modify: src/app/matches/page.tsx
- Modify: src/app/matches/[id]/page.tsx
- Modify: src/app/matches/[id]/MatchDetail.tsx

**Interfaces:**
- Dashboard, ranking, players and player detail receive current-season stats from season_player_stats.
- /history?season=season-1 and /history?season=season-2 display only the selected season’s matches and summary.
- /history defaults to the active season.
- Match lists outside /history show current-season matches only.

- [ ] **Step 1: Add the failing history selector test**

Add to e2e/seasons.spec.ts:

~~~ts
test("el historial acepta selector de temporada", async ({ page }) => {
    await page.goto("/history");
    await expect(page.getByRole("combobox", { name: /temporada/i })).toHaveValue("season-2");
    await page.getByRole("combobox", { name: /temporada/i }).selectOption("season-1");
    await expect(page).toHaveURL(/season=season-1/);
    await expect(page.getByText(/Temporada 1/i)).toBeVisible();
});
~~~

- [ ] **Step 2: Run it before changing the reads**

Run: npx playwright test e2e/seasons.spec.ts --project=chromium -g "selector"

Expected: FAIL because history has no selector and still reads profile/global match data.

- [ ] **Step 3: Centralize the selected-season query**

In history/page.tsx, accept searchParams: Promise<{ season?: string }>, resolve it with resolveSeasonSelection, and query:

~~~ts
const { data: stats } = await supabase
    .from("season_player_stats")
    .select("*")
    .eq("season_id", season.id)
    .eq("user_id", user.id)
    .single();

const { data: participations } = await supabase
    .from("match_participants")
    .select("match_id, team, goals, is_mvp, matches!inner(id, season_id, date, location, status, team_a_score, team_b_score)")
    .eq("user_id", user.id)
    .eq("matches.season_id", season.id);
~~~

Render SeasonSelector with name="season", options from seasons, and the current slug. Use the selected seasonal stats for the four summary cards and keep the existing match card styling.

- [ ] **Step 4: Replace global profile stats in all read paths**

Use season_player_stats joined with profiles for leaderboard and players. Preserve the existing LeaderboardTabs and PlayersList visual contracts by mapping the joined rows into their current PlayerData/Profile props.

Update these exact reads:

- src/app/page.tsx: Hero RP, rank, matches and goals.
- src/app/leaderboard/page.tsx: ordering, pagination, provisional threshold and W/D/L/MVP data.
- src/app/players/page.tsx: player directory ordering and displayed counters.
- src/app/players/[id]/page.tsx: current stats, MVP trophies and RP history filtered by season.
- src/app/matches/page.tsx: active-season match list.
- src/app/matches/[id]/page.tsx and MatchDetail.tsx: participant current-season ELO and match-season data used by team cards.

Do not change the calculation or design of existing result badges, charts, avatars or cards. Only change the source and add a small season label/selector where required.

- [ ] **Step 5: Run the read-path checks and commit**

Run:

~~~powershell
npx playwright test e2e/seasons.spec.ts --project=chromium
npm run lint
npm run build
~~~

Expected: the history selector passes, Season 1 remains queryable, Season 2 shows zero stats before new matches, and the existing visual tests/build pass.

~~~powershell
git add src/components/SeasonSelector.tsx src/app/page.tsx src/app/history/page.tsx src/app/leaderboard src/app/players src/app/matches/page.tsx src/app/matches/[id]
git commit -m "feat: scope app statistics and history by season"
~~~

### Task 7: Remove guest mode and disable Fantasy completely

**Files:**
- Modify: src/app/login/page.tsx
- Modify: src/app/login/actions.ts
- Modify: src/components/NavbarClient.tsx
- Modify: src/components/BottomNav.tsx
- Modify: src/app/fantasy/layout.tsx
- Modify: src/app/fantasy/actions.ts
- Modify: src/app/matches/actions.ts
- Modify: src/app/page.tsx
- Modify: src/app/matches/page.tsx
- Modify: src/app/matches/[id]/page.tsx
- Modify: src/app/matches/new/page.tsx
- Modify: src/app/profile/page.tsx
- Modify: src/app/profile/data-actions.ts
- Delete: e2e/guest.spec.ts
- Create: e2e/disabled-features.spec.ts

**Interfaces:**
- No guest-login action remains callable from the app.
- /fantasy, /fantasy/mercado and /fantasy/clasificacion return notFound() or a disabled response without reading/mutating Fantasy data.
- Navbar and BottomNav contain no Fantasy link.
- Finishing matches and resolving MVPs no longer add Fantasy points.

- [ ] **Step 1: Add failing UI assertions**

Create e2e/disabled-features.spec.ts:

~~~ts
import { test, expect } from "@playwright/test";

test("login ya no muestra demo ni Fantasy en la navegación", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /ver demo como invitado/i })).toHaveCount(0);
    await page.goto("/");
    await expect(page.getByRole("link", { name: /^Fantasy$/i })).toHaveCount(0);
});

test("Fantasy no es accesible por URL", async ({ page }) => {
    await page.goto("/fantasy");
    await expect(page).not.toHaveURL(/\/fantasy$/);
});
~~~

- [ ] **Step 2: Run the tests to verify they fail**

Run: npx playwright test e2e/disabled-features.spec.ts --project=chromium

Expected: FAIL because the demo button and Fantasy link currently exist.

- [ ] **Step 3: Remove guest and Fantasy exposure**

Remove loginAsGuest from src/app/login/actions.ts and its import/click handler from src/app/login/page.tsx. Delete guest-only props and branches from pages/actions; old anonymous cookies are already redirected by middleware.

Remove the Fantasy entries from both navigation arrays. In FantasyLayout, put the feature guard before loading tabs or children:

~~~ts
import { notFound } from "next/navigation";

export default async function FantasyLayout() {
    notFound();
}
~~~

Keep the Fantasy tables and components on disk for future work, but return the disabled result from each Fantasy Server Action before any database query. Remove applyFantasyPoints from match finalization and the Fantasy bonus from MVP resolution so hidden data does not continue changing.

- [ ] **Step 4: Disable anonymous sign-ins in hosted configuration**

In Supabase Dashboard → Authentication → Providers/Settings, ensure anonymous sign-ins are disabled. Keep enable_anonymous_sign_ins = false in supabase/config.toml. Do not delete existing anonymous auth users automatically.

- [ ] **Step 5: Run and commit**

Run:

~~~powershell
npx playwright test e2e/disabled-features.spec.ts --project=chromium
npm run lint
~~~

Expected: no guest button, no Fantasy navigation, direct Fantasy route unavailable and lint passes.

~~~powershell
git add src/app/login/page.tsx src/app/login/actions.ts src/components/NavbarClient.tsx src/components/BottomNav.tsx src/app/fantasy src/app/matches/actions.ts src/app/page.tsx src/app/matches/page.tsx src/app/matches/[id]/page.tsx src/app/matches/new/page.tsx src/app/profile/page.tsx src/app/profile/data-actions.ts e2e/disabled-features.spec.ts
git rm e2e/guest.spec.ts
git commit -m "feat: remove guest mode and disable Fantasy"
~~~

### Task 8: Make Panenka seasonal and remove Fantasy tools

**Files:**
- Modify: src/lib/ai/tools.ts
- Modify: src/app/api/asistente/route.ts
- Modify: src/app/asistente/page.tsx
- Modify: e2e/asistente.spec.ts

**Interfaces:**
- buildTools(userId: string, defaultSeason: Season) returns only non-Fantasy tools.
- Ranking, goleadores, jugadores, partidos, estadísticas propias e historial filter by defaultSeason.id unless an explicitly validated season slug is supplied.
- Panenka cannot expose get_fantasy_standings or get_my_fantasy_team.

- [ ] **Step 1: Add a failing static contract check**

Add a test that asks the API for a Fantasy-specific answer and verifies the UI does not expose Fantasy tools or links. Also add a repository assertion in the test file that the tool list does not contain the two disabled names after importing the builder in a server-safe test path.

~~~ts
test("Panenka no anuncia Fantasy", async ({ page }) => {
    await page.goto("/asistente");
    await expect(page.getByText(/Fantasy/i)).toHaveCount(0);
});
~~~

- [ ] **Step 2: Run the test before changing tools**

Run: npx playwright test e2e/asistente.spec.ts --project=chromium -g "Fantasy"

Expected: FAIL because the current assistant page and tool builder still include Fantasy references.

- [ ] **Step 3: Update tool queries**

Change profile stat selections to join season_player_stats for the default season. For example, get_leaderboard must query season_player_stats filtered by season_id, join profiles(username, position, avatar_url), apply the provisional filter to seasonal matches_played, and order by seasonal elo_rating.

Add a small optional input to historical tools:

~~~ts
type SeasonInput = { season_slug?: string };

const selectedSeason = input.season_slug
    ? await resolveSeasonSelection(input.season_slug)
    : defaultSeason;
~~~

Use the selected season ID in get_matches, get_my_matches, get_leaderboard, get_top_scorers, get_player_detail, get_players_history_together and match-detail validation. Remove the two Fantasy tool definitions and update the system prompt so it states that the assistant only knows real-match data.

- [ ] **Step 4: Verify assistant behavior**

Run:

~~~powershell
npx playwright test e2e/asistente.spec.ts --project=chromium
npm run build
~~~

Expected: existing assistant disclosure tests pass, no Fantasy tools are exposed and build succeeds.

- [ ] **Step 5: Commit Panenka changes**

~~~powershell
git add src/lib/ai/tools.ts src/app/api/asistente/route.ts src/app/asistente/page.tsx e2e/asistente.spec.ts
git commit -m "feat: scope Panenka data by season and remove Fantasy tools"
~~~

### Task 9: Update E2E fixtures and cover the complete seasonal flow

**Files:**
- Modify: e2e/global-setup.ts
- Modify: e2e/helpers/db.ts
- Create: e2e/seasons.spec.ts
- Modify: e2e/access.spec.ts
- Create or modify: e2e/disabled-features.spec.ts
- Modify: .env.test.local locally only; do not commit it

**Interfaces:**
- The regular E2E user always has an active community_access_grants row.
- A separate gated E2E user starts each run without a grant.
- Tests clean up only their own temporary matches and access grant.

- [ ] **Step 1: Make the fixture fail under the new schema**

Run the existing setup after Task 1 without changes:

~~~powershell
npx playwright test e2e/auth.spec.ts --project=chromium
~~~

Expected: FAIL or redirect to /access because the regular test user has no grant yet.

- [ ] **Step 2: Add local-only test configuration**

Add these names to .env.test.local with local test values, keeping the file ignored:

~~~env
PACHANGA_ACCESS_CODE=local-test-code-2026
E2E_GATED_TEST_EMAIL=gated-e2e@pachanga.local
E2E_GATED_TEST_PASSWORD=PachangaE2E123!
~~~

The same PACHANGA_ACCESS_CODE must be inherited by the Next dev server through playwright.config.ts’s existing dotenv setup.

- [ ] **Step 3: Update global setup and DB helpers**

After ensuring the regular test profile exists, upsert its active grant. Create the gated user idempotently and delete only its community_access_grants row before tests. Add to e2e/helpers/db.ts:

~~~ts
export async function deleteCommunityGrant(userId: string): Promise<void> {
    const admin = getAdminClient();
    const { error } = await admin.from("community_access_grants").delete().eq("user_id", userId);
    if (error) throw new Error("No se pudo limpiar el grant: " + error.message);
}
~~~

Add cleanup for temporary season-test matches using the existing deleteMatch helper. Do not truncate tables globally.

- [ ] **Step 4: Add the complete acceptance coverage**

Cover these cases in Playwright:

~~~ts
test("el usuario normal conserva el acceso después de refrescar", async ({ page }) => {
    await page.goto("/");
    await page.reload();
    await expect(page).toHaveURL("http://localhost:3000/");
});

test("Temporada 2 no hereda estadísticas de Temporada 1", async ({ page }) => {
    await page.goto("/history?season=season-2");
    await expect(page.getByText(/Temporada 2/i)).toBeVisible();
    await expect(page.getByText("Aún no has jugado partidos")).toBeVisible();
});
~~~

Also verify that the first new match has Season 2, that /history?season=season-1 remains accessible, and that no UI link points to /fantasy.

- [ ] **Step 5: Run the full suite and commit fixture updates**

Run:

~~~powershell
npx playwright test
npm run lint
npm run build
~~~

Expected: all Chromium and mobile-selected tests pass, with no test writing to production because global-setup.ts retains its local Supabase URL guard.

~~~powershell
git add e2e/global-setup.ts e2e/helpers/db.ts e2e/access.spec.ts e2e/seasons.spec.ts e2e/disabled-features.spec.ts
git commit -m "test: cover private access and season isolation"
~~~

### Task 10: Document and execute the safe production rollout

**Files:**
- Create: docs/operations/2026-08-31-season-2-rollout.md
- Modify: README.md

**Interfaces:**
- Produces an operator runbook for the reactivated Supabase project.
- Documents PACHANGA_ACCESS_CODE, the local verification command and the production smoke test.
- Updates README setup/schema documentation so it no longer claims that profile counters are the primary source or that guest/Fantasy features are available.

- [ ] **Step 1: Add the runbook before production changes**

Document this exact order:

~~~text
1. Supabase Dashboard: confirm the project is resumed and the existing data is visible.
2. Record counts for auth users, profiles, matches, match_participants and rp_history.
3. Configure local .env.local without committing it.
4. Run npx supabase db reset and the season verifier locally.
5. Run the full E2E suite against local Supabase.
6. Apply the migration to the resumed project with the Supabase CLI or SQL Editor.
7. Run the verifier against the resumed project.
8. Configure PACHANGA_ACCESS_CODE in Vercel server-side environment settings.
9. Deploy the application.
10. Log in with an authorized account, redeem the code, create the Wednesday match and verify season_id is Season 2.
11. Verify an ungranted existing account is redirected to /access.
12. Verify /history?season=season-1 and /history?season=season-2 are separate.
~~~

- [ ] **Step 2: Add production verification queries**

Include read-only SQL checks for:

~~~sql
select slug, status, starts_at, ends_at from public.seasons order by starts_at;
select count(*) from public.matches where season_id is null;
select count(*) from public.rp_history where season_id is null;
select count(*) from public.matches where season_id = (select id from public.seasons where slug = 'season-2');
select count(*) from public.community_access_grants where revoked_at is null;
~~~

Expected: exactly one active season, zero null foreign keys and one Season 2 match after the first new match is created.

- [ ] **Step 3: Update README documentation**

Update the schema table with seasons, season_player_stats and community_access_grants; state that profiles stores identity and that competitive counters are seasonal. Remove the guest/Fantasy availability claims from the feature list and describe the private access code requirement.

- [ ] **Step 4: Run documentation and production-readiness checks**

Run:

~~~powershell
git diff --check
npm run lint
npm run build
~~~

Expected: clean diff, lint pass and production build pass. Do not drop the legacy profile columns in this rollout.

- [ ] **Step 5: Commit the rollout documentation**

~~~powershell
git add docs/operations/2026-08-31-season-2-rollout.md README.md
git commit -m "docs: add Season 2 production rollout runbook"
~~~

### Task 11: Final verification and handoff

**Files:**
- Verify: all files changed by Tasks 1–10
- Verify: supabase/migrations/20260831000001_add_private_access_and_seasons.sql
- Verify: docs/operations/2026-08-31-season-2-rollout.md

**Interfaces:**
- No required source changes remain after verification.
- Final handoff reports the migration commit, application commits, production checks and any discrepancy found in the backfill.

- [ ] **Step 1: Verify the working tree and migration history**

Run:

~~~powershell
git status --short
git log --oneline -12
~~~

Expected: only intentional commits are present and no environment files, backups or test auth state are staged.

- [ ] **Step 2: Run the complete local verification**

Run:

~~~powershell
npx supabase db reset
npx tsx --env-file=.env.test.local src/scripts/verify-season-migration.ts
npm run lint
npm run build
npx playwright test
~~~

Expected: migration verifier, lint, build and all E2E tests pass.

- [ ] **Step 3: Check seasonal invariants**

Confirm manually or with the verifier:

~~~text
- All pre-existing matches have season-1.
- All pre-existing RP events have season-1.
- Season 2 is the only active season.
- A new match receives season-2.
- A finished Season 2 match changes only Season 2 stats.
- Historical Season 1 stats remain unchanged.
- Revoked/missing access redirects to /access.
- Admin bypass works.
- Fantasy tables remain present but are not queried by visible flows.
~~~

- [ ] **Step 4: Perform the production smoke test after deployment**

Use two real test accounts: one authorized by the code and one existing account without the grant. Verify the authorized account can access /, create/join the first match and see Season 2 stats; verify the ungranted account sees only /access after login. Do not use the real production code in screenshots, logs or commits.

- [ ] **Step 5: Close the rollout**

Only after the production smoke test passes, mark the rollout complete. Keep profiles.elo_rating, profiles.matches_played, profiles.goals_scored and existing Fantasy tables until a later cleanup plan has verified every remaining read path.
