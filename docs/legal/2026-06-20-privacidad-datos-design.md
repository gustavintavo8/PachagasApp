# Diseño: Privacidad y protección de datos en Pachanga

- **Fecha:** 2026-06-20
- **Estado:** Aprobado (pendiente de plan de implementación)
- **Autor:** equipo Pachanga
- **Tipo:** Cumplimiento de protección de datos (RGPD / LOPDGDD) + privacidad desde el diseño

---

## 1. Contexto y marco

Pachanga es una plataforma full-stack (Next.js 16 + Supabase) para organizar partidos
de fútbol entre amigos. Trata datos personales reales (emails, perfiles, fotos de
personas, chat) y usa un asistente de IA (Panenka) que envía datos a un tercero en
EE. UU. (Groq). Hoy no existe ninguna capa de privacidad: ni política de privacidad,
ni textos legales, ni mecanismos de ejercicio de derechos, ni consentimiento en el alta.

**Marco acordado para este trabajo:**

- **Responsable del tratamiento:** una persona física, con un email de contacto para
  privacidad. Sin razón social ni domicilio fiscal.
- **Enfoque:** pragmático de hobby/portfolio. Privacidad desde el diseño (RGPD art. 25)
  aplicada a lo existente, cumpliendo lo legalmente esencial y defendible, **sin
  sobreingeniería**.
- **Alcance del trabajo:** cambios técnicos en la app **y** documentación legal/interna.
- **Cookies:** solo cookies estrictamente necesarias + analítica sin cookies → **sin
  banner de consentimiento**, solo información.
- **IA (Panenka):** se mantiene Groq, con enfoque **informar + minimizar**.
- **Borrado de cuenta:** **autoservicio** (botón que borra), no por solicitud manual.

### 1.1 Lo que NO está en alcance (YAGNI, justificado)

- **Delegado de Protección de Datos (DPO):** no obligatorio. No hay tratamiento a gran
  escala ni observación sistemática, ni categorías especiales como actividad principal
  (RGPD art. 37).
- **Evaluación de Impacto (DPIA) formal:** no obligatoria en este perfil de riesgo. Se
  deja en su lugar una **nota de riesgo ligera** centrada en las fotos.
- **Banner de cookies:** innecesario con solo cookies esenciales (Guía AEPD de cookies;
  ePrivacy: las cookies estrictamente necesarias están exentas de consentimiento).
- **Migración del proveedor de IA a la UE:** descartada para esta iteración; se gestiona
  la transferencia internacional vía información + minimización + verificación de DPA.

---

## 2. Inventario de datos personales (estado actual)

| Origen | Datos personales |
|--------|------------------|
| `auth.users` (Supabase, gestionado) | email, hash de contraseña, tokens OAuth de Google, flag `is_anonymous` |
| `public.profiles` | **email**, username, `avatar_url`, posición, `skill_level`, stats (ELO, goles, partidos), `is_admin`, `market_value` |
| `match_participants` | participación, goles, MVP por usuario |
| `match_comments` | texto libre del chat (puede contener datos personales) |
| `match_photos` | **fotos de personas identificables** (URL en Storage, bucket público) |
| `mvp_votes` | quién vota a quién |
| `player_ratings` (según README) | valoraciones entre jugadores |
| `notifications` | mensajes/títulos dirigidos al usuario |
| `rp_history` | histórico de puntos por usuario |
| Storage buckets | `avatars` (público), `match_photos` (público) |

**Encargados / subencargados / terceros identificados:**

- **Supabase** — base de datos, autenticación, storage, realtime (encargado).
- **Vercel** — hosting y `@vercel/speed-insights` (encargado; Speed Insights es sin cookies).
- **Groq** — inferencia del asistente Panenka, **EE. UU.** (subencargado; transferencia internacional).
- **Google** — OAuth de inicio de sesión.

---

## 3. Hallazgos que motivan el trabajo

1. **Fuga de email (crítico).** La política RLS `profiles_select_public ... USING (true)`
   permite que cualquiera (rol `anon`) lea `public.profiles`, que incluye la columna
   `email`. Exposición pública de datos personales de todos los usuarios.
2. **Sin ejercicio de derechos.** No hay borrado de cuenta ni exportación de datos en la
   app; solo `ON DELETE CASCADE` a nivel BD, que no es autoservicio.
3. **Sin transparencia.** No hay política de privacidad, aviso legal, términos ni
   información de cookies. Sin información sobre la transferencia a Groq (EE. UU.).
4. **Sin consentimiento ni control de edad** en el registro.
5. **IA sin aviso ni minimización.** Panenka no informa de que es IA ni de que procesa en
   un tercero; las tools pueden enviar más datos de los necesarios.

---

## 4. Mapa de cumplimiento (referencia normativa)

