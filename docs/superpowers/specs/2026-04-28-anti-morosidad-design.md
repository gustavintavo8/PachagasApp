# Spec: Sistema Anti-Morosidad (Pagos Manuales)

**Fecha:** 2026-04-28  
**Estado:** Aprobado

---

## Resumen

Funcionalidad para que el organizador (y el admin) pueda marcar manualmente a cada jugador como "pagado" tras recibir el Bizum. Todos los participantes pueden ver el estado de pago de cada jugador para reducir la morosidad. No hay precios, ni notificaciones, ni historial — solo un toggle manual.

---

## Base de Datos

### Migración: `match_participants`

Añadir columna:

```sql
ALTER TABLE public.match_participants
  ADD COLUMN has_paid boolean NOT NULL DEFAULT false;
```

No se necesita tabla nueva ni cambios en otras tablas.

### RLS

- **SELECT:** La policy `Ver participantes todos` ya existe y cubre el nuevo campo.
- **UPDATE de `has_paid`:** El server action usa el admin client (service role), igual que `kickPlayer`. No se añade policy de UPDATE para usuarios normales — el control de permisos se hace en la capa de servidor.

---

## Server Action

**Archivo:** `src/app/matches/actions.ts`

```ts
markAsPaid(matchId: string, targetUserId: string, paid: boolean): Promise<ActionResult>
```

### Validaciones (en orden)

1. Usuario autenticado.
2. `matchId` y `targetUserId` son UUIDs válidos (Zod).
3. El partido existe y está en estado `open`.
4. El llamante es el organizador (`created_by === user.id`) o es admin (`isAdmin(user.id)`).
5. Rate limit: `mark-paid:{user.id}` — 20 tokens / 60 000 ms.

### Efecto

```ts
adminClient
  .from("match_participants")
  .update({ has_paid: paid })
  .eq("match_id", matchId)
  .eq("user_id", targetUserId)
```

Revalida `/matches/${matchId}`.

Sin notificaciones.

---

## Tipos

Añadir `has_paid: boolean` a `MatchParticipant` en `src/lib/types.ts`.

---

## UI — `MatchDetail.tsx`

### Badge de estado de pago

En la fila de cada participante, junto al nombre, se añade un icono Lucide React:

| Estado | Icono | Color |
|--------|-------|-------|
| Pagado (`has_paid = true`) | `CheckCircle2` | `text-[#ccff00]` (accent) |
| Pendiente (`has_paid = false`) | `CircleDashed` | `text-muted` |

- **Para todos:** el icono es solo visual, no interactivo.
- **Para organizador y admin:** el icono es un botón que alterna `has_paid`. Al hacer click se actualiza optimistamente en local state y se llama `markAsPaid` en background. Si falla, se revierte y se muestra toast de error.

### Visibilidad

El icono y el resumen solo se muestran cuando `match.status === "open"`.

### Resumen de cobros (organizador/admin únicamente)

Encima o debajo de la lista de participantes:

```
X / Y pagados
```

Texto simple con los contadores derivados del estado local de participantes.

---

## Flujo completo

```
Jugador se une al partido
       ↓
has_paid = false (por defecto)
       ↓
Jugador paga por Bizum (fuera de la app)
       ↓
Organizador/admin ve la lista → click en CircleDashed del jugador
       ↓
markAsPaid(matchId, userId, true) → has_paid = true
       ↓
Icono cambia a CheckCircle2 verde para todos
```

---

## Lo que NO incluye este diseño

- Precio configurable por partido.
- Notificaciones al jugador al ser marcado como pagado.
- Historial de quién marcó o cuándo.
- Disponibilidad en partidos cerrados, finalizados o cancelados.
