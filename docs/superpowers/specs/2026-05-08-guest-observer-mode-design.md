# Modo Observador Invitado — Diseño

**Fecha:** 2026-05-08  
**Estado:** Aprobado

## Resumen

Añadir un botón "Ver demo como invitado" en la página de login que autentica al usuario de forma anónima (Supabase Anonymous Auth). El invitado puede navegar toda la app y usar el asistente Panenka, pero no puede realizar ninguna acción de escritura. Los botones de acción se ocultan en el frontend; los server actions devuelven error si se llaman directamente.

## Arquitectura

### Autenticación

- Se usa **Supabase Anonymous Sign-in** (`supabase.auth.signInAnonymously()`).
- El invitado obtiene un JWT válido con `is_anonymous: true`.
- El middleware existente lo deja pasar sin cambios — ya tiene sesión.
- La sesión es efímera; Supabase la gestiona y limpia automáticamente.
- No se crea ningún perfil persistente en la tabla `profiles`.

### Detección del modo invitado

- **Server side**: `user.is_anonymous === true` (disponible en el objeto `User` de `supabase.auth.getUser()`).
- **Client side**: los server page components calculan `isGuest` y lo pasan como prop `boolean` a sus client components hijos. No se usa ningún context ni env var público.

### Variables de entorno

Ninguna nueva. No se necesitan `GUEST_EMAIL`, `GUEST_PASSWORD` ni similares.

## Cambios por capa

### 1. Login (`src/app/login/`)

**`actions.ts`** — nueva action:
```ts
export async function loginAsGuest(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw new Error(error.message);
  redirect("/");
}
```

**`page.tsx`** — añadir botón debajo del formulario principal:
- Estilo secundario (outline/zinc), diferenciado del CTA principal.
- Texto: "Ver demo como invitado".
- Llama `loginAsGuest()` con su propio estado de loading.
- Posición: debajo del bloque del formulario, separado por un divisor sutil.

### 2. Guards en server actions

Patrón común a aplicar en todas las acciones de escritura listadas:

```ts
if (user.is_anonymous) {
  return { success: false, error: "Esta acción no está disponible en modo demo" };
}
```

**Acciones afectadas:**

| Archivo | Función |
|---------|---------|
| `matches/actions.ts` | `createMatch`, `joinMatch`, `leaveMatch`, `voteForMvp` |
| `profile/actions.ts` | `updateProfile`, `updateAvatar` |

El guard se coloca inmediatamente después del check de autenticación existente (`if (!user)`), antes de cualquier otra lógica.

Acciones de solo administrador (`closeMatch`, `setScore`, `generateTeams`, `cancelMatch`, `rescheduleMatch`, `kickPlayer`, `markAsPaid`) ya están protegidas por `isAdmin()` — un usuario anónimo sin perfil nunca pasa ese check. No necesitan guard explícito.

### 3. Páginas server — propagación de `isGuest`

Cada server page component obtiene el usuario y calcula `isGuest`:

```ts
const { data: { user } } = await supabase.auth.getUser();
const isGuest = user?.is_anonymous ?? false;
```

**`matches/[id]/page.tsx`** → pasa `isGuest` a `<MatchDetail isGuest={isGuest} />`.

**`matches/new/page.tsx`** → si `isGuest`, hace `redirect("/matches")` antes de renderizar el formulario.

**`profile/page.tsx`** → pasa `isGuest` a `<ProfileForm isGuest={isGuest} />`.

### 4. Client components — ocultación de botones

**`MatchDetail.tsx`**:
- Recibe `isGuest: boolean` en sus props.
- Oculta: botón "Unirse", botón "Abandonar".
- Pasa `isGuest` a `<MatchChat isGuest={isGuest} />`, `<MatchPhotos isGuest={isGuest} />`, `<MvpVoting isGuest={isGuest} />`.

**`MatchChat`** (componente existente):
- Recibe `isGuest: boolean`.
- Si `isGuest`: oculta el input de mensaje y el botón de enviar. El historial de mensajes es visible.

**`MatchPhotos`** (componente existente):
- Recibe `isGuest: boolean`.
- Si `isGuest`: oculta el botón de subir foto. Las fotos existentes son visibles.

**`MvpVoting`** (componente existente):
- Recibe `isGuest: boolean`.
- Si `isGuest`: oculta los botones de voto. Los resultados son visibles.

**`ProfileForm.tsx`**:
- Recibe `isGuest: boolean`.
- Si `isGuest`: oculta el formulario de edición completo (campos username, posición, foto).
- Muestra texto informativo sutil: `"El perfil no es editable en modo demo"`.
- Las estadísticas del perfil (ELO, partidos jugados, goles) no se muestran ya que el usuario anónimo no tiene fila en `profiles` — la página mostrará el estado vacío que ya existe.

### 5. Asistente Panenka (`src/app/api/asistente/route.ts`)

Sin cambios. El usuario anónimo tiene un `user.id` válido. Las tools de Panenka buscarán datos para ese ID y devolverán resultados vacíos (sin historial de partidos, sin perfil). Panenka responderá acorde a sus datos reales — puede responder preguntas generales sobre el app y sobre otros jugadores/partidos.

## Flujo de usuario

1. Usuario llega a `/login`
2. Hace clic en "Ver demo como invitado"
3. `loginAsGuest()` llama `signInAnonymously()` → sesión JWT anónima
4. `redirect("/")` → llega al dashboard
5. Navega libremente: dashboard, ranking, jugadores, partidos, asistente
6. Los botones de escritura no aparecen
7. Si intenta una acción de escritura directamente (API call): recibe error `"Esta acción no está disponible en modo demo"`
8. Cierra el tab → la sesión expira automáticamente

## Lo que NO cambia

- Middleware (`src/middleware.ts`) — sin cambios
- RLS policies de Supabase — sin cambios
- Lógica de ELO — sin cambios
- Esquema de la base de datos — sin cambios
- Navbar y BottomNav — sin cambios (guest navega todos los menús)
- Fantasy (`src/app/fantasy/`) — acciones de fantasy no están en scope; el invitado puede ver las páginas pero si intenta escribir, fallará por ausencia de perfil