| Requisito | Norma | Cómo se cubre |
|-----------|-------|---------------|
| Privacidad desde el diseño y por defecto | RGPD art. 25; Guía AEPD Privacidad desde el Diseño | Bloque 0, 1, 3, 4 |
| Seguridad del tratamiento | RGPD art. 32 | Bloque 0 (RLS), higiene existente (RLS, rate limiting) |
| Información al interesado | RGPD arts. 13–14; Guía AEPD deber de informar | Bloque 2 (política), Bloque 4 (aviso IA) |
| Derechos por medios electrónicos | RGPD arts. 12, 15–22 | Bloque 1 |
| Base jurídica | RGPD art. 6 | Bloque 5 (mapa de bases) |
| Consentimiento (cuando aplique) | RGPD art. 7 | Bloque 3 |
| Edad mínima del menor (14 años) | LOPDGDD art. 7 | Bloque 3 |
| Transferencias internacionales | RGPD cap. V (arts. 44+) | Bloque 2 + Bloque 4 (Groq) |
| Registro de Actividades de Tratamiento | RGPD art. 30 | Bloque 5 (RAT simplificado) |
| Notificación de brechas | RGPD arts. 33–34 | Bloque 5 (mini-procedimiento) |
| Transparencia de sistemas de IA | EU AI Act (riesgo limitado); AEPD IA | Bloque 4 (aviso de IA) |
| Mecanismos de reclamación accesibles | Guía AEPD Privacidad desde el Diseño | Bloque 1 (contacto + AEPD) |
| Identificación del prestador | LSSI | Bloque 2 (aviso legal) |
| Principios éticos | Código Ético y Deontológico CCII | Bloque 5 (nota de ética) |

---

## 5. Bloques de trabajo

### Bloque 0 — Cerrar la fuga de datos (P0)

**Objetivo:** que el `email` (y cualquier dato personal no público) deje de ser legible
por terceros, manteniendo públicos los datos que el producto necesita (username, avatar,
stats para ranking/directorio).

**Tareas:**

- Dejar de exponer `profiles.email` al rol `anon`/`authenticated` ajeno. Opción de
  referencia: servir los campos públicos mediante una **vista** `public_profiles`
  (sin `email`) y restringir la lectura de `email` en `profiles` al propio usuario
  (`auth.uid() = id`); o equivalente que garantice column-level privacy.
- Auditar y migrar todas las lecturas de cliente/servidor/tools que hoy seleccionan de
  `profiles` para que no dependan del email ajeno.
- Revisar que los buckets de Storage no expongan rutas con datos sensibles innecesarios.

**Criterio de aceptación:** una consulta con la `anon key` no devuelve el email de otros
usuarios; la app sigue funcionando (ranking, directorio, perfiles públicos).

---

### Bloque 1 — Derechos de los usuarios (P1)

**Objetivo:** derechos ejercitables por medios electrónicos desde la propia app
(RGPD arts. 12, 15–22).

**Tareas:**

- **Supresión (autoservicio):** botón "Eliminar mi cuenta" en perfil → server action que
  usa el cliente admin (`src/lib/supabase/admin.ts`) para borrar el usuario de
  `auth.users`; el `ON DELETE CASCADE` limpia el resto. Diálogo de confirmación que
  explique qué se borra y qué (si algo) se conserva y por qué.
- **Acceso / portabilidad:** botón "Descargar mis datos" → server action que genera un
  **JSON** con perfil, participaciones, comentarios, fotos (URLs), votos, valoraciones,
  notificaciones e historial del usuario autenticado.
- **Rectificación:** documentar que el formulario de perfil ya la cubre.
- **Canal de contacto/reclamación:** email de privacidad visible en la política y mención
  del derecho a reclamar ante la **AEPD**.

**Criterio de aceptación:** un usuario puede, sin intervención manual, descargar sus datos
y eliminar su cuenta; tras el borrado no quedan filas suyas en tablas con FK a su id.

---

### Bloque 2 — Transparencia y textos legales (P1)

**Objetivo:** páginas legales accesibles y enlazadas (footer + perfil).

**Tareas (rutas nuevas en `src/app/`):**

- **`/privacidad` — Política de Privacidad:** responsable y contacto; categorías de datos;
  finalidades; **bases jurídicas**; destinatarios y subencargados (Supabase, Vercel, Groq,
  Google); **transferencia internacional a Groq (EE. UU.)**; plazos de conservación;
  derechos y cómo ejercerlos (enlazando Bloque 1); edad mínima; reclamación ante la AEPD.
- **`/aviso-legal` — Aviso legal:** identificación del prestador (LSSI), con el nivel de
  datos que el responsable (persona física) decida publicar.
