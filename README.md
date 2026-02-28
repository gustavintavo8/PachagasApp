<div align="center">

# ⚽ Pachanga

**La app definitiva para organizar tus pachangas de fútbol.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database%20%26%20Auth-3fcf8e?logo=supabase)](https://supabase.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)](https://typescriptlang.org/)
[![Playwright](https://img.shields.io/badge/Playwright-E2E%20Tests-45ba4b?logo=playwright)](https://playwright.dev/)
[![PWA](https://img.shields.io/badge/PWA-Installable-5a0fc8?logo=pwa)](https://web.dev/progressive-web-apps/)

[Demo](#-demo) · [Características](#-características) · [Tech Stack](#️-tech-stack) · [Instalación](#-instalación) · [Variables de Entorno](#-variables-de-entorno) · [Deploy](#-deploy)

</div>

---

## 📸 Demo

> Lanza `npm run dev` y accede a `http://localhost:3000` para explorar la app.

---

## ✨ Características

### Core
| Feature | Descripción |
|---------|-------------|
| 🔐 **Autenticación** | Email/contraseña + Google OAuth via Supabase Auth |
| 👤 **Perfiles** | Avatar, posición, nivel de habilidad, estadísticas |
| ⚽ **Gestión de Partidos** | Crear, unirse, abandonar, cerrar y finalizar partidos |
| ⚖️ **Generador de Equipos** | Algoritmo de balanceo por nivel de habilidad |
| 🏟️ **Cancha Visual** | Representación visual del campo con posiciones de jugadores |
| 📊 **Resultado y Goleadores** | Registro de marcador y goles individuales |

### Social
| Feature | Descripción |
|---------|-------------|
| 💬 **Chat por Partido** | Mensajería en tiempo real con Supabase Realtime |
| 📷 **Fotos Post-Partido** | Galería con upload a Supabase Storage + lightbox |
| ⭐ **Valoraciones** | Puntúa a otros jugadores (puntualidad, deportividad, nivel) |
| 🔔 **Notificaciones** | Alertas en tiempo real: uniones, equipos, resultados |
| 📤 **Compartir Partido** | Enlace directo, WhatsApp y Telegram |

### Analytics & Discovery
| Feature | Descripción |
|---------|-------------|
| 📈 **Gráficas de Jugador** | Goles/mes (barras) + evolución de winrate (área) |
| 🏆 **Ranking Global** | Tabla de clasificación por partidos, goles y MVPs |
| 📅 **Calendario** | Vista mensual con indicadores de estado por color |
| 📜 **Historial** | Todos tus partidos con resultado, W/D/L y goles |
| 👥 **Directorio de Jugadores** | Browse de todos los usuarios con stats y perfil |

### Plataforma
| Feature | Descripción |
|---------|-------------|
| 📱 **PWA** | Instalable como app nativa (manifest + service worker) |
| 🌙 **Dark Mode** | Tema oscuro premium con acentos verde neón `#ccff00` |
| 🛡️ **Rate Limiting** | Protección contra spam en acciones críticas |
| 🧪 **E2E Tests** | Suite de Playwright con 10 tests automatizados |

---

## 🛠️ Tech Stack

```
Frontend       Next.js 16 (App Router) + React 19 + TypeScript
Styling        Vanilla CSS (design tokens + utilidades propias)
Database       Supabase (PostgreSQL) + Row Level Security
Auth           Supabase Auth (Email + Google OAuth)
Storage        Supabase Storage (avatars + match photos)
Realtime       Supabase Realtime (chat + notificaciones)
Charts         Recharts 3
Icons          Lucide React
Testing        Playwright (Chromium)
Deploy         Vercel (recomendado)
```

---

## 🚀 Instalación

### Prerrequisitos

- **Node.js** ≥ 18
- **npm** ≥ 9
- Una cuenta de [Supabase](https://supabase.com/) (free tier funciona)

### Setup

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-usuario/pachanga-app.git
cd pachanga-app

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env.local
# Edita .env.local con tus credenciales de Supabase

# 4. Lanzar en modo desarrollo
npm run dev
```

### Tablas necesarias en Supabase

Crea las siguientes tablas en tu Supabase Dashboard o via SQL Editor:

| Tabla | Columnas clave |
|-------|---------------|
| `profiles` | id, username, avatar_url, position, skill_level, matches_played, goals_scored |
| `matches` | id, date, location, max_players, status, team_a_score, team_b_score, created_by |
| `match_participants` | id, match_id, user_id, team, goals, is_mvp |
| `match_comments` | id, match_id, user_id, content, created_at |
| `match_photos` | id, match_id, user_id, photo_url, created_at |
| `notifications` | id, user_id, type, title, message, match_id, read, created_at |
| `player_ratings` | id, match_id, rater_id, rated_id, punctuality, sportsmanship, skill, created_at |

> **Storage bucket:** `match_photos` (público)
> **Realtime:** Habilitar replicación para `notifications` y `match_comments`

---

## 🔑 Variables de Entorno

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

| Variable | Descripción |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL de tu proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anónima pública |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio (solo server-side, para admin ops) |

---

## 🧪 Tests

```bash
# Instalar navegadores de Playwright (solo la primera vez)
npx playwright install chromium

# Ejecutar todos los tests
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
│   ├── auth/callback/      # OAuth callback handler
│   ├── calendar/            # Vista de calendario
│   ├── history/             # Historial (legacy, integrado en /matches)
│   ├── leaderboard/         # Ranking global
│   ├── login/               # Autenticación
│   ├── matches/             # Partidos (activos + historial)
│   │   └── [id]/            # Detalle de partido (chat, fotos, rating)
│   ├── players/             # Directorio de jugadores
│   │   └── [id]/            # Perfil de jugador (stats, charts, ratings)
│   └── profile/             # Perfil propio
├── components/
│   ├── ui/                  # Componentes base (Button, Card, Avatar, Dialog)
│   ├── MatchChat.tsx        # Chat en tiempo real
│   ├── MatchPhotos.tsx      # Galería de fotos
│   ├── NavbarClient.tsx     # Barra de navegación
│   ├── NotificationBell.tsx # Campana de notificaciones
│   ├── PlayerCharts.tsx     # Gráficas de rendimiento
│   └── PlayerRating.tsx     # Sistema de valoraciones
├── lib/
│   ├── supabase/            # Clientes Supabase (server, client, admin)
│   ├── rate-limit.ts        # Rate limiter (token bucket)
│   ├── team-balancer.ts     # Algoritmo de balanceo de equipos
│   └── utils.ts             # Utilidades compartidas
└── middleware.ts             # Auth middleware
```

---

## 📄 Licencia

MIT © Pachanga

---

<div align="center">
  <sub>Built with ☕ and ⚽ for futboleros everywhere.</sub>
</div>
