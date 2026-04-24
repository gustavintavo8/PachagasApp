# Mejoras Frontend + Backend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mejorar la UX móvil con bottom navigation, dashboard rediseñado, detalle de partido con tabs internas, e índices DB para reducir tiempos de carga.

**Architecture:** Los cambios de DB son migraciones SQL puras aditivas. Los cambios de frontend siguen los patrones existentes del proyecto: Server Components para datos, Client Components solo para estado e interactividad. Se añade `BottomNav` al layout raíz, se simplifica `NavbarClient` eliminando el menú hamburguesa, y se refactoriza `page.tsx` (dashboard) y `MatchDetail.tsx` (tabs internas).

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4 (`bg-accent` = `#ccff00`), Supabase PostgreSQL, Lucide React, Playwright E2E.

---

## File Map

| Acción | Archivo |
|---|---|
| Crear | `supabase/migrations/20260424000001_add_performance_indexes.sql` |
| Crear | `supabase/migrations/20260424000002_add_get_common_matches_rpc.sql` |
| Crear | `src/components/BottomNav.tsx` |
| Modificar | `src/components/NavbarClient.tsx` |
| Modificar | `src/components/Navbar.tsx` |
| Modificar | `src/app/layout.tsx` |
| Modificar | `src/app/page.tsx` |
| Modificar | `src/app/matches/[id]/MatchDetail.tsx` |
| Modificar | `src/app/matches/page.tsx` |
| Modificar | `src/app/players/page.tsx` |
| Modificar | `src/app/leaderboard/page.tsx` |

---

## Task 1: Índices de base de datos

**Files:**
- Create: `supabase/migrations/20260424000001_add_performance_indexes.sql`

- [ ] **Step 1: Crear la migración SQL**

```sql
-- supabase/migrations/20260424000001_add_performance_indexes.sql

CREATE INDEX IF NOT EXISTS idx_match_participants_match_id
  ON match_participants(match_id);

CREATE INDEX IF NOT EXISTS idx_match_participants_user_id
  ON match_participants(user_id);

CREATE INDEX IF NOT EXISTS idx_rp_history_user_id
  ON rp_history(user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read
  ON notifications(user_id, read);

CREATE INDEX IF NOT EXISTS idx_mvp_votes_match_id
  ON mvp_votes(match_id);
```

- [ ] **Step 2: Aplicar la migración a Supabase local**

```bash
npx supabase db push
```

Expected: migración aplicada sin errores. Si hay error de conexión, verificar que Supabase local esté corriendo con `npx supabase start`.

- [ ] **Step 3: Verificar que los índices existen**

```bash
npx supabase db diff
```

Expected: no diff pendiente (migración ya aplicada).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260424000001_add_performance_indexes.sql
git commit -m "perf(db): añadir índices en match_participants, rp_history, notifications, mvp_votes"
```

---

## Task 2: RPC `get_common_matches`

**Files:**
- Create: `supabase/migrations/20260424000002_add_get_common_matches_rpc.sql`

- [ ] **Step 1: Crear la migración SQL**

```sql
-- supabase/migrations/20260424000002_add_get_common_matches_rpc.sql

CREATE OR REPLACE FUNCTION get_common_matches(user_a uuid, user_b uuid)
RETURNS TABLE (
  match_id   uuid,
  date       timestamptz,
  location   text,
  team_a_score int,
  team_b_score int,
  user_a_team  text,
  user_b_team  text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    m.id          AS match_id,
    m.date,
    m.location,
    m.team_a_score,
    m.team_b_score,
    pa.team       AS user_a_team,
    pb.team       AS user_b_team
  FROM matches m
  JOIN match_participants pa ON pa.match_id = m.id AND pa.user_id = user_a
  JOIN match_participants pb ON pb.match_id = m.id AND pb.user_id = user_b
  WHERE m.status = 'finished'
  ORDER BY m.date DESC;
$$;
```

- [ ] **Step 2: Aplicar la migración**

```bash
npx supabase db push
```

Expected: sin errores.

- [ ] **Step 3: Verificar la RPC en el perfil de jugador**

Navegar a `/players/[id]` de algún jugador que comparta partidos con el usuario de test. El H2H debe aparecer sin caer al fallback app-side. En el código `src/app/players/[id]/page.tsx` el comentario `// if RPC fails, do it app-side` debería dejar de ejecutarse.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260424000002_add_get_common_matches_rpc.sql
git commit -m "feat(db): añadir RPC get_common_matches para cálculo H2H en SQL"
```

---

## Task 3: Componente `BottomNav`

**Files:**
- Create: `src/components/BottomNav.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
// src/components/BottomNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Calendar, Users, Trophy, User } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/",          label: "Inicio",    Icon: Home     },
  { href: "/matches",   label: "Partidos",  Icon: Calendar },
  { href: "/players",   label: "Jugadores", Icon: Users    },
  { href: "/fantasy",   label: "Fantasy",   Icon: Trophy   },
  { href: "/profile",   label: "Perfil",    Icon: User     },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface/95 backdrop-blur-xl md:hidden"
         style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
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
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2 transition-colors",
                active ? "text-accent" : "text-muted"
              )}
            >
              <span className={cn(
                "flex h-8 w-8 items-center justify-center rounded-xl transition-colors",
                active && "bg-accent/15"
              )}>
                <Icon size={18} />
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

