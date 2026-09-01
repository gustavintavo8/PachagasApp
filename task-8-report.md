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
