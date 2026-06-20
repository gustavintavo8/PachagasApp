# Mapa de bases jurídicas (art. 6 RGPD) — Pachanga

Este documento detalla, para cada finalidad de tratamiento listada en `RAT.md`, la base
jurídica del art. 6 RGPD elegida y la justificación. Es la contraparte interna y razonada
de lo que `/privacidad` §3 resume para el usuario.

## 1. Ejecución del servicio (art. 6.1.b — ejecución de un contrato o de medidas
precontractuales a solicitud del interesado)

| Finalidad | Justificación |
|---|---|
| Cuenta y autenticación | Sin email/credenciales no se puede crear ni dar acceso a la cuenta que el usuario solicita expresamente al registrarse. |
| Perfil y actividad (ranking, stats, partidos) | Son el contenido funcional del servicio: un usuario que se une a Pachanga lo hace para participar en partidos y ver su progreso; tratar posición, ELO, goles y partidos jugados es necesario para prestar esa función, no opcional. |
| Notificaciones de eventos de la app | Avisar de convocatorias, resultados o cambios de equipo es parte de la funcionalidad central que el usuario espera al usar la app; no son comunicaciones de marketing. |

No se necesita consentimiento adicional para estas finalidades porque son inherentes al
servicio solicitado: pedirlo de forma separada sería redundante y confundiría al usuario
sobre qué puede realmente desactivar (no podría usar la app sin ellas).

## 2. Interés legítimo (art. 6.1.f)

| Finalidad | Justificación |
|---|---|
| Chat de partido | Permite la coordinación social entre jugadores de un mismo partido, función esperada en una app de organización de partidos entre amigos; el interés del organizador/jugadores en comunicarse supera el impacto mínimo sobre quien participa voluntariamente en el chat de un partido al que se ha unido. |
| Fotos de partido | La galería social (fotos del partido) es un valor añadido habitual en este tipo de apps; se combina con interés legítimo y, cuando hay personas identificables, con el deber de quien sube la foto de contar con el consentimiento de las personas que aparecen (ver `/terminos` §3 y `nota-riesgo-fotos.md`). |
| Asistente IA (Panenka) | Ofrecer un asistente conversacional sobre stats y partidos mejora la experiencia del servicio sin tratar datos sensibles; se minimiza el envío a Groq a apodo + estadísticas agregadas (nunca email ni identificadores internos), lo que reduce el impacto sobre el interesado a un nivel proporcional al beneficio. |

### Ponderación de interés legítimo (test de balance, resumido)

Para cada uno de los tres tratamientos anteriores se ha considerado:

1. **Interés perseguido:** habilitar funciones sociales/de producto (comunicación,
   recuerdo visual del partido, asistencia conversacional) sin las cuales la app pierde
   gran parte de su propósito de "organizar partidos entre amigos".
2. **Necesidad:** no existe una alternativa razonable que logre el mismo resultado
   tratando menos datos — un chat sin texto no es chat, una galería sin fotos no es
   galería, un asistente sin datos de juego no puede responder sobre el juego.
3. **Expectativas razonables del interesado:** un usuario que se registra en una app de
   gestión de partidos de fútbol con amigos espera razonablemente que exista chat y
   fotos del partido; se le informa de ello en el alta (consentimiento explícito a
   Política + Términos, Bloque 3) y, en el caso del asistente, con un aviso visible de
   IA en el propio chat (Bloque 4).
4. **Impacto y mitigaciones:** el chat es visible solo para participantes del partido;
   las fotos llevan aviso de derechos de imagen en la subida y mecanismo de retirada
   (takedown) en `/terminos`; el asistente IA nunca recibe email ni PII innecesaria y no
   conserva el historial de forma persistente en el proveedor externo.
5. **Conclusión:** en los tres casos el interés legítimo prevalece porque el tratamiento
   es proporcional, esperable y mitigado; no se han identificado salvaguardas adicionales
   razonables que no se hayan implementado ya.

## 3. Consentimiento (art. 6.1.a / art. 7 RGPD)

| Finalidad | Justificación |
|---|---|
| Aceptación de Política de Privacidad y Términos en el alta | Es la base jurídica explícita elegida para el acto de registro: casilla no premarcada, con enlaces a ambos textos, cuya aceptación se registra con fecha y versión (`accepted_privacy_version` / `accepted_privacy_at` en `profiles`, ver Tasks 1/7). Permite trazar qué versión de los textos aceptó cada usuario y exigir re-consentimiento si cambian sustancialmente. |
| Confirmación de edad mínima (14 años, LOPDGDD art. 7) | Recogida en el mismo paso del alta como control de elegibilidad, no como base jurídica de tratamiento en sí, pero documentada aquí porque forma parte del mismo flujo de consentimiento informado. |

El consentimiento es retirable: el usuario puede eliminar su cuenta en cualquier momento
desde su perfil (borrado autoservicio), lo que equivale a la retirada del consentimiento
y cesa el tratamiento de los datos personales asociados.

## 4. Transferencia internacional a Groq (EE. UU.)

La transferencia de datos de juego (apodo + estadísticas, nunca email) al proveedor de
inferencia de IA Groq, ubicado en EE. UU., se ampara en las garantías contractuales y de
protección de datos ofrecidas por el proveedor (verificación de su DPA/garantías,
Bloque 4) y se minimiza el dato transferido al mínimo necesario para que el asistente
funcione. No es una base jurídica del art. 6 en sí misma, sino el mecanismo de
cobertura de la transferencia (cap. V RGPD) para la finalidad ya amparada en interés
legítimo (asistente IA). Se documenta también en `/privacidad` §5 y en `RAT.md`.

## 5. Resumen de coherencia

Esta tabla es coherente con `/privacidad` §3 (resumen público) y con `RAT.md` (columna
"Base jurídica" por tratamiento). No se introduce ninguna base jurídica nueva que no
esté ya reflejada en la política pública.
