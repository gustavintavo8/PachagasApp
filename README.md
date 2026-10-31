<div align="center">

<img src="public/banner.png" alt="Pachanga: la palabra sobre un campo rojo y otro azul, con Panenka, el balón cansado, como punto final" width="100%">

**Plataforma full-stack para organizar partidos de fútbol con equipos balanceados por ELO, chat en tiempo real, estadísticas de jugadores y PWA instalable.**

> **[→ Ver demo en vivo](https://pachagas-app.vercel.app)**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database%20%26%20Auth-3fcf8e?logo=supabase)](https://supabase.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)](https://typescriptlang.org/)
[![Playwright](https://img.shields.io/badge/Playwright-70%20E2E%20tests-45ba4b?logo=playwright)](https://playwright.dev/)
[![PWA](https://img.shields.io/badge/PWA-Installable-5a0fc8?logo=pwa)](https://web.dev/progressive-web-apps/)

[Demo](#-demo) · [Flujos](#-flujos) · [Diseño](#-diseño) · [Highlights](#-highlights-técnicos) · [Características](#-características) · [Tech Stack](#️-tech-stack) · [Decisiones Técnicas](#-decisiones-técnicas) · [Instalación](#-instalación) · [Deploy](#-deploy)

</div>

---

## 📸 Demo

> 👥 **31 jugadores registrados** · ⚽ **101 goles marcados** · 🏟️ **9 partidos organizados** — datos reales de producción.

> Lanza `npm run dev` y accede a `http://localhost:3000` para explorar la app.

Capturas de la app real a tamaño móvil, con datos ficticios.

<table>
  <tr>
    <td align="center" width="33%">
      <img src="docs/capturas/juegas-respuesta.webp" alt="Inicio responde Juegas, con las plazas que faltan" width="240"><br>
      <sub><b>Inicio: ¿juegas?</b></sub>
    </td>
    <td align="center" width="33%">
      <img src="docs/capturas/de-azul.webp" alt="Inicio a pantalla completa de color azul el día que hay equipos" width="240"><br>
      <sub><b>La casa de tu peto</b></sub>
    </td>
    <td align="center" width="33%">
      <img src="docs/capturas/partido-abierto.webp" alt="Partido abierto con el campo, los petos y quién ha pagado" width="240"><br>
      <sub><b>Partido abierto</b></sub>
    </td>
  </tr>
  <tr>
    <td align="center" width="33%">
      <img src="docs/capturas/partido-terminado.webp" alt="Partido terminado con el marcador partido en rojo y azul y la votación del MVP" width="240"><br>
      <sub><b>Crónica y MVP</b></sub>
    </td>
    <td align="center" width="33%">
      <img src="docs/capturas/ranking.webp" alt="Ranking con tu puesto en una frase y la tabla de Titulares" width="240"><br>
      <sub><b>Ranking</b></sub>
    </td>
    <td align="center" width="33%">
      <img src="docs/capturas/ficha-peto.webp" alt="Ficha de un jugador teñida del color de su peto, con su RP y su forma" width="240"><br>
      <sub><b>Ficha de jugador</b></sub>
    </td>
  </tr>
</table>

---

## 🧭 Flujos

Cada flecha dice qué haces para pasar a la siguiente pantalla.

![Flujo de apuntarse: la portada pregunta si juegas, te apuntas, salen los equipos y la pantalla se vuelve de tu color](docs/capturas/flujo-apuntarse.webp)

![Flujo de organizar: montar partido, hoja Organizar, generar equipos y cobrar](docs/capturas/flujo-organizar.webp)

![Flujo de resultado: poner marcador y goleadores, crónica del partido y voto del MVP](docs/capturas/flujo-resultado.webp)

<details>
<summary><b>Ver el resto de flujos</b>: ranking, Panenka, fotos y chat, entrar y perfil</summary>

![Flujo de ranking: tu puesto, las cinco clasificaciones, la lista de jugadores y una ficha](docs/capturas/flujo-ranking.webp)

![Flujo de Panenka y los avisos: preguntar a Panenka, su respuesta, la hoja de avisos y el partido](docs/capturas/flujo-panenka.webp)

![Flujo de fotos y chat: rejilla de fotos, visor y chat del partido](docs/capturas/flujo-fotos-chat.webp)

![Flujo de entrada: login, error de contraseña, acceso privado y código inválido](docs/capturas/flujo-entrar.webp)

![Flujo de perfil: perfil, edición, tus datos y confirmación para borrar la cuenta](docs/capturas/flujo-perfil.webp)

La respuesta de Panenka de estas capturas es de ejemplo, y las fotos son imágenes de muestra.

</details>

---

## 🔦 Diseño

> En Pachanga, la app es el campo de noche: negro hasta que hay partido, y entonces los petos inundan la pantalla.

- **Rojo y azul solo significan equipo.** El amarillo es la tarjeta: deudas, avisos y errores.
- **El peto es la unidad de todo.** Cuenta plazas, marca quién ha pagado y, cuando salen los equipos, tiñe tu pantalla.
- **La respuesta es lo más grande de cada pantalla**, escrita en una frase: «Juegas.», «Faltan 3», «15.º, a 1 de Tinín.». `src/lib/titulares.ts` las calcula a partir de los datos, sin IA.
- **Panenka lo vio todo.** Firma las crónicas y pone la voz seca de la app.
- **Hecha para el pulgar.** Hojas que se arrastran, respuesta inmediata al pulsar, safe areas e inputs que no hacen zoom.

Especificación completa en [docs/superpowers/specs/2026-10-31-rediseno-focos-design.md](docs/superpowers/specs/2026-10-31-rediseno-focos-design.md).

---

## ⚡ Highlights técnicos

- **ELO + balanceo en 3 fases** — Draft posicional → igualación de tamaño → swap-optimisation iterativo. Converge en óptimo local en 2-3 pasadas.
- **Server Components + Server Actions** — Las páginas de lectura pesada (perfil, ranking) no envían JS al cliente. Solo se hidratan los componentes interactivos (chat, notificaciones, votación). Las gráficas son SVG renderizado en servidor.
- **Realtime sobre CDC de PostgreSQL** — Chat y notificaciones via Supabase Realtime, sin polling. La misma conexión que la base de datos.
- **RLS como capa de autorización** — Todas las reglas de acceso viven en PostgreSQL como políticas declarativas, no en la capa de aplicación.
- **Rate limiting por token bucket** — Protección contra spam en server actions críticos implementada desde cero, sin librerías externas.
- **PWA instalable** — Con manifest, se añade a la pantalla de inicio en Android/iOS y se abre como una app.

---

## ✨ Características

### Core

| Feature | Descripción |
|---------|-------------|
| 🔐 **Autenticación** | Email/contraseña + Google OAuth via Supabase Auth |
| 🔒 **Acceso privado** | Cada cuenta entra con el código de la comunidad, una sola vez |
| 🗓️ **Temporadas** | Estadísticas separadas por temporada, con el histórico consultable |
| 👤 **Perfiles** | Avatar, apodo, posición y tu temporada |
| <img src="public/icon-192.png" width="20" alt="Pachanga Icon"> **Gestión de Partidos** | Montar, apuntarse, borrarse, cambiar la fecha, cancelar y repetir partidos |
| ⚖️ **Generador de Equipos** | Equipos rojo y azul equilibrados por RP y posición |
| 🏟️ **Campo** | Campo dibujado con petos, nombres y quién ha pagado |
| 💶 **Cobros** | El organizador marca quién ha pagado, con o sin equipos |
| 📊 **Resultado y Goleadores** | Marcador, goles de cada jugador y crónica del partido |

### Social

| Feature | Descripción |
|---------|-------------|
| 💬 **Chat por Partido** | Mensajería en tiempo real con Supabase Realtime |
| 📷 **Fotos Post-Partido** | Galería con upload a Supabase Storage + lightbox |
| 🏅 **Votación MVP** | Baldosas de un toque en el color del equipo, con plazo y resultado |
| 🔔 **Notificaciones** | Alertas en tiempo real: apuntados, equipos, resultados, cambios de fecha, cancelaciones y MVP |
| 📤 **Compartir Partido** | Enlace directo y WhatsApp |
| 📅 **Añadir al calendario** | Google Calendar, Outlook o archivo `.ics` |

### AI Assistant

| Feature | Descripción |
|---------|-------------|
| 🤖 **Panenka** | Asistente conversacional con acceso a datos reales de la app |
| 📊 **Consultas sobre el juego** | Ranking, goleadores, estadísticas propias, historial y comparativas entre jugadores |
| 📈 **Análisis temporal** | Calcula ritmo de goles por mes, progresión y tendencias desde el historial real |
| 💬 **Markdown enriquecido** | Respuestas con tablas, negrita y listas renderizadas en el chat |
| ⚡ **~1.400 tokens/petición** | Eficiencia alta gracias al modelo y schemas compactos |

### Analytics & Discovery

| Feature | Descripción |
|---------|-------------|
| 📈 **Ficha de Jugador** | Evolución de RP, forma reciente, goles, MVPs e historial contra ti |
| 🏆 **Ranking** | RP, Pichichi, MVP, Partidos y Victorias, con Titulares y Banquillo |
| 📜 **Historial** | Tus partidos por temporada, con resultado y goles |
| 👥 **Jugadores** | Lista con búsqueda y filtro por posición |

### Plataforma

| Feature | Descripción |
|---------|-------------|
| 📱 **PWA** | Instalable en el móvil con manifest. `public/sw.js` existe, pero no está registrado |
| 🔦 **Diseño Focos** | Negro de campo de noche; los petos rojo y azul inundan la pantalla cuando hay equipos o resultado |
| 🛡️ **Rate Limiting** | Protección contra spam en acciones críticas |
| 🧪 **E2E Tests** | 70 tests de Playwright, con comprobaciones de accesibilidad (axe-core). Los marcados `@smoke` y `@mobile` se repiten en Pixel 5 y iPhone 13 |

---

## 🛠️ Tech Stack

```
Frontend       Next.js 16 (App Router) + React 19 + TypeScript
Styling        Tailwind CSS 4 (via @tailwindcss/postcss)
Database       Supabase (PostgreSQL) + Row Level Security
Auth           Supabase Auth (Email + Google OAuth)
Storage        Supabase Storage (avatars + match photos)
Realtime       Supabase Realtime (chat + notificaciones)
AI             Vercel AI SDK v6 · @ai-sdk/groq · openai/gpt-oss-20b
UI             Base UI (hojas inferiores) · Sonner (avisos) · Lucide React
Charts         SVG propio renderizado en servidor
Testing        Playwright (Chromium, Pixel 5, iPhone 13) + axe-core
Deploy         Vercel (recomendado)
```

---

## 🚀 Instalación

### Prerrequisitos

- **Node.js** ≥ 20.9
- **npm** ≥ 9
- Una cuenta de [Supabase](https://supabase.com/) (free tier funciona)

### Setup

```bash
# 1. Clonar el repositorio
git clone https://github.com/gustavintavo8/PachagasApp
cd PachagasApp

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
# Crea .env.local con las variables de la sección "Variables de Entorno"

# 4. Lanzar en modo desarrollo
npm run dev
```

### Tablas necesarias en Supabase

Crea las siguientes tablas en tu Supabase Dashboard o via SQL Editor:

| Tabla | Columnas clave |
|-------|---------------|
| `profiles` | id, username, avatar_url, position, skill_level (identidad; conserva columnas legacy durante la transición) |
| `seasons` | id, name, slug, status, starts_at, ends_at |
| `season_player_stats` | season_id, user_id, elo_rating, matches_played, goals_scored, wins, draws, losses, mvps |
| `community_access_grants` | user_id, granted_at, revoked_at |
| `matches` | id, date, location, max_players, status, team_a_score, team_b_score, created_by |
| `match_participants` | match_id, user_id, team, goals, is_mvp, has_paid |
| `match_comments` | id, match_id, user_id, content, created_at |
| `match_photos` | id, match_id, user_id, photo_url, created_at |
| `mvp_votes` | id, match_id, voter_id, voted_for, created_at |
| `rp_history` | id, user_id, match_id, season_id, rp_change, new_rp, created_at |
| `notifications` | id, user_id, type, title, message, match_id, read, created_at |
| `rate_limits` | key, tokens, last_refill |

> **Storage buckets:** `avatars` y `match_photos` (públicos). Las migraciones no los crean: hay que crearlos a mano.
> **Realtime:** Habilitar replicación para `notifications`, `mvp_votes` y `match_comments`

`profiles` almacena la identidad y los datos básicos del jugador. Los contadores competitivos son estacionales y su fuente principal es `season_player_stats`; las columnas legacy de `profiles` se conservan durante la transición. El acceso a la comunidad es privado: una cuenta autenticada sin un grant activo debe canjear `PACHANGA_ACCESS_CODE` en `/access`. El código se configura únicamente en el entorno server-side y nunca debe publicarse ni commitearse. Fantasy permanece desactivado aunque sus tablas se conserven para una futura reactivación.

> **Operaciones:** consulta el [runbook de rollout de Temporada 2 y acceso privado](docs/operations/2026-08-31-season-2-rollout.md) antes de aplicar cambios en Supabase o Vercel.

---

## 🔑 Variables de Entorno

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GROQ_API_KEY=gsk_...
PACHANGA_ACCESS_CODE=elige-un-codigo
```

| Variable | Descripción |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL de tu proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anónima pública |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio (solo server-side, para admin ops) |
| `GROQ_API_KEY` | API key de [GroqCloud](https://console.groq.com/) para el asistente Panenka |
| `PACHANGA_ACCESS_CODE` | Código de la comunidad (solo server-side). Nunca lo publiques |

---

## 🧪 Tests

Los E2E corren contra Supabase local, con las credenciales en `.env.test.local`. La configuración aborta si la URL no es local.

```bash
# Tests unitarios (titulares, calendario, contratos)
npm run test:unit

# Instalar navegadores de Playwright (solo la primera vez; WebKit es para el perfil de iPhone 13)
npx playwright install chromium webkit

# Ejecutar todos los tests E2E
npx playwright test

# Ver el reporte HTML
npx playwright show-report
```

---

## 🚢 Deploy

### Vercel (recomendado)

1. Conecta tu repositorio en [Vercel](https://vercel.com/)
2. Añade las variables de entorno en Settings → Environment Variables
3. Deploy automático en cada push a `main`

### Otros

```bash
# Build de producción
npm run build

# Lanzar servidor de producción
npm start
```

---

## 📂 Estructura del Proyecto

```
src/
├── app/
│   ├── access/              # Código de acceso a la comunidad
│   ├── api/asistente/       # API route del asistente Panenka (streamText)
│   ├── asistente/           # Chat con Panenka (UI)
│   ├── auth/callback/       # OAuth callback handler
│   ├── fantasy/             # Fantasy (desactivado: sus rutas devuelven 404)
│   ├── history/             # Historial de partidos
│   ├── leaderboard/         # Ranking global
│   ├── login/               # Autenticación
│   ├── matches/             # Partidos (próximos + terminados)
│   │   └── [id]/            # Detalle de partido y hojas del organizador
│   ├── players/             # Lista de jugadores
│   │   └── [id]/            # Ficha de jugador (RP, forma, historial)
│   └── profile/             # Perfil propio
├── components/
│   ├── ui/                  # Componentes base (Button, Avatar, Dialog, Toast)
│   ├── BottomNav.tsx        # Barra inferior con Panenka en el centro
│   ├── Campo.tsx            # Campo dibujado con petos
│   ├── Flood.tsx            # Pantalla del color del peto
│   ├── Hoja.tsx             # Hoja inferior arrastrable
│   ├── Marcador.tsx         # Marcador con la costura según el resultado
│   ├── MatchChat.tsx        # Chat del partido
│   ├── MatchPhotos.tsx      # Galería de fotos
│   ├── MvpVoting.tsx        # Votación del MVP
│   ├── NotificationBell.tsx # Campana y hoja de avisos
│   ├── Panenka.tsx          # La mascota en SVG, con estados de ánimo
│   ├── Peto.tsx             # La marca de peto y la fila de plazas
│   └── PlayerCharts.tsx     # Gráfica de RP y tira de forma
├── lib/
│   ├── ai/                  # Herramientas del asistente (tools.ts)
│   ├── supabase/            # Clientes Supabase (server, client, admin)
│   ├── access.ts            # Código de acceso a la comunidad
│   ├── elo.ts               # Lógica de cálculo ELO
│   ├── rate-limit.ts        # Rate limiter (token bucket)
│   ├── seasons.ts           # Temporadas
│   ├── team-balancer.ts     # Algoritmo de balanceo de equipos
│   ├── titulares.ts         # Las frases de cada pantalla y la voz de Panenka
│   └── utils.ts             # Utilidades compartidas
└── middleware.ts             # Auth middleware
```

---

## 🧠 Decisiones Técnicas

### Por qué Supabase en vez de Firebase

Firebase fue descartado por dos razones concretas: su modelo de datos (documentos anidados en Firestore) no encaja bien con relaciones muchos-a-muchos como `match_participants` o `mvp_votes`, donde las queries relacionales son frecuentes. Supabase ofrece PostgreSQL real — se pueden hacer JOINs, agregaciones y Row Level Security con políticas declarativas en SQL, sin necesidad de duplicar datos ni mantener contadores manualmente. El Realtime de Supabase (basado en CDC de PostgreSQL) cubre el chat y las notificaciones con un modelo pub/sub sencillo desde el mismo cliente.

### Por qué Next.js App Router

El App Router permite mezclar Server Components y Client Components en el mismo árbol. Las páginas de perfil, ranking y detalle de partido son mayoritariamente lecturas: se renderizan en servidor (sin JavaScript en cliente, sin spinner de carga), y solo los componentes interactivos — chat, campana de notificaciones, votación — se hidratan como Client Components. Esto da tiempos de carga percibidos bajos sin sacrificar interactividad. Los Server Actions eliminan la necesidad de una API REST propia para las mutaciones.

### Algoritmo de balanceo de equipos

El balanceo se resuelve en tres fases sobre los ratings ELO de cada jugador:

**Fase 1 — Draft posicional:** Los jugadores se agrupan por posición (GK → DEF → MID → FWD) y dentro de cada grupo se ordenan por ELO descendente. Se asignan en zigzag al equipo con menos jugadores en esa posición; en caso de empate, al equipo con menor ELO promedio. Así se garantiza paridad posicional antes de optimizar.

**Fase 2 — Igualación de tamaño:** Si los equipos quedan desiguales en número (partidos con número impar de jugadores), se mueve el jugador cuyo traspaso minimiza la diferencia de ELO promedio resultante — no simplemente el último de la lista.

**Fase 3 — Optimización por intercambio:** Se prueban todos los pares A↔B posibles; si un intercambio reduce la diferencia de ELO promedio en más de 0.5 puntos, se confirma y se reinicia el paso. El algoritmo converge en 2-3 iteraciones hacia un óptimo local. El umbral de 0.5 evita micro-swaps infinitos por ruido de punto flotante.

El resultado es equipos con diferencia de ELO promedio cercana a cero, respetando la distribución posicional del partido.

---

### Asistente Panenka — arquitectura y decisiones de modelo

Panenka es un asistente conversacional integrado en la app que responde preguntas sobre jugadores, partidos y estadísticas estacionales consultando la base de datos en tiempo real. La implementación usa **Vercel AI SDK v6** con un sistema de herramientas (_tool use_ / function calling) que permite al modelo razonar sobre cuándo y qué datos consultar.

**Elección de proveedor y modelo — `openai/gpt-oss-20b` vía Groq**

El proceso de selección pasó por varias iteraciones:

- **Google Gemini** (inicial): descartado por cuotas de RPM extremadamente bajas en el free tier y errores frecuentes de "high demand" con los modelos 2.5.
- **Groq + Llama 3.3 70B**: mejor disponibilidad, pero el modelo generaba JSON inválido en los tool calls de forma impredecible (`Failed to call a function`), lo que hacía el asistente poco fiable.
- **Groq + Llama 3.1 8B Instant**: más rápido y con mayor TPM en free tier, pero demasiado pequeño para function calling consistente — inventaba respuestas sin llamar a las herramientas.
- **Groq + `openai/gpt-oss-20b`** ✅: arquitectura OpenAI con function calling fiable, corriendo en hardware Groq a ~1.000 t/s. Consume ~1.400 tokens por petición (frente a los 7.000 del 70B), con 250.000 TPM en Developer Plan.

**`jsonSchema()` en lugar de `zodSchema()`**

Zod v4 convierte los campos `.optional()` en `anyOf: [{type: "X"}, {type: "null"}]` al generar el JSON Schema. Groq no soporta este patrón en function calling y devuelve error. La solución fue reemplazar `zodSchema()` por `jsonSchema()` de `"ai"` con schemas manuales explícitos donde los campos opcionales simplemente no aparecen en el array `required`, sin unions con null.

**Herramientas de consulta disponibles**

| Tool | Descripción |
|------|-------------|
| `get_my_stats` | ELO, goles, partidos y posición en el ranking del usuario autenticado |
| `get_my_matches` | Historial de partidos con fecha, goles y MVP — para análisis temporal |
| `get_player_detail` | Perfil y ranking de cualquier jugador (búsqueda por username con wildcards) |
| `get_players` | Lista de jugadores con filtros de posición y rango ELO |
| `get_matches` | Partidos con filtros de estado y rango de fechas |
| `get_match_detail` | Resultado, participantes, goles y MVP de un partido concreto |
| `get_leaderboard` | Ranking ELO global (mínimo 3 partidos) |
| `get_top_scorers` | Ranking de máximos goleadores |
| `get_players_history_together` | Partidos en los que dos jugadores han coincidido |

**Rendering de respuestas**

Las respuestas del modelo se renderizan como Markdown mediante `react-markdown` + `remark-gfm`, lo que permite tablas comparativas, texto en negrita y listas estructuradas directamente en el chat.

---

## 📄 Licencia

MIT © Pachanga

---

<div align="center">
  <sub>Built with ☕ and <img src="public/icon-192.png" width="16" alt="Pachanga Icon"> for futboleros everywhere.</sub>
</div>