- [ ] **Step 2: Commit parcial**

```bash
git add src/components/BottomNav.tsx
git commit -m "feat(ui): añadir componente BottomNav para navegación móvil"
```

---

## Task 4: Simplificar Navbar para móvil

**Files:**
- Modify: `src/components/NavbarClient.tsx`
- Modify: `src/components/Navbar.tsx`
- Modify: `src/app/layout.tsx`

El objetivo es: en móvil, la barra superior muestra solo logo + campana de notificaciones. El menú hamburguesa y el menú desplegable desaparecen. Los links de navegación se van a `BottomNav`. En desktop, todo queda como está.

- [ ] **Step 1: Actualizar `NavbarClient.tsx`**

Reemplazar el contenido completo del archivo:

```tsx
// src/components/NavbarClient.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Home, Calendar, BarChart3, Users, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavbarClientProps {
  desktopUserMenu?: React.ReactNode;
  mobileRight?: React.ReactNode;
}

const navLinks = [
  { href: "/",           label: "Inicio",    icon: Home      },
  { href: "/matches",    label: "Partidos",  icon: Calendar  },
  { href: "/leaderboard",label: "Ranking",   icon: BarChart3 },
  { href: "/players",    label: "Jugadores", icon: Users     },
  { href: "/fantasy",    label: "Fantasy",   icon: Star      },
];

export function NavbarClient({ desktopUserMenu, mobileRight }: NavbarClientProps) {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-surface/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Image src="/icon-192.png" alt="Pachanga" width={32} height={32} className="rounded-lg" />
          <span className="text-lg font-bold text-foreground">Pachanga</span>
        </Link>

        {/* Desktop Nav Links */}
        <div className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const active =
              pathname === link.href ||
              (link.href === "/matches" && pathname === "/history");
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent/10 text-accent"
                    : "text-muted hover:bg-surface-hover hover:text-foreground"
                )}
              >
                <Icon size={16} />
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Desktop: User menu (avatar + notifications + logout) */}
        <div className="hidden items-center gap-3 md:flex">
          {desktopUserMenu}
        </div>

        {/* Mobile: solo campana de notificaciones */}
        <div className="flex items-center md:hidden">
          {mobileRight}
        </div>
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Actualizar `Navbar.tsx` para pasar `mobileRight`**

Reemplazar el contenido completo del archivo:

```tsx
// src/components/Navbar.tsx
import { createClient } from "@/lib/supabase/server";
import { NavbarClient } from "./NavbarClient";
import { NotificationBell } from "./NotificationBell";
import { Suspense } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { getAvatarUrl } from "@/lib/utils";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/login/actions";

async function DesktopUserMenu() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, avatar_url")
    .eq("id", user.id)
    .single();

  const avatarUrl = getAvatarUrl(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    profile?.avatar_url ?? null
  );

  return (
    <>
      <NotificationBell userId={user.id} />
      <Link href="/profile" className="transition-transform hover:scale-105" title="Mi Perfil">
        <Avatar
          src={avatarUrl}
          fallback={profile?.username || user.email || "U"}
          size="sm"
        />
      </Link>
      <form action={signOut}>
        <button
          type="submit"
          className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
          title="Cerrar Sesión"
        >
          <LogOut size={16} />
        </button>
      </form>
    </>
  );
}

async function MobileNotificationBell() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return <NotificationBell userId={user.id} />;
}

export function Navbar() {
  return (
    <NavbarClient
      desktopUserMenu={
        <Suspense fallback={<div className="h-8 w-8 rounded-full bg-surface-hover animate-pulse" />}>
          <DesktopUserMenu />
        </Suspense>
      }
      mobileRight={
        <Suspense fallback={<div className="h-6 w-6 rounded-full bg-surface-hover animate-pulse" />}>
          <MobileNotificationBell />
        </Suspense>
      }
    />
  );
}
```

- [ ] **Step 3: Actualizar `layout.tsx` para añadir `BottomNav` y ajustar padding**

```tsx
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
  maximumScale: 1,
  userScalable: false,
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
        <ToastProvider>
          <Suspense fallback={<NavbarSkeleton />}>
            <Navbar />
          </Suspense>
          {/* pb-20 on mobile to clear the fixed BottomNav */}
          <main className="min-h-[calc(100vh-4rem)] pb-20 md:pb-0">{children}</main>
          <BottomNav />
        </ToastProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Arrancar dev server y verificar en viewport móvil**

