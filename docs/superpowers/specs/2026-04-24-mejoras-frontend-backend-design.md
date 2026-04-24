# Spec: Mejoras Frontend + Backend — Pachanga App

**Fecha:** 2026-04-24  
**Estado:** Aprobado  
**Enfoque elegido:** Full-stack completo (Enfoque C)

---

## Contexto

Pachanga App es una aplicación web de gestión de fútbol informal. El 95% de los usuarios acceden desde móvil. La app ya tiene una base técnica sólida (Next.js App Router, React Compiler, Suspense streaming, Supabase Realtime) pero la UX móvil y la capa de base de datos tienen margen claro de mejora. No hay quejas formales de usuarios pero el desarrollador nota carga lenta a veces en móvil.

**Principios de este spec:**
- Los datos de producción están seguros: todos los cambios de DB son aditivos (solo índices y una nueva RPC).
- La lógica de ELO/RP no se toca.
- El esquema de tablas existentes no cambia.
- El widget meteorológico se mantiene hardcodeado a Mieres, Asturias.

---

## Sección 1 — Navegación

### Decisión: Bottom Tab Bar

Reemplazar la navbar superior con menú hamburguesa por una **bottom tab bar** con 5 destinos principales, accesibles con el pulgar en cualquier pantalla.

**Tabs:**
| Icono | Label | Ruta |
|---|---|---|
| 🏠 | Inicio | `/` |
| 📅 | Partidos | `/matches` |
| 👥 | Jugadores | `/players` |
| 🏆 | Fantasy | `/fantasy` |
| 👤 | Perfil | `/profile` |

**La barra superior** se simplifica: solo logo + campana de notificaciones. Desaparece el menú hamburguesa y los links de navegación.

**Implementación:**
- Nuevo componente `BottomNav` (client component, necesita `usePathname` para el tab activo).
- La bottom tab bar vive en el layout raíz (`app/layout.tsx`) junto al `ToastProvider`.
- El `Navbar` existente se recorta para servir solo de header (logo + notificaciones).
- En desktop (≥768px) la bottom tab se oculta y el Navbar recupera los links horizontales.

---

## Sección 2 — Dashboard (`/`)

### Decisión: Hero card + próximo partido destacado

Reorganizar la pantalla de inicio en tres bloques verticales ordenados por prioridad de uso:

**Bloque 1 — Hero card del usuario**
- Avatar, nombre, posición
- RP actual con ícono ⚡
- Posición en el ranking global (ej. `#7 ranking`) — calculado server-side con una query simple `COUNT(*) WHERE elo_rating > user_elo`
- Tres stats en fila: Partidos / Goles / % Victoria (victorias/partidos)
- Fondo con gradiente sutil + círculo decorativo en accent

**Bloque 2 — Próximo partido destacado**
- Card con borde accent que destaca el partido abierto más próximo en el tiempo al que el usuario NO está apuntado aún (o en el que ya está apuntado si no hay otro)
- Muestra: nombre del partido, hora, nº apuntados, botón "Ver" que navega al detalle
- Si no hay partidos abiertos: estado vacío con CTA para crear partido (solo organizado/admin)

**Bloque 3 — Más partidos**
- Lista compacta de los demás partidos abiertos
- Cada item: punto verde (abierto), nombre, hora, contador de jugadores
- Link "Ver todos →" que navega a `/matches`

**Qué desaparece del dashboard:**
- Las gráficas de Recharts se eliminan del dashboard. Ya existen en `/players/[id]` (el perfil público de cada jugador), donde tienen más contexto. El usuario puede ver sus propias gráficas navegando a su perfil desde el leaderboard o desde la hero card.

---

## Sección 3 — Detalle de partido (`/matches/[id]`)

### Decisión: Tabs internas (Info / Equipos / Chat / Fotos)

Reemplazar el scroll largo de `MatchDetail` por cuatro tabs internas con estado local en el cliente.

**Tab 1 — Info** (tab por defecto al abrir el partido)
- Header del partido: nombre, fecha/hora, ubicación
- Widget meteorológico (mantener hardcodeado a Mieres, Asturias)
- Barra de progreso de jugadores apuntados (ej. `9 / 14`)
- Botón "Apuntarse" / "Abandonar" prominente
- Lista de participantes con: avatar, nombre, posición (badge), RP — ordenados por RP desc
- Acciones de admin (cerrar partido, generar equipos, poner resultado, cancelar, reprogramar) en un menú secundario "⚙️ Gestión" que se despliega

**Tab 2 — Equipos**
- El componente `SoccerPitch` existente (sin cambios funcionales)
- Solo visible cuando el partido tiene equipos generados; si no, muestra estado vacío con botón para generarlos (si es admin)

**Tab 3 — Chat**
- El componente `MatchChat` existente (sin cambios funcionales)
- Badge numérico en el tab cuando hay mensajes no leídos (contador desde la última vez que se visitó el tab, usando `useRef` para la marca de tiempo)

