# Task 10 — Informe de documentación del rollout

Fecha: 2026-09-01

## Alcance

Se documentó el rollout seguro de Temporada 2 y acceso privado para un operador distinto. El runbook separa las acciones locales de las acciones manuales en Supabase Dashboard/SQL Editor, Vercel y producción, y deja explícito que no se ejecuta ninguna migración remota automáticamente.

No se modificaron migraciones existentes, plan/ledger ni `task-4-report.md`. Los archivos no rastreados preexistentes relacionados con tareas anteriores permanecen intactos y no se incluyeron en el commit.

## Archivos

- `docs/operations/2026-08-31-season-2-rollout.md`
  - Prerrequisitos, confirmación del proyecto reanudado y backup/PITR.
  - Orden exacto de los 12 pasos del brief.
  - Aplicación ordenada de `20260831000001`, `20260831000002`, `20260831000003` y `20260901000001` sin editar migraciones anteriores.
  - Configuración server-side de `PACHANGA_ACCESS_CODE` sin incluir su valor.
  - Consultas SQL de solo lectura para temporadas, foreign keys, grants activos y RLS/privilegios de Fantasy.
  - Smoke tests de acceso autorizado/no autorizado, primer partido de Temporada 2 y separación de historiales.
  - Rollback basado en backup/PITR y procedimiento futuro de reactivación de Fantasy mediante una migración nueva.
- `README.md`
  - Tabla de esquema actualizada con `seasons`, `season_player_stats` y `community_access_grants`.
  - `profiles` descrito como fuente de identidad y los contadores competitivos como estacionales.
  - Eliminadas las afirmaciones y tools Fantasy obsoletas de la descripción de Panenka y añadida la condición de acceso privado.

## Comandos y resultados

| Comando o comprobación | Resultado |
| --- | --- |
| `git diff --check` | OK; sin errores de whitespace. |
| Validación PowerShell de enlaces relativos Markdown en `README.md` y el runbook | OK; 2 archivos comprobados, sin destinos locales inexistentes. |
| Escaneo de patrones de credenciales en README/runbook | OK; no se encontraron valores de claves o secretos. |
| `npm run lint` | FALLA por un error preexistente fuera de alcance en `src/components/SoccerPitch.tsx:592` (`react-hooks/set-state-in-effect`); 30 warnings adicionales. No se modificó ese archivo. |
| `npm run build` sin variables cargadas | FALLA al prerenderizar `/sitemap.xml` porque falta `SUPABASE_SERVICE_ROLE_KEY` en el proceso. |
| `npm run build` con las variables del `.env.test.local` ignorado cargadas solo en el proceso | OK; compilación, TypeScript y generación de 26 páginas completadas. Se observaron únicamente warnings preexistentes de raíz de workspace y deprecación de `middleware`. No se imprimieron variables. |

No se ejecutaron `npx supabase db push`, SQL de producción, despliegues ni E2E como parte de esta tarea documental. El runbook deja esas acciones para el operador, después de confirmar proyecto, backup y entorno.

## Riesgos y pendientes

- La producción necesita un backup/PITR verificable antes del backfill y de la conversión a foreign keys `NOT NULL`; no existe un rollback `down` seguro documentado.
- Un historial remoto de migraciones divergente debe resolverse antes de `db push`, sin editar ni renombrar migraciones históricas.
- La rotación de `PACHANGA_ACCESS_CODE` no revoca grants ya concedidos; la revocación debe gestionarse por separado mediante `community_access_grants.revoked_at`.
- La suite E2E y los smoke tests de producción siguen siendo acciones operativas posteriores al despliegue; este commit no afirma que se hayan ejecutado remotamente.
- El lint global continúa bloqueado por el error preexistente señalado arriba. El build reproducible requiere cargar variables locales no versionadas.
- Fantasy conserva sus tablas y filas para una reactivación futura, pero la migración de desactivación revoca los privilegios de `anon` y `authenticated`; la reactivación debe hacerse con una migración nueva y una revisión de seguridad.

## Commit

La documentación inicial de Tarea 10 quedó creada en `8a6491c337a9d3426dc1611fa5ce4d252d84558a` (`docs: add Season 2 production rollout runbook`). Las correcciones de la ronda 1 quedaron en `d1732a79763204be5dd9313f7c98c74686af61c3` (`docs: address Task 10 rollout review`).

El commit final revisado de la ronda 2 es `6c2a8c6dfb8a6ab99b6498c882d20bf4fd4051bd` (`docs: fix local verifier rollout order`).

## Ronda 1 — Correcciones aplicadas

- `README.md` enlaza visiblemente el runbook mediante la ruta relativa `docs/operations/2026-08-31-season-2-rollout.md` junto a la documentación de acceso privado.
- El verificador de producción usa exclusivamente `.env.production.local`, separado de `.env.local` y `.env.test.local`. El runbook incluye una comprobación visible de esquema y hostname HTTPS antes de ejecutar `npx tsx`, sin imprimir claves ni tokens.
- La reactivación futura de Fantasy exige una migración nueva y transaccional que retire o reemplace explícitamente `Fantasy desactivado` en `public.fantasy_teams` y `public.fantasy_rosters`, recree policies/grants aprobados y verifique que no queda un deny residual.
- Se conserva la separación de acciones locales y producción y no se ejecutaron migraciones remotas, SQL de producción, despliegues ni operaciones destructivas.

### Validaciones de la ronda 1

| Comprobación | Resultado |
| --- | --- |
| `git diff --check` sobre el staging final | OK. |
| Validación de enlaces relativos Markdown en README, runbook e informe | OK; sin destinos locales inexistentes. |
| Secret-pattern scan sobre los tres archivos documentales | OK; sin valores de credenciales o códigos. |
| Escaneo de afirmaciones Fantasy obsoletas en README | OK; no quedan las tools ni la afirmación de disponibilidad retiradas. |

## Ronda 2 — Corrección del orden de verificación local

El bloque ejecutable del verificador se retiró del paso 3. Ese paso solo prepara `.env.local` y `.env.test.local`; la única ejecución local de `npx tsx --env-file=.env.test.local src/scripts/verify-season-migration.ts` permanece junto a `npx supabase db reset` en el paso 4, después de `npx supabase start`, `npx supabase status` y la comprobación explícita de que `NEXT_PUBLIC_SUPABASE_URL` usa `127.0.0.1`, `localhost` o `::1`. La comprobación no imprime secretos.

No se ejecutaron migraciones remotas, SQL de producción, despliegues ni operaciones destructivas. El README, `.env.production.local`, la retirada futura de `Fantasy desactivado` y el commit base `8a6491c337a9d3426dc1611fa5ce4d252d84558a` se conservan.