```bash
npm run dev
```

Abrir `http://localhost:3000` con las DevTools en modo móvil (375px). Verificar:
- Bottom tab bar visible con 5 tabs
- Tab activo resaltado en accent (#ccff00)
- Navbar superior muestra logo + campana de notificaciones únicamente
- En desktop (≥768px) la bottom tab desaparece y el navbar muestra los links horizontales

- [ ] **Step 5: Commit**

```bash
git add src/components/NavbarClient.tsx src/components/Navbar.tsx src/app/layout.tsx
git commit -m "feat(nav): reemplazar menú hamburguesa con bottom tab bar en móvil"
```

---

## Task 5: Dashboard rediseñado

**Files:**
- Modify: `src/app/page.tsx`

El dashboard actual tiene: welcome header + stats en grid + próximo partido + lista de partidos abiertos + gráficas + historial reciente.

El nuevo: hero card del usuario (stats + ranking) + próximo partido destacado + lista compacta de otros partidos abiertos. Las gráficas e historial se eliminan del dashboard (ya están accesibles en `/players/[id]`).

- [ ] **Step 1: Reescribir `src/app/page.tsx`**

```tsx
// src/app/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { formatDate, getAvatarUrl } from "@/lib/utils";
import { Calendar, MapPin, Users, Zap, PlusCircle, ChevronRight } from "lucide-react";

// --- Hero Card ---

async function HeroCard({ userId }: { userId: string }) {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, avatar_url, elo_rating, matches_played, goals_scored, position")
    .eq("id", userId)
    .single();

  const { count: rankAbove } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .gt("elo_rating", profile?.elo_rating ?? 1000);

  const rank = (rankAbove ?? 0) + 1;
  const avatarUrl = getAvatarUrl(process.env.NEXT_PUBLIC_SUPABASE_URL!, profile?.avatar_url ?? null);

  return (
    <Card className="relative overflow-hidden border-border/80 bg-gradient-to-br from-surface to-surface-hover/50">
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-accent/5" />
      <div className="relative z-10 flex items-center gap-4">
        <Avatar src={avatarUrl} fallback={profile?.username || "P"} size="lg" priority />
        <div className="flex-1 min-w-0">
          <p className="text-xl font-bold text-foreground truncate">
            {profile?.username || "Jugador"}
          </p>
          <div className="flex items-center gap-1.5 text-accent">
            <Zap size={14} />
            <span className="text-sm font-semibold">{profile?.elo_rating ?? 1000} RP</span>
          </div>
        </div>
        <span className="shrink-0 rounded-lg border border-accent/20 bg-accent/10 px-2.5 py-1 text-xs font-bold text-accent">
          #{rank}
        </span>
      </div>
      <div className="relative z-10 mt-4 grid grid-cols-3 divide-x divide-border border-t border-border pt-4">
        <div className="px-4 text-center first:pl-0 last:pr-0">
          <p className="text-xl font-bold text-foreground">{profile?.matches_played ?? 0}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted">Partidos</p>
        </div>
        <div className="px-4 text-center">
          <p className="text-xl font-bold text-foreground">{profile?.goals_scored ?? 0}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted">Goles</p>
        </div>
        <div className="px-4 text-center first:pl-0 last:pr-0">
          <Link href="/leaderboard" className="block transition-opacity hover:opacity-80">
            <p className="text-xl font-bold text-accent">Ver</p>
            <p className="text-[10px] uppercase tracking-wider text-muted">Ranking</p>
          </Link>
        </div>
      </div>
    </Card>
  );
}

function HeroCardSkeleton() {
  return <div className="h-40 rounded-xl bg-surface/50 animate-pulse" />;
}

// --- Próximo partido destacado ---

async function NextMatchCard({ userId }: { userId: string }) {
  const supabase = await createClient();

  const { data: openMatches } = await supabase
    .from("matches")
    .select("*, match_participants(user_id)")
    .eq("status", "open")
    .gte("date", new Date().toISOString())
    .order("date", { ascending: true })
    .limit(1)
    .single();

  if (!openMatches) {
    return (
      <Card className="border-border/50 text-center">
        <p className="text-sm text-muted">No hay partidos abiertos ahora mismo.</p>
        <Link href="/matches/new" className="mt-2 inline-block">
          <Button variant="outline" size="sm">
            <PlusCircle size={14} />
            Crear partido
          </Button>
        </Link>
      </Card>
    );
  }

  const hasJoined = openMatches.match_participants.some((p: { user_id: string }) => p.user_id === userId);
  const playerCount = openMatches.match_participants.length;

  return (
    <Link href={`/matches/${openMatches.id}`} prefetch={false}>
      <Card className="border-accent/25 bg-gradient-to-r from-accent/8 to-transparent transition-all hover:border-accent/40 hover:shadow-[0_4px_24px_rgba(204,255,0,0.08)]">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-accent">
              {hasJoined ? "✓ Apuntado" : "Próximo partido"}
            </p>
            <p className="mt-0.5 font-semibold text-foreground">{openMatches.location}</p>
          </div>
          <ChevronRight size={18} className="mt-0.5 shrink-0 text-muted" />
        </div>
        <div className="flex items-center gap-4 text-sm text-muted">
          <span className="flex items-center gap-1.5">
            <Calendar size={13} />
            {formatDate(openMatches.date)}
          </span>
          <span className="flex items-center gap-1.5">
            <Users size={13} />
            {playerCount}/{openMatches.max_players}
          </span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-hover">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${Math.min((playerCount / openMatches.max_players) * 100, 100)}%` }}
          />
        </div>
      </Card>
    </Link>
  );
}

