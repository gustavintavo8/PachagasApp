# Acceso privado y temporadas — Diseño técnico

**Fecha:** 2026-08-31  
**Estado:** Diseño aprobado para planificación  
**Proyecto:** Pachanga App

## Objetivo

Convertir Pachanga en una aplicación privada para usuarios autorizados, iniciar inmediatamente una nueva temporada con estadísticas independientes, conservar todo el histórico anterior y retirar temporalmente Fantasy y el modo invitado de la experiencia pública.

## Decisiones de producto

- El acceso a la comunidad se controla mediante un único código global.
- El código se solicita una sola vez por cuenta, no en cada inicio de sesión.
- Las cuentas existentes sin permiso quedan bloqueadas hasta introducir el código.
- Las cuentas nuevas siguen el mismo flujo después de confirmar/iniciar sesión.
- Los administradores tienen acceso directo.
- El modo invitado se elimina de la UI y se cierra también en backend.
- Fantasy se oculta de la navegación, se bloquea por URL y deja sus datos intactos para una decisión futura.
- Todos los partidos actuales pertenecen a Temporada 1.
- Temporada 2 se crea y activa en el momento de aplicar la migración.
- El siguiente partido nuevo pertenecerá automáticamente a Temporada 2.
- El histórico se consulta por temporada desde `/history`.
- Las estadísticas de temporada son la fuente principal; las columnas estadísticas antiguas de `profiles` se conservan solo durante la transición.

## Alcance

### Incluido

- Migración SQL para temporadas, estadísticas por jugador y permisos de acceso.
- Backfill de partidos y RP históricos a Temporada 1.
- Inicialización de Temporada 2 con RP 1000 y contadores a cero.
- Protección centralizada de páginas y Server Actions.
- Adaptación de creación/finalización de partidos, ELO, MVP, ranking, perfiles, jugadores, historial y Panenka.
- Retirada de Fantasy y del modo invitado.
- Pruebas de migración, acceso y separación de estadísticas.

### No incluido

- Ligas múltiples con membresías independientes.
- Panel administrativo para cambiar el código desde la aplicación.
- Reinicio o rediseño del Fantasy.
- Borrado de usuarios anónimos o de datos históricos.
- Cambio de algoritmo ELO.

## Arquitectura de acceso

### Modelo de datos

Se crea `public.community_access_grants`:

- `user_id uuid primary key references auth.users(id) on delete cascade`.
- `granted_at timestamptz not null default now()`.
- `revoked_at timestamptz null`.

Una cuenta tiene acceso cuando existe su fila y `revoked_at is null`. La tabla no permite inserciones o actualizaciones directas por usuarios autenticados; solo el Server Action de canje, usando el cliente administrativo después de validar el código.

Se habilita RLS con una única lectura propia para el usuario autenticado. El middleware puede comprobar el permiso con la sesión actual, pero no puede concederlo.

### Código global

El código se configura como secreto de servidor con la variable `PACHANGA_ACCESS_CODE`. Nunca se envía al cliente ni se almacena en PostgreSQL. La comparación se hace en servidor con una comparación resistente a timing attacks, después de recortar espacios exteriores sin transformar el uso de mayúsculas/minúsculas.

El Server Action `redeemCommunityAccess(code: string): Promise<ActionResult>`:

1. Obtiene el usuario autenticado.
2. Rechaza sesiones anónimas.
3. Aplica rate limiting por usuario.
4. Comprueba el código.
5. Inserta o reactiva el permiso.
6. Revalida la navegación y devuelve éxito.

### Protección de rutas

El middleware mantiene como públicas las rutas de autenticación y legales, además de `/access`. Para cualquier otra ruta:

- Sin usuario: redirige a `/login`.
- Usuario anónimo: redirige a `/login`.
- Usuario sin permiso activo: redirige a `/access`.
- Usuario con permiso que visita `/access`: redirige a `/`.
- Administrador: continúa sin código.

