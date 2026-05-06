# Panenka — Asistente IA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir la página `/asistente` con Panenka, un asistente conversacional que responde preguntas en lenguaje natural sobre datos reales de Pachanga (jugadores, partidos, estadísticas, fantasy) usando Gemini 2.0 Flash con tool calling contra Supabase.

**Architecture:** Route Handler `POST /api/asistente` con Vercel AI SDK (`streamText`) y 10 tools que ejecutan queries en Supabase admin client. El cliente usa el hook `useChat` de `ai/react` para streaming token a token. Auth verificada en el server (cookies Supabase), rate limiting de 15 req/min por usuario.

**Tech Stack:** `ai` (Vercel AI SDK), `@ai-sdk/google` (Gemini 2.0 Flash), `zod` (validación de parámetros), Supabase admin client, Next.js 16 App Router, Lucide React (icono `Bot`).

---

## Mapa de archivos

| Acción | Archivo | Responsabilidad |
|--------|---------|----------------|
| Crear | `src/lib/ai/tools.ts` | 10 tool definitions con Zod schemas y ejecutores Supabase |
| Crear | `src/app/api/asistente/route.ts` | POST handler: auth + rate limit + streamText |
| Crear | `src/app/asistente/page.tsx` | Server Component: verifica auth, renderiza AsistenteChat |
| Crear | `src/app/asistente/AsistenteChat.tsx` | Client Component: UI del chat con `useChat` |
| Crear | `e2e/asistente.spec.ts` | E2E: acceso no autenticado y renderizado autenticado |
| Modificar | `src/components/NavbarClient.tsx` | Añadir link "Panenka" con icono Bot al nav desktop |
| Modificar | `src/components/Navbar.tsx` | Añadir botón Bot en mobileRight junto a campana |

---

## Task 1: Instalar dependencias y configurar variable de entorno

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `.env.local` (añadir `GOOGLE_GENERATIVE_AI_API_KEY`)

- [ ] **Step 1: Instalar los paquetes**

```bash
npm install ai @ai-sdk/google zod
```

Salida esperada: `added N packages` sin errores.

- [ ] **Step 2: Verificar que los paquetes se instalaron**

```bash
node -e "require('ai'); require('@ai-sdk/google'); require('zod'); console.log('OK')"
```

Salida esperada: `OK`

- [ ] **Step 3: Añadir la clave de API de Google a `.env.local`**

Abre `.env.local` y añade esta línea al final:

```
GOOGLE_GENERATIVE_AI_API_KEY=tu_clave_de_google_aqui
```

> **Nota:** `@ai-sdk/google` lee esta variable de entorno automáticamente. No es necesario pasarla explícitamente en el código.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: instalar ai, @ai-sdk/google y zod para asistente Panenka"
```

---

## Task 2: Escribir el test E2E de la página `/asistente`

**Files:**
- Create: `e2e/asistente.spec.ts`

El test verifica que usuarios no autenticados son redirigidos y que usuarios autenticados ven el header de Panenka. Se escribe **antes** de implementar la página (TDD).

- [ ] **Step 1: Crear el archivo de test**

Crea `e2e/asistente.spec.ts` con este contenido:

```typescript
import { test, expect } from "@playwright/test";

test.describe("Asistente Panenka", () => {
    test("usuario no autenticado es redirigido a login @smoke", async ({ page }) => {
        test.use({ storageState: { cookies: [], origins: [] } });
        await page.goto("/asistente");
        await page.waitForURL("**/login");
        await expect(page.locator('input[type="email"]')).toBeVisible();
    });

    test("usuario autenticado ve la página de Panenka @smoke", async ({ page }) => {
        await page.goto("/asistente");
        await expect(page.getByText("Panenka")).toBeVisible();
        await expect(page.getByText("Tu asistente futbolero")).toBeVisible();
        await expect(page.getByPlaceholder("Pregunta a Panenka...")).toBeVisible();
    });

    test("las sugerencias rápidas aparecen en estado vacío @smoke", async ({ page }) => {
        await page.goto("/asistente");
        await expect(page.getByText("¿Quién lidera el ranking?")).toBeVisible();
        await expect(page.getByText("¿Cuáles son mis estadísticas?")).toBeVisible();
    });

    test("la ruta POST /api/asistente rechaza requests no autenticados", async ({ request }) => {
        const response = await request.post("http://localhost:3000/api/asistente", {
            data: { messages: [{ role: "user", content: "hola" }] },
            headers: { "Cookie": "" },
        });
        expect(response.status()).toBe(401);
    });
});
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

