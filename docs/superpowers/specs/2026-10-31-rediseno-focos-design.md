# Rediseño Focos — Diseño

**Fecha:** 2026-10-31
**Rama:** `redesign/lavado-integral` (desde `origin/main` + `codex/rpc-verifier-fix`)
**Alcance:** toda la capa visual y de sensación táctil de la app. Datos, RLS y Server Actions no cambian de contrato.

## La idea

> En Pachanga, la app es el campo de noche: negro hasta que hay partido, y entonces los petos inundan la pantalla.

Casi todo es blanco sobre negro. Cuando salen los equipos o acaba un partido, el rojo y el azul llegan como campos enteros, de borde a borde. Nada es una tarjeta. El peto es la unidad de todo: cuenta plazas, marca quién ha pagado y, el día que te toca, tiñe tu pantalla entera. Panenka lo vio todo y lo cuenta.

Referencia visual: `opcion-2` (Focos), con injertos de `opcion-1` (la voz y los titulares) y `opcion-3` (Titulares/Banquillo, marcar «tú»). Las capturas y el HTML de referencia están en el scratchpad de la sesión (ruta en cada encargo).

**Lo que hace que esto no sea genérico** (si un cambio destruye algo de esta lista, está mal):

1. Rojo y Azul son los únicos colores de la app, y solo significan equipo.
2. El peto como marca: lleno, vacío, discontinuo.
3. La respuesta es la cosa más grande de la pantalla, escrita en una frase («Juegas.», «Faltan 3», «Segundo, a 47 de Iván.»), no una etiqueta con un número debajo.
4. El marcador partido por una costura que se mueve con el resultado, con Panenka en el punto de saque.
5. La casa de tu peto: el día que hay equipos, Inicio se vuelve de tu color.
6. La voz de Panenka: seca, cansada, con el grupo como blanco.

## Tokens

En `src/app/globals.css`, bloque `@theme inline`. Se conservan los nombres actuales para que el código (y Fantasy, en pausa) siga compilando, y se añaden `rojo`, `azul` y `tarjeta`.

| Token Tailwind | Valor | Uso |
| --- | --- | --- |
| `background` | `#000000` | Suelo. Negro de verdad |
| `surface` | `#141414` | El único escalón: filas pulsadas, inputs, celdas |
| `surface-hover` | `#1f1f1f` | Estado pulsado sobre `surface` |
| `border` | `#2a2a2a` | Reglas de filas, separadores |
| `border-hover` | `#4a4a4a` | Contorno de controles |
| `foreground` | `#f4f4f4` | Tinta, botón primario, fila «tú» invertida |
| `muted` | `#a8a8a8` | Texto secundario (8,9:1). Nunca para lo importante |
| `rojo` | `#d8141e` | Equipo Rojo. Solo el peto |
| `azul` | `#0a55d8` | Equipo Azul. Solo el peto |
| `tarjeta` | `#ffcf0d` | Tarjeta amarilla: deudas, avisos, errores, acciones destructivas |
| `accent` | alias de `foreground` | Compatibilidad |
| `accent-hover` | `#ffffff` | Compatibilidad |
| `danger` | alias de `tarjeta` | El rojo no puede significar error aquí |

Texto sobre campo rojo o azul: `#ffffff`. Líneas del campo dibujado: `#6e6e6e`, 1,5px.

**Prohibido en todo `src/` salvo `src/app/fantasy`:** `zinc-*`, `#ccff00`, `bg-gradient-*`, `backdrop-blur*`, `shadow-*` sobre cosas en reposo, `drop-shadow`, `rounded-*` (salvo `rounded-full` en lo que sea redondo de verdad: el balón, el círculo central), `uppercase` con tracking, colores crudos de Tailwind (`text-blue-400`, `text-green-500`…), emoji, `transition-all`, `:hover` sin `@media (hover: hover) and (pointer: fine)`.

Victoria, empate y derrota no llevan color: V encendida (blanco sobre negro invertido), E gris, D apagada. Los cambios de RP llevan signo y ningún color.

## Tipografía

Dos caras, con `next/font/google`:

- **Sofia Sans Extra Condensed** (600, 800, 900), variable `--font-display`: respuestas, cifras, navegación. Tiene cifras tabulares reales.
- **Archivo** (400, 500, 700), variable `--font-sans`: todo lo que se lee.

Clases en `globals.css`, tamaños a 390px:

| Clase | Tamaño / interlínea | Peso | Para |
| --- | --- | --- | --- |
| `.t-respuesta` | `min(150px, 38vw)` / 0.9 | 900 | «Juegas.» |
| `.t-marcador` | ver componente | 900 | El marcador |
| `.t-titular` | `min(64px, 15vw)` / 0.98 | 800 | «Faltan 3», frases-respuesta |
| `.t-seccion` | 30px / 1.05 | 800 | Encabezados de bloque |
| `.t-cifra` | 22–56px | 800 | RP, estadísticas, siempre `tabular-nums` |
| cuerpo | 16px / 1.45 | 400 | Texto |
| `.t-meta` | 14px / 1.35 | 500 | Secundario |
| mínimo | 12px | — | Ejes del gráfico y poco más. Nada por debajo |

Encabezados en mayúscula inicial de frase. Sin cursivas, sin inclinar, sin biseles (son lo que convierte la condensada en casa de apuestas).

Nombres largos a tamaño de cartel: sin JS, con `style={{ "--chars": name.length }}` y `font-size: min(190px, calc((100vw - 32px) / (var(--chars) * 0.42)))`. Tiene que funcionar con «Cristian moreira s» y con «Lu».

## Forma

- **Radio 0 en todo.** Los campos se tocan con canto vivo. Lo único curvo: el círculo central, el balón, Panenka.
- **Avatares cuadrados**, como cromos. Con foto si la hay; si no, inicial en `surface` con tipografía display. Nunca en círculo ni con anillo de color.
- **Nada de tarjetas.** Se agrupa con espacio, reglas de 1px (`border`) y cambios de campo. Si algo necesita caja, es un campo entero, no un borde redondeado.
- **Iconos:** lucide, 18px, trazo 1.75, solo donde aporta. Nunca dentro de un cuadrado tintado.
- **Márgenes:** 16px a los lados en móvil. Los campos de color van a sangre.

## Marco nativo (móvil primero)

Es una PWA que se usa con el pulgar. Hay que aplicar la skill `mobile-native` entera:

- `viewport`: `width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content`. `theme-color` negro, y lo cambia `<Flood>` en pantallas de color.
- `html`: `-webkit-tap-highlight-color: transparent`, `-webkit-text-size-adjust: 100%`, `overscroll-behavior: none`. Scroll interno con `overscroll-behavior: contain`.
- Inputs a 16px. Controles con `touch-action: manipulation` y `user-select: none`, nunca en texto de contenido. `inputmode`, `autocapitalize`, `enterkeyhint` correctos.
- Alturas con `dvh`/`svh`. `env(safe-area-inset-*)` en barras, hojas y toasts.
- Objetivos táctiles de 44px como mínimo.
- `manifest.json`: `background_color` y `theme_color` negros. Iconos nuevos.

**Barra superior** (`Navbar`): estática, transparente, 48px + safe area, `z` sobre el contenido para que los campos de color pasen por debajo. Palabra «Pachanga» en display a la izquierda, campana a la derecha. No flota: se va con el scroll. En pantallas de detalle, a la izquierda una flecha de vuelta y el contexto.

**Barra inferior** (`BottomNav`): opaca, negra, regla superior de 1px, 56px + safe area. Solo texto en display, 21px, peso 600: **Inicio · Partidos · Panenka · Ranking · Perfil**. En el centro, en lugar de la palabra Panenka, la cara del balón a 36px sobre la regla, como un punto de saque (con `aria-label="Panenka"`). Activo: blanco con una regla de 2px arriba. Inactivo: `muted`. Sin icono, sin animación al cambiar. Jugadores se alcanza desde Ranking; Historial desde Partidos y Perfil.

No aparece a quien no ha entrado (`/login`, `/access`, legales sin sesión). En escritorio (`md+`) los mismos enlaces van arriba y el contenido es una columna centrada de hasta 640px; los campos de color ocupan la columna.