La comprobación también se incorpora a las Server Actions y a la API de Panenka como defensa en profundidad, porque ocultar una ruta no impide invocar directamente una mutación compilada.

## Arquitectura de temporadas

### Tablas y relaciones

Se crea `public.seasons` con:

- `id uuid primary key`.
- `name text not null`.
- `slug text unique not null`.
- `status text not null` restringido a `active` o `archived`.
- `starts_at timestamptz not null`.
- `ends_at timestamptz null`.
- `created_at timestamptz not null default now()`.

Un índice único parcial garantiza como máximo una temporada activa.

Se crea `public.season_player_stats` con clave primaria `(season_id, user_id)` y estas columnas:

- `season_id uuid references seasons(id) on delete cascade`.
- `user_id uuid references profiles(id) on delete cascade`.
- `elo_rating integer not null default 1000`.
- `matches_played integer not null default 0`.
- `goals_scored integer not null default 0`.
- `wins integer not null default 0`.
- `draws integer not null default 0`.
- `losses integer not null default 0`.
- `mvps integer not null default 0`.
- `created_at timestamptz not null default now()`.
- `updated_at timestamptz not null default now()`.

Se añade `season_id` a `matches` y a `rp_history`. La columna se añade inicialmente nullable para permitir el backfill y después se convierte en obligatoria. `match_participants` no necesita una segunda columna porque hereda la temporada de su partido.

### Inicialización de datos

La migración crea:

- Temporada 1 como `archived`, con los partidos actuales y sus eventos de RP.
- Temporada 2 como `active`, con `starts_at` igual al momento de la migración.

Todos los `matches` existentes se asignan a Temporada 1. Todos los `rp_history` existentes se asignan a Temporada 1. Las filas de `season_player_stats` de Temporada 1 se inicializan con el ELO y los contadores acumulados actuales de `profiles`, y con victorias, empates, derrotas y MVPs calculados a partir de partidos finalizados.

La migración debe generar una comprobación de consistencia: los partidos, goles y MVPs reconstruidos desde el histórico no pueden contradecir los contadores existentes sin quedar registrados para revisión antes de activar la aplicación nueva.

Para Temporada 2 se crean filas iniciales para los perfiles existentes con ELO 1000 y contadores a cero. Los usuarios nuevos reciben su fila al concedérseles acceso o al participar en su primer partido, mediante una operación idempotente.

### Fuente de verdad

El código deja de leer las estadísticas competitivas desde `profiles`. `profiles` mantiene identidad, avatar, posición y preferencias personales. Sus columnas estadísticas antiguas se conservan durante la primera migración para permitir rollback y compatibilidad con Fantasy, pero no se actualizan como fuente principal.

Cada consulta que necesita estadísticas recibe una temporada explícita. Si no se especifica, usa la temporada activa obtenida desde una función compartida. Nunca se decide la temporada solo comparando fechas.

## Flujo de partidos y estadísticas

- `createMatch` obtiene la temporada activa y la guarda en `matches.season_id`.
- Balanceo de equipos y visualización de cancha usan el ELO de `season_player_stats` de la temporada del partido.
- Al finalizar un partido, el incremento de partidos, goles y resultado se aplica a la fila de temporada correspondiente.
- `applyEloUpdates` lee y actualiza el ELO de la temporada del partido e inserta `rp_history` con `season_id`.
- La resolución de MVP incrementa el contador de la temporada y debe ser idempotente.
- El flujo de finalización conserva la protección contra doble procesamiento cuando un partido ya está finalizado.
- Se añade una operación de reconstrucción de estadísticas por temporada y jugador para corregir desajustes sin tocar el histórico bruto.

Las consultas de ranking, jugadores, perfil, dashboard, historial, balanceo, herramientas de Panenka y cualquier cálculo de provisionalidad deben filtrar por la temporada seleccionada. El historial bruto de partidos y participantes permanece inmutable salvo las columnas de clasificación de temporada.

## Interfaz

### Pantalla de acceso