```bash
npx playwright test e2e/asistente.spec.ts --project=chromium
```

Salida esperada: todos los tests `FAIL` con errores de página no encontrada o redirección incorrecta. Esto confirma que el test está bien escrito antes de la implementación.

- [ ] **Step 3: Commit**

```bash
git add e2e/asistente.spec.ts
git commit -m "test(e2e): añadir tests del asistente Panenka (failing)"
```

---

## Task 3: Implementar las 10 tools de Supabase (`src/lib/ai/tools.ts`)

**Files:**
- Create: `src/lib/ai/tools.ts`

Todas las tools usan el cliente admin (bypassa RLS) ya que las queries son de lectura y el usuario ya está autenticado en el route handler.

- [ ] **Step 1: Crear `src/lib/ai/tools.ts`**

```typescript
import { tool } from "ai";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

export function buildTools(userId: string) {
    const admin = createAdminClient();

    return {
        get_players: tool({
            description:
                "Busca jugadores con filtros opcionales de posición y rango ELO. Devuelve lista con estadísticas.",
            parameters: z.object({
                position: z
                    .enum(["GK", "DEF", "MID", "FWD"])
                    .optional()
                    .describe("Posición del jugador"),
                min_elo: z.number().optional().describe("ELO mínimo"),
                max_elo: z.number().optional().describe("ELO máximo"),
                limit: z.number().default(20).describe("Número máximo de resultados"),
            }),
            execute: async ({ position, min_elo, max_elo, limit }) => {
                let query = admin
                    .from("profiles")
                    .select(
                        "username, position, elo_rating, matches_played, goals_scored, market_value"
                    )
                    .order("elo_rating", { ascending: false })
                    .limit(limit);

                if (position) query = query.eq("position", position);
                if (min_elo !== undefined) query = query.gte("elo_rating", min_elo);
                if (max_elo !== undefined) query = query.lte("elo_rating", max_elo);

                const { data, error } = await query;
                if (error) return { error: "No se pudo obtener la lista de jugadores" };
                return { jugadores: data };
            },
        }),

        get_matches: tool({
            description:
                "Busca partidos con filtros opcionales de estado y rango de fechas (ISO 8601).",
            parameters: z.object({
                status: z
                    .enum(["open", "closed", "finished", "cancelled"])
                    .optional()
                    .describe("Estado del partido"),
                from_date: z.string().optional().describe("Fecha de inicio (ISO 8601)"),
                to_date: z.string().optional().describe("Fecha de fin (ISO 8601)"),
                limit: z.number().default(10).describe("Número máximo de resultados"),
            }),
            execute: async ({ status, from_date, to_date, limit }) => {
                let query = admin
                    .from("matches")
                    .select(
                        "id, date, location, status, max_players, team_a_score, team_b_score"
                    )
                    .order("date", { ascending: false })
                    .limit(limit);

                if (status) query = query.eq("status", status);
                if (from_date) query = query.gte("date", from_date);
                if (to_date) query = query.lte("date", to_date);

                const { data, error } = await query;
                if (error) return { error: "No se pudo obtener los partidos" };
                return { partidos: data };
            },
        }),

        get_top_scorers: tool({
            description: "Devuelve el ranking de máximos goleadores de la app.",
            parameters: z.object({
                limit: z.number().default(10).describe("Número de goleadores a devolver"),
            }),
            execute: async ({ limit }) => {
                const { data, error } = await admin
                    .from("profiles")
                    .select("username, goals_scored, matches_played, position")
                    .order("goals_scored", { ascending: false })
                    .limit(limit);
                if (error) return { error: "No se pudo obtener el ranking de goleadores" };
                return { goleadores: data };
            },
        }),

        get_leaderboard: tool({
            description:
                "Devuelve el ranking ELO de jugadores con al menos 3 partidos jugados.",
            parameters: z.object({
                limit: z.number().default(10).describe("Número de jugadores a devolver"),
            }),
            execute: async ({ limit }) => {
                const { data, error } = await admin
                    .from("profiles")
                    .select("username, elo_rating, matches_played, goals_scored, position")
                    .gte("matches_played", 3)
                    .order("elo_rating", { ascending: false })
                    .limit(limit);
                if (error) return { error: "No se pudo obtener el ranking" };
                return { ranking: data };
            },
        }),

        get_player_detail: tool({
            description:
                "Obtiene el perfil completo y posición en el ranking de un jugador por su nombre de usuario.",
            parameters: z.object({
                username: z.string().describe("Nombre de usuario del jugador"),
            }),
            execute: async ({ username }) => {
                const { data: player, error } = await admin
                    .from("profiles")
                    .select(
                        "username, position, skill_level, elo_rating, matches_played, goals_scored, market_value"
                    )
                    .ilike("username", username)
                    .single();

                if (error || !player)
                    return { error: `No se encontró al jugador "${username}"` };

                const { count } = await admin
                    .from("profiles")
                    .select("id", { count: "exact", head: true })
                    .gt("elo_rating", player.elo_rating)
                    .gte("matches_played", 3);

                return { jugador: { ...player, rank: (count ?? 0) + 1 } };
            },
        }),

        get_match_detail: tool({
            description:
                "Obtiene los detalles completos de un partido: resultado, participantes, goles y MVP.",
            parameters: z.object({
                match_id: z.string().describe("ID del partido"),
            }),
            execute: async ({ match_id }) => {
                const { data, error } = await admin
                    .from("matches")
                    .select(
                        "*, match_participants(user_id, team, goals, is_mvp, has_paid, profiles(username, position))"
                    )
                    .eq("id", match_id)
                    .single();
                if (error || !data) return { error: "No se encontró el partido" };
                return { partido: data };
            },
        }),

        get_my_stats: tool({
            description:
                "Devuelve las estadísticas del usuario autenticado: ELO, goles, partidos jugados y posición en el ranking.",
            parameters: z.object({}),
            execute: async () => {
                const { data: profile, error } = await admin
                    .from("profiles")
                    .select(
                        "username, position, elo_rating, matches_played, goals_scored, market_value"
                    )
                    .eq("id", userId)
                    .single();

                if (error || !profile)
                    return { error: "No se pudieron obtener tus estadísticas" };

                const { count } = await admin
                    .from("profiles")
                    .select("id", { count: "exact", head: true })
                    .gt("elo_rating", profile.elo_rating)
                    .gte("matches_played", 3);

                return { mis_stats: { ...profile, rank: (count ?? 0) + 1 } };
            },
        }),

        get_fantasy_standings: tool({
            description:
                "Devuelve la clasificación de equipos fantasy ordenada por puntos totales.",
            parameters: z.object({
                limit: z.number().default(10).describe("Número de equipos a devolver"),
            }),
            execute: async ({ limit }) => {
                const { data, error } = await admin
                    .from("fantasy_teams")
                    .select("name, total_points, budget, profiles(username)")
                    .order("total_points", { ascending: false })
                    .limit(limit);
                if (error)
                    return { error: "No se pudo obtener la clasificación fantasy" };
                return { clasificacion: data };
            },
        }),

        get_my_fantasy_team: tool({
            description:
                "Devuelve el equipo fantasy del usuario autenticado con su plantilla completa (titulares, suplentes, capitán).",
            parameters: z.object({}),
            execute: async () => {
                const { data: team, error: teamError } = await admin
                    .from("fantasy_teams")
                    .select("id, name, total_points, budget")
                    .eq("user_id", userId)
                    .single();

                if (teamError || !team)
                    return {
                        error: "No tienes un equipo fantasy o no se pudo obtener",
                    };

                const { data: roster, error: rosterError } = await admin
                    .from("fantasy_rosters")
                    .select(
                        "is_captain, is_starter, profiles(username, position, elo_rating)"
                    )
                    .eq("team_id", team.id);

                if (rosterError) return { error: "No se pudo obtener la plantilla" };

                return { equipo: { ...team, plantilla: roster } };
            },
        }),

        get_players_history_together: tool({
            description:
                "Devuelve los partidos en los que dos jugadores coincidieron, con el equipo y goles de cada uno.",
            parameters: z.object({
                player_a: z.string().describe("Nombre de usuario del primer jugador"),
                player_b: z.string().describe("Nombre de usuario del segundo jugador"),
            }),
            execute: async ({ player_a, player_b }) => {
                const { data: profiles, error: profilesError } = await admin
                    .from("profiles")
                    .select("id, username")
                    .or(
                        `username.ilike.${player_a},username.ilike.${player_b}`
                    );

                if (profilesError || !profiles || profiles.length < 2)
                    return {
                        error: `No se encontraron ambos jugadores: "${player_a}" y "${player_b}"`,
                    };

                const profileA = profiles.find(
                    (p) => p.username?.toLowerCase() === player_a.toLowerCase()
                );
                const profileB = profiles.find(
                    (p) => p.username?.toLowerCase() === player_b.toLowerCase()
                );

                if (!profileA || !profileB)
                    return {
                        error: `No se encontraron ambos jugadores: "${player_a}" y "${player_b}"`,
                    };

                const { data: matchesA } = await admin
                    .from("match_participants")
                    .select("match_id, team, goals, is_mvp")
                    .eq("user_id", profileA.id);

                if (!matchesA || matchesA.length === 0)
                    return { partidos_juntos: [] };

                const matchIds = matchesA.map((m) => m.match_id);

                const { data: matchesB } = await admin
                    .from("match_participants")
                    .select("match_id, team, goals, is_mvp")
                    .eq("user_id", profileB.id)
                    .in("match_id", matchIds);

                if (!matchesB || matchesB.length === 0)
                    return { partidos_juntos: [] };

                const sharedIds = matchesB.map((m) => m.match_id);

                const { data: matches } = await admin
                    .from("matches")
                    .select("id, date, location, team_a_score, team_b_score, status")
                    .in("id", sharedIds)
                    .order("date", { ascending: false });

                const result = (matches ?? []).map((match) => {
                    const partA = matchesA.find((m) => m.match_id === match.id);
                    const partB = matchesB.find((m) => m.match_id === match.id);
                    return {
                        ...match,
                        [player_a]: {
                            equipo: partA?.team,
                            goles: partA?.goals,
                            mvp: partA?.is_mvp,
                        },
                        [player_b]: {
                            equipo: partB?.team,
                            goles: partB?.goals,
                            mvp: partB?.is_mvp,
                        },
                    };
                });

                return { partidos_juntos: result };
            },
        }),
    };
}
```

