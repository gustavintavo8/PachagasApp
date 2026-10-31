# Añadir un partido al calendario

**Fecha:** 2026-09-02

**Estado:** Diseño aprobado

**Alcance:** Detalle de un partido próximo

## Objetivo

Permitir que una persona añada un partido próximo a su calendario desde la pantalla de detalle. La solución debe integrarse con la zona actual de compartir, funcionar con Google Calendar y Outlook, y ofrecer un archivo estándar para el resto de aplicaciones de calendario.

## Experiencia de usuario

En la pestaña de información del partido se añadirá un botón junto a **Copiar enlace** y **WhatsApp**:

- Etiqueta: **Añadir al calendario**.
- Icono: `CalendarPlus` de `lucide-react`, la librería de iconos que ya utiliza la aplicación.
- Apariencia: mismo tratamiento visual neutro que **Copiar enlace**, incluido el borde, fondo, tipografía y estado `hover` con el color de acento.
- Disposición: se reutilizará la fila flexible actual, de modo que los tres controles puedan saltar de línea sin desbordarse en pantallas pequeñas.

Al activar el botón se abrirá un menú compacto con estas opciones:

1. **Google Calendar**: abre la composición de un evento en Google Calendar con sus campos rellenados.
2. **Outlook**: abre la composición de un evento en Outlook web con sus campos rellenados.
3. **Descargar archivo .ics**: descarga un evento compatible con Apple Calendar, Calendario de Windows, Thunderbird y otras aplicaciones que acepten iCalendar.

Los enlaces a Google y Outlook se abrirán en una pestaña nueva. Descargar `.ics` no navegará fuera de la página.

El control estará disponible únicamente cuando el partido:

- tenga estado `open` o `closed`; y
- tenga una fecha de inicio posterior al momento actual.

No se mostrará para partidos `finished`, `cancelled` o cuya hora de inicio ya haya pasado. Un partido `closed` próximo sigue siendo exportable porque puede estar completo, pero sigue siendo relevante para quienes ya participan.

## Contenido del evento

Todos los proveedores recibirán los mismos datos:

| Campo | Valor |
| --- | --- |
| Título | `⚽ Pachanga en {ubicación}` |
| Inicio | Fecha y hora almacenadas en `match.date` |
| Fin | Exactamente una hora después del inicio |
| Ubicación | Valor de `match.location` |
| Descripción | `Partido organizado en Pachangas` seguido del enlace público al detalle |

Ejemplo de título: `⚽ Pachanga en Polideportivo Municipal`.

El número de jugadores no se incluirá. Ese dato podría cambiar después de exportar el evento y el calendario conservaría una cifra desactualizada. El enlace al partido será la fuente para consultar su estado actual.

## Comportamiento técnico

La función no necesita cambios en Supabase, nuevas tablas, migraciones ni endpoints. Los datos necesarios ya están disponibles en `MatchDetail`.

La generación se aislará en una utilidad de calendario, separada del componente de detalle. Esta utilidad deberá:

- aceptar al menos `id`, `date` y `location` del partido, además del origen público de la aplicación;
- construir una representación común del evento antes de adaptarla a cada proveedor;
- calcular el final sumando 60 minutos al instante de inicio;
- convertir las fechas a UTC para los enlaces externos y el archivo iCalendar;
- codificar cada parámetro de forma independiente al construir las URL de Google y Outlook;
- escapar barras invertidas, comas, puntos y coma y saltos de línea según iCalendar al generar `.ics`;
- usar finales de línea CRLF, plegar las líneas largas de iCalendar y crear un `UID` estable derivado del identificador del partido;
- descargar el archivo con un nombre reconocible, por ejemplo `pachanga-2026-09-04.ics`;
- devolver un error controlado si `match.date` no representa una fecha válida.

La URL pública del partido tendrá la forma `{origin}/matches/{id}` y aparecerá en la descripción. No se codificará de forma fija el dominio de producción para que funcione también en desarrollo y despliegues de vista previa.

Los adaptadores usarán estos contratos:

