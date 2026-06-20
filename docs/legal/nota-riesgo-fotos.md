# Nota de riesgo ligera — Fotos de partido (sustituto de DPIA)

## 1. Por qué esta nota y no una DPIA formal

El RGPD (art. 35) exige una Evaluación de Impacto (DPIA) cuando un tratamiento implica
*probablemente* un alto riesgo para los derechos y libertades de las personas (p. ej.
tratamiento a gran escala, observación sistemática, categorías especiales de datos como
actividad principal). Pachanga es un proyecto de hobby/portfolio gestionado por una
persona física, sin tratamiento a gran escala ni vigilancia sistemática — los criterios
que activarían la obligación de DPIA no se cumplen (ver también `etica.md` §5). Por eso
no existe una DPIA formal en este proyecto, por decisión deliberada.

Sin embargo, las **fotos de partido** son, con diferencia, el mayor riesgo residual de
privacidad de la app (datos de personas identificables, subidas por terceros, en un
bucket público), así que en su lugar se documenta este análisis ligero: identificación
del riesgo, valoración y mitigaciones existentes. Es proporcional al riesgo real sin la
carga formal de una DPIA completa.

## 2. Descripción del tratamiento

- Los usuarios autenticados (no invitados) pueden subir fotos asociadas a un partido
  (`match_photos`), almacenadas en un bucket de Supabase Storage.
- Las fotos suelen contener **personas identificables**: los propios jugadores del
  partido, y potencialmente terceros presentes (otros espectadores, familiares, etc.) no
  registrados en la app y que no han dado ningún consentimiento a través de ella.
- Las fotos son visibles para quienes tengan acceso a la galería del partido en la app.

## 3. Riesgos identificados

| Riesgo | Descripción | Probabilidad | Impacto |
|---|---|---|---|
| Subida sin consentimiento de personas que aparecen | Un usuario sube una foto de otra persona (jugador o tercero) sin haberle preguntado | Media — comportamiento social habitual y poco premeditado | Medio — afecta al derecho a la propia imagen |
| Exposición más amplia de la prevista | Una foto pensada para el grupo de un partido es vista por más personas de las que el sujeto de la foto esperaba (todos los miembros con acceso al partido, no solo quienes estuvieron presentes) | Media | Bajo-medio |
| Dificultad para que un tercero no usuario solicite la retirada | Alguien que aparece en una foto pero no usa la app no sabe cómo pedir que se elimine | Baja-media | Medio si ocurre |
| Acceso público al bucket de Storage | Si las URLs del bucket no requieren autenticación y son adivinables/enumerables, una foto podría ser accedida fuera de la app | Baja (depende de configuración del bucket) | Medio-alto si ocurre |

No se han identificado riesgos de categorías especiales de datos (las fotos son de
contexto deportivo recreativo, no de salud, ideología, orientación, etc.), ni riesgo de
tratamiento automatizado sobre las fotos (no hay reconocimiento facial ni biometría: las
fotos son contenido estático sin procesar algorítmicamente).

## 4. Mitigaciones existentes

- **Aviso en el momento de subida:** el componente de subida de fotos del partido
  (`src/components/MatchPhotos.tsx`) muestra el aviso *"Sube solo fotos sobre las que
  tengas derechos y con permiso de quienes aparecen"* antes de confirmar la subida,
  trasladando la responsabilidad y el recordatorio al momento exacto de la acción.
- **Términos de uso explícitos:** `/terminos` §3 ("Fotos y derechos de imagen") exige que
  el usuario solo suba fotos sobre las que tenga derechos y consentimiento de quienes
  aparecen, y es responsable del contenido que publica.
- **Mecanismo de retirada (takedown):** `/terminos` §3 ofrece un canal de contacto
  (`LEGAL_CONTACT_EMAIL`, definido en `src/lib/legal.ts`) para que **cualquier persona**
  afectada por una foto — usuaria de la app o no — pueda solicitar su eliminación, y el
  compromiso de eliminarla. Este canal no exige que el solicitante tenga cuenta en la
  app, precisamente para cubrir el caso de terceros no registrados.
- **Alcance limitado de la galería:** las fotos se asocian a un partido concreto y se
  muestran en el contexto de ese partido, no en un feed global público fuera de la app.
- **Borrado ligado a la cuenta:** si el autor de una foto elimina su cuenta, las fotos
  asociadas se eliminan en cascada (ver `retencion.md` §5), reduciendo la persistencia de
  contenido huérfano.

## 5. Mitigaciones recomendadas a futuro (no bloqueantes para esta iteración)

- Revisar periódicamente que el bucket de fotos no permita enumeración trivial de
  archivos de otros partidos (verificación de configuración de Supabase Storage), aunque
  esto es una medida de seguridad técnica más que de gobernanza de privacidad y queda
  fuera del alcance documental de esta nota.
- Si el proyecto creciera en usuarios o pasara a tener difusión pública más amplia,
  reconsiderar si este análisis ligero sigue siendo suficiente o si conviene formalizar
  una DPIA completa (criterio de revisión: cambio relevante de escala o de finalidad,
  no solo paso del tiempo).

## 6. Conclusión

El riesgo de las fotos de personas se mitiga mediante información en el momento de la
subida, normas claras en los términos de uso y un mecanismo de retirada accesible a
cualquier afectado — **no mediante bloqueo técnico previo** (la app no impide
técnicamente subir una foto sin verificar consentimiento de terceros, porque no existe
una forma automática fiable de hacerlo). Esta combinación de medidas se considera
proporcional al riesgo real identificado en una app de este tamaño y propósito, y
sustituye adecuadamente a una DPIA formal en este caso concreto.