Se crea `/access` con el estilo de las tarjetas y controles existentes:

- Título de acceso privado.
- Explicación breve de que hace falta el código de la comunidad.
- Input `type="password"`.
- Botón para validar.
- Mensaje específico para código incorrecto, demasiados intentos y sesión caducada.
- No mostrar el código ni incluirlo en HTML, props o logs.

### Navegación y rutas

- Se elimina Fantasy de `NavbarClient` y `BottomNav`.
- `FantasyLayout` y las acciones Fantasy responden como funcionalidad temporalmente deshabilitada.
- Se eliminan el botón de modo invitado y la acción de login anónimo.
- Las sesiones anónimas existentes no se borran automáticamente; al acceder se redirigen a login.

### Selector histórico

`/history` usa la temporada activa por defecto y acepta una temporada mediante search param validado. El selector solo muestra temporadas existentes y ordenadas de la más reciente a la más antigua. El listado y el resumen de victorias, empates y derrotas se calculan para la temporada seleccionada.

El ranking y los perfiles muestran estadísticas de la temporada activa inicialmente. Las vistas que ya soportan historial de RP reciben el filtro de temporada para no mezclar curvas de Temporada 1 y Temporada 2.

## Panenka

Las herramientas de Panenka dejan de consultar Fantasy. Las herramientas de jugadores, partidos, ranking, estadísticas propias e historial usan la temporada activa por defecto y aceptan un filtro de temporada cuando la pregunta requiera histórico. Ninguna herramienta debe devolver datos Fantasy mientras la funcionalidad esté deshabilitada.

## Seguridad y privacidad

- RLS se aplica a las tablas nuevas.
- Ningún cliente puede concederse acceso a sí mismo sin pasar por la validación server-side.
- El código de acceso no se imprime en mensajes de error, logs o respuestas.
- Rate limiting independiente para canje del código.
- Se conserva la separación entre cliente Supabase normal y cliente service role.
- No se eliminan datos actuales durante el cambio de temporada.
- La migración se ejecuta primero en local y se verifica antes de producción.
- El despliegue requiere configurar `PACHANGA_ACCESS_CODE` solo en el entorno server-side de Vercel y local.

## Despliegue

1. Confirmar desde Dashboard que el proyecto reactivado responde y conserva datos.
2. Registrar conteos actuales de usuarios, partidos finalizados, participantes y `rp_history`.
3. Ejecutar la migración en Supabase local.
4. Probar backfill y separación de temporadas.
5. Aplicar la migración al proyecto reactivado.
6. Configurar `PACHANGA_ACCESS_CODE` en los entornos de despliegue.
7. Desplegar la aplicación.
8. Entregar el código únicamente a los jugadores autorizados.
9. Verificar login, código, creación del primer partido y estadísticas de Temporada 2.

No se borran ni se modifican destructivamente partidos, participantes, perfiles ni Fantasy. Las columnas antiguas de `profiles` se retirarán en una migración posterior solo después de validar producción.

## Criterios de aceptación

- Una cuenta autenticada sin permiso no puede ver el dashboard ni ejecutar mutaciones.
- Una cuenta puede canjear correctamente el código una vez y conserva acceso al renovar sesión.
- Un código incorrecto no concede acceso y queda limitado por rate limiting.
- Un administrador accede sin código.
- El modo invitado no aparece ni puede iniciar sesión por la acción antigua.
- Fantasy no aparece en navegación y sus rutas no son utilizables.
- Todos los partidos anteriores aparecen en Temporada 1.
- El ranking de Temporada 1 conserva los valores históricos esperados.
- Temporada 2 comienza con ELO 1000 y contadores a cero.
- El primer partido nuevo se guarda con `season_id` de Temporada 2.
- Finalizar un partido incrementa solo las estadísticas de Temporada 2.
- El historial permite consultar separadamente Temporada 1 y Temporada 2.
- Panenka no mezcla temporadas ni expone Fantasy deshabilitado.