- Google Calendar recibirá una URL de creación basada en `calendar.google.com/calendar/render` con `action=TEMPLATE`, `text`, `dates`, `details` y `location`. El intervalo de `dates` usará el formato UTC compacto de Google.
- Outlook recibirá una URL de composición basada en `outlook.live.com/calendar/0/deeplink/compose` con `subject`, `startdt`, `enddt`, `body` y `location`. Sus fechas se expresarán como ISO 8601.
- El archivo iCalendar incluirá como mínimo `VCALENDAR`, `VERSION:2.0`, `PRODID`, `VEVENT`, `UID`, `DTSTAMP`, `DTSTART`, `DTEND`, `SUMMARY`, `DESCRIPTION`, `LOCATION` y `END:VEVENT`.

## Integración en la interfaz

El componente de interfaz del menú será pequeño y específico para esta acción. `MatchDetail.tsx` solo decidirá si debe mostrarlo y le pasará los datos del partido; la construcción de URL y del archivo no se implementará dentro del componente principal.

El menú deberá:

- declarar el disparador como `type="button"`;
- exponer `aria-haspopup="menu"` y el estado mediante `aria-expanded`;
- poder recorrerse con teclado;
- cerrarse al seleccionar una opción, pulsar `Escape` o hacer clic fuera;
- mantener un foco visible;
- usar `rel="noopener noreferrer"` en enlaces externos;
- mostrar un mensaje de error mediante el sistema de notificaciones existente si no puede preparar o descargar el evento.

No se añadirá una dependencia externa para el menú ni para generar iCalendar: el alcance es suficientemente pequeño para resolverlo con React, las utilidades del navegador y los estilos existentes.

## Casos especiales

- **Cambio posterior del partido:** el evento ya exportado no se actualizará automáticamente. La ficha enlazada sí mostrará los datos actuales. La sincronización bidireccional o las suscripciones de calendario quedan fuera de alcance.
- **Zona horaria:** `match.date` se interpretará como un instante y se serializará en UTC. El proveedor de calendario será responsable de mostrarlo en la zona horaria configurada por la persona usuaria.
- **Bloqueo de ventanas emergentes:** Google y Outlook se implementarán como enlaces normales iniciados por una interacción directa, no mediante `window.open` diferido.
- **Datos especiales:** ubicaciones con tildes, emoji, comas o saltos de línea deben conservarse correctamente en las URL y en `.ics`.
- **Hidratación:** la comparación con el momento actual y el uso de `window.location.origin` se realizarán en el cliente sin introducir diferencias entre el HTML del servidor y la primera renderización.

## Verificación y criterios de aceptación

La funcionalidad se considerará terminada cuando se cumpla todo lo siguiente:

1. Un partido futuro con estado `open` o `closed` muestra **Añadir al calendario** junto a los controles actuales.
2. Un partido terminado, cancelado o pasado no muestra el control.
3. El menú ofrece Google Calendar, Outlook y descarga `.ics` y se puede operar con ratón y teclado.
4. Los tres formatos contienen el título con el emoji `⚽`, la ubicación, la hora correcta, una duración exacta de 60 minutos y el enlace al partido.
5. Ningún formato incluye el número de jugadores.
6. Google y Outlook reciben parámetros correctamente codificados y se abren sin que un bloqueador impida la interacción normal.
7. El archivo `.ics` es importable y conserva correctamente caracteres españoles y el emoji.
8. La disposición no produce desbordamiento en móvil.
9. La compilación, el lint y las pruebas existentes continúan pasando.

Las pruebas automatizadas cubrirán como mínimo el cálculo de la hora final, la serialización UTC, la codificación de URL, el escape de iCalendar, el `UID` estable y la condición de visibilidad. Una comprobación de navegador verificará la apertura del menú, los destinos generados y el contenido descargado del archivo `.ics` sin completar operaciones en servicios externos.

## Fuera de alcance

- Guardar preferencias de calendario en Supabase.
- Actualizar o eliminar automáticamente eventos ya exportados.
- Añadir duración configurable a los partidos.
- Integraciones OAuth específicas con Google o Microsoft.
- Incluir participantes o enviar invitaciones de calendario.
- Mostrar cifras de jugadores que puedan quedar desactualizadas.
