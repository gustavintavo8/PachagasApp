# Spec: Mejoras Integrales de Pachanga App

**Fecha:** 2026-05-04  
**Área:** Rendimiento · Calidad de Código · Testing · Visibilidad/UX  
**Skills usados:** next-cache-components, next-best-practices, react-best-practices, supabase-postgres-best-practices, typescript-advanced-types, composition-patterns, nodejs-backend-patterns, nodejs-best-practices, playwright-best-practices, accessibility, seo, tailwind-css-patterns, frontend-design

---

## Contexto

Pachanga App es una aplicación Next.js 16 + React 19 + Supabase para organizar partidos de fútbol entre amigos. Incluye sistema ELO, fantasy teams, votación MVP, sistema anti-morosidad de pagos, chat en tiempo real, y fotos. El stack es sólido y las convenciones están bien establecidas (server actions con Zod, rate limiting, admin client separado). Este spec cubre mejoras en cuatro áreas ortogonales que pueden ejecutarse como workstreams independientes.

---

## Fase 1 — Rendimiento y Escalabilidad

### 1.1 Next.js Cache Components (PPR)

**Qué:** Activar `cacheComponents: true` en `next.config.ts` para habilitar Partial Prerendering. Migrar páginas semi-estáticas al modelo static + cached + dynamic.

**Páginas a migrar:**
- `/leaderboard` — datos de ranking cambian poco; `cacheLife('hours')` + `cacheTag('leaderboard')`
- `/players` — lista de jugadores; `cacheLife('hours')` + `cacheTag('players')`
- `/matches` — lista de partidos abiertos; `cacheLife('minutes')` + `cacheTag('matches')`
- `/players/[id]` — perfil público; `cacheLife('hours')` + `cacheTag('player-${id}')`

**Páginas que permanecen dinámicas:**
- `/` (dashboard) — muestra ELO personal, próximo partido del usuario
- `/matches/[id]` — estado en tiempo real, participantes, chat

**Invalidación:** Los server actions que mutan datos añaden `revalidateTag` (background) o `updateTag` (mismo request) según el caso. Ej: `markAsPaid` → `updateTag('match-${matchId}')`.

**Migración de `unstable_cache`:** Si existe algún uso de `unstable_cache`, se migra a `'use cache'`.

### 1.2 Eliminar Waterfalls en Server Actions

**`setScore` — loop secuencial de ELO:**
```
// Actual: for...of secuencial (~24 queries serie para 12 jugadores)
for (const update of eloUpdates) {
  await adminSupabase.from('profiles').update(...)
  await adminSupabase.from('rp_history').insert(...)
}

// Objetivo: Promise.all paralelo
await Promise.all(eloUpdates.map(async (update) => {
  await adminSupabase.from('profiles').update(...)
  await adminSupabase.from('rp_history').insert(...)
}))
```

**`generateTeams` — loop de updates de equipo:**
Reemplazar el `for` de `supabase.from('match_participants').update({ team })` con `Promise.all`.

**Server components con múltiples selects independientes:**
En páginas que hacen 2+ queries Supabase sin dependencia entre sí, agrupar con `Promise.all([query1, query2])`.

### 1.3 Supabase / Postgres — Índices y Queries

**Índices faltantes (añadir via migración Supabase):**
```sql
CREATE INDEX IF NOT EXISTS idx_match_participants_match_id 
  ON match_participants(match_id);

CREATE INDEX IF NOT EXISTS idx_match_participants_user_id 
  ON match_participants(user_id);

CREATE INDEX IF NOT EXISTS idx_mvp_votes_match_id 
  ON mvp_votes(match_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
  ON notifications(user_id, read) WHERE read = false;

CREATE INDEX IF NOT EXISTS idx_rp_history_user_id 
  ON rp_history(user_id);
```

**Consolidar N+1 en detalle de partido:**
La página `/matches/[id]` hace queries separadas para el match, los participantes, y luego los perfiles. Consolidar en un único select con join:
```sql
SELECT mp.*, p.username, p.avatar_url, p.elo_rating, p.position
FROM match_participants mp
JOIN profiles p ON p.id = mp.user_id
WHERE mp.match_id = $1
```

