# Task 8 — Panenka estacional y eliminación de tools Fantasy

## Cambios

- `src/lib/ai/tools.ts`: `buildTools(userId, defaultSeason)` ahora expone únicamente tools de partidos reales. Jugadores, goleadores, ranking, detalle de jugador, estadísticas propias y historiales consultan la temporada por defecto; aceptan `season_slug` cuando se resuelve correctamente. Partidos y detalles validan `season_id`, y los errores de temporada son genéricos.
- `src/app/api/asistente/route.ts`: conserva los guards de autenticación, acceso comunitario y rate limit; valida `season_slug`, resuelve la temporada activa por defecto, añade el contexto estacional al prompt y pasa la temporada a `buildTools`.
- `e2e/asistente.spec.ts`: añade el contrato visual sin referencias Fantasy y un contrato server-safe del builder, incluyendo rechazo de un slug inválido sin acceso a datos.
- `src/app/asistente/page.tsx`: revisado; ya no contenía referencias Fantasy y no requirió cambios adicionales.

## Verificación

- `npx tsc --noEmit` → OK.
- `npx eslint src/lib/ai/tools.ts src/app/api/asistente/route.ts src/app/asistente/page.tsx e2e/asistente.spec.ts` → OK.
- `npx playwright test e2e/asistente.spec.ts --config=playwright.contract.config.ts --project=chromium -g "Fantasy tools contract"` → 1 passed; se ejecutó con una configuración temporal sin `globalSetup`, servidor ni red, y el artefacto temporal fue eliminado.
- `npx playwright test e2e/asistente.spec.ts --project=chromium -g "Fantasy"` → no pudo iniciar porque `globalSetup` requiere Supabase local en `127.0.0.1:54321`, que no estaba disponible.
- `npm run build` → compilación y TypeScript OK; falló al prerenderizar `/sitemap.xml` por `SUPABASE_SERVICE_ROLE_KEY` ausente en el entorno.
- `git diff --check` → sin errores.

## Riesgos / seguimiento

- La prueba E2E completa y el prerender de sitemap deben repetirse en un entorno con Supabase local y las variables de test configuradas. No se usaron datos remotos.
- La UI no selecciona temporada explícitamente; el endpoint admite `season_slug` y usa la temporada activa cuando no se proporciona.

## Ronda 1 — corrección de revisión

La revisión detectó que `get_players`, `get_player_detail` y `get_my_stats` aún seleccionaban y propagaban `profiles.market_value`. Se retiró ese campo de las tres selecciones y se verificó que tampoco se exponen `total_points`, `budget`, `logo_url` ni referencias Fantasy en las tools del asistente.

### Verificación de la corrección

- `npx playwright test e2e/asistente.spec.ts --config=playwright.contract.config.ts --project=chromium -g "Fantasy tools contract"` (antes de la corrección) → 1 failed, aserción esperada: `market_value` estaba presente en `buildTools.toString()`.
- El mismo comando después de la corrección → 1 passed.
- `npx tsc --noEmit` → OK.
- `npx eslint src/lib/ai/tools.ts src/app/api/asistente/route.ts src/app/asistente/page.tsx e2e/asistente.spec.ts` → OK.
- `rg -ni "market_value|total_points|budget|fantasy|get_fantasy_standings|get_my_fantasy_team" src/lib/ai/tools.ts src/app/api/asistente/route.ts src/app/asistente/page.tsx` → sin coincidencias (exit 1 esperado).
- `git diff --check` → sin errores.

No se ejecutaron pruebas largas, el E2E con `globalSetup` ni mutaciones remotas en esta ronda. Se eliminó la configuración temporal de Playwright y se restauraron los artefactos generados por los tests.
