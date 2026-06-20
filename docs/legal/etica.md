# Nota de ética — Pachanga

Declaración interna de principios éticos aplicados al diseño y desarrollo de Pachanga,
alineada con el **Código Ético y Deontológico del Colegio Profesional de Ingeniería en
Informática (CCII)**. No es un documento público (no se enlaza desde la app); convive con
el resto de `docs/legal/` como evidencia de que estos principios se consideraron de forma
explícita durante el desarrollo, no solo a posteriori.

## 1. Minimización de datos

- Pachanga trata el mínimo de datos personales necesario para cada finalidad. Ejemplo
  concreto y verificable en el código: tras detectarse que `public.profiles` exponía el
  email a cualquier usuario autenticado/anónimo vía una política RLS permisiva, se
  eliminó la columna `email` de `profiles` (fuente única de verdad: `auth.users`), de
  forma que el directorio de jugadores, ranking y perfiles públicos ya no dependen de
  ni exponen el email de nadie.
- El asistente de IA (Panenka) está minimizado por diseño: sus *tools*
  (`src/lib/ai/tools.ts`) seleccionan explícitamente `username` y estadísticas de juego
  (posición, ELO, goles, partidos, valor de mercado) y **nunca** email ni columnas
  internas no necesarias para responder. Esta minimización se trató como invariante de
  producto, no como configuración opcional.
- La exportación de datos (`exportMyData`) y el borrado de cuenta (`deleteAccount`) se
  diseñaron como autoservicio precisamente para no requerir que un tercero (el propio
  responsable) tenga que manejar manualmente solicitudes con datos personales ajenos más
  de lo estrictamente necesario.

## 2. Transparencia

- Existen páginas públicas y accesibles desde el footer (`/privacidad`, `/aviso-legal`,
  `/terminos`) que explican en lenguaje llano qué datos se tratan, para qué, con qué base
  jurídica, quién accede a ellos y durante cuánto tiempo.
- El asistente Panenka muestra un aviso visible de que es un sistema de IA y de que las
  consultas se procesan en un proveedor externo (Groq, EE. UU.), en línea con la
  transparencia exigida a sistemas de IA de riesgo limitado.
- El alta de usuario exige una aceptación explícita (casilla no premarcada) de Política y
  Términos, con registro de qué versión se aceptó y cuándo
  (`accepted_privacy_version` / `accepted_privacy_at`), de modo que el consentimiento es
  verificable, no presumido.
- Esta misma documentación interna (RAT, bases jurídicas, procedimiento de brechas,
  retención, riesgo de fotos) existe para que las decisiones de tratamiento sean
  trazables y revisables, no solo implícitas en el código.

## 3. No discriminación del balanceador de equipos (ELO)

- El algoritmo de balanceo de equipos (`src/lib/team-balancer.ts`) reparte jugadores
  exclusivamente en función de **dos variables objetivas y relacionadas con el juego**:
  posición declarada (`GK`/`DEF`/`MID`/`FWD`) y puntuación ELO calculada a partir del
  rendimiento histórico en partidos (`src/lib/elo.ts`). No utiliza, ni tiene acceso a,
  ningún atributo demográfico, protegido o ajeno al juego (género, edad, origen, etc.).
- El proceso es determinista y auditable: agrupa por posición, ordena por ELO y reparte
  en zigzag equilibrando el ELO medio por equipo, con una fase de optimización por
  intercambios que solo considera el ELO. Cualquier sesgo posible vendría exclusivamente
  del propio histórico de rendimiento en el juego (que es la señal que el producto busca
  reflejar — equipos competitivamente equilibrados), no de características personales
  de los jugadores.
- Esto satisface el principio de no discriminación en sistemas algorítmicos: la única
  "decisión automatizada" del producto es deportiva (a qué equipo va cada jugador para
  un partido amistoso), no tiene efectos jurídicos ni significativos sobre derechos de
  las personas, y su lógica es además completamente explicable a quien lo pregunte (no
  es una caja negra de aprendizaje automático).

## 4. Uso responsable de la IA (Panenka)

- Panenka usa un modelo alojado en Groq exclusivamente para responder preguntas sobre
  estadísticas y partidos ya existentes en la app; no toma decisiones automatizadas sobre
  personas, no genera contenido que afecte a derechos de los usuarios, y sus respuestas
  se presentan con la advertencia de que pueden contener errores y no deben tomarse como
  asesoramiento (`/terminos` §4).
- Se ha minimizado el dato enviado al proveedor externo al mínimo necesario (ver §1) y se
  ha verificado/documentado la transferencia internacional correspondiente en
  `/privacidad` §5 y en `bases-juridicas.md` §4, en lugar de ignorarla.
- No se usa la IA para perfilar, puntuar moralmente o tomar decisiones sobre los usuarios
  más allá de lo que el propio usuario le pregunta de forma explícita en el chat.

## 5. Proporcionalidad de la gobernanza (decisión explícita, no descuido)

- Este proyecto **no tiene Delegado de Protección de Datos (DPO)** ni una **Evaluación de
  Impacto (DPIA) formal**, y esto es una decisión deliberada y documentada, no un
  olvido: no hay tratamiento a gran escala, ni observación sistemática de personas a gran
  escala, ni categorías especiales de datos como actividad principal (criterios del RGPD
  art. 37 y de las guías de la AEPD para la designación obligatoria de DPO). El
  responsable es una persona física gestionando un proyecto de hobby/portfolio.
- En lugar de una DPIA formal, se ha realizado una **nota de riesgo ligera** centrada en
  el principal riesgo residual identificado (fotos de personas identificables), recogida
  en `nota-riesgo-fotos.md`. Esto se considera proporcional: la profundidad del análisis
  de riesgo es comparable a la de una DPIA en lo sustantivo (identificación de riesgo,
  evaluación, mitigaciones), pero sin la carga formal/documental de un proceso pensado
  para organizaciones de mayor escala.
- Esta proporcionalidad es, en sí misma, una aplicación del principio ético de no
  sobreingeniería: dedicar el esfuerzo de cumplimiento donde el riesgo real lo justifica
  (fuga de email, derechos de los usuarios, transparencia, consentimiento, fotos) y no
  fingir estructuras de gobernanza (DPO, comités, DPIAs extensas) que no aportarían
  protección real adicional a esta escala y solo añadirían apariencia de cumplimiento sin
  sustancia.