- **`/terminos` — Términos / uso aceptable:** normas de chat; **fotos**: solo subir
  imágenes sobre las que se tengan derechos/consentimiento de las personas que aparecen;
  mecanismo de **retirada (takedown)**.
- **Sección de cookies** dentro de `/privacidad`: declarar que solo hay cookies
  estrictamente necesarias (sesión Supabase Auth) + Speed Insights sin cookies, por lo que
  no se requiere consentimiento. **Sin banner.**
- **Footer/enlaces** a las tres páginas, visibles en toda la app.

**Criterio de aceptación:** las tres páginas existen, son accesibles desde el footer y la
política cubre los puntos de los arts. 13–14.

---

### Bloque 3 — Consentimiento y alta (P2)

**Objetivo:** recoger consentimiento informado y controlar la edad en el registro.

**Tareas:**

- **Casilla de aceptación** (no premarcada) de Privacidad + Términos en el formulario de
  registro, con enlaces a ambas páginas.
- **Registro de evidencia** del consentimiento: almacenar fecha y versión de los textos
  aceptados (p. ej. columnas en `profiles` o tabla `consents`).
- **Edad mínima 14 (LOPDGDD art. 7):** confirmación de edad en el alta.
- **Aviso de derechos de imagen** al subir fotos (recordatorio breve en el flujo de
  `match_photos`).

**Criterio de aceptación:** no se puede completar el registro sin aceptar los textos y
confirmar edad; queda constancia de la versión aceptada.

---

### Bloque 4 — IA Panenka: informar + minimizar (P2)

**Objetivo:** cumplir transparencia de IA (EU AI Act, riesgo limitado) y minimizar la
transferencia a Groq (RGPD arts. 13/44).

**Tareas:**

- **Minimización:** revisar `src/lib/ai/tools.ts` / `buildTools` para que a Groq solo
  lleguen los datos necesarios (usernames, stats agregadas) y **nunca emails ni
  identificadores internos innecesarios**.
- **Aviso de IA en el chat:** texto visible de que Panenka es un asistente de IA y de que
  las consultas se procesan en un proveedor externo (Groq).
- **Verificar el DPA/garantías de Groq** y reflejar la transferencia internacional en
  `/privacidad`.

**Criterio de aceptación:** el aviso de IA es visible en el asistente; una revisión del
payload enviado a Groq no contiene emails ni PII innecesaria; la transferencia está
documentada en la política.

---

### Bloque 5 — Documentación interna (P3, fuera de la app)

**Objetivo:** documentación de cumplimiento proporcional a la escala. Se guarda en el
repo (p. ej. `docs/legal/`), no se publica en la app.

**Tareas:**

- **RAT simplificado (RGPD art. 30):** tabla por tratamiento con finalidad, base jurídica,
  categorías de datos, destinatarios, transferencias, conservación.
- **Mapa de bases jurídicas** por dato/finalidad (ejecución del contrato/servicio,
  consentimiento, interés legítimo).
- **Mini-procedimiento de brechas (arts. 33–34):** pasos y plazo de 72 h para notificar.
- **Nota de retención/limpieza:** criterios para notificaciones antiguas y cuentas
  inactivas/anónimas.
- **Nota de ética (Código CCII):** breve declaración de principios aplicados.
- **Nota de riesgo ligera (en lugar de DPIA):** foco en fotos de personas y mitigaciones
  (consentimiento, takedown, bucket).

**Criterio de aceptación:** los documentos existen en el repo y son coherentes con la
política pública y la configuración técnica.

---

## 6. Orden de ejecución

1. **P0** — Bloque 0 (fuga de email).
2. **P1** — Bloque 1 (derechos) + Bloque 2 (política y textos legales).
3. **P2** — Bloque 3 (alta/consentimiento) + Bloque 4 (IA).
4. **P3** — Bloque 5 (documentación interna).

---

## 7. Riesgos y consideraciones

- **Cambios de RLS (Bloque 0)** pueden romper lecturas existentes que esperan `email`;
  requiere auditoría cuidadosa de todas las consultas a `profiles` antes de migrar.
- **Borrado de cuenta** usa la service role key: la server action debe validar bien la
  identidad del solicitante para no permitir borrar a terceros.
- **Fotos de terceros** son el mayor riesgo residual; se mitiga con términos, aviso en la
  subida y takedown, no con bloqueo técnico.
- **Versionado de textos legales:** al cambiar la política/términos habrá que considerar
  re-consentimiento; se documenta el esquema de versión en el Bloque 3.

---

## 8. Decisiones abiertas para la fase de plan

- Mecanismo técnico exacto del Bloque 0 (vista `public_profiles` vs. reorganización de
  columnas) se concreta en el plan de implementación.
- Ubicación del registro de consentimiento (columnas en `profiles` vs. tabla `consents`).
- Formato exacto del export (un JSON único vs. ZIP con fotos).