**Revisar políticas RLS** para que los filtros principales estén cubiertos por los nuevos índices.

### 1.4 Bundle — Dynamic Imports

**Componentes a migrar a `next/dynamic`:**
- `WeatherWidget` — depende de API externa, no necesita SSR
- `PlayerCharts` — usa Recharts (~150KB gzip); cargar solo en página de jugador
- `SoccerPitch` — SVG complejo solo visible en partidos con equipos generados

```tsx
const PlayerCharts = dynamic(() => import('@/components/PlayerCharts'), {
  ssr: false,
  loading: () => <ChartSkeleton />,
})
```

---

## Fase 2 — Calidad de Código

### 2.1 TypeScript — Tipos más Robustos

**Discriminated union para `ActionResult`:**
```typescript
// Antes (ambiguo — permite { success: true, error: "algo" })
type ActionResult = { success: boolean; error?: string; data?: unknown }

// Después (narrowing correcto en call sites)
type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }
```

Actualizar todos los server actions y sus call sites para usar el nuevo tipo. Los call sites hacen narrowing explícito: `if (!result.success) return`.

**Tipos a mover a `src/lib/types.ts`:**
- `ParticipantProfile` (actualmente inline en `actions.ts`)
- `ActionResult<T>` (actualmente inline en `actions.ts` como `ActionResult`)
- Schemas Zod reutilizables exportados desde `src/lib/schemas.ts`

**Utility types para Supabase:**
Crear tipos derivados para los resultados de query más usados, evitando redefinir shapes inline.

### 2.2 Composición de Componentes (React 19)

**Auditoría de boolean props:**
Revisar componentes en `src/components/` y `src/components/ui/` que usen props booleanas para cambiar comportamiento. Candidatos probables: `Button` (variantes de estilo), `Card` (variantes de layout). Refactorizar a variantes explícitas o compound components.

**React 19 — eliminar forwardRef:**
En React 19 los refs se pasan como props directamente. Revisar los componentes `ui/` que usen `forwardRef` y migrarlos al patrón nuevo.

**Compound components:**
Si `MatchDetail.tsx` tiene lógica de tabs mezclada con render, extraer a un compound component `<Tabs>` limpio (o reutilizar el `LeaderboardTabs` existente como base).

### 2.3 Server Actions — Extracción y Cohesión

**`setScore` — separar responsabilidades:**
La función actual (~300 líneas) hace cuatro cosas. Extraer a helpers internos en el mismo archivo:
```
setScore()
  └── applyGoalScorers()
  └── applyEloUpdates()
  └── applyFantasyPoints()
  └── notifyScoreSet()
```
Cada helper recibe los datos que necesita y retorna el resultado. `setScore` los orquesta.

**`sendNotification` → `src/lib/notifications.ts`:**
La función `sendNotification` está definida en `matches/actions.ts` pero es usada por múltiples acciones. Mover a un módulo propio reutilizable desde cualquier actions file.

### 2.4 Manejo de Errores Consistente

**Problema actual:** Los server actions retornan `error.message` directo de Supabase (ej: `"duplicate key value violates unique constraint"`) que es técnico y en inglés.

**Solución:** Crear `src/lib/errors.ts` con una función `mapSupabaseError(error: PostgrestError): string` que traduce códigos de error de Postgres a mensajes en español orientados al usuario. Los detalles técnicos solo van a `console.error`.

```typescript
// src/lib/errors.ts
const PG_ERROR_MAP: Record<string, string> = {
  '23505': 'Ya existe un registro con esos datos',
  '23503': 'El recurso relacionado no existe',
  '42501': 'No tienes permiso para realizar esta acción',
}

export function mapSupabaseError(error: PostgrestError): string {
  return PG_ERROR_MAP[error.code] ?? 'Ha ocurrido un error inesperado'
}
```

---

## Fase 3 — Testing

### 3.1 Page Object Model (POM)

