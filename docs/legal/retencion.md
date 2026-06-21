# Nota de retención y limpieza de datos — Pachanga

Esta nota detalla, a nivel interno y técnico, los criterios de conservación resumidos en
`/privacidad` §6 ("Mientras tengas la cuenta activa... algunos registros pueden
conservarse el tiempo mínimo exigido por ley"). Cubre tres categorías: conservación
mientras la cuenta está activa, limpieza de notificaciones antiguas y tratamiento de
cuentas inactivas/invitadas.

## 1. Principio general: conservación ligada a la cuenta activa

Salvo las excepciones de este documento, los datos personales de un usuario (perfil,
participaciones, comentarios de chat, fotos, votos, valoraciones, notificaciones,
historial de RP) se conservan **mientras la cuenta esté activa**. Al eliminar la cuenta
(borrado autoservicio, `deleteAccount` en `src/app/profile/data-actions.ts`), el usuario
se borra de `auth.users` vía el cliente admin de Supabase y el `ON DELETE CASCADE` de la
base de datos limpia el resto de filas con clave foránea a su `id` (perfil,
participaciones, comentarios, fotos, votos, notificaciones, etc.). No hay periodo de
gracia ni copia adicional fuera de las copias de seguridad estándar de la infraestructura
(Supabase), que rotan según la política de retención de backups de la propia
infraestructura y no son accesibles para uso ordinario.

## 2. Notificaciones antiguas

- Las notificaciones (`notifications`) son mensajes dirigidos al usuario sobre eventos de
  la app (convocatorias, resultados, MVP, fantasy, etc.). Pierden utilidad rápidamente
  una vez leídas o pasado el evento al que se refieren.
- **Criterio de conservación:** no tienen un valor de conservación a largo plazo distinto
  del de la cuenta del usuario; se conservan mientras la cuenta existe y se eliminan
  junto con ella en el borrado de cuenta.
- **Limpieza periódica recomendada:** dado que no aportan valor pasado un tiempo, se
  recomienda una limpieza periódica de notificaciones antiguas (p. ej. más de 90 días) de
  cuentas activas, para minimizar el volumen de datos personales almacenados sin
  necesidad funcional (principio de minimización, RGPD art. 5.1.c). Esta limpieza es una
  tarea de mantenimiento, no un derecho ejercitable por el usuario; el usuario que quiera
  eliminar antes sus notificaciones puede hacerlo eliminando su cuenta o, si la función
  existe en la interfaz, marcándolas/borrándolas individualmente.

## 3. Cuentas anónimas / invitadas

- Pachanga permite un modo invitado anónimo (`is_anonymous: true` en el JWT de Supabase
  Auth, ver `isGuestUser` en `src/lib/permissions.ts`), usado para que alguien explore la
  app sin crear cuenta. Las cuentas invitadas tienen funciones de escritura restringidas
  (no pueden crear partidos, no suben avatar, no acceden a borrado/exportación de datos
  reales porque no representan a una persona con datos persistentes de valor).
- **Criterio de conservación:** las sesiones anónimas son, por naturaleza, de corta vida.
  Una sesión anónima que **caduca o no se convierte en cuenta registrada** no debe
  conservarse indefinidamente: Supabase Auth puede configurarse para expirar
  automáticamente los usuarios anónimos no convertidos tras un periodo de inactividad (p.
  ej. unos días), y cualquier dato de actividad ligado a esa sesión se limpia con ella
  por el mismo mecanismo de `ON DELETE CASCADE` que aplica a cualquier usuario.
- No se conservan listas separadas de "invitados" fuera de `auth.users`; al expirar el
  usuario anónimo desaparece como cualquier otra cuenta.

## 4. Cuentas inactivas (registradas, no invitadas)

- El proyecto no impone hoy un borrado automático de cuentas registradas inactivas: el
  usuario decide cuándo eliminar su cuenta (borrado autoservicio). Esto es una decisión
  consciente de diseño para un proyecto a esta escala (no hay obligación legal de fijar
  un plazo máximo de inactividad cuando la finalidad — mantener el histórico de partidos,
  ranking y stats del usuario — sigue siendo válida mientras la cuenta exista).
- **Criterio recomendado a futuro** (no implementado, anotado aquí para coherencia con el
  principio de minimización si el proyecto creciera): si el volumen de cuentas inactivas
  se volviera significativo, valorar un aviso al usuario tras un periodo largo de
  inactividad (p. ej. 24 meses sin acceso) ofreciendo eliminar la cuenta o confirmarla
  como activa, antes de proceder a una limpieza. Mientras esto no se implemente, prevalece
  el criterio del punto 1: conservación ligada a la cuenta activa, sin límite temporal
  forzado.

## 5. Fotos y contenido de chat

- Las fotos de partido y los mensajes de chat siguen el mismo criterio general: se
  conservan mientras la cuenta y el contenido existan, se eliminan con el borrado de
  cuenta del autor, y pueden eliminarse antes mediante:
  - **Retirada individual** (si la interfaz lo permite) por el propio autor.
  - **Takedown** solicitado por una persona que aparece en una foto sin haber dado su
    consentimiento, vía el canal de contacto de `/terminos` §3 (`LEGAL_CONTACT_EMAIL`).
    Ver `nota-riesgo-fotos.md` para el detalle de este mecanismo.

## 6. Coherencia

Este documento es coherente con `/privacidad` §6 (resumen público), con `RAT.md`
(columna "Conservación" por tratamiento) y con el mecanismo de borrado autoservicio de
`src/app/profile/data-actions.ts`. No introduce ningún plazo de conservación que
contradiga lo publicado en la política.
