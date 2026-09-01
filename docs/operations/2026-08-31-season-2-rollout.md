# Runbook: rollout de Temporada 2 y acceso privado

Fecha de referencia: 2026-08-31

Alcance: aplicación controlada de las migraciones de temporadas, acceso privado y desactivación de Fantasy.

## Regla de seguridad

Este documento describe acciones locales y acciones manuales en Supabase Dashboard, SQL Editor, Vercel y la aplicación desplegada. No ejecuta migraciones remotas automáticamente. El operador debe confirmar el proyecto, el entorno y el backup antes de cualquier cambio en producción.

No se deben editar, renombrar ni reordenar migraciones ya aplicadas. Los cambios posteriores se incorporan mediante un archivo SQL nuevo con timestamp posterior. No se incluyen en este documento URLs de producción, project refs, credenciales ni el valor de `PACHANGA_ACCESS_CODE`.

## Prerrequisitos y responsables

Antes de empezar, el operador debe tener:

- Acceso al proyecto correcto en Supabase Dashboard y permiso para consultar el esquema, revisar backups/PITR y ejecutar SQL si se elige SQL Editor.
- Supabase CLI autenticada y vinculada al proyecto correcto, si se elige CLI. El project ref debe obtenerse de la configuración segura del equipo o del Dashboard; no se debe inventar ni guardar en este repositorio.
- Acceso al proyecto de Vercel para configurar una variable server-side y desplegar la aplicación.
- Node.js/npm, Docker Desktop y el repositorio en una revisión que contenga las migraciones y el verificador de este runbook.
- Un `.env.local` local no versionado para la aplicación y un `.env.test.local` local no versionado para Playwright. Ambos deben contener solo valores de desarrollo/prueba. El `.gitignore` del proyecto excluye los archivos `.env*` y `e2e/.auth/`.

La configuración local necesita, como mínimo, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`. Para la suite E2E también se requieren las variables `E2E_TEST_*`, `E2E_GATED_TEST_*`, `E2E_SEASONS_TEST_*` y `E2E_SEASONS_STATS_TEST_*` que consume `e2e/global-setup.ts`. `PACHANGA_ACCESS_CODE` puede usar un valor ficticio solo en el entorno local; nunca se copia al informe, al README ni a los logs.

## Backup y rollback

### Antes de aplicar cambios

1. En Supabase Dashboard, confirmar que el proyecto correcto está reanudado y que los datos existentes son visibles.
2. Confirmar que existe un backup o punto de restauración utilizable según el plan contratado y la política del equipo. Registrar fuera del repositorio la hora, el proyecto y la referencia del backup/PITR.
3. Si no existe un punto de restauración verificable o el proyecto no es inequívoco, detener el rollout.
4. Ejecutar la consulta de conteos de la sección siguiente y guardar el resultado en el registro operativo fuera de Git. Los conteos pueden contener información operativa; no se deben pegar aquí.

### Qué hacer ante un fallo

- Si falla una migración durante su ejecución, no editar el archivo, no marcarla manualmente como aplicada y no continuar con la siguiente. Guardar el error, comprobar el estado de la migración y revisar el backup.
- La primera migración hace backfill y después convierte `matches.season_id` y `rp_history.season_id` en `NOT NULL`. No hay una migración `down` segura para deshacer ese cambio mediante SQL improvisado.
- Para una restauración de datos, usar el procedimiento aprobado de backup/PITR de Supabase y la referencia registrada antes del cambio. Coordinar la restauración con el responsable de producción; no ejecutar un `DROP`, `TRUNCATE` o `DELETE` global como rollback.
- Un rollback de la aplicación puede hacerse a una revisión compatible, pero no revierte las migraciones ni reactiva Fantasy. Verificar que la revisión recuperada tolera las columnas y tablas nuevas.
- Las columnas legacy de `profiles` se conservan durante este rollout. No eliminarlas como parte del rollback ni del despliegue de Temporada 2.

## Orden exacto del rollout

### 1. Comprobación inicial en Supabase Dashboard — producción

Confirmar que el proyecto está reanudado, que se puede abrir el esquema y que los datos de producción son visibles. No ejecutar todavía SQL de escritura ni migraciones.

### 2. Conteos de referencia — producción, solo lectura

Ejecutar en SQL Editor y guardar el resultado fuera del repositorio:

```sql
select 'auth.users' as relation, count(*) as row_count from auth.users
union all
select 'public.profiles', count(*) from public.profiles
union all
select 'public.matches', count(*) from public.matches
union all
select 'public.match_participants', count(*) from public.match_participants
union all
select 'public.rp_history', count(*) from public.rp_history;
```

Si los conteos no son plausibles para el proyecto seleccionado, detenerse y resolver la discrepancia antes de continuar.

### 3. Configuración local — máquina del operador

Crear o actualizar `.env.local` y `.env.test.local` sin incluirlos en Git. No usar claves de producción para las pruebas locales. Para la verificación de migraciones, el comando oficial carga `.env.test.local`:

```powershell
npx tsx --env-file=.env.test.local src/scripts/verify-season-migration.ts
```

El verificador usa `SUPABASE_SERVICE_ROLE_KEY` para comprobaciones administrativas. Nunca imprimir esa variable ni su contenido.

### 4. Reset y verificador local — solo Supabase local

Iniciar Docker Desktop y el stack local de Supabase. El siguiente comando es destructivo para la base local y no debe ejecutarse contra producción:

```powershell
npx supabase db reset
npx tsx --env-file=.env.test.local src/scripts/verify-season-migration.ts
```

El reset aplica desde cero las migraciones disponibles en `supabase/migrations`. El verificador debe confirmar, entre otros invariantes, exactamente dos temporadas, `season-1` archivada, `season-2` activa, una sola temporada activa, cero claves foráneas estacionales nulas, estadísticas estacionales coherentes y el contrato de índices/RLS/privilegios.

### 5. Suite E2E completa — solo Supabase local

Con Supabase local y la aplicación local disponibles, ejecutar:

```powershell
npx playwright test
```

`playwright.config.ts` carga `.env.test.local`, usa `http://localhost:3000` y `e2e/global-setup.ts` rechaza URLs de Supabase que no sean locales. Si el setup no puede demostrar que está en local, la suite debe abortar. No cambiar esa guardia para probar producción.