**Tab 4 — Fotos**
- El componente `MatchPhotos` existente (sin cambios funcionales)

**Carga de datos:**
- Los datos iniciales del partido (info, participantes) se cargan en el Server Component padre y se pasan como props a `MatchDetail` — ya existía esta estructura, se refuerza para evitar waterfalls del cliente.
- Solo los listeners Realtime (chat, mvp_votes, notifications) se inicializan en el cliente.

---

## Sección 4 — Performance y backend

### 4.1 Índices de base de datos

Nueva migración Supabase con 5 índices (todos `CREATE INDEX IF NOT EXISTS`):

```sql
CREATE INDEX IF NOT EXISTS idx_match_participants_match_id ON match_participants(match_id);
CREATE INDEX IF NOT EXISTS idx_match_participants_user_id  ON match_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_rp_history_user_id          ON rp_history(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read  ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_mvp_votes_match_id          ON mvp_votes(match_id);
```

### 4.2 Paginación en listas

Implementar paginación cursor-based (usando `id` o `created_at`) en tres páginas:

- `/matches` — paginación de 20 en 20, botón "Cargar más" (no infinite scroll para mantener simplicidad)
- `/players` — igual, 20 en 20 ordenados por `matches_played DESC`
- `/leaderboard` — la primera página carga los top 20; botón "Cargar más"

El componente `MatchesTabs` ya es client, por lo que añadir el estado de paginación es directo. Para `/players` y `/leaderboard` (Server Components), se implementa con un param `?page=N` en la URL.

### 4.3 RPC `get_common_matches`

Crear la función SQL que actualmente falla y fuerza el fallback app-side en `/players/[id]`:

```sql
CREATE OR REPLACE FUNCTION get_common_matches(user_a uuid, user_b uuid)
RETURNS TABLE (
  match_id uuid,
  date timestamptz,
  location text,
  team_a_score int,
  team_b_score int,
  user_a_team text,
  user_b_team text
)
LANGUAGE sql STABLE AS $$
  SELECT
    m.id,
    m.date,
    m.location,
    m.team_a_score,
    m.team_b_score,
    pa.team AS user_a_team,
    pb.team AS user_b_team
  FROM matches m
  JOIN match_participants pa ON pa.match_id = m.id AND pa.user_id = user_a
  JOIN match_participants pb ON pb.match_id = m.id AND pb.user_id = user_b
  WHERE m.status = 'finished'
  ORDER BY m.date DESC;
$$;
```

### 4.4 Reducción de waterfalls en MatchDetail

`MatchDetail` actualmente es un client component que hace fetch al montar. Refactorizar para que:
1. El Server Component `matches/[id]/page.tsx` cargue en paralelo: datos del partido, participantes, perfil del organizador, perfil del usuario actual, lista de admins (ya hace la mayoría, reforzar el paralelismo con `Promise.all`).
2. Pasar todos los datos como props al client component.
3. El client component solo maneja estado local (tab activa) y suscripciones Realtime.

---

## Componentes nuevos

| Componente | Tipo | Propósito |
|---|---|---|
| `BottomNav` | Client | Tab bar inferior con 5 destinos, tab activo por `usePathname` |
| `HeroCard` | Server | Card del usuario con stats y posición en ranking |
| `NextMatchCard` | Server | Card destacada del próximo partido abierto |
| `MatchDetailTabs` | Client | Contenedor de tabs internas del detalle de partido |

---

## Componentes que se modifican

| Componente | Cambio |
|---|---|
| `Navbar` | Eliminar links de navegación y menú hamburguesa; mantener logo + notificaciones |
| `app/layout.tsx` | Añadir `<BottomNav>` + media query para ocultarlo en desktop |
| `app/page.tsx` | Reescribir estructura: HeroCard + NextMatchCard + lista compacta |
| `matches/[id]/page.tsx` | Reforzar `Promise.all` para carga paralela |
| `MatchDetail` | Añadir `MatchDetailTabs` internamente; recibir datos como props |

---

## Fuera de scope

- Lógica de ELO/RP
- Modificación de esquema de tablas existentes
- Fix del tipo `bigint`/`integer` en `consume_rate_limit` (requiere confirmación separada)
- Widget meteorológico dinámico (se mantiene hardcodeado a Mieres)
- Push notifications nativas (PWA ya tiene manifest, pero esto es un proyecto aparte)

---

## Orden de implementación sugerido

1. **Índices DB** — sin riesgo, impacto inmediato en producción
2. **RPC `get_common_matches`** — aditivo, elimina el fallback
3. **Bottom tab bar + Navbar simplificado** — cambio visible más impactante
4. **Dashboard rediseñado** — Hero card + próximo partido
5. **Match detail con tabs** — refactor del componente más grande
6. **Paginación en listas** — mejora de escala a largo plazo