**El pie legal** deja de salir en cada pantalla: va en `/login`, en las legales y al final de Perfil. Comprobar `e2e/privacidad.spec.ts` y `e2e/a11y.spec.ts` antes de moverlo.

**Cerrar sesión** en Perfil (hoy en móvil no existe).

## Componentes nuevos

En `src/components/`:

- **`Peto`**: la marca. `estado: "lleno" | "debe" | "libre"`, `equipo: "rojo" | "azul" | null`, `tu?: boolean`, `size`. Lleno es sólido; debe es sólido con tarjeta amarilla pequeña pegada; libre es contorno discontinuo a tinta completa, y es lo más visible de la fila cuando faltan jugadores. `tu` añade un contorno doble.
- **`PetoFila`**: la fila de plazas (14 petos, o `max_players`). Reparte en dos filas si no caben. Lleva `role="img"` con `aria-label="11 de 14 plazas"`.
- **`Campo`**: el campo dibujado en líneas sobre negro, con petos y nombres. Sustituye al verde de `SoccerPitch`, que conserva sus datos y su tarjeta de jugador.
- **`Marcador`**: dos campos a sangre, rojo y azul, con la costura blanca al `golesRojo / total` (0-0 al 50 %, limitada a 28–72 % para que quepan las cifras). Panenka en el punto de saque, sobre la costura. Pasa por debajo de la barra superior.
- **`Flood`**: componente cliente sin DOM. Pone `data-flood` en `<html>` y cambia `theme-color` al montar; los restaura al desmontar.
- **`Panenka`**: el balón redibujado en SVG a partir de `public/panenka.png`, con el mismo carácter. `mood: "harto" | "dormido" | "contento"`, pelo en `currentColor` para que se vea en negro y en color. Parpadea y echa humo muy de vez en cuando; quieto con `prefers-reduced-motion`.
- **`PanenkaDice`**: Panenka pequeño + su frase + firma «Por Panenka, que lo vio todo» donde sea crónica.
- **`Hoja`**: hoja inferior sobre `Drawer` de `@base-ui/react`, arrastrable, con asa, safe area y radio 0. Sustituye a `Dialog` en móvil. `src/components/ui/Dialog.tsx` conserva su API y por dentro es esta hoja.
- **`Filas`**: lista de filas con regla, nombre, cifra alineada a la derecha.
- **Toasts:** `sonner` debajo del `useToast()` actual, sin tocar a quienes lo llaman. Abajo, por encima de la barra, con safe area, sin iconos de colores. Con `aria-live`, no `role="alert"`.

`Button`: rectangular. `primary` blanco con texto negro, 52px en acciones principales; `outline` contorno `foreground`; `ghost` texto; `danger` contorno `tarjeta`. Al pulsar: `scale(.98)` e inversión en 100ms.

## La voz y los titulares

Nuevo `src/lib/titulares.ts`, funciones puras y deterministas, con tests en `test/titulares.test.mjs`. Reciben datos y devuelven frases. Nada de `Math.random`: si hay variantes, se elige por hash del id del partido.

**Inicio** (`estadoPortada`):

| Estado | Respuesta | Acción |
| --- | --- | --- |
| Apuntado, sin equipos | «Juegas.» | «Me borro» + «Si te vas, faltan N» |
| Apuntado, con equipos | «De rojo.» / «De azul.», pantalla entera de ese color | Ver equipos |
| Sin apuntar, hay plazas | «¿Juegas?» | «Me apunto» primario |
| Lleno, sin apuntar | «Sin plaza.» | Ver quién va |
| Hoy | «Hoy, 20:00.» | Según estado |
| Sin partido | «No hay pachanga.» | «Montar partido» |

Debajo: día, hora, sitio; «Faltan 3» más grande que todo lo que sigue; la fila de petos; «Sin decir nada: Manolín, Javi…» en blanco, porque es a lo que se viene (jugadores con partidos esta temporada que no se han apuntado); una banda pequeña con el último resultado y la frase de Panenka. La banda nunca puede gritar más que «Faltan 3».