### 6. Aplicación de migraciones — producción, acción manual

Antes de aplicar, revisar el historial remoto con la CLI vinculada al proyecto correcto:

```powershell
npx supabase migration list
```

El operador debe resolver cualquier divergencia entre el historial remoto y los archivos del repositorio antes de hacer push. No se debe editar una migración histórica para hacer coincidir los historiales.

La secuencia nueva que debe quedar aplicada es:

1. `supabase/migrations/20260831000001_add_private_access_and_seasons.sql`
2. `supabase/migrations/20260831000002_add_season_stats_functions.sql`
3. `supabase/migrations/20260831000003_fix_season_finalization_atomicity.sql`
4. `supabase/migrations/20260901000001_disable_fantasy_access.sql`

Las migraciones anteriores que aún estén pendientes deben aplicarse también en el orden lexicográfico que ya tienen en `supabase/migrations`. La opción preferida es que el operador revise la lista y ejecute manualmente:

```powershell
npx supabase db push
```

Este comando solo debe ejecutarse después de confirmar el proyecto vinculado, el backup y la lista de pendientes. En SQL Editor, la alternativa es abrir cada archivo pendiente y ejecutarlo individualmente en el mismo orden, sin mezclar cambios de la aplicación ni alterar el contenido de los archivos. Ni este runbook ni el agente ejecutan ese comando remoto.

Si una migración ya figura como aplicada, no volver a pegarla en SQL Editor. Si el estado remoto no puede reconciliarse con Git, detenerse y escalarlo.

### 7. Verificador en el proyecto reanudado — producción, acción manual

Después del `db push` o de la ejecución manual en SQL Editor, ejecutar el verificador apuntando al proyecto reanudado, con las credenciales de producción cargadas solo en el entorno seguro del operador:

```powershell
npx tsx --env-file=.env.local src/scripts/verify-season-migration.ts
```

El comando es una comprobación de solo lectura, pero el proceso que lo ejecute tendrá acceso administrativo. No guardar el `.env.local`, su salida completa ni tokens en el repositorio. Si el resultado no es satisfactorio, detener el rollout antes del despliegue.

### 8. Configuración del código global — Vercel, producción

