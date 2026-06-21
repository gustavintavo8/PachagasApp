# Mini-procedimiento de brechas de seguridad (arts. 33–34 RGPD) — Pachanga

Procedimiento interno, proporcional a la escala del proyecto (responsable persona física,
sin equipo de seguridad dedicado ni DPO — ver `etica.md`). Sigue el ciclo
**detectar → contener → evaluar → notificar → comunicar → registrar**.

## 0. Qué se considera "brecha"

Cualquier incidente de seguridad que produzca, de forma accidental o ilícita, la
destrucción, pérdida, alteración, comunicación o acceso no autorizado a datos personales
tratados por Pachanga. Ejemplos relevantes en este proyecto: exposición de la tabla
`profiles`/`auth.users` por un fallo de RLS, filtración de la service role key de
Supabase, acceso no autorizado al bucket de fotos, o un fallo que envíe datos personales
no minimizados a Groq.

## 1. Detectar

- Fuentes de detección: alertas de Supabase/Vercel, reportes de usuarios, revisión manual
  de políticas RLS, logs de errores en server actions (p. ej. `deleteAccount`,
  `exportMyData`), o hallazgo durante desarrollo (como ocurrió con la fuga de email del
  Bloque 0 de este mismo proyecto, cerrada en una tarea previa).
- Quien detecte un indicio de brecha debe registrarlo de inmediato (hora, qué se observó,
  cómo se detectó) aunque todavía no esté confirmado.

## 2. Contener

- Cortar el vector de exposición lo antes posible: revertir o corregir la política RLS
  afectada, rotar claves comprometidas (`SUPABASE_SERVICE_ROLE_KEY`, claves de API de
  Groq/Google si procede), revocar sesiones si hay sospecha de compromiso de cuentas,
  deshabilitar temporalmente la función afectada si no hay forma rápida de corregirla
  (p. ej. desactivar una ruta o una Server Action).
- Conservar evidencia (capturas, logs, consultas de prueba) antes de aplicar cambios que
  puedan borrar el rastro del incidente.

## 3. Evaluar el riesgo

Para cada brecha confirmada, valorar:

- **Qué datos** se han visto afectados (¿email? ¿credenciales? ¿fotos? ¿solo datos ya
  públicos como apodo/stats?).
- **Cuántos usuarios** y con qué alcance (¿un usuario, varios, todos?).
- **Probabilidad e impacto** sobre los derechos y libertades de los afectados (p. ej. una
  fuga de email es más sensible que una fuga de apodos públicos; una fuga de fotos de
  identificables es de mayor impacto que una fuga de estadísticas de juego).
- **Riesgo "alto"** (criterio orientativo): datos que permitan identificar a la persona
  combinados con un riesgo real de daño (suplantación, acoso, exposición de fotos sin
  consentimiento a terceros no previstos, credenciales comprometidas).

Esta evaluación determina si procede notificar a la AEPD y/o comunicar a los afectados.

## 4. Notificar a la AEPD en 72 horas si hay riesgo (art. 33 RGPD)

- **Plazo:** sin dilación indebida y, a ser posible, **dentro de las 72 horas** desde que
  el responsable tenga constancia de la brecha, salvo que sea improbable que constituya
  un riesgo para los derechos y libertades de las personas.
- **Cómo notificar:** a través de la sede electrónica de la AEPD, formulario de
  notificación de brechas de seguridad: <https://sedeagpd.gob.es> (apartado "Notificación
  de quiebras de seguridad"). Información de contacto general de la AEPD:
  <https://www.aepd.es> — C/ Jorge Juan, 6, 28001 Madrid.
- **Contenido mínimo de la notificación:** naturaleza de la brecha, categorías y número
  aproximado de interesados y de registros afectados, consecuencias probables, medidas
  adoptadas o propuestas para mitigarla, y datos de contacto del responsable
  (`LEGAL_CONTACT_EMAIL` en `src/lib/legal.ts`).
- Si no se notifica dentro de las 72 horas, debe acompañarse de los motivos del retraso.

## 5. Comunicar a los afectados si el riesgo es alto (art. 34 RGPD)

- Si la evaluación del paso 3 concluye que la brecha entraña un **riesgo alto** para los
  derechos y libertades de los usuarios, se debe comunicar a los afectados **sin
  dilación indebida**, en lenguaje claro y sencillo, indicando: qué ha pasado, qué datos
  se han visto afectados, qué consecuencias puede tener, qué medidas se han tomado y qué
  pueden hacer ellos (p. ej. cambiar contraseña, revisar su cuenta de Google si usaron
  login con Google).
- Canal de comunicación: email de contacto registrado del usuario (si la brecha no afecta
  precisamente al propio email) o aviso visible dentro de la app si el canal de email no
  es fiable en ese incidente concreto.
- No es necesaria esta comunicación si se han aplicado medidas que hagan improbable el
  riesgo (p. ej. los datos expuestos estaban cifrados o ya eran públicos por diseño, como
  apodo o avatar).

## 6. Registrar

- Toda brecha, notificada o no a la AEPD, debe quedar registrada internamente con al
  menos: fecha de detección, descripción, datos afectados, número estimado de afectados,
  medidas de contención, decisión motivada sobre notificación a la AEPD y comunicación a
  afectados, y fecha de cierre.
- Este registro no se publica en la app; vive en el repositorio (o en un documento
  interno equivalente) junto con el resto de `docs/legal/`.
- Las brechas que motiven cambios técnicos (p. ej. una corrección de RLS) deben quedar
  enlazadas a su commit/PR correspondiente para trazabilidad.

## 7. Responsable de ejecutar este procedimiento

Dado que el proyecto no tiene DPO (decisión documentada en `etica.md`), el propio
responsable del tratamiento (ver `src/lib/legal.ts`) es quien detecta, decide y ejecuta
estos pasos. Esto es proporcional a la escala y naturaleza del proyecto (hobby/portfolio,
sin tratamiento a gran escala ni categorías especiales de datos como actividad
principal), pero implica que la rapidez de respuesta depende de la disponibilidad de una
sola persona — un riesgo organizativo aceptado conscientemente y mitigado manteniendo
este procedimiento simple y accionable sin recursos adicionales.