- [ ] **Step 2: Verificar que TypeScript no da errores en el módulo**

```bash
npx tsc --noEmit --project tsconfig.json 2>&1 | head -30
```

Salida esperada: sin errores relacionados con `src/lib/ai/tools.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/tools.ts
git commit -m "feat(ai): implementar 10 tools de Supabase para Panenka"
```

---

## Task 4: Implementar el Route Handler `POST /api/asistente`

**Files:**
- Create: `src/app/api/asistente/route.ts`

- [ ] **Step 1: Crear el directorio y el archivo**

```bash
mkdir -p src/app/api/asistente
```

Crea `src/app/api/asistente/route.ts`:

```typescript
import { streamText } from "ai";
import { google } from "@ai-sdk/google";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { buildTools } from "@/lib/ai/tools";

const SYSTEM_PROMPT = `Eres Panenka, el asistente oficial de Pachanga — una app para organizar partidos de fútbol entre amigos. Tienes acceso a datos reales: jugadores, partidos, estadísticas, rankings y equipos fantasy.

Responde siempre en español, de forma concisa y con personalidad futbolera. Usa los datos de las tools para responder con precisión. Cuando no tengas datos suficientes, dilo claramente. No inventes estadísticas.`;

export async function POST(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return new Response("No autenticado", { status: 401 });
    }

    const { allowed } = await rateLimit(`asistente:${user.id}`, 15, 60_000);
    if (!allowed) {
        return new Response(
            JSON.stringify({
                error: "Panenka necesita un descanso, espera un momento ⚽",
            }),
            { status: 429, headers: { "Content-Type": "application/json" } }
        );
    }

    const { messages } = await request.json();

    const result = streamText({
        model: google("gemini-2.0-flash"),
        system: SYSTEM_PROMPT,
        messages,
        tools: buildTools(user.id),
        maxSteps: 5,
    });

    return result.toDataStreamResponse();
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit --project tsconfig.json 2>&1 | head -30
```

