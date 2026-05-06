# Panenka — Asistente IA conversacional para Pachanga

**Fecha:** 2026-05-06  
**Estado:** Aprobado  
**Stack:** Next.js 16 App Router · Supabase · Vercel AI SDK · Gemini 2.0 Flash

---

## 1. Objetivo

Añadir una página `/asistente` donde el usuario autenticado pueda hacer preguntas en lenguaje natural sobre los datos reales de la app (jugadores, partidos, estadísticas, fantasy) y recibir respuestas generadas por Gemini 2.0 Flash mediante tool calling contra Supabase.

El asistente se llama **Panenka**, tiene personalidad futbolera y responde siempre en español.

---

## 2. Arquitectura

### Archivos nuevos

| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `src/app/asistente/page.tsx` | Server Component | Verifica auth, pasa `userId` al componente cliente |
| `src/app/asistente/AsistenteChat.tsx` | Client Component | UI del chat con `useChat` de Vercel AI SDK |
| `src/app/api/asistente/route.ts` | Route Handler (POST) | `streamText` + tools + rate limiting |
| `src/lib/ai/tools.ts` | Módulo | Definición de las 10 tools con Zod + ejecutores Supabase |

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/components/NavbarClient.tsx` | Añadir link "Asistente" en nav desktop con icono `Bot` |
| `src/components/Navbar.tsx` | Añadir botón Panenka en `mobileRight` (junto a campana) |

### Recurso estático

| Recurso | Descripción |
|---------|-------------|
| `public/panenka.png` | Avatar de Panenka (el usuario lo provee; si no existe, se usa fallback ⚽) |

### Paquetes nuevos

```
ai                  ← Vercel AI SDK (streamText, useChat)
@ai-sdk/google      ← Proveedor Google (Gemini 2.0 Flash)
zod                 ← Validación de parámetros de tools (actualmente transitiva, debe añadirse como directa)
```

---

## 3. Flujo de datos

```
Usuario escribe mensaje
  → useChat → POST /api/asistente (body: { messages, userId })
    → Verificar sesión Supabase (cookies)
    → Rate limiting (15 req/min por usuario)
    → streamText(gemini-2.0-flash, system, tools, messages)
      → Gemini decide qué tools llamar (puede llamar varias en paralelo)
      → Cada tool ejecuta query Supabase y devuelve JSON
      → Gemini genera respuesta final con los datos
    → ReadableStream de vuelta al cliente
  → useChat renderiza tokens en tiempo real
```

---

## 4. Tools (10 en total)

### Amplias — consulta flexible con filtros opcionales

#### `get_players`
- **Parámetros:** `position?: "GK"|"DEF"|"MID"|"FWD"`, `min_elo?: number`, `max_elo?: number`, `limit?: number` (default 20)
- **Query:** `profiles` con los filtros aplicados, ordenado por `elo_rating` desc
- **Devuelve:** `username, position, elo_rating, matches_played, goals_scored, market_value`

#### `get_matches`
- **Parámetros:** `status?: "open"|"closed"|"finished"|"cancelled"`, `from_date?: string`, `to_date?: string`, `limit?: number` (default 10)
- **Query:** `matches` con filtros, ordenado por `date` desc
- **Devuelve:** `id, date, location, status, max_players, team_a_score, team_b_score`

### Específicas — queries directas sin ambigüedad

#### `get_top_scorers`
- **Parámetros:** `limit?: number` (default 10)
- **Query:** `profiles` ordenado por `goals_scored` desc
- **Devuelve:** `username, goals_scored, matches_played, position`

#### `get_leaderboard`
- **Parámetros:** `limit?: number` (default 10)
- **Query:** `profiles` donde `matches_played >= 3`, ordenado por `elo_rating` desc
- **Devuelve:** `username, elo_rating, matches_played, goals_scored, position`

#### `get_player_detail`
- **Parámetros:** `username: string`
- **Query:** `profiles` por `username` (ilike para tolerancia de mayúsculas)
- **Devuelve:** todos los campos de `Profile` + rank calculado

#### `get_match_detail`
- **Parámetros:** `match_id: string`
- **Query:** `matches` con `match_participants(*, profiles(username, position))` 
- **Devuelve:** datos del partido + lista de participantes con goles, equipo, MVP, pagado

#### `get_my_stats`
- **Parámetros:** ninguno (usa `userId` del contexto de la request)
- **Query:** `profiles` por `id = userId` + rank calculado
- **Devuelve:** stats completas del usuario autenticado

#### `get_fantasy_standings`
- **Parámetros:** `limit?: number` (default 10)
- **Query:** `fantasy_teams` ordenado por `total_points` desc, con `profiles(username)`
- **Devuelve:** `name, total_points, budget, username del dueño`

#### `get_my_fantasy_team`
- **Parámetros:** ninguno (usa `userId`)
- **Query:** `fantasy_teams` del usuario + `fantasy_rosters` con `profiles`
- **Devuelve:** nombre del equipo, presupuesto, puntos, plantilla completa (titulares, suplentes, capitán)

#### `get_players_history_together`
- **Parámetros:** `player_a: string` (username), `player_b: string` (username)
- **Query:** Busca `match_participants` donde ambos `user_id` aparecen en el mismo `match_id`, join con `matches` y `profiles`
- **Devuelve:** lista de partidos compartidos con fecha, resultado, en qué equipo jugó cada uno, y si alguno fue MVP

---

## 5. Route Handler — `/api/asistente`

```typescript
// Esquema de la request
{ messages: CoreMessage[] }  // userId viene de la sesión Supabase