En Vercel → Environment Variables, crear o actualizar exactamente la variable server-side `PACHANGA_ACCESS_CODE` para el entorno de producción. El valor debe introducirse desde el gestor seguro del equipo; no aparecerá en este documento, en el README, en tickets, en capturas ni en la salida de comandos. No usar un nombre `NEXT_PUBLIC_*`.

Guardar el cambio y planificar el redeploy. Rotar el código no revoca grants ya concedidos: la revocación de una cuenta se controla con su fila de `community_access_grants` y `revoked_at`, mediante un procedimiento administrativo aprobado.

### 9. Deploy de la aplicación — Vercel, producción

Desplegar la misma revisión de Git que pasó la verificación local. Confirmar en Vercel que `PACHANGA_ACCESS_CODE` está disponible server-side en el entorno de producción y que no se expone en el bundle cliente. No continuar si el deploy usa una revisión distinta de las migraciones verificadas.

### 10. Smoke test de cuenta autorizada — producción

Con una cuenta existente autorizada para la prueba:

1. Iniciar sesión.
2. Abrir `/access` solo si la cuenta lo necesita y canjear el código global sin copiarlo a una evidencia persistente.
3. Crear el partido del miércoles acordado por el operador.
4. Comprobar en la UI que el partido se creó y, con la consulta de solo lectura de abajo, que su `season_id` es el de `season-2`.

El acceso se concede a la cuenta, no al navegador: después de refrescar, las rutas protegidas deben seguir disponibles para ese usuario.

### 11. Smoke test de cuenta existente sin grant — producción

Con una cuenta existente que deliberadamente no tenga un grant activo:

1. Iniciar sesión.
2. Confirmar que una ruta protegida redirige a `/access`.
3. Confirmar que el código incorrecto no concede acceso.
4. No conceder el grant de esa cuenta como parte de la prueba. Si se concede accidentalmente, revocarlo siguiendo el procedimiento administrativo y registrar la acción fuera de Git.

### 12. Separación del historial — producción

Comprobar con un usuario autorizado que:

- `/history?season=season-1` muestra únicamente el historial de Temporada 1.
- `/history?season=season-2` muestra el historial de Temporada 2.
- El partido recién creado aparece en Temporada 2 y no contamina la vista de Temporada 1.

## Comprobaciones SQL de producción

Todas las consultas de esta sección son de solo lectura. Ejecutarlas después de la migración y repetir las de datos después del primer partido nuevo.

### Temporadas, claves foráneas y grants de acceso

```sql
select slug, status, starts_at, ends_at
from public.seasons
order by starts_at;

select count(*) as active_seasons
from public.seasons
where status = 'active';

select count(*)
from public.matches
where season_id is null;

select count(*)
from public.rp_history
where season_id is null;

select count(*)
from public.matches
where season_id = (
  select id from public.seasons where slug = 'season-2'
);

select count(*)
from public.community_access_grants
where revoked_at is null;
```

Resultado esperado: exactamente una temporada activa (`season-2`), cero foreign keys nulas y cero partidos de Temporada 2 inmediatamente después de la migración. Tras crear el primer partido nuevo, el último conteo debe ser `1`. La cantidad de grants activos debe coincidir con la lista autorizada del operador; no se asume un número fijo.

Para revisar el partido creado y su temporada, usar solo sus datos operativos no sensibles:

```sql
select m.id, m.date, m.status, m.season_id, s.slug
from public.matches as m
join public.seasons as s on s.id = m.season_id
order by m.created_at desc nulls last, m.date desc
limit 5;
```

### RLS y grants de Fantasy revocados

La migración `20260901000001_disable_fantasy_access.sql` conserva tablas y filas de Fantasy, revoca los privilegios de `anon` y `authenticated`, elimina las políticas permisivas anteriores y deja una política restrictiva explícita de denegación. Verificarlo con:

```sql
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class as c
join pg_namespace as n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('fantasy_teams', 'fantasy_rosters')
order by c.relname;

select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('fantasy_teams', 'fantasy_rosters')
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('fantasy_teams', 'fantasy_rosters')
order by tablename, policyname;

select
  has_table_privilege('anon', 'public.fantasy_teams', 'SELECT') as anon_can_read_teams,
  has_table_privilege('anon', 'public.fantasy_rosters', 'SELECT') as anon_can_read_rosters,
  has_table_privilege('authenticated', 'public.fantasy_teams', 'SELECT') as authenticated_can_read_teams,
  has_table_privilege('authenticated', 'public.fantasy_rosters', 'SELECT') as authenticated_can_read_rosters;

select
  has_table_privilege('anon', 'public.fantasy_teams', 'INSERT,UPDATE,DELETE') as anon_can_write_teams,
  has_table_privilege('anon', 'public.fantasy_rosters', 'INSERT,UPDATE,DELETE') as anon_can_write_rosters,
  has_table_privilege('authenticated', 'public.fantasy_teams', 'INSERT,UPDATE,DELETE') as authenticated_can_write_teams,
  has_table_privilege('authenticated', 'public.fantasy_rosters', 'INSERT,UPDATE,DELETE') as authenticated_can_write_rosters;
```

Resultado esperado: `rls_enabled` es `true` en ambas tablas; la consulta de `role_table_grants` no devuelve filas para `anon` ni `authenticated`; la consulta de políticas muestra únicamente la política `Fantasy desactivado` para cada tabla, con comportamiento restrictivo y condición denegatoria; y todos los `has_table_privilege` anteriores devuelven `false`. La migración también revoca de forma defensiva privilegios sobre secuencias y funciones que dependan de estas tablas; si el catálogo del proyecto contiene una secuencia o RPC adicional, verificar que no exponga ejecución a esos roles antes de cerrar el rollout.

## Reactivación futura de Fantasy

La reactivación requiere una tarea y una revisión de seguridad independientes. Los datos actuales se mantienen precisamente para que esta operación no requiera reconstruirlos.

1. Definir y aprobar el alcance de Fantasy: rutas, acciones, herramientas de Panenka, roles permitidos, políticas RLS, grants de tablas, secuencias y funciones.
2. Preparar una migración nueva con timestamp posterior a `20260901000001_disable_fantasy_access.sql`. No editar ni borrar esa migración, ni restaurar privilegios manualmente en producción como solución permanente.
3. Recrear explícitamente las políticas y privilegios aprobados, tomando como referencia histórica `20260422221734_remote_schema.sql` y respetando el mínimo privilegio. No copiar automáticamente `GRANT ALL` si la nueva superficie no lo necesita.
4. Reactivar de forma coordinada el código de rutas, Server Actions, API/tools y navegación. Los tests deben demostrar que el acceso comunitario sigue siendo obligatorio y que una cuenta sin grant no puede usar Fantasy.
5. Aplicar la migración nueva primero en local con `npx supabase db reset`, ejecutar el verificador, los contratos dirigidos y la suite E2E. Después repetir el flujo de backup, `migration list`, aplicación manual, consultas RLS/grants y smoke tests en producción.
6. Desplegar la aplicación compatible y exponer la UI solo después de confirmar que las políticas, grants y controles de acceso funcionan en producción.

No usar un rollback de backup para reactivar Fantasy salvo que el objetivo sea restaurar el proyecto completo a un punto anterior. Para una reactivación selectiva, la fuente de verdad es una migración nueva y revisada.

## Criterios de cierre y riesgos conocidos

El rollout solo se da por cerrado cuando el verificador de producción es satisfactorio, hay exactamente una temporada activa, no quedan claves foráneas nulas, el primer partido nuevo apunta a `season-2`, el acceso privado funciona para las dos cuentas de prueba y las consultas RLS/grants confirman que Fantasy sigue revocado.

Riesgos que deben quedar en el registro operativo:

- Un historial remoto divergente puede hacer que `db push` no represente la secuencia revisada; se debe detener y reconciliar sin editar migraciones anteriores.
- La migración de backfill transforma datos existentes y el rollback depende del backup/PITR, no de una reversión improvisada.
- `PACHANGA_ACCESS_CODE` es global y los grants concedidos sobreviven a su rotación; gestionar ambas cosas por separado.
- El verificador usa privilegios administrativos y nunca debe apuntar a un proyecto no confirmado ni dejar sus credenciales en el repositorio.
- Fantasy queda desactivado a nivel de UI, backend, RLS y privilegios para `anon`/`authenticated`, aunque sus tablas y filas permanecen para una futura reactivación.