Salida esperada: sin errores.

- [ ] **Step 3: Ejecutar el test de autenticación del route handler**

Con el servidor corriendo (`npm run dev` en otra terminal):

```bash
npx playwright test e2e/asistente.spec.ts --grep "rechaza requests" --project=chromium
```

Salida esperada: `PASSED` — la ruta devuelve 401 sin autenticación.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/asistente/route.ts
git commit -m "feat(api): implementar route handler POST /api/asistente con Gemini 2.0 Flash"
```

---

## Task 5: Implementar la página y el componente de chat

**Files:**
- Create: `src/app/asistente/page.tsx`
- Create: `src/app/asistente/AsistenteChat.tsx`

- [ ] **Step 1: Crear `src/app/asistente/page.tsx`**

```typescript
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AsistenteChat } from "./AsistenteChat";

export const metadata = {
    title: "Panenka — Asistente IA | Pachanga",
};

export default async function AsistentePage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    return (
        <div className="mx-auto max-w-2xl px-4 py-6">
            <AsistenteChat />
        </div>
    );
}
```

- [ ] **Step 2: Crear `src/app/asistente/AsistenteChat.tsx`**

```typescript
"use client";

import { useChat } from "ai/react";
import { useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";

const SUGERENCIAS = [
    "¿Quién lidera el ranking?",
    "¿Cuáles son mis estadísticas?",
    "¿Quién ha marcado más goles?",
    "¿Cuándo es el próximo partido?",
];

export function AsistenteChat() {
    const { messages, input, handleInputChange, handleSubmit, isLoading, error, setInput } =
        useChat({ api: "/api/asistente" });
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    return (
        <div
            className="flex flex-col rounded-2xl border border-border bg-surface"
            style={{ minHeight: "calc(100vh - 10rem)" }}
        >
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                <Avatar src="/panenka.png" fallback="⚽" size="sm" />
                <div>
                    <h1 className="text-sm font-bold text-foreground">Panenka</h1>
                    <p className="text-[10px] text-muted">Tu asistente futbolero</p>
                </div>
                <span className="ml-auto flex items-center gap-1.5">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
                    <span className="text-[10px] font-medium text-accent">En línea</span>
                </span>
            </div>

            {/* Messages */}
            <div
                ref={scrollRef}
                className="flex-1 space-y-4 overflow-y-auto px-4 py-4"
            >
                {messages.length === 0 && (
                    <div className="flex flex-col items-center gap-6 py-8 text-center">
                        <Avatar src="/panenka.png" fallback="⚽" size="lg" />
                        <div>
                            <p className="font-semibold text-foreground">
                                ¡Hola! Soy Panenka
                            </p>
                            <p className="mt-1 text-sm text-muted">
                                Pregúntame lo que quieras sobre los datos de Pachanga
                            </p>
                        </div>
                        <div className="grid w-full grid-cols-2 gap-2">
                            {SUGERENCIAS.map((s) => (
                                <button
                                    key={s}
                                    onClick={() => setInput(s)}
                                    className="rounded-xl border border-border bg-surface-hover px-3 py-2.5 text-left text-xs text-muted transition-colors hover:border-accent/40 hover:text-foreground"
                                >
                                    ⚽ {s}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((m) => {
                    if (m.role === "tool") return null;
                    const isUser = m.role === "user";
                    const text = m.content;
                    if (!text) return null;

                    return (
                        <div
                            key={m.id}
                            className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}
                        >
                            {!isUser && (
                                <Avatar
                                    src="/panenka.png"
                                    fallback="⚽"
                                    size="sm"
                                    className="mt-0.5 shrink-0"
                                />
                            )}
                            <div
                                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                                    isUser
                                        ? "rounded-tr-sm bg-accent/10 text-foreground"
                                        : "rounded-tl-sm bg-surface-hover text-foreground"
                                }`}
                            >
                                <p className="whitespace-pre-wrap break-words">{text}</p>
                            </div>
                        </div>
                    );
                })}

                {isLoading && (
                    <div className="flex gap-2.5">
                        <Avatar
                            src="/panenka.png"
                            fallback="⚽"
                            size="sm"
                            className="mt-0.5 shrink-0"
                        />
                        <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-surface-hover px-4 py-3">
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:0ms]" />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:150ms]" />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:300ms]" />
                        </div>
                    </div>
                )}

                {error && (
                    <p className="text-center text-xs text-red-400">
                        Panenka no está disponible ahora mismo, intenta en un momento
                    </p>
                )}
            </div>

            {/* Input */}
            <form
                onSubmit={handleSubmit}
                className="flex items-center gap-2 border-t border-border px-4 py-3"
            >
                <input
                    value={input}
                    onChange={handleInputChange}
                    placeholder="Pregunta a Panenka..."
                    disabled={isLoading}
                    className="flex-1 rounded-xl border border-border bg-zinc-800 px-4 py-2.5 text-sm text-foreground placeholder:text-muted/60 transition-colors focus:border-accent focus:outline-none disabled:opacity-50"
                />
                <button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    aria-label="Enviar mensaje"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-zinc-950 transition-all hover:bg-accent-hover active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    <Send size={16} />
                </button>
            </form>
        </div>
    );
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit --project tsconfig.json 2>&1 | head -30
```

Salida esperada: sin errores.

- [ ] **Step 4: Ejecutar los tests de renderizado de la página**

Con `npm run dev` activo en otra terminal:

```bash
npx playwright test e2e/asistente.spec.ts --project=chromium
```

Salida esperada: los 3 tests de renderizado pasan (`PASSED`). El test de redirect de no-autenticado puede tardar si el storageState está activo — está bien si pasa en modo `{ cookies: [], origins: [] }`.

- [ ] **Step 5: Commit**

```bash
git add src/app/asistente/page.tsx src/app/asistente/AsistenteChat.tsx
git commit -m "feat(asistente): implementar página /asistente y componente AsistenteChat"
```

---

## Task 6: Añadir Panenka a la navegación

**Files:**
- Modify: `src/components/NavbarClient.tsx`
- Modify: `src/components/Navbar.tsx`

- [ ] **Step 1: Actualizar `src/components/NavbarClient.tsx`**

Añade `Bot` al import de lucide y el link de Panenka al array `navLinks`:

```typescript
// src/components/NavbarClient.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Home, Calendar, BarChart3, Users, Star, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavbarClientProps {
  desktopUserMenu?: React.ReactNode;
  mobileRight?: React.ReactNode;
}

const navLinks = [
  { href: "/",             label: "Inicio",    icon: Home      },
  { href: "/matches",      label: "Partidos",  icon: Calendar  },
  { href: "/leaderboard",  label: "Ranking",   icon: BarChart3 },
  { href: "/players",      label: "Jugadores", icon: Users     },
  { href: "/fantasy",      label: "Fantasy",   icon: Star      },
  { href: "/asistente",    label: "Panenka",   icon: Bot       },
];

export function NavbarClient({ desktopUserMenu, mobileRight }: NavbarClientProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegación principal" className="sticky top-0 z-50 border-b border-border bg-surface/80 backdrop-blur-xl">
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
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent/10 text-accent"
                    : "text-muted hover:bg-surface-hover hover:text-foreground"
                )}
              >
                <Icon size={16} aria-hidden="true" />
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Desktop: User menu (avatar + notifications + logout) */}
        <div className="hidden items-center gap-3 md:flex">
          {desktopUserMenu}
        </div>

        {/* Mobile: campana + botón Panenka */}
        <div className="flex items-center md:hidden">
          {mobileRight}
        </div>
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Actualizar `src/components/Navbar.tsx`**

Añade el link móvil a Panenka en el slot `mobileRight` junto a la campana de notificaciones:

```typescript
// src/components/Navbar.tsx
import { createClient } from "@/lib/supabase/server";
import { NavbarClient } from "./NavbarClient";
import { NotificationBell } from "./NotificationBell";
import { Suspense } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { getAvatarUrl } from "@/lib/utils";
import Link from "next/link";
import { LogOut, Bot } from "lucide-react";
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
      <Link href="/profile" className="transition-transform hover:scale-105" title="Mi Perfil" aria-label="Mi Perfil">
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
          aria-label="Cerrar Sesión"
        >
          <LogOut size={16} aria-hidden="true" />
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
        <div className="flex items-center gap-1">
          <Link
            href="/asistente"
            aria-label="Panenka — Asistente IA"
            className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <Bot size={20} aria-hidden="true" />
          </Link>
          <Suspense fallback={<div className="h-6 w-6 rounded-full bg-surface-hover animate-pulse" />}>
            <MobileNotificationBell />
          </Suspense>
        </div>
      }
    />
  );
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit --project tsconfig.json 2>&1 | head -30
```

Salida esperada: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/components/NavbarClient.tsx src/components/Navbar.tsx
git commit -m "feat(nav): añadir link a Panenka en Navbar (desktop y mobile)"
```

---

## Task 7: Verificación final y build de producción

**Files:** ninguno nuevo

- [ ] **Step 1: Ejecutar todos los tests del asistente**

```bash
npx playwright test e2e/asistente.spec.ts --project=chromium
```

Salida esperada: `4 passed`.

- [ ] **Step 2: Ejecutar el build de producción para detectar errores**

```bash
npm run build
```

Salida esperada: build exitoso sin errores de TypeScript ni de Next.js.

- [ ] **Step 3: Smoke test manual**

Con `npm run dev`:
1. Abre `http://localhost:3000/asistente`
2. Verifica que aparece el header de Panenka y las 4 sugerencias rápidas
3. Haz clic en "¿Quién lidera el ranking?" — debe rellenar el input
4. Envía el mensaje — debe aparecer el indicador de "pensando..." y luego la respuesta de Gemini con datos reales
5. En mobile (DevTools → Pixel 5): verifica que el icono Bot aparece en la Navbar junto a la campana

- [ ] **Step 4: Ejecutar la suite E2E completa para detectar regresiones**

```bash
npx playwright test --project=chromium
```

Salida esperada: todos los tests pasan, sin regresiones en auth, matches, ni otros flujos.

- [ ] **Step 5: Commit final**

```bash
git add -A
git commit -m "feat: asistente IA Panenka — implementación completa"
```

---

## Notas de implementación

### Variable de entorno en producción
Si deploys en Vercel, añade `GOOGLE_GENERATIVE_AI_API_KEY` en el dashboard de Vercel (Settings → Environment Variables).

### Avatar de Panenka
Coloca la imagen en `public/panenka.png`. Sin ella, el componente `Avatar` usa el fallback `"⚽"` automáticamente — la app funciona correctamente de ambas formas.

### Rate limiting
El rate limit usa la función `rateLimit` de `src/lib/rate-limit.ts` que llama al RPC `consume_rate_limit` de Supabase. Si el RPC falla, el comportamiento es `allowed: true` (fail-open), lo que garantiza disponibilidad.

### Tool calling multi-vuelta
`maxSteps: 5` permite hasta 5 rondas de tool calling. Gemini puede llamar múltiples tools en paralelo dentro de cada ronda. Para preguntas que requieren 2 fuentes de datos (e.g., "¿cómo me comparo con el primero?"), llamará `get_my_stats` + `get_leaderboard` simultáneamente.