// Pasos del handler
1. createClient(cookies()) → getUser() → 401 si no autenticado
2. Rate limit: 15 req/min por userId (rateLimit de src/lib/rate-limit.ts)
3. streamText({
     model: google('gemini-2.0-flash'),
     system: SYSTEM_PROMPT,
     messages,
     tools: buildTools(userId, supabaseAdminClient),
     maxSteps: 5,  // máximo de rondas tool-calling
   })
4. return result.toDataStreamResponse()
```

**SYSTEM_PROMPT:**
```
Eres Panenka, el asistente oficial de Pachanga — una app para organizar 
partidos de fútbol entre amigos. Tienes acceso a datos reales: jugadores, 
partidos, estadísticas, rankings y equipos fantasy.

Responde siempre en español, de forma concisa y con personalidad futbolera. 
Usa los datos de las tools para responder con precisión. Cuando no tengas 
datos suficientes, dilo claramente. No inventes estadísticas.
```

---

## 6. Componente de Chat — `AsistenteChat`

### Estado
- `useChat({ api: '/api/asistente' })` gestiona mensajes, streaming y loading
- Sin persistencia — el historial vive solo en la sesión actual del navegador

### Layout (mobile-first, max-w-2xl)
```
┌──────────────────────────────────────┐
│ [Avatar Panenka] Panenka             │  ← Header fijo
│ Tu asistente futbolero               │
├──────────────────────────────────────┤
│                                      │
│  [Mensaje usuario] →                 │  ← Burbuja derecha (bg-accent/10)
│                                      │
│  ← [Avatar] Respuesta Panenka        │  ← Burbuja izquierda
│                                      │
│  [⚽ Sugerencia 1] [⚽ Sugerencia 2]  │  ← Solo estado vacío inicial
│  [⚽ Sugerencia 3] [⚽ Sugerencia 4]  │
│                                      │
│  ···  (pensando...)                  │  ← Durante tool calling
│                                      │
├──────────────────────────────────────┤
│ [Pregunta a Panenka...]       [→]    │  ← Input + submit
└──────────────────────────────────────┘
```

### Sugerencias rápidas iniciales
1. "¿Quién lidera el ranking?"
2. "¿Cuáles son mis estadísticas?"
3. "¿Quién ha marcado más goles?"
4. "¿Cuándo es el próximo partido?"

### Avatar de Panenka
- Usa el componente `Avatar` existente con `src="/panenka.png"`
- Fallback: `"⚽"` si la imagen no existe
- El usuario provee `public/panenka.png`; sin ella funciona con fallback

---

## 7. Navegación

### Desktop (NavbarClient)
- Añadir `{ href: "/asistente", label: "Panenka", icon: Bot }` al array `navLinks`
- Mismo estilo que los demás links (active state con `bg-accent/10 text-accent`)

### Mobile (Navbar + NavbarClient)
- En `mobileRight`: añadir link con icono `Bot` de Lucide junto a `MobileNotificationBell`
- Icono small (`size={20}`), `text-muted` / `text-accent` si pathname === "/asistente"

---

## 8. Manejo de errores

| Situación | Comportamiento |
|-----------|---------------|
| No autenticado | `redirect('/login')` en el Server Component |
| Rate limit superado (429) | Mensaje inline: *"Panenka necesita un descanso, espera un momento ⚽"* |
| Error en una tool de Supabase | Panenka responde indicando que no pudo obtener ese dato; la conversación continúa |
| Error de Gemini API | Mensaje inline: *"Panenka no está disponible ahora mismo, intenta en un momento"* |

---

## 9. Convenciones del proyecto respetadas

- Todo en español (UI, comentarios de negocio)
- Dark mode siempre (`bg-surface`, `text-foreground`, `border-border`)
- Accent `#ccff00` para elementos activos/primarios
- Componentes UI existentes: `Avatar`, `Card`, `Button`
- Rate limiting en ruta crítica (siguiendo `src/lib/rate-limit.ts`)
- Tipado estricto, sin `any`
- Sin modificaciones al esquema de Supabase (solo lecturas)

---

## 10. Fuera de alcance (esta versión)

- Persistencia del historial de conversación en Supabase
- Acciones de escritura (el asistente no puede crear partidos ni modificar datos)
- Soporte multilingüe
- Historial de conversaciones anteriores entre sesiones
