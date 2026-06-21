# Registro de Actividades de Tratamiento (RAT) — Pachanga (simplificado, art. 30 RGPD)

- **Responsable:** ver `src/lib/legal.ts` (`LEGAL_CONTROLLER_NAME` / `LEGAL_CONTACT_EMAIL`). Persona física, sin DPO (ver `etica.md` y `nota-riesgo-fotos.md` para la justificación de esa decisión).
- **Última revisión:** 2026-06-20 (versión de política asociada: `PRIVACY_POLICY_VERSION` en `src/lib/legal.ts`).
- **Ámbito:** aplicación web Pachanga (Next.js + Supabase) para organizar partidos de fútbol entre amigos.

| Tratamiento | Finalidad | Base jurídica | Categorías de datos | Destinatarios | Transferencias | Conservación |
|---|---|---|---|---|---|---|
| Cuenta y autenticación | Crear y dar acceso a la cuenta | Ejecución del servicio | Email, credenciales (`auth.users`), tokens OAuth de Google si aplica | Supabase | — | Hasta baja |
| Perfil y actividad | Ranking, stats, partidos | Ejecución del servicio | Apodo, avatar, posición, ELO, goles, partidos jugados, valor de mercado (fantasy) | Supabase, Vercel | — | Hasta baja |
| Chat de partido | Comunicación entre jugadores | Interés legítimo | Mensajes de texto (`match_comments`) | Supabase | — | Hasta baja / retirada del mensaje |
| Fotos de partido | Galería social | Interés legítimo / consentimiento | Imágenes de personas (`match_photos`, bucket de Storage) | Supabase Storage | — | Hasta baja / takedown |
| Asistente IA (Panenka) | Responder consultas de juego | Interés legítimo | Apodo, estadísticas agregadas (sin email, sin identificadores internos) | Groq | EE. UU. (garantías del proveedor; ver `bases-juridicas.md` §4) | No persistente en Groq; el historial de conversación vive solo en la sesión del navegador |
| Notificaciones | Avisar de eventos de la app (convocatorias, MVP, fantasy, etc.) | Ejecución del servicio | Mensajes dirigidos al usuario (`notifications`) | Supabase | — | Limpieza periódica de notificaciones antiguas (ver `retencion.md`) |

## Notas

- Esta tabla es un RAT **simplificado**, proporcional a la escala del proyecto (hobby/portfolio, responsable persona física). No sustituye un RAT corporativo si el proyecto creciera a una escala distinta.
- "Destinatarios" lista encargados de tratamiento (art. 28 RGPD), no terceros independientes: Supabase (BD/auth/storage), Vercel (hosting; Speed Insights sin cookies), Groq (inferencia IA) y, en el flujo de login, Google (OAuth).
- El detalle de bases jurídicas y su justificación está en `bases-juridicas.md`. El detalle de criterios de conservación está en `retencion.md`.
- Cambios en este RAT deben revisarse cada vez que se añada un tratamiento nuevo de datos personales (nueva tabla, nuevo proveedor, nueva finalidad).