function NextMatchCardSkeleton() {
  return <div className="h-28 rounded-xl bg-surface/50 animate-pulse" />;
}

// --- Lista de partidos abiertos ---

async function MoreOpenMatches({ userId }: { userId: string }) {
  const supabase = await createClient();

  const { data: matches } = await supabase
    .from("matches")
    .select("*, match_participants(user_id)")
    .eq("status", "open")
    .gte("date", new Date().toISOString())
    .order("date", { ascending: true })
    .range(1, 5); // skip the first (shown in NextMatchCard)

  if (!matches || matches.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Más partidos</p>
        <Link href="/matches" className="text-xs font-medium text-accent hover:underline">
          Ver todos →
        </Link>
      </div>
      {matches.map((match) => {
        const hasJoined = match.match_participants.some((p: { user_id: string }) => p.user_id === userId);
        return (
          <Link key={match.id} href={`/matches/${match.id}`} prefetch={false}>
            <Card className="flex items-center gap-3 border-border/60 py-3 transition-colors hover:border-accent/30">
              <div className="h-2 w-2 shrink-0 rounded-full bg-accent" />
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{match.location}</p>
                <p className="text-xs text-muted">{formatDate(match.date)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {hasJoined && (
                  <span className="text-[10px] font-bold text-accent">✓</span>
                )}
                <span className="rounded-md border border-border px-2 py-0.5 text-xs text-muted">
                  {match.match_participants.length}/{match.max_players}
                </span>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

function MoreOpenMatchesSkeleton() {
  return (
    <div className="space-y-2">
      <div className="h-4 w-24 rounded bg-surface/50 animate-pulse" />
      {Array.from({ length: 3 }, (_, i) => (
        <div key={`skeleton-more-${i}`} className="h-16 rounded-xl bg-surface/50 animate-pulse" />
      ))}
    </div>
  );
}

// --- Main Page ---

async function DashboardContent() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <Suspense fallback={<HeroCardSkeleton />}>
        <HeroCard userId={user.id} />
      </Suspense>

      <Suspense fallback={<NextMatchCardSkeleton />}>
        <NextMatchCard userId={user.id} />
      </Suspense>

      <Suspense fallback={<MoreOpenMatchesSkeleton />}>
        <MoreOpenMatches userId={user.id} />
      </Suspense>
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        <HeroCardSkeleton />
        <NextMatchCardSkeleton />
        <MoreOpenMatchesSkeleton />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
```

- [ ] **Step 2: Verificar el dashboard en móvil**

Con `npm run dev` corriendo, abrir `http://localhost:3000` en vista móvil. Verificar:
- Hero card muestra avatar, RP, posición en ranking, partidos, goles
- Próximo partido tiene barra de progreso
- Lista de otros partidos tiene "Ver todos →"
- No hay gráficas ni historial (se ven en `/players/[id]`)

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(dashboard): rediseñar con hero card, próximo partido y lista compacta"
```

---

## Task 6: Detalle de partido con tabs

**Files:**
- Modify: `src/app/matches/[id]/MatchDetail.tsx`

`MatchDetail.tsx` actualmente tiene `activeTab: "chat" | "photos" | "mvp"` para una sección al final. Se refactoriza para tener 4 tabs principales: **Info** (todo lo de la primera mitad del scroll) / **Equipos** (SoccerPitch) / **Chat** / **Fotos** (fotos + MVP voting).

La estructura general del JSX del `return` cambia. Todo el código de handlers (`handleAction`, `handleSetScore`, etc.) se mantiene intacto.

- [ ] **Step 0: Leer el archivo completo antes de modificar**

```bash
# Leer MatchDetail.tsx completo para entender la estructura actual
# antes de hacer cualquier cambio. Hay ~600 líneas.
```

Prestar atención a:
- La lista completa de imports (especialmente qué acciones están importadas de `"../actions"`)
- El JSX actual del SoccerPitch (props exactos que se le pasan)
- Dónde está el bloque de `{activeTab === "chat" && ...}` etc.

- [ ] **Step 1: Añadir `closeMatch` a los imports de actions**

En la línea de imports de `"../actions"`, añadir `closeMatch`:

```typescript
import {
    joinMatch,
    leaveMatch,
    closeMatch,   // ← añadir
    setScore,
    generateTeams,
    cancelMatch,
    rescheduleMatch,
    kickPlayer,
} from "../actions";
```

- [ ] **Step 2: Cambiar el estado de `activeTab`**

Localizar la línea:
```typescript
const [activeTab, setActiveTab] = useState<"chat" | "photos" | "mvp">("chat");
```

Reemplazarla con:
```typescript
const [activeTab, setActiveTab] = useState<"info" | "equipos" | "chat" | "fotos">("info");
```

- [ ] **Step 3: Reemplazar el `return` de `MatchDetail`**

Localizar el `return (` en la función `MatchDetail` (alrededor de la línea 174) y reemplazar todo el JSX hasta el cierre de la función con:

```tsx
  return (
    <div className="mx-auto max-w-3xl">
      {/* Tabs de navegación interna */}
      <div className="sticky top-16 z-40 flex border-b border-border bg-surface/95 backdrop-blur-xl">
        {(["info", "equipos", "chat", "fotos"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "relative flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors",
              activeTab === tab ? "text-accent" : "text-muted hover:text-foreground"
            )}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {activeTab === tab && (
              <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full bg-accent" />
            )}
          </button>
        ))}
      </div>

      {/* Tab: Info */}
      {activeTab === "info" && (
        <div className="space-y-4 px-4 py-6">
          {/* Header del partido */}
          <Card className="relative overflow-hidden border-border/80 bg-gradient-to-br from-surface to-surface-hover/50">
            <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-accent/5 to-transparent pointer-events-none" />
            <div className="relative z-10 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${statusColors[match.status] || statusColors.open}`}>
                  {match.status === "cancelled" ? "CANCELADO" : match.status === "open" ? "ABIERTO" : match.status === "closed" ? "CERRADO" : match.status === "finished" ? "FINALIZADO" : match.status}
                </span>
                {isOrganizer && (
                  <span className="flex items-center gap-1 rounded-full bg-purple-500/10 px-2.5 py-1 text-[11px] font-bold text-purple-400 border border-purple-500/30 uppercase tracking-wider">
                    <Shield size={11} />
                    Organizador
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2 text-sm text-muted">
                <span className="flex items-center gap-2">
                  <Calendar size={15} className="text-accent" />
                  {formatDate(match.date)}
                </span>
                <span className="flex items-center gap-2">
                  <MapPin size={15} className="text-accent" />
                  {match.location}
                </span>
              </div>
              {/* Barra de progreso de jugadores */}
              <div>
                <div className="mb-1 flex justify-between text-xs text-muted">
                  <span className="flex items-center gap-1"><Users size={12} /> Jugadores</span>
                  <span className="font-semibold text-foreground">{participants.length} / {match.max_players}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-hover">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${Math.min((participants.length / match.max_players) * 100, 100)}%` }}
                  />
                </div>
              </div>
              {/* Resultado si está finalizado */}
              {match.status === "finished" && match.team_a_score !== null && match.team_b_score !== null && (
                <div className="flex items-center justify-center gap-4 rounded-xl bg-surface-hover/50 py-3">
                  <div className="text-center">
                    <p className="text-xs font-bold uppercase tracking-wider text-red-400">Rojo</p>
                    <p className="text-3xl font-black text-foreground">{match.team_a_score}</p>
                  </div>
                  <span className="text-xl font-bold text-muted">—</span>
                  <div className="text-center">
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-400">Azul</p>
                    <p className="text-3xl font-black text-foreground">{match.team_b_score}</p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* WeatherWidget */}
          <WeatherWidget matchDate={match.date} />

          {/* Botón unirse / abandonar */}
          {match.status === "open" && (
            <div className="flex gap-2">
              {!hasJoined ? (
                <Button
                  className="flex-1"
                  onClick={() => handleAction(() => joinMatch(match.id), "join", "¡Te has apuntado!")}
                  disabled={loading === "join" || participants.length >= match.max_players}
                >
                  <UserPlus size={16} />
                  {loading === "join" ? "Apuntando..." : "Apuntarse"}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleAction(() => leaveMatch(match.id), "leave", "Has abandonado el partido.")}
                  disabled={loading === "leave"}
                >
                  <LeaveIcon size={16} />
                  {loading === "leave" ? "Saliendo..." : "Abandonar"}
                </Button>
              )}
            </div>
          )}

          {/* Acciones de administración */}
          {canManage && match.status !== "cancelled" && match.status !== "finished" && (
            <Card className="border-border/60 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Gestión</p>
              <div className="flex flex-wrap gap-2">
                {match.status === "open" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction(() => generateTeams(match.id), "teams", "¡Equipos generados!")}
                    disabled={loading === "teams" || participants.length < 2}
                  >
                    <Shuffle size={14} />
                    {loading === "teams" ? "Generando..." : "Generar equipos"}
                  </Button>
                )}
                {match.status === "open" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction(() => closeMatch(match.id) as any, "close", "Partido cerrado.")}
                    disabled={loading === "close"}
                  >
                    {loading === "close" ? "Cerrando..." : "Cerrar partido"}
                  </Button>
                )}
                {(match.status === "open" || match.status === "closed") && (
                  <Button size="sm" variant="outline" onClick={() => setScoreDialogOpen(true)}>
                    <Trophy size={14} />
                    Poner resultado
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setRescheduleDialogOpen(true)}>
                  <CalendarClock size={14} />
                  Reprogramar
                </Button>
                <Button size="sm" variant="danger" onClick={() => setCancelDialogOpen(true)}>
                  <XCircle size={14} />
                  Cancelar
                </Button>
              </div>
            </Card>
          )}

          {/* MVP Voting (cuando el partido está finalizado) */}
          {match.status === "finished" && (
            <MvpVoting
              matchId={match.id}
              currentUserId={currentUserId}
              participants={participants}
              canManage={canManage}
            />
          )}

          {/* Lista de jugadores */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
              Jugadores ({participants.length}/{match.max_players})
            </p>
            <div className="space-y-2">
              {participants.map((p) => {
                const avatarUrl = getAvatarUrl(process.env.NEXT_PUBLIC_SUPABASE_URL!, p.profiles.avatar_url ?? null);
                const posColor = POSITION_COLORS[p.profiles.position as keyof typeof POSITION_COLORS] ?? "text-muted";
                return (
                  <Card key={p.user_id} className="flex items-center gap-3 border-border/60 py-3">
                    <Avatar src={avatarUrl} fallback={p.profiles.username || "?"} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{p.profiles.username}</p>
                    </div>
                    {p.profiles.position && (
                      <span className={`text-[11px] font-bold ${posColor}`}>
                        {POSITION_SHORT[p.profiles.position as keyof typeof POSITION_SHORT]}
                      </span>
                    )}
                    <span className="text-xs text-muted">{p.profiles.elo_rating ?? 1000} RP</span>
                    {canManage && p.user_id !== currentUserId && (
                      <button
                        onClick={() => handleAction(() => kickPlayer(match.id, p.user_id), `kick-${p.user_id}`, `${p.profiles.username} expulsado.`)}
                        disabled={loading === `kick-${p.user_id}`}
                        className="rounded p-1 text-muted transition-colors hover:bg-red-500/10 hover:text-red-400"
                        title="Expulsar jugador"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Equipos */}
      {activeTab === "equipos" && (
        <div className="px-4 py-6">
          {teamsGenerated ? (
            // Usar exactamente el mismo JSX de SoccerPitch que estaba en el return original del archivo
            // (copiar de la lectura del Step 0 — los props exactos dependen del componente)
            <SoccerPitch
              teamA={teamA}
              teamB={teamB}
            />
          ) : (
            <Card className="border-border/50 py-12 text-center">
              <Shuffle size={32} className="mx-auto mb-3 text-muted/50" />
              <p className="text-sm text-muted">Los equipos aún no se han generado.</p>
              {canManage && match.status === "open" && participants.length >= 2 && (
                <Button
                  className="mt-4"
                  variant="outline"
                  onClick={() => {
                    handleAction(() => generateTeams(match.id), "teams", "¡Equipos generados!");
                    setActiveTab("equipos");
                  }}
                  disabled={loading === "teams"}
                >
                  <Shuffle size={16} />
                  {loading === "teams" ? "Generando..." : "Generar equipos"}
                </Button>
              )}
            </Card>
          )}
        </div>
      )}

      {/* Tab: Chat */}
      {activeTab === "chat" && (
        <div className="px-4 py-6">
          <MatchChat
            matchId={match.id}
            currentUserId={currentUserId}
            currentUserProfile={currentUserProfile}
          />
        </div>
      )}

      {/* Tab: Fotos */}
      {activeTab === "fotos" && (
        <div className="px-4 py-6">
          <MatchPhotos
            matchId={match.id}
            currentUserId={currentUserId}
          />
        </div>
      )}

      {/* Dialogs (siempre montados, no dependen del tab activo) */}

      {/* Score Dialog */}
      <Dialog open={scoreDialogOpen} onClose={() => setScoreDialogOpen(false)} title="Poner Resultado">
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-red-400">Rojo</p>
              <input
                type="number"
                min={0}
                value={teamAScore}
                onChange={(e) => setTeamAScore(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-16 rounded-lg border border-border bg-surface-hover p-2 text-center text-2xl font-bold text-foreground focus:border-accent focus:outline-none"
              />
            </div>
            <span className="text-xl font-bold text-muted">—</span>
            <div className="text-center">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-blue-400">Azul</p>
              <input
                type="number"
                min={0}
                value={teamBScore}
                onChange={(e) => setTeamBScore(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-16 rounded-lg border border-border bg-surface-hover p-2 text-center text-2xl font-bold text-foreground focus:border-accent focus:outline-none"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGoalScorers(!showGoalScorers)}
              className="flex items-center gap-1.5 text-xs text-accent hover:underline"
            >
              <Target size={12} />
              {showGoalScorers ? "Ocultar" : "Añadir"} goleadores (opcional)
              <ChevronDown size={12} className={showGoalScorers ? "rotate-180" : ""} />
            </button>
          </div>
          {showGoalScorers && (
            <div className="space-y-2 rounded-xl border border-border p-3">
              {participants.map((p) => (
                <div key={p.user_id} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-foreground">{p.profiles.username}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPlayerGoals(p.user_id, (goalScorers[p.user_id] ?? 0) - 1)} className="rounded bg-surface-hover px-2 py-1 text-sm text-muted">−</button>
                    <span className="w-6 text-center text-sm font-semibold text-foreground">{goalScorers[p.user_id] ?? 0}</span>
                    <button onClick={() => setPlayerGoals(p.user_id, (goalScorers[p.user_id] ?? 0) + 1)} className="rounded bg-surface-hover px-2 py-1 text-sm text-muted">+</button>
                  </div>
                </div>
              ))}
              <div className="border-t border-border pt-2 text-xs text-muted">
                Rojo: {teamAGoalsAssigned}/{teamAScore === "" ? 0 : teamAScore} · Azul: {teamBGoalsAssigned}/{teamBScore === "" ? 0 : teamBScore}
              </div>
            </div>
          )}
          <Button className="w-full" onClick={handleSetScore} disabled={loading === "score"}>
            <Trophy size={16} />
            {loading === "score" ? "Guardando..." : "Confirmar resultado"}
          </Button>
        </div>
      </Dialog>

      {/* Reschedule Dialog */}
      <Dialog open={rescheduleDialogOpen} onClose={() => setRescheduleDialogOpen(false)} title="Reprogramar Partido">
        <div className="space-y-4">
          <input
            type="datetime-local"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface-hover p-2 text-foreground focus:border-accent focus:outline-none"
          />
          <Button
            className="w-full"
            onClick={() => handleAction(
              () => rescheduleMatch(match.id, newDate),
              "reschedule",
              "Partido reprogramado."
            ).then(() => setRescheduleDialogOpen(false))}
            disabled={loading === "reschedule" || !newDate}
          >
            <CalendarClock size={16} />
            {loading === "reschedule" ? "Reprogramando..." : "Confirmar nueva fecha"}
          </Button>
        </div>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)} title="Cancelar Partido">
        <div className="space-y-4">
          <p className="text-sm text-muted">¿Seguro que quieres cancelar este partido? Se notificará a todos los jugadores.</p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setCancelDialogOpen(false)}>
              Volver
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={() => handleAction(() => cancelMatch(match.id), "cancel", "Partido cancelado.").then(() => setCancelDialogOpen(false))}
              disabled={loading === "cancel"}
            >
              <Ban size={16} />
              {loading === "cancel" ? "Cancelando..." : "Cancelar partido"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 4: Añadir el import `cn` al MatchDetail si no está**

Buscar la línea de imports en `MatchDetail.tsx`. Si no existe `import { cn } from "@/lib/utils"`, añadirla junto a los otros imports.

- [ ] **Step 5: Verificar en el navegador**

Navegar a `/matches/[id]` de algún partido. Verificar:
- 4 tabs visibles (Info / Equipos / Chat / Fotos)
- Tab "Info" activo por defecto, muestra header + barra de progreso + jugadores
- Tab "Equipos" muestra el campo o el estado vacío
- Tab "Chat" muestra el chat
- Tab "Fotos" muestra las fotos

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errores. Si hay errores de tipos, corregirlos antes de continuar.

- [ ] **Step 7: Commit**

```bash
git add src/app/matches/[id]/MatchDetail.tsx
git commit -m "feat(matches): rediseñar detalle de partido con tabs Info/Equipos/Chat/Fotos"
```

---

## Task 7: Paginación en listas

**Files:**
- Modify: `src/app/matches/page.tsx`
- Modify: `src/app/players/page.tsx`
- Modify: `src/app/leaderboard/page.tsx`

### 7a — Partidos (límite de 30 más recientes)

- [ ] **Step 1: Añadir `limit(30)` a la query de matches**

En `src/app/matches/page.tsx`, cambiar la query:

```typescript
// Antes:
const { data: matches } = await supabase
  .from("matches")
  .select("*, match_participants(user_id, team, goals, is_mvp)")
  .order("date", { ascending: false });

// Después:
const { data: matches } = await supabase
  .from("matches")
  .select("*, match_participants(user_id, team, goals, is_mvp)")
  .order("date", { ascending: false })
  .limit(30);
```

### 7b — Jugadores (paginación URL `?page=N`)

- [ ] **Step 2: Añadir `searchParams` y paginación en `players/page.tsx`**

```typescript
// src/app/players/page.tsx
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PlayersList } from "./PlayersList";
import { getAdminUserIds } from "@/lib/permissions";
import type { Profile } from "@/lib/types";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Jugadores — Pachanga",
  description: "Explora todos los jugadores de la comunidad.",
};

const PAGE_SIZE = 20;

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const [{ data: profiles, count }, adminUserIds] = await Promise.all([
    supabase
      .from("profiles")
      .select("*", { count: "exact" })
      .order("matches_played", { ascending: false })
      .range(from, to),
    getAdminUserIds(),
  ]);

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Jugadores</h1>
        <p className="text-muted">Explora todos los jugadores registrados</p>
      </div>
      <PlayersList
        profiles={(profiles as Profile[]) || []}
        currentUserId={user.id}
        adminUserIds={adminUserIds}
      />
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={`/players?page=${page - 1}`}
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-accent/30 hover:text-foreground"
            >
              ← Anterior
            </Link>
          )}
          <span className="text-sm text-muted">{page} / {totalPages}</span>
          {page < totalPages && (
            <Link
              href={`/players?page=${page + 1}`}
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-accent/30 hover:text-foreground"
            >
              Siguiente →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
```

### 7c — Leaderboard (paginación URL `?page=N`)

- [ ] **Step 3: Añadir `searchParams` y paginación en `leaderboard/page.tsx`**

```typescript
// src/app/leaderboard/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LeaderboardTabs } from "./LeaderboardTabs";
import { getAdminUserIds } from "@/lib/permissions";
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
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const [{ data: profiles, count }, { data: allParticipations }, adminUserIds] = await Promise.all([
    supabase
      .from("profiles")
      .select("*", { count: "exact" })
      .order("matches_played", { ascending: false })
      .range(from, to),
    supabase
      .from("match_participants")
      .select("user_id, team, goals, is_mvp, matches(status, team_a_score, team_b_score)"),
    getAdminUserIds(),
  ]);

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  // Build stats map (igual que antes)
  const statsMap: Record<string, { wins: number; draws: number; losses: number; mvps: number }> = {};
  if (allParticipations) {
    for (const p of allParticipations) {
      const match = p.matches as unknown as {
        status: string; team_a_score: number | null; team_b_score: number | null;
      };
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
            <Link
              href={`/leaderboard?page=${page - 1}`}
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-accent/30 hover:text-foreground"
            >
              ← Anterior
            </Link>
          )}
          <span className="text-sm text-muted">{page} / {totalPages}</span>
          {page < totalPages && (
            <Link
              href={`/leaderboard?page=${page + 1}`}
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-accent/30 hover:text-foreground"
            >
              Siguiente →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verificar paginación**

Abrir `/players` y `/leaderboard`. Si hay más de 20 jugadores, deben aparecer los botones de paginación. Si hay menos, los botones no aparecen.

- [ ] **Step 5: Commit**

```bash
git add src/app/matches/page.tsx src/app/players/page.tsx src/app/leaderboard/page.tsx
git commit -m "feat(perf): añadir paginación en matches, players y leaderboard"
```

---

## Task 8: Verificación final E2E

- [ ] **Step 1: Arrancar Supabase local y ejecutar los tests existentes**

```bash
npx supabase start
npx playwright test
```

Expected: todos los tests pasan. Los tests existentes cubren: auth, navegación a /matches, crear partido, unirse/abandonar, generar equipos, poner resultado.

- [ ] **Step 2: Verificar manualmente en móvil**

Con `npm run dev` + DevTools en 375px:
- `/` → hero card visible, próximo partido visible
- tap "Partidos" en bottom nav → navega a /matches
- tap "Jugadores" → navega a /players
- tap "Fantasy" → navega a /fantasy
- tap "Perfil" → navega a /profile
- abrir un partido → ver 4 tabs (Info / Equipos / Chat / Fotos)
- tab activo en bottom nav resaltado en accent

- [ ] **Step 3: Verificar en desktop (≥768px)**

- Bottom nav oculto
- Navbar superior muestra links horizontales + avatar + logout
- Dashboard funciona igual

- [ ] **Step 4: Commit final si hay ajustes menores**

```bash
git add -p
git commit -m "fix: ajustes visuales tras verificación E2E"
```