**Crónica** (`titularCronica`): el hecho más raro del partido por reglas, de más a menos raro: marcó todo un equipo («Marcaron los siete del Azul»), portero goleador, hat-trick en derrota («Hugo metió cuatro y perdió igual»), remontada no hay datos, goleada, empate, por la mínima, y genérico. Máximo 32 caracteres cuando se pueda.

**Ranking** (`titularRanking`): «Segundo, a 47 de Iván.», «Líder, 33 por delante de Pelayo.», «Último. Alguien tiene que serlo.», «Aún no cuentas. Te faltan 2 partidos.». Ordinales en palabra hasta décimo.

**Jugador** (`titularJugador`): «Nueve goles y ni un MVP», «Invicto en seis partidos», «Doce partidos sin marcar».

**Voz de Panenka:** seca, resignada, de amigo que se levanta tarde. Se mete con el fútbol de la gente, nunca con la persona ni su físico. Sin tacos fuertes. Nada de exclamaciones ni de «¡Vamos!». Nunca menciona fumar. Ejemplos: «Tres seguidas del Azul. El Rojo, ni está ni se le espera.», «Pichichi, un defensa. Segundo, un portero. Así estamos.», «0 MVPs. Insiste.».

**Vocabulario:** apuntarse, me borro, faltan, plazas, peto, el Rojo, el Azul, Titulares, Banquillo, Pichichi. Los estados, en español: Abierto, Cerrado, Terminado, Cancelado. «Equipo Rojo» es siempre rojo.

**Vacíos y errores:** el marco se queda y la frase es la respuesta. Errores dentro del bloque que falló, una frase y «Reintentar», con `tarjeta` solo en un icono. Cargas: el layout final con barras planas `surface` del tamaño real, sin brillo, sin saltos.

## Pantallas

Cada una responde primero a su pregunta. La referencia es el mockup; donde el mockup no llega, manda esto.

### Inicio — ¿Juego?
Lo de arriba. Si hay equipos, `<Flood>` y la pantalla entera es del peto, con compañeros y rivales. Unirse y borrarse usan `joinMatch`/`leaveMatch` tal cual, con las mismas reglas de quién puede salir que el detalle. Arreglar el `.maybeSingle()` que dice que no hay partidos cuando hay dos (`.limit(1)`).

### Partidos — ¿Qué hay y qué pasó?
Próximos (primero el más cercano), con fecha grande, plazas como petos pequeños y tu estado. Terminados con mini marcador en dos colores. `Nuevo` arriba a la derecha. Enlace a Historial.

### Partido abierto — ¿Quién va?
Día y hora como titular, «Faltan 3» enorme, el campo con petos (o la fila, si no hay equipos), leyenda «8 han pagado · 3 deben · 3 libres» con las mismas marcas. Barra fija sobre la inferior con la acción principal: «Me apunto» / «Me borro» / «Buscar 3 por WhatsApp». Todo lo del organizador (generar equipos, poner resultado, cambiar fecha, cobros, cancelar) va en una `Hoja` tras un botón «Organizar», no como muro de botones. Cobros es una lista en esa hoja, que funciona también con equipos hechos.

### Partido terminado — ¿Quién ganó?
`Marcador` como héroe, titular de crónica encima, goleadores en sus dos columnas con cifras (hoy los goles del partido no se ven en ningún sitio), frase de Panenka firmada, votación MVP con baldosas de un toque en el color del equipo y plazo real («Cierra hoy, 20:15»). Fotos y Chat como enlaces a sus pestañas.

### Chat y Fotos
Pestañas del partido. Chat a pantalla completa con la barra de escribir pegada al teclado. Fotos en rejilla a sangre, sin tarjetas. Autor y hora siempre visibles al abrir la foto, no solo con hover.

### Ranking — ¿Cómo voy?
Sobre negro (el héroe blanco del mockup queda fuera). Titular con tu posición, luego la tabla: Titulares (los siete primeros) y Banquillo. Tu fila invertida, «Pelayo, tú». Pestañas RP / Pichichi / MVP / Partidos / Victorias. Nada de podio. Enlace a todos los jugadores.