**Estructura:**
```
e2e/
├── pages/
│   ├── AuthPage.ts
│   ├── MatchPage.ts
│   ├── LeaderboardPage.ts
│   └── ProfilePage.ts
├── fixtures/
│   └── auth.ts
└── tests/
    ├── matches.spec.ts
    ├── payments.spec.ts
    ├── mvp-voting.spec.ts
    └── ...
```

**`MatchPage`** encapsula: navegar a partido, join/leave, ver lista de participantes, marcar pago, votar MVP, ver tabs Info/Equipos/Chat/Fotos.

**`AuthPage`** encapsula: flujo de login, logout, redirección post-auth.

**`LeaderboardPage`** encapsula: cambiar tab, paginación, verificar posiciones.

**`ProfilePage`** encapsula: editar campos, subir avatar, verificar persistencia.

### 3.2 Fixtures de Autenticación

**Problema actual:** Cada test file hace login completo, lo que es lento y frágil.

**Solución:** Fixtures de Playwright con `storageState` pre-guardado por rol:
```typescript
// e2e/fixtures/auth.ts
export const test = base.extend<{ asPlayer: Page; asOrganizer: Page }>({
  asPlayer: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: 'e2e/.auth/player.json',
    })
    await use(await context.newPage())
  },
  // ...
})
```

El `globalSetup` guarda los estados de sesión una sola vez al inicio del suite.

### 3.3 Test Tags y Organización

**Tags a implementar:**
- `@smoke` — flujos críticos mínimos (crear partido, unirse, ver leaderboard)
- `@critical` — flujos con impacto en datos (resultado, ELO, pagos)
- `@fast` — tests sin esperas de red real (mocks de Supabase)
- `@mobile` — tests con viewport de móvil

**Configuración CI:**
- PRs: solo `@smoke` (rápido, < 2 min)
- Merge a main: suite completo
- Nightly: suite completo + `@mobile`

### 3.4 Cobertura de Flujos Faltantes

**Tests E2E a añadir:**
- Sistema de pagos: organizer marca paid/unpaid, estado persiste, badge visible
- Votación MVP: jugador vota, contador actualiza, resolución al completar votos
- Generación de equipos: equipos generados y asignados correctamente
- Chat en tiempo real: mensaje enviado aparece sin reload
- Fantasy: crear equipo, fichaje, lineup, puntuación tras partido

### 3.5 Testing de Accesibilidad y Móvil

**Playwright projects:**
```typescript
// playwright.config.ts
projects: [
  { name: 'chromium', ... },
  { name: 'mobile-chrome', use: devices['Pixel 5'] },
  { name: 'mobile-safari', use: devices['iPhone 13'] },
]
```

**axe-core:**
```typescript
import AxeBuilder from '@axe-core/playwright'

test('leaderboard no tiene violaciones a11y @smoke', async ({ page }) => {
  await page.goto('/leaderboard')
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
})
```

---

## Fase 4 — Visibilidad y UX

### 4.1 SEO — Metadata Dinámica

**`generateMetadata` en rutas dinámicas:**
```typescript
// app/matches/[id]/page.tsx
export async function generateMetadata({ params }): Promise<Metadata> {
  const match = await getMatch(params.id)
  return {
    title: `Partido en ${match.location} — Pachanga`,
    description: `${match.date} · ${match.participants.length}/${match.max_players} jugadores`,
    openGraph: {
      title: `Partido en ${match.location}`,
      description: `Únete al partido del ${match.date}`,
      images: [{ url: `/api/og/match/${params.id}` }],
    },
  }
}
```

**Archivos a crear:**
- `app/sitemap.ts` — genera XML con rutas estáticas + matches públicos recientes
- `app/robots.ts` — permite crawling de rutas públicas, bloquea `/api/`
- `app/api/og/match/[id]/route.tsx` — OG image con next/og

**Canonical URLs:**
Añadir `alternates: { canonical: url }` en el metadata de cada página.

### 4.2 JSON-LD — Datos Estructurados