### Jugador — ¿Quién es este?
Su nombre a tamaño cartel. Si tiene peto en el próximo partido con equipos, `<Flood>` y la página arriba es de ese color: «El martes va de azul». Titular de `titularJugador`. Gráfico RP en SVG propio, sin recharts: línea recta de 2px, sin relleno, referencia «1000, salida», pico etiquetado. Tira de forma alineada bajo los puntos, con V/E/D, delta y fecha. Goles, MVPs, trofeos, «Historial vs ti». Se elimina el valor de mercado mientras Fantasy esté en pausa.

### Perfil — Yo
Avatar cuadrado grande, apodo, posición como selector de cuatro opciones. Datos y privacidad más abajo. Cerrar sesión. Pie legal al final.

### Panenka — Pregúntale
Chat a pantalla completa, la cara grande en vacío, sugerencias como filas de texto. La barra de escribir pegada abajo. Burbujas sin caja: lo suyo a sangre, lo tuyo alineado a la derecha sobre `surface`.

### Login y Acceso — Aún no entras
Sin barra inferior. Pantalla negra, «Pachanga» grande, Panenka con cara de portero de discoteca. `/access`: «Acceso privado» (locked por test) y el código.

### Notificaciones
`Hoja` desde la campana, no un desplegable. Filas con regla.

## Movimiento

Tokens en `globals.css`:

```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
```

- **Pulsar:** inmediato, 100ms, `scale(.98)` e inversión. En `:active`.
- **Cambiar de pestaña:** sin animación. Se hace decenas de veces.
- **Empujar a un detalle:** View Transition muy corta si sale limpia (`experimental.viewTransition`), 200ms, opacidad y 12px. Si da problemas con `cacheComponents`, fuera sin culpa.
- **El color llega una vez y rápido:** los campos se abren desde la costura con `clip-path` en 220ms `--ease-out`. Nada más entra.
- **Apuntarse:** el peto libre se llena en su sitio, 160ms, y la respuesta cambia en el mismo instante.
- **Hojas:** las de Base UI, curva `--ease-drawer`.
- Nada de entradas escalonadas en pantallas que se abren a diario. `prefers-reduced-motion`: sin desplazamientos, se quedan opacidad y color.

## Dependencias

Se añaden `sonner` y `@base-ui/react`. Se quita `recharts` si nada más la usa tras el rediseño. Nada de `motion` salvo que haga falta de verdad.

## Fuera de alcance

- Server Actions, RLS, migraciones, algoritmo ELO, balanceo. Solo se tocan lecturas para pintar (`.limit(1)`, añadir un campo a un `select`) y filtrar lo que ya existe.
- `src/app/fantasy/**`: sigue en pausa y sin retocar. Solo tiene que compilar.
- `public/sw.js`: no está registrado. Se deja igual y se avisa.
- Textos legales: el contenido no se toca. Solo su presentación.

## Arreglos que entran

Los fallos de presentación del inventario (`inventory/*.md`) se arreglan al reescribir cada pantalla: textos en inglés, anidar `<a><button>`, `aria-*`, botones sin nombre, spinners colgados, hidratación del enlace de WhatsApp, etc.

Además:

- **XSS guardado en JSON-LD** (`matches/[id]/page.tsx`, `players/[id]/page.tsx`): escapar `<` como `<`.
- **Manifest:** excluir `.json` y `sw.js` del matcher del middleware, o la instalación como PWA falla para invitados.
- **Cerrar sesión en móvil.**
- **Doble campana** montada dos veces con el mismo canal: una sola.

## Tests

- Los textos «locked» de cada inventario se mantienen salvo los cambios deliberados: `Unirse` → `Me apunto`, `Salir` → `Me borro`, y los que cada pantalla justifique. Si cambia un texto, se cambia su test en el mismo paso.
- `test/titulares.test.mjs` cubre cada regla, con nombres largos y plurales.
- Al terminar: `npm run lint`, `npm run build`, `npm run test:unit`, Playwright en chromium y móvil, comparados con la línea base de antes de empezar.

## Lo que queda para el dispositivo real

Tacto, safe areas y teclado no se pueden verificar en emulación. Se comprueba lo que se puede con WebKit y Chromium móvil y se dice qué falta.