**Schema `SportsEvent` en `/matches/[id]`:**
```json
{
  "@context": "https://schema.org",
  "@type": "SportsEvent",
  "name": "Partido de fútbol en [location]",
  "startDate": "[date ISO]",
  "location": { "@type": "Place", "name": "[location]" },
  "sport": "Football"
}
```

**Schema `Person` en `/players/[id]`** con nombre y estadísticas básicas.

### 4.3 Accesibilidad WCAG 2.2

**Crítico — Fix inmediato:**

1. **`userScalable: false`** en `src/app/layout.tsx` → eliminar. Viola WCAG 1.4.4. Los usuarios con baja visión necesitan hacer zoom.

2. **Botones con iconos Lucide sin label:** Todos los `<button>` que solo tienen un `<svg>` deben añadir `aria-label` o `<span className="sr-only">`. Ejemplo: botones de join, leave, kick.

3. **Skip link:** Añadir como primer elemento del body:
   ```tsx
   <a href="#main-content" className="sr-only focus:not-sr-only">
     Saltar al contenido principal
   </a>
   ```

**Alto — Fix antes de lanzamiento:**

4. **`scroll-margin-bottom`** en elementos interactivos para que el `BottomNav` fijo no los tape al navegar con teclado.

5. **Labels de formularios:** Verificar que todos los `<input>` tienen `<label htmlFor>` asociado. Formulario de crear partido y perfil son los más críticos.

6. **Mensajes de error accesibles:** Los errores de server actions deben mostrarse en un elemento con `role="alert"` o `aria-live="polite"` para que los lectores de pantalla los anuncien.

7. **`aria-current="page"`** en el `BottomNav` y `Navbar` para indicar la ruta activa.

**Moderado:**

8. **Target size:** Verificar que botones táctiles tienen mínimo 44×44px en móvil, especialmente los badges y toggles del sistema de pagos.

9. **Contraste de color:** Verificar ratio del accent `#ccff00` sobre fondos oscuros. Para texto normal se requiere 4.5:1.

### 4.4 Animaciones y Preferencias de Usuario

**`globals.css` — reduced motion global:**
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**`content-visibility` en listas largas:**
```css
/* Leaderboard rows, match history items */
.leaderboard-row, .match-history-item {
  content-visibility: auto;
  contain-intrinsic-size: 0 64px;
}
```

---

## Resumen de Cambios por Archivo

| Área | Archivos principales |
|------|---------------------|
| Cache | `next.config.ts`, pages de leaderboard/players/matches |
| Waterfalls | `src/app/matches/actions.ts` |
| Índices | `supabase/migrations/` (nuevo archivo) |
| Bundle | `PlayerCharts`, `WeatherWidget`, `SoccerPitch` |
| TypeScript | `src/lib/types.ts`, `src/lib/schemas.ts`, `src/lib/errors.ts` |
| Actions | `src/app/matches/actions.ts`, `src/lib/notifications.ts` |
| POM | `e2e/pages/`, `e2e/fixtures/` |
| CI/Tags | `playwright.config.ts`, todos los spec files |
| SEO | `src/app/sitemap.ts`, `src/app/robots.ts`, `src/app/api/og/` |
| A11y | `src/app/layout.tsx`, `src/components/BottomNav.tsx`, `src/components/Navbar.tsx`, componentes de forms |
| CSS | `src/app/globals.css` |

---

## Criterios de Éxito

- **Rendimiento:** Lighthouse Performance ≥ 85 en móvil. TTI reducido en páginas de lista.
- **Calidad:** `tsc --noEmit` sin errores. No hay `any` explícito nuevo. `setScore` < 100 líneas por función.
- **Testing:** Suite E2E con > 80% de flujos críticos cubiertos. `@smoke` completa en < 2 min.
- **Visibilidad:** Lighthouse Accessibility ≥ 90. Lighthouse SEO = 100. OG images funcionan en WhatsApp.

---

## Restricciones

- NO modificar la lógica de ELO (per CLAUDE.md)
- NO cambiar el esquema de Supabase sin comunicarlo explícitamente (los índices son aditivos, no rompen nada)
- Los nuevos server actions llevan rate limiting
- Todo en español (UI, mensajes de error al usuario)
