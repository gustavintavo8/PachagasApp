import { MVP_VOTING_WINDOW_MS } from "./constantes";
import { PROVISIONAL_THRESHOLD } from "./elo";
import type { Match, MatchParticipant, Profile } from "./types";

/**
 * La voz de la app: reciben datos y devuelven frases.
 * Puras y deterministas: las variantes se eligen por hash de un id y "ahora"
 * siempre llega como argumento. Fechas y horas, siempre en Europe/Madrid.
 */

export const MAX_TITULAR = 32;

/** Diferencia de goles a partir de la cual es goleada. La misma que BLOWOUT_THRESHOLD en elo.ts. */
export const UMBRAL_GOLEADA = 4;

export type Fecha = Date | string | number;
export type Equipo = "rojo" | "azul";
export type Genero = "m" | "f";
export type Posicion = NonNullable<Profile["position"]>;

// ─── Variantes ────────────────────────────────────────────────────────────────

function hashEstable(texto: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < texto.length; i++) {
        hash ^= texto.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}

/** La sal evita que todas las frases de un mismo partido caigan en el mismo índice. */
function elegir(id: string, sal: string, variantes: readonly string[]): string {
    return variantes[hashEstable(`${sal}:${id}`) % variantes.length];
}

// ─── Plurales, números y nombres ──────────────────────────────────────────────

const NUMEROS = [
    "cero", "uno", "dos", "tres", "cuatro", "cinco", "seis",
    "siete", "ocho", "nueve", "diez", "once", "doce",
];

const ORDINALES = [
    "primero", "segundo", "tercero", "cuarto", "quinto",
    "sexto", "séptimo", "octavo", "noveno", "décimo",
];

export function capitalizar(texto: string): string {
    return texto.charAt(0).toLocaleUpperCase("es-ES") + texto.slice(1);
}

function pluralDe(singular: string): string {
    return /[aeiouáéó]$/i.test(singular) ? `${singular}s` : `${singular}es`;
}

/** Solo la palabra: elegirPlural(2, "gol") → "goles". */
export function elegirPlural(n: number, singular: string, plural = pluralDe(singular)): string {
    return n === 1 ? singular : plural;
}

/** Con cifra: plural(1, "gol") → "1 gol", plural(9, "gol") → "9 goles". */
export function plural(n: number, singular: string, plurales = pluralDe(singular)): string {
    return `${n} ${elegirPlural(n, singular, plurales)}`;
}

/** Cero a doce en palabra, de ahí en adelante en cifra. */
export function numeroPalabra(n: number, genero: Genero = "m"): string {
    if (!Number.isInteger(n) || n < 0 || n >= NUMEROS.length) return String(n);
    return n === 1 && genero === "f" ? "una" : NUMEROS[n];
}

/** En palabra y con su nombre: "un gol", "nueve goles", "una victoria", "13 goles". */
export function enPalabras(
    n: number,
    singular: string,
    plurales = pluralDe(singular),
    genero: Genero = "m"
): string {
    if (n === 1) return `${genero === "f" ? "una" : "un"} ${singular}`;
    return `${numeroPalabra(n, genero)} ${plurales}`;
}

/** "segundo", "décimo", "11.º". */
export function ordinal(n: number): string {
    return ORDINALES[n - 1] ?? `${n}.º`;
}

function limpiarNombre(nombre: string | null | undefined): string | null {
    const limpio = nombre?.trim();
    return limpio ? limpio : null;
}

/** Primera palabra del nombre, para cuando el completo no cabe en el titular. */
export function nombreCorto(nombre: string): string {
    return nombre.trim().split(/\s+/)[0];
}

/** Antes de i- o hi- la conjunción es «e»: «Óscar e Iván». «Iago» e «hielo» siguen con «y». */
function conjuncion(siguiente: string): string {
    return /^h?[ií](?![aeoáéó])/i.test(siguiente) ? "e" : "y";
}

/** "Manolín, Javi y Hugo", "Sergio, Óscar e Iván". */
export function listaNombres(nombres: readonly string[]): string {
    if (nombres.length < 2) return nombres.join("");
    const ultimo = nombres[nombres.length - 1];
    return `${nombres.slice(0, -1).join(", ")} ${conjuncion(ultimo)} ${ultimo}`;
}

/** El primero que cabe. Si ninguno cabe, el más corto. */
function ajustar(candidatos: readonly string[]): string {
    const cabe = candidatos.find((candidato) => candidato.length <= MAX_TITULAR);
    if (cabe) return cabe;
    return candidatos.reduce((corto, candidato) => (candidato.length < corto.length ? candidato : corto));
}

/** Cierra la frase con un punto, aunque el nombre del final ya traiga el suyo: «Rubén M.». */
function conPunto(frase: string): string {
    return `${frase.replace(/\.+$/, "")}.`;
}

// ─── Fechas en Madrid ─────────────────────────────────────────────────────────

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
    "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MS_POR_DIA = 24 * 60 * 60 * 1000;

const RELOJ_MADRID = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
});

function enMadrid(fecha: Fecha) {
    const instante = new Date(fecha);
    if (Number.isNaN(instante.getTime())) throw new Error("La fecha no es válida");

    const partes = RELOJ_MADRID.formatToParts(instante);
    const parte = (tipo: Intl.DateTimeFormatPartTypes) =>
        Number(partes.find((p) => p.type === tipo)?.value);

    const [anio, mes, dia] = [parte("year"), parte("month"), parte("day")];
    const medianoche = Date.UTC(anio, mes - 1, dia);
    return {
        mes,
        dia,
        hora: `${String(parte("hour")).padStart(2, "0")}:${String(parte("minute")).padStart(2, "0")}`,
        diaSemana: new Date(medianoche).getUTCDay(),
        /** Días naturales en Madrid: restar dos da la distancia en días de calendario. */
        indiceDia: medianoche / MS_POR_DIA,
    };
}

/** "martes" */
export function nombreDia(fecha: Fecha): string {
    return DIAS[enMadrid(fecha).diaSemana];
}

/** "20:00" */
export function horaMadrid(fecha: Fecha): string {
    return enMadrid(fecha).hora;
}

/** "3 nov" */
export function diaYMes(fecha: Fecha): string {
    const { dia, mes } = enMadrid(fecha);
    return `${dia} ${MESES_CORTOS[mes - 1]}`;
}

/** "Martes 3 nov, 20:00" */
export function fechaCorta(fecha: Fecha): string {
    return `${capitalizar(nombreDia(fecha))} ${diaYMes(fecha)}, ${horaMadrid(fecha)}`;
}

/** "Martes 3 de noviembre" */
export function fechaLarga(fecha: Fecha): string {
    const { dia, mes } = enMadrid(fecha);
    return `${capitalizar(nombreDia(fecha))} ${dia} de ${MESES[mes - 1]}`;
}

/** Días de calendario en Madrid entre "ahora" y la fecha. Negativo si ya pasó. */
export function diasHasta(fecha: Fecha, ahora: Fecha): number {
    return enMadrid(fecha).indiceDia - enMadrid(ahora).indiceDia;
}

/** "hoy", "mañana", "el martes" dentro de la semana, "el martes 17" más allá o en pasado. */
export function cuandoEs(fecha: Fecha, ahora: Fecha): string {
    const dias = diasHasta(fecha, ahora);
    if (dias === 0) return "hoy";
    if (dias === 1) return "mañana";
    if (dias > 1 && dias < 7) return `el ${nombreDia(fecha)}`;
    return `el ${nombreDia(fecha)} ${enMadrid(fecha).dia}`;
}

/**
 * "Cierra hoy, 20:15", "Cierra mañana, 20:15", "Votación cerrada".
 * Mismo criterio que voteForMvp: cierra pasada la ventana, no al llegar a ella.
 * Sin finished_at, quien llama pasa match.date, como hacen las actions.
 */
export function plazoVotacion(finishedAt: Fecha | null | undefined, ahora: Fecha): string {
    if (finishedAt === null || finishedAt === undefined) return "Votación cerrada";
    const cierre = new Date(finishedAt).getTime() + MVP_VOTING_WINDOW_MS;
    if (new Date(ahora).getTime() > cierre) return "Votación cerrada";
    return `Cierra ${cuandoEs(cierre, ahora)}, ${horaMadrid(cierre)}`;
}

// ─── Equipos ──────────────────────────────────────────────────────────────────

/** El equipo A es el Rojo y el B, el Azul. */
export function equipoDeTeam(team: MatchParticipant["team"]): Equipo | null {
    if (team === "A") return "rojo";
    if (team === "B") return "azul";
    return null;
}

function nombreEquipo(equipo: Equipo): string {
    return equipo === "rojo" ? "Rojo" : "Azul";
}

function otroEquipo(equipo: Equipo): Equipo {
    return equipo === "rojo" ? "azul" : "rojo";
}

/** "El martes va de azul", "Hoy va de rojo". */
export function titularPetoJugador({ equipo, fecha, ahora }: { equipo: Equipo; fecha: Fecha; ahora: Fecha }): string {
    return capitalizar(`${cuandoEs(fecha, ahora)} va de ${equipo}`);
}

// ─── Portada ──────────────────────────────────────────────────────────────────

type ParticipantePortada = Pick<MatchParticipant, "user_id" | "team">;

export type PartidoPortada = Pick<Match, "id" | "date" | "location" | "max_players" | "status"> & {
    participants: readonly ParticipantePortada[];
};

type ConPartido = { linea: string; faltan: number; hoy: boolean };

export type EstadoPortada =
    | { estado: "sin-partido"; respuesta: string; linea: null; faltan: 0; hoy: false; equipo: null; textoSalida: null }
    | (ConPartido & { estado: "apuntado"; respuesta: string; equipo: null; textoSalida: string })
    | (ConPartido & { estado: "con-equipo"; respuesta: string; equipo: Equipo; textoSalida: string })
    | (ConPartido & { estado: "libre"; respuesta: string; equipo: null; textoSalida: null })
    | (ConPartido & { estado: "lleno"; respuesta: string; equipo: null; textoSalida: null });

/** "Faltan 3", "Falta 1", "Completo". */
export function textoFaltan(faltan: number): string {
    if (faltan <= 0) return "Completo";
    return `${faltan === 1 ? "Falta" : "Faltan"} ${faltan}`;
}

function textoSalida(faltanSiTeVas: number): string {
    if (faltanSiTeVas <= 0) return "Si te vas, sigue lleno";
    return `Si te vas, ${textoFaltan(faltanSiTeVas).toLowerCase()}`;
}

function conSitio(cuando: string, sitio: string): string {
    const limpio = sitio.trim();
    return limpio ? `${cuando}, ${limpio}` : cuando;
}

/**
 * El día del partido manda «Hoy, 20:00.» sobre «Juegas.», «¿Juegas?» y «Sin plaza.»,
 * pero no sobre el peto: «De rojo.» es lo que tiñe la pantalla ese día.
 * El estado no cambia con hoy, así que la acción se decide igual que cualquier otro día.
 */
export function estadoPortada({
    partido,
    yo,
    ahora,
}: {
    partido: PartidoPortada | null | undefined;
    yo: string | null | undefined;
    ahora: Fecha;
}): EstadoPortada {
    if (
        !partido ||
        partido.status === "finished" ||
        partido.status === "cancelled" ||
        diasHasta(partido.date, ahora) < 0
    ) {
        return {
            estado: "sin-partido",
            respuesta: "No hay pachanga.",
            linea: null,
            faltan: 0,
            hoy: false,
            equipo: null,
            textoSalida: null,
        };
    }

    const hoy = diasHasta(partido.date, ahora) === 0;
    const hora = horaMadrid(partido.date);
    const respuestaHoy = `Hoy, ${hora}.`;
    const linea = conSitio(hoy ? `Hoy, ${hora}` : fechaCorta(partido.date), partido.location);
    // Si la respuesta ya dice la hora, debajo solo hace falta el sitio.
    const lineaBajoHoy = hoy ? partido.location.trim() : linea;

    const faltan = Math.max(0, partido.max_players - partido.participants.length);
    const miPlaza = yo ? partido.participants.find((p) => p.user_id === yo) : undefined;

    if (miPlaza) {
        const salida = textoSalida(partido.max_players - partido.participants.length + 1);
        const equipo = equipoDeTeam(miPlaza.team);
        if (equipo) {
            return { estado: "con-equipo", respuesta: `De ${equipo}.`, linea, faltan, hoy, equipo, textoSalida: salida };
        }
        return {
            estado: "apuntado",
            respuesta: hoy ? respuestaHoy : "Juegas.",
            linea: lineaBajoHoy,
            faltan,
            hoy,
            equipo: null,
            textoSalida: salida,
        };
    }

    if (partido.status === "open" && faltan > 0) {
        return {
            estado: "libre",
            respuesta: hoy ? respuestaHoy : "¿Juegas?",
            linea: lineaBajoHoy,
            faltan,
            hoy,
            equipo: null,
            textoSalida: null,
        };
    }

    // joinMatch solo admite partidos abiertos: cerrado con huecos es sin plaza igual.
    return {
        estado: "lleno",
        respuesta: hoy ? respuestaHoy : "Sin plaza.",
        linea: lineaBajoHoy,
        faltan: 0,
        hoy,
        equipo: null,
        textoSalida: null,
    };
}

const MAX_LINEA_RESPUESTA = 12;

/**
 * El --chars de .t-respuesta: lo que ocupa su línea más ancha.
 * Lo que no cabe en una línea parte en dos y manda la palabra más larga.
 */
export function charsRespuesta(respuesta: string): number {
    if (respuesta.length > MAX_LINEA_RESPUESTA) {
        return Math.max(...respuesta.split(" ").map((palabra) => palabra.length));
    }
    // El punto final casi no ocupa: «Juegas.» vale 6,4, el valor por defecto de la clase.
    return respuesta.endsWith(".") ? respuesta.length - 0.6 : respuesta.length;
}

/** "Sin decir nada: Manolín, Javi y Hugo", y si son más, "Manolín, Javi, Hugo y 4 más". */
export function textoSinDecirNada(nombres: readonly string[], tope = 3): string | null {
    if (nombres.length === 0) return null;
    // «y 1 más» ocupa lo mismo que el nombre que se calla: se dice el nombre.
    if (nombres.length > tope + 1) {
        return `Sin decir nada: ${nombres.slice(0, tope).join(", ")} y ${nombres.length - tope} más`;
    }
    return `Sin decir nada: ${listaNombres(nombres)}`;
}

/** "¿Juego el martes?", "¿Juego hoy?". Sin partido a la vista, "¿Hay pachanga?". */
export function preguntaPortada(fecha: Fecha | null | undefined, ahora: Fecha): string {
    if (fecha === null || fecha === undefined) return "¿Hay pachanga?";
    return `¿Juego ${cuandoEs(fecha, ahora)}?`;
}

/** Cuando no se ha podido leer el partido: decirlo, no fingir que no hay. */
export const PORTADA_SIN_DATOS = { respuesta: "Ni idea.", linea: "No se ha podido cargar el partido." } as const;

/**
 * Portada: el próximo partido abierto o cerrado en el que estás; si no, el abierto más cercano.
 * Los partidos en los que estás siguen aquí todo el día de partido, aunque ya hayan empezado.
 * "otros" son los abiertos que quedan, sin los que ya han empezado.
 */
export function elegirPartidoPortada<P extends PartidoPortada>(
    partidos: readonly P[],
    yo: string | null | undefined,
    ahora: Fecha
): { partido: P | null; otros: P[] } {
    const instante = (fecha: Fecha) => new Date(fecha).getTime();
    const vigentes = partidos
        .filter((p) => (p.status === "open" || p.status === "closed") && diasHasta(p.date, ahora) >= 0)
        .sort((a, b) => instante(a.date) - instante(b.date));
    const abiertos = vigentes.filter((p) => p.status === "open" && instante(p.date) >= instante(ahora));

    const partido =
        (yo ? vigentes.find((p) => p.participants.some((plaza) => plaza.user_id === yo)) : undefined) ??
        abiertos[0] ??
        null;
    return { partido, otros: abiertos.filter((p) => p.id !== partido?.id) };
}

/** Lo que se lee bajo «De rojo.»: dos compañeros grandes, el resto y quién hay enfrente. */
export function textoConEquipo({
    equipo,
    companeros,
    rivales,
}: {
    equipo: Equipo;
    companeros: readonly string[];
    rivales: readonly string[];
}): { con: string; resto: string | null; enfrente: string | null } {
    const [primeros, resto] = [companeros.slice(0, 2), companeros.slice(2)];
    const enfrente = rivales.length > 0
        ? `Enfrente, de ${otroEquipo(equipo)}: ${conPunto(listaNombres(rivales))}`
        : null;
    return {
        con: primeros.length > 0 ? `Con ${listaNombres(primeros)}` : "De momento, tú solo",
        resto: resto.length > 0
            ? `${capitalizar(conjuncion(resto[0]))} ${conPunto(listaNombres(resto))}`
            : null,
        enfrente,
    };
}

/** "Segundo, 1087 RP". Sin los partidos mínimos no hay puesto: "Aún no cuentas, 1000 RP". */
export function lineaPuesto({ posicion, rp }: { posicion: number | null | undefined; rp: number }): string {
    if (!posicion || posicion < 1) return `Aún no cuentas, ${rp} RP`;
    return `${capitalizar(ordinal(posicion))}, ${rp} RP`;
}

/** "8 han pagado · 3 deben · 3 libres". Lo que está a cero no se dice. */
export function leyendaPlazas({ pagados, deben, libres }: { pagados: number; deben: number; libres: number }): string {
    const partes: string[] = [];
    if (pagados > 0) partes.push(`${pagados} ${pagados === 1 ? "ha pagado" : "han pagado"}`);
    if (deben > 0) partes.push(`${deben} ${deben === 1 ? "debe" : "deben"}`);
    if (libres > 0) partes.push(plural(libres, "libre"));
    return partes.join(" · ");
}

// ─── Crónica ──────────────────────────────────────────────────────────────────

export type ParticipanteCronica = {
    nombre: string | null;
    equipo: Equipo | null;
    goles: number;
    posicion?: Profile["position"];
};

export type HechoCronica =
    | "equipo-entero"
    | "portero-goleador"
    | "hat-trick-derrota"
    | "goleada"
    | "empate"
    | "por-la-minima"
    | "generico"
    | "sin-resultado";

export type Cronica = { titular: string; frasePanenka: string; hecho: HechoCronica };

type FilaPartido = Pick<MatchParticipant, "team" | "goals"> & {
    profiles?: Pick<Profile, "username" | "position"> | null;
};

/** De la fila de match_participants a lo que necesita titularCronica. */
export function participanteCronica(fila: FilaPartido): ParticipanteCronica {
    return {
        nombre: fila.profiles?.username ?? null,
        equipo: equipoDeTeam(fila.team),
        goles: fila.goals,
        posicion: fila.profiles?.position ?? null,
    };
}

type HechoConChiste = Exclude<HechoCronica, "sin-resultado">;

const CHISTES_CRONICA: Record<HechoConChiste, readonly string[]> = {
    "equipo-entero": [
        "Marcar, marcaron todos. Defender ya es otra conversación.",
        "Un gol para cada uno, como los caramelos en la cabalgata.",
        "Repartieron los goles como quien divide la cuenta.",
        "Cuando marca todo el mundo, el problema está en la otra portería.",
    ],
    "portero-goleador": [
        "Un portero en la lista de goleadores. Los delanteros, bien, gracias.",
        "Fue, marcó y volvió. Los delanteros siguen buscando el camino.",
        "Cuando marca el de los guantes, mejor no preguntar por los de arriba.",
        "Gol desde la portería. Otros llevan toda la temporada intentándolo desde más cerca.",
    ],
    "hat-trick-derrota": [
        "El fútbol es injusto. Y su defensa, también.",
        "Goles no faltaron. Faltó todo lo demás.",
        "Hay días en que ni marcando sales ganando.",
        "Se hartó de marcar y le sirvió de lo que le sirvió.",
    ],
    goleada: [
        "Se acabó pronto. Se siguió jugando por educación.",
        "He visto partidos más igualados en el recreo.",
        "A partir del cuarto dejé de mirar.",
        "El marcador lo dice todo y yo prefiero no añadir nada.",
    ],
    empate: [
        "Nadie ganó. Nadie aprendió nada tampoco.",
        "Reparto de puntos y de culpas.",
        "Una hora corriendo para quedarse igual.",
        "Empate. Todos contentos, que es lo preocupante.",
    ],
    "por-la-minima": [
        "Un gol de diferencia. Para lo que se vio, es mucho.",
        "Ganaron por la mínima y lo contarán por la máxima.",
        "Fue ajustado. Nadie jugó bien, pero fue ajustado.",
        "Por uno. Toda la semana oyéndolo, y por uno.",
    ],
    generico: [
        "Ganó quien metió más. Hasta ahí llego.",
        "Partido normal. Que ya es mucho decir.",
        "Hubo goles, hubo quejas y hubo discusión por el último. Lo de siempre.",
        "Nada que no hayáis hecho mal otras veces.",
    ],
};

const CHISTES_CERO_A_CERO = [
    "Goles: nadie. Las redes siguen como nuevas.",
    "Yo tampoco vi nada. Y eso que lo vi todo.",
    "Se jugó, dicen. No hay pruebas.",
    "Dos porterías y ninguna corrió peligro. Ni ellas se lo creen.",
];

const CHISTES_SIN_GOLEADORES = [
    "Goles hubo. De quién, no consta. Cómodo.",
    "Nadie apuntó quién marcó. Así todos fueron el pichichi.",
    "El marcador existe. Los goleadores, según a quién preguntes.",
    "Sin goleadores apuntados. Mañana los reclamarán todos.",
];

const CHISTES_SIN_RESULTADO = [
    "Nadie apuntó el resultado. Se jugó, dicen.",
    "Acabó, pero nadie sabe cómo. Ni yo, y mira que lo vi todo.",
    "Sin marcador. Así no pierde nadie, que es lo que se buscaba.",
    "El resultado sigue en la cabeza del organizador. Ahí se queda.",
];

function esPortero(p: ParticipanteCronica): boolean {
    return p.posicion === "GK";
}

function titularResultado(
    id: string,
    golesGanador: number,
    golesPerdedor: number,
    ganador: Equipo
): { titular: string; hecho: HechoConChiste } {
    const nombre = nombreEquipo(ganador);
    const perdedor = nombreEquipo(otroEquipo(ganador));
    const diferencia = golesGanador - golesPerdedor;
    const golesPalabra = numeroPalabra(golesGanador);

    if (diferencia >= UMBRAL_GOLEADA) {
        return {
            hecho: "goleada",
            titular: elegir(id, "titular-goleada", [
                `El ${nombre} le hizo ${golesPalabra} al ${perdedor}`,
                `Al ${perdedor} le cayeron ${golesPalabra}`,
                `El ${perdedor} se llevó ${golesPalabra}`,
                `Goleada del ${nombre}`,
            ]),
        };
    }
    if (diferencia === 1) {
        return {
            hecho: "por-la-minima",
            titular: elegir(id, "titular-minima", [
                `El ${nombre}, por la mínima`,
                `Ganó el ${nombre} por uno`,
                `Por un gol: el ${nombre}`,
                `El ${nombre}, por los pelos`,
            ]),
        };
    }
    return {
        hecho: "generico",
        titular: elegir(id, "titular-generico", [
            `Ganó el ${nombre}`,
            `El ${nombre} se lo llevó`,
            `Victoria del ${nombre}`,
            `${capitalizar(golesPalabra)} a ${numeroPalabra(golesPerdedor)} para el ${nombre}`,
        ]),
    };
}

function titularEmpate(id: string, goles: number): string {
    if (goles === 0) {
        return elegir(id, "titular-cero", ["Cero a cero", "Nadie marcó", "Ni un gol", "Cero a cero y a casa"]);
    }
    const n = numeroPalabra(goles);
    return elegir(id, "titular-empate", [
        `Empate a ${n}`,
        `${capitalizar(n)} a ${n} y a casa`,
        `Nadie ganó: ${n} a ${n}`,
        `Empate a ${n} y sin culpables`,
    ]);
}

/**
 * El titular es el hecho más raro del partido, por este orden: marcó todo un equipo,
 * marcó un portero, tres o más goles en derrota, goleada, empate, por la mínima y genérico.
 * Los hechos raros que no llegan a titular los cuenta Panenka debajo.
 * "id" es el del partido; sin él, las variantes salen del marcador.
 */
export function titularCronica({
    id,
    rojo,
    azul,
    participantes,
}: {
    id?: string;
    rojo: number | null | undefined;
    azul: number | null | undefined;
    participantes: readonly ParticipanteCronica[];
}): Cronica {
    const semilla = id ?? `${rojo}-${azul}`;

    if (rojo === null || rojo === undefined || azul === null || azul === undefined) {
        return {
            titular: "Sin resultado",
            frasePanenka: elegir(semilla, "sin-resultado", CHISTES_SIN_RESULTADO),
            hecho: "sin-resultado",
        };
    }

    const ganador: Equipo | null = rojo === azul ? null : rojo > azul ? "rojo" : "azul";
    const perdedor = ganador && otroEquipo(ganador);
    const miembros = (equipo: Equipo) => participantes.filter((p) => p.equipo === equipo);
    const golesDe = (equipo: Equipo) => (equipo === "rojo" ? rojo : azul);
    const conPlantilla = (equipo: Equipo) => miembros(equipo).length >= 3;
    const marcaronTodos = (equipo: Equipo) => conPlantilla(equipo) && miembros(equipo).every((p) => p.goles > 0);

    const titularEquipoEntero = (): string | null => {
        const [r, a] = [marcaronTodos("rojo"), marcaronTodos("azul")];
        if (r && a) return `Marcaron los ${numeroPalabra(miembros("rojo").length + miembros("azul").length)}`;
        if (!r && !a) return null;
        const equipo: Equipo = r ? "rojo" : "azul";
        return `Marcaron los ${numeroPalabra(miembros(equipo).length)} del ${nombreEquipo(equipo)}`;
    };

    const porteros = participantes.filter((p) => p.equipo !== null && esPortero(p) && p.goles > 0);
    const titularPortero = (): string | null => {
        if (porteros.length === 0) return null;
        if (porteros.length > 1) return `Marcaron los ${numeroPalabra(porteros.length)} porteros`;
        const [portero] = porteros;
        const nombre = limpiarNombre(portero.nombre);
        if (!nombre) {
            return portero.goles > 1
                ? `${capitalizar(numeroPalabra(portero.goles))} goles desde la portería`
                : "Gol desde la portería";
        }
        const goles = numeroPalabra(portero.goles);
        return portero.goles > 1
            ? ajustar([`${nombre}, portero, metió ${goles}`, `${nombreCorto(nombre)}, portero, metió ${goles}`])
            : ajustar([`Marcó ${nombre}, el portero`, `Marcó ${nombreCorto(nombre)}, el portero`]);
    };

    const hatTrick = perdedor
        ? [...miembros(perdedor)]
              .filter((p) => p.goles >= 3)
              .sort((a, b) => b.goles - a.goles || (a.nombre ?? "").localeCompare(b.nombre ?? "", "es"))[0]
        : undefined;

    const titularHatTrick = (): string | null => {
        if (!hatTrick) return null;
        const goles = numeroPalabra(hatTrick.goles);
        const nombre = limpiarNombre(hatTrick.nombre);
        if (!nombre) return `${capitalizar(goles)} goles y derrota igual`;
        return ajustar([
            `${nombre} metió ${goles} y perdió igual`,
            `${nombre}, ${goles} y perdió igual`,
            `${nombreCorto(nombre)}, ${goles} y perdió igual`,
        ]);
    };

    // Segundos hechos, en la voz de Panenka, para cuando no son el titular.
    const fraseHatTrick = (): string | null => {
        if (!hatTrick || !perdedor || !ganador) return null;
        const quien = limpiarNombre(hatTrick.nombre) ?? "Alguien";
        const delEquipo = `del ${nombreEquipo(perdedor)}`;
        const golesEquipo = golesDe(perdedor);
        const cuantos = hatTrick.goles >= golesEquipo
            ? `los ${numeroPalabra(golesEquipo)} ${delEquipo}`
            : `${numeroPalabra(hatTrick.goles)} de los ${numeroPalabra(golesEquipo)} ${delEquipo}`;
        return `${quien} metió ${cuantos} y perdió por ${numeroPalabra(golesDe(ganador) - golesEquipo)}.`;
    };

    const frasePortero = (): string | null => {
        if (porteros.length === 0) return null;
        if (porteros.length > 1) return `Los ${numeroPalabra(porteros.length)} porteros también.`;
        const nombre = limpiarNombre(porteros[0].nombre);
        return nombre ? `${nombre} también, y es portero.` : "Hasta marcaron bajo palos.";
    };

    const candidatos: { hecho: HechoConChiste; titular: () => string | null; frases: (() => string | null)[] }[] = [
        { hecho: "equipo-entero", titular: titularEquipoEntero, frases: [frasePortero, fraseHatTrick] },
        { hecho: "portero-goleador", titular: titularPortero, frases: [fraseHatTrick] },
        { hecho: "hat-trick-derrota", titular: titularHatTrick, frases: [] },
    ];

    const totalGoleadores = participantes.filter((p) => p.equipo !== null).reduce((suma, p) => suma + p.goles, 0);
    const sinGoleadores = rojo + azul > 0 && totalGoleadores === 0;

    for (const candidato of candidatos) {
        const titular = candidato.titular();
        if (!titular) continue;
        const extras = candidato.frases.map((frase) => frase()).filter((frase) => frase !== null);
        return {
            titular: capitalizar(titular),
            hecho: candidato.hecho,
            frasePanenka: extras.length > 0
                ? extras.join(" ")
                : elegir(semilla, `chiste-${candidato.hecho}`, CHISTES_CRONICA[candidato.hecho]),
        };
    }

    const resultado: { titular: string; hecho: HechoConChiste } = ganador
        ? titularResultado(semilla, Math.max(rojo, azul), Math.min(rojo, azul), ganador)
        : { hecho: "empate", titular: titularEmpate(semilla, rojo) };

    let chistes = CHISTES_CRONICA[resultado.hecho];
    if (rojo === 0 && azul === 0) chistes = CHISTES_CERO_A_CERO;
    if (sinGoleadores) chistes = CHISTES_SIN_GOLEADORES;

    return { ...resultado, frasePanenka: elegir(semilla, `chiste-${resultado.hecho}`, chistes) };
}

// ─── Ranking ──────────────────────────────────────────────────────────────────

export type RivalRanking = { nombre: string | null; distancia: number } | null | undefined;

function distanciaA(rival: NonNullable<RivalRanking>): number {
    return Math.abs(Math.round(rival.distancia));
}

function titularLider(totalEnTabla: number, siguiente: RivalRanking): string {
    if (totalEnTabla <= 1 || !siguiente) return "Líder. No hay nadie más.";
    const distancia = distanciaA(siguiente);
    const nombre = limpiarNombre(siguiente.nombre);
    if (!nombre) return distancia === 0 ? "Líder, en empate." : `Líder, ${distancia} por delante.`;
    if (distancia === 0) {
        return ajustar([`Líder, a la par de ${nombre}`, `Líder, a la par de ${nombreCorto(nombre)}`].map(conPunto));
    }
    return ajustar(
        [`Líder, ${distancia} por delante de ${nombre}`, `Líder, ${distancia} por delante de ${nombreCorto(nombre)}`].map(conPunto)
    );
}

/**
 * "anterior" es quien va justo por encima y "siguiente" quien va justo por debajo,
 * con la distancia en puntos. Empatado a puntos se dice «a la par», no «a 0 de».
 * Sin nombre, la frase evita el género: «a 47 de subir», nunca «del anterior».
 */
export function titularRanking({
    posicion,
    totalEnTabla,
    partidos,
    umbralProvisional = PROVISIONAL_THRESHOLD,
    anterior,
    siguiente,
}: {
    posicion: number | null | undefined;
    totalEnTabla: number;
    partidos: number;
    umbralProvisional?: number;
    anterior?: RivalRanking;
    siguiente?: RivalRanking;
}): string {
    const restantes = umbralProvisional - partidos;
    if (restantes > 0) {
        return `Aún no cuentas. Te ${elegirPlural(restantes, "falta", "faltan")} ${plural(restantes, "partido")}.`;
    }
    if (!posicion || posicion < 1) return "Aún no cuentas.";
    if (posicion === 1) return titularLider(totalEnTabla, siguiente);

    const puesto = capitalizar(ordinal(posicion));
    const empatado = !!anterior && distanciaA(anterior) === 0;

    if (posicion >= totalEnTabla && !empatado) return "Último. Alguien tiene que serlo.";
    if (!anterior) return `${puesto}.`;

    const distancia = distanciaA(anterior);
    const nombre = limpiarNombre(anterior.nombre);
    if (!nombre) return empatado ? `${puesto}, en empate.` : `${puesto}, a ${distancia} de subir.`;
    if (empatado) {
        return ajustar([`${puesto}, a la par de ${nombre}`, `${puesto}, a la par de ${nombreCorto(nombre)}`].map(conPunto));
    }
    return ajustar([`${puesto}, a ${distancia} de ${nombre}`, `${puesto}, a ${distancia} de ${nombreCorto(nombre)}`].map(conPunto));
}

const POSICION_CON_ARTICULO: Record<Posicion, string> = {
    GK: "un portero",
    DEF: "un defensa",
    MID: "un medio",
    FWD: "un delantero",
};

const PANENKA_RANKING = {
    provisional: [
        "Primero juega algo y luego hablamos.",
        "Aquí se entra jugando. Dicen.",
        "Sin partidos suficientes no hay tabla. Ni disgustos.",
        "Con tan poco no me da ni para meterme contigo.",
    ],
    ultimo: [
        "Alguien tenía que sujetar la tabla por abajo.",
        "Desde ahí solo se puede subir. En teoría.",
        "La tabla también necesita cimientos.",
        "Lo bueno de estar ahí abajo es que no te persigue nadie.",
    ],
    lider: [
        "Primero. A mí tampoco me lo explica nadie.",
        "Arriba del todo. Mira quién viene detrás y lo entenderás.",
        "Disfrútalo. Esta liga no aguanta dos semanas igual.",
        "Liderato. Lo normal sería preocuparse por la liga.",
    ],
    mitad: [
        "Mitad de tabla. Ni para presumir ni para esconderse.",
        "Mitad de tabla. Aquí no mira nadie.",
        "Ni arriba ni abajo. Mitad de tabla, que es decir poco.",
        "En mitad de la tabla se está tranquilo. Otro mérito no tiene.",
    ],
    general: [
        "Ahí andas. No es un elogio ni lo contrario.",
        "La tabla es la que es. Yo solo la miro.",
        "Hay tablas más igualadas, pero no más raras.",
        "Unos suben, otros bajan y nadie mejora. Es precioso.",
    ],
} as const;

/**
 * "id" decide la variante: con el del último partido terminado, cambia cada semana.
 * Los hechos de la tabla van antes que los chistes de plantilla.
 */
export function frasePanenkaRanking({
    id,
    pichichi,
    segundoGoleador,
    rachaEquipo,
    posicion,
    totalEnTabla,
    partidos,
    umbralProvisional = PROVISIONAL_THRESHOLD,
}: {
    id: string;
    pichichi?: { posicion?: Profile["position"] } | null;
    segundoGoleador?: { posicion?: Profile["position"] } | null;
    rachaEquipo?: { equipo: Equipo; partidos: number } | null;
    posicion?: number | null;
    totalEnTabla?: number;
    partidos?: number;
    umbralProvisional?: number;
}): string {
    if (rachaEquipo && rachaEquipo.partidos >= 3) {
        const seguidas = capitalizar(numeroPalabra(rachaEquipo.partidos, "f"));
        const rival = nombreEquipo(otroEquipo(rachaEquipo.equipo));
        return `${seguidas} seguidas del ${nombreEquipo(rachaEquipo.equipo)}. El ${rival}, ni está ni se le espera.`;
    }

    if (pichichi?.posicion && pichichi.posicion !== "FWD") {
        const primero = `Pichichi, ${POSICION_CON_ARTICULO[pichichi.posicion]}.`;
        const segundo = segundoGoleador?.posicion;
        if (segundo && segundo !== "FWD") {
            return `${primero} Segundo, ${POSICION_CON_ARTICULO[segundo]}. Así estamos.`;
        }
        return `${primero} Los delanteros, bien, gracias.`;
    }

    if (partidos !== undefined && partidos < umbralProvisional) {
        return elegir(id, "ranking-provisional", PANENKA_RANKING.provisional);
    }
    if (posicion === 1) return elegir(id, "ranking-lider", PANENKA_RANKING.lider);
    if (posicion && totalEnTabla && totalEnTabla > 1 && posicion >= totalEnTabla) {
        return elegir(id, "ranking-ultimo", PANENKA_RANKING.ultimo);
    }
    // El tercio central: decirle «mitad de tabla» al tercero de 18 sería mentira.
    if (posicion && totalEnTabla && posicion * 3 > totalEnTabla && posicion * 3 <= totalEnTabla * 2) {
        return elegir(id, "ranking-mitad", PANENKA_RANKING.mitad);
    }
    return elegir(id, "ranking-general", PANENKA_RANKING.general);
}

// ─── Jugador ──────────────────────────────────────────────────────────────────

/** Rachas vigentes, contadas desde el último partido hacia atrás. */
export type Racha = {
    victorias?: number;
    derrotas?: number;
    sinPerder?: number;
    sinGanar?: number;
    sinMarcar?: number;
};

export type PartidoRacha = { resultado: "V" | "E" | "D"; goles: number };

/** Recibe el historial con el partido más reciente primero. */
export function calcularRacha(historial: readonly PartidoRacha[]): Required<Racha> {
    const seguidos = (cumple: (partido: PartidoRacha) => boolean) => {
        const corte = historial.findIndex((partido) => !cumple(partido));
        return corte === -1 ? historial.length : corte;
    };
    return {
        victorias: seguidos((p) => p.resultado === "V"),
        derrotas: seguidos((p) => p.resultado === "D"),
        sinPerder: seguidos((p) => p.resultado !== "D"),
        sinGanar: seguidos((p) => p.resultado !== "V"),
        sinMarcar: seguidos((p) => p.goles === 0),
    };
}

export type DatosJugador = {
    nombre?: string | null;
    partidos: number;
    goles: number;
    mvps: number;
    victorias: number;
    empates: number;
    derrotas: number;
    racha?: Racha | null;
    posicion?: Profile["position"];
    umbralProvisional?: number;
};

const golesEn = (n: number) => enPalabras(n, "gol");
const partidosEn = (n: number) => enPalabras(n, "partido");
const victoriasEn = (n: number) => enPalabras(n, "victoria", "victorias", "f");
const derrotasEn = (n: number) => enPalabras(n, "derrota", "derrotas", "f");
const mvpsEn = (n: number) => enPalabras(n, "MVP", "MVPs");

const RACHA_TITULAR = 5;
const RACHA_SEGUIDAS = 3;

function sinMarcarDe({ goles: total, partidos, racha, posicion }: DatosJugador): number {
    // A un portero no se le reprocha no marcar.
    if (posicion === "GK") return 0;
    return total === 0 ? partidos : racha?.sinMarcar ?? 0;
}

/** El dato más llamativo de la ficha. "nombre" solo decide si se puede decir «Invicto». */
export function titularJugador(datos: DatosJugador): string {
    const {
        nombre,
        partidos,
        goles: totalGoles,
        mvps,
        victorias,
        racha,
        umbralProvisional = PROVISIONAL_THRESHOLD,
    } = datos;

    if (partidos <= 0) return "Sin partidos. Sin excusas.";

    if (partidos < umbralProvisional) {
        return capitalizar(
            totalGoles > 0
                ? `${partidosEn(partidos)} y ${golesEn(totalGoles)}`
                : `${partidosEn(partidos)}, nada que contar`
        );
    }

    const sinPerder = racha?.sinPerder ?? 0;
    if (sinPerder >= RACHA_TITULAR) {
        return limpiarNombre(nombre)
            ? `Invicto en ${partidosEn(sinPerder)}`
            : capitalizar(`${partidosEn(sinPerder)} sin perder`);
    }

    const sinMarcar = sinMarcarDe(datos);
    if (sinMarcar >= RACHA_TITULAR) return capitalizar(`${partidosEn(sinMarcar)} sin marcar`);

    if (totalGoles >= 5 && mvps === 0) return capitalizar(`${golesEn(totalGoles)} y ni un MVP`);

    if ((racha?.victorias ?? 0) >= RACHA_SEGUIDAS) {
        return capitalizar(`${victoriasEn(racha?.victorias ?? 0)} seguidas`);
    }
    if ((racha?.derrotas ?? 0) >= RACHA_SEGUIDAS) {
        return capitalizar(`${derrotasEn(racha?.derrotas ?? 0)} seguidas`);
    }
    if ((racha?.sinGanar ?? 0) >= RACHA_TITULAR) {
        return capitalizar(`${partidosEn(racha?.sinGanar ?? 0)} sin ganar`);
    }

    if (mvps >= 2 && mvps > totalGoles) return "Más MVPs que goles";
    if (mvps >= 3) return capitalizar(`${mvpsEn(mvps)} en ${partidosEn(partidos)}`);
    if (totalGoles >= 5 && totalGoles >= partidos) return capitalizar(`${golesEn(totalGoles)} en ${partidosEn(partidos)}`);

    if (victorias === 0) return capitalizar(`${partidosEn(partidos)} sin una victoria`);

    return capitalizar(
        ajustar([
            `${victoriasEn(victorias)} en ${partidosEn(partidos)}`,
            `${victoriasEn(victorias)} de ${numeroPalabra(partidos, "f")}`,
        ])
    );
}

const PANENKA_JUGADOR = {
    nuevo: [
        "Aquí no hay nada que mirar. Vuelve cuando juegue.",
        "Nada que reprochar todavía. Dale tiempo.",
        "Ficha en blanco. Es lo mejor que le va a pasar.",
        "Aún no ha fallado nada. Disfrutemos el momento.",
    ],
    sinMvp: [
        "0 MVPs. Insiste.",
        "Ni un MVP. Las votaciones son libres, por desgracia.",
        "El MVP sigue siendo cosa de otros. Por ahora.",
        "Ni un voto que sirviera de algo. Se sigue intentando.",
    ],
    invicto: [
        "Sin perder. Algo estarán haciendo mal los demás.",
        "No pierde. Yo tampoco me lo explico.",
        "Sin perder en esta liga. No lo pondría en el currículum.",
        "Alguna vez perderá. Yo tengo tiempo.",
    ],
    sinMarcar: [
        "La portería sigue en el mismo sitio. Por si ayuda.",
        "Lo de marcar, otro día.",
        "Hay quien viene a marcar y hay quien viene a estar.",
        "El gol volverá. O no. Yo no prometo nada.",
    ],
    malaRacha: [
        "Rachas así las tiene cualquiera. Bueno, cualquiera no.",
        "Perder también es constancia.",
        "Las estadísticas no mienten, pero se podrían callar un rato.",
        "Mejorar no cuesta tanto. Eso me han dicho.",
    ],
    general: [
        "Ni fu ni fa. En esta liga, un elogio.",
        "Cumple. Que aquí ya es destacar.",
        "He visto cosas peores. Casi todas, el mismo día.",
        "Los números son los que son. Yo no los toco.",
        "Ahí va, semana tras semana. Nadie le ha pedido explicaciones.",
    ],
} as const;

/** "id" decide la variante: con jugador y último partido juntos, cambia cada semana. */
export function frasePanenkaJugador({ id, ...datos }: DatosJugador & { id: string }): string {
    const { partidos, mvps, victorias, derrotas, racha } = datos;

    if (partidos <= 0) return elegir(id, "jugador-nuevo", PANENKA_JUGADOR.nuevo);
    if ((racha?.sinPerder ?? 0) >= RACHA_TITULAR) return elegir(id, "jugador-invicto", PANENKA_JUGADOR.invicto);
    if (sinMarcarDe(datos) >= RACHA_TITULAR) return elegir(id, "jugador-sin-marcar", PANENKA_JUGADOR.sinMarcar);
    if (mvps === 0 && partidos >= 5) return elegir(id, "jugador-sin-mvp", PANENKA_JUGADOR.sinMvp);
    if ((racha?.derrotas ?? 0) >= RACHA_SEGUIDAS || derrotas > victorias * 2) {
        return elegir(id, "jugador-mala-racha", PANENKA_JUGADOR.malaRacha);
    }
    return elegir(id, "jugador-general", PANENKA_JUGADOR.general);
}

// ─── Tabla y ficha: piezas pequeñas ───────────────────────────────────────────

/** "2.º", "11.º": para las cifras, donde la palabra no cabe. */
export function ordinalCorto(n: number): string {
    return `${n}.º`;
}

/** "+17", "−15", "0". Con el menos de verdad, que mide lo mismo que el más. */
export function conSigno(n: number): string {
    if (n === 0) return "0";
    return `${n > 0 ? "+" : "−"}${Math.abs(n)}`;
}

/** La otra mitad de titularRanking: «Diego, 16 por detrás.» */
export function lineaPorDetras(siguiente: RivalRanking): string | null {
    const nombre = limpiarNombre(siguiente?.nombre);
    if (!siguiente || !nombre) return null;
    const distancia = distanciaA(siguiente);
    return conPunto(distancia === 0 ? `${nombre}, a la par` : `${nombre}, ${distancia} por detrás`);
}

/** Resultado para quien jugó en "team". Sin equipo o sin marcador no hay resultado: no se adivina. */
export function resultadoDe(
    team: MatchParticipant["team"],
    golesA: number | null | undefined,
    golesB: number | null | undefined
): PartidoRacha["resultado"] | null {
    const equipo = equipoDeTeam(team);
    if (!equipo || golesA === null || golesA === undefined || golesB === null || golesB === undefined) return null;
    if (golesA === golesB) return "E";
    return (golesA > golesB) === (equipo === "rojo") ? "V" : "D";
}

/** Victorias seguidas de un mismo equipo, con el partido más reciente primero. Un empate la corta. */
export function rachaDeEquipo(
    resultados: readonly { rojo: number | null; azul: number | null }[]
): { equipo: Equipo; partidos: number } | null {
    const ganadorDe = ({ rojo, azul }: { rojo: number | null; azul: number | null }): Equipo | null => {
        if (rojo === null || azul === null || rojo === azul) return null;
        return rojo > azul ? "rojo" : "azul";
    };
    const equipo = resultados.length > 0 ? ganadorDe(resultados[0]) : null;
    if (!equipo) return null;
    const corte = resultados.findIndex((resultado) => ganadorDe(resultado) !== equipo);
    return { equipo, partidos: corte === -1 ? resultados.length : corte };
}

const MAX_LINEA_CARTEL = 12;

/**
 * Las líneas del nombre a tamaño de cartel. Un nombre largo de varias palabras va en dos
 * líneas, por el corte que deja más corta la más ancha: así la letra sale mucho más grande.
 */
export function lineasCartel(nombre: string): string[] {
    const limpio = nombre.trim().replace(/\s+/g, " ");
    const palabras = limpio.split(" ");
    if (limpio.length <= MAX_LINEA_CARTEL || palabras.length < 2) return [limpio];

    const cortes = palabras.slice(1).map((_, i) => [
        palabras.slice(0, i + 1).join(" "),
        palabras.slice(i + 1).join(" "),
    ]);
    const ancho = (lineas: string[]) => Math.max(...lineas.map((linea) => linea.length));
    return cortes.reduce((mejor, corte) => (ancho(corte) < ancho(mejor) ? corte : mejor));
}

/** { clave: "2026-10", nombre: "Octubre" }, en Madrid. */
export function mesMadrid(fecha: Fecha): { clave: string; nombre: string } {
    const { mes, indiceDia } = enMadrid(fecha);
    const anio = new Date(indiceDia * MS_POR_DIA).getUTCFullYear();
    return { clave: `${anio}-${String(mes).padStart(2, "0")}`, nombre: capitalizar(MESES[mes - 1]) };
}

/** El error dentro del bloque que falló: una frase, sin dramatizar. */
export function fraseError(contexto: "ranking" | "jugadores"): string {
    return contexto === "ranking" ? "La tabla no ha llegado." : "Esto no ha llegado.";
}

// ─── Partidos e historial ─────────────────────────────────────────────────────

const ESTADOS_PARTIDO: Record<Match["status"], string> = {
    open: "Abierto",
    closed: "Cerrado",
    finished: "Terminado",
    cancelled: "Cancelado",
};

export function estadoPartido(status: Match["status"]): string {
    return ESTADOS_PARTIDO[status];
}

export const SIN_TERMINADOS = "Aún no se ha jugado nada.";
export const ERROR_PARTIDOS = "Los partidos no han llegado.";
export const ERROR_HISTORIAL = "Tu historial no ha llegado.";

function textoDia(indiceDia: number, indiceAhora: number, hora: string): string {
    const dias = indiceDia - indiceAhora;
    if (dias === 0) return `Hoy, ${hora}`;
    if (dias === 1) return "Mañana";
    const fecha = new Date(indiceDia * MS_POR_DIA);
    const nombre = `${capitalizar(DIAS[fecha.getUTCDay()])} ${fecha.getUTCDate()}`;
    return dias > 0 && dias < 28 ? nombre : `${nombre} ${MESES_CORTOS[fecha.getUTCMonth()]}`;
}

/** La fecha grande de la lista: "Hoy, 20:00", "Mañana", "Martes 3", "Sábado 5 dic" si queda lejos o ya pasó. */
export function diaPartido(fecha: Fecha, ahora: Fecha): string {
    const { indiceDia, hora } = enMadrid(fecha);
    return textoDia(indiceDia, enMadrid(ahora).indiceDia, hora);
}

/** Lo que va bajo la fecha: "20:00 · Campus de Barredo". Hoy la hora ya va en la fecha. */
export function lineaPartido(fecha: Fecha, lugar: string, ahora: Fecha): string {
    if (diasHasta(fecha, ahora) === 0) return lugar.trim();
    return [horaMadrid(fecha), lugar.trim()].filter(Boolean).join(" · ");
}

/** Tu situación en un partido por jugar. Mismas reglas que la portada: cerrado es sin plaza. */
export function tuPlaza({
    partido,
    yo,
    ahora,
}: {
    partido: PartidoPortada;
    yo: string | null | undefined;
    ahora: Fecha;
}): { texto: string; dentro: boolean; equipo: Equipo | null } {
    const { estado, equipo } = estadoPortada({ partido, yo, ahora });
    if (estado === "con-equipo") return { texto: `De ${equipo}`, dentro: true, equipo };
    if (estado === "apuntado") return { texto: "Juegas", dentro: true, equipo: null };
    if (estado === "libre") return { texto: "¿Juegas?", dentro: false, equipo: null };
    return { texto: "Sin plaza", dentro: false, equipo: null };
}

/** "Faltan 3", "Completo". Cerrado con huecos ya no falta nadie: "11 de 14". */
export function textoPlazas({
    ocupadas,
    plazas,
    status,
}: {
    ocupadas: number;
    plazas: number;
    status: Match["status"];
}): string {
    const faltan = plazas - ocupadas;
    if (faltan > 0 && status === "closed") return `${ocupadas} de ${plazas}`;
    return textoFaltan(faltan);
}

/** La línea de un partido terminado. Lo tuyo va antes que el sitio: el sitio es lo que puede cortarse. */
export function detalleTerminado({
    fecha,
    lugar,
    jugado,
    team,
    goles,
    mvp,
}: {
    fecha: Fecha;
    lugar: string;
    jugado: boolean;
    team: MatchParticipant["team"];
    goles: number;
    mvp: boolean;
}): string {
    const partes = [diaYMes(fecha)];
    if (!jugado) partes.push("No jugaste");
    if (jugado && !team) partes.push("Sin equipo");
    if (mvp) partes.push("MVP");
    if (goles > 0) partes.push(plural(goles, "gol"));
    if (lugar.trim()) partes.push(lugar.trim());
    return partes.join(" · ");
}

/** La respuesta de Historial. Sin partidos, el texto es el que espera el test de temporadas. */
export function titularHistorial({
    jugados,
    victorias,
    derrotas,
}: {
    jugados: number;
    victorias: number;
    derrotas: number;
}): string {
    if (jugados <= 0) return "Aún no has jugado partidos";
    const total = numeroPalabra(jugados);
    if (jugados === 1) {
        if (victorias === 1) return "Ganaste el único.";
        return derrotas === 1 ? "Perdiste el único." : "Empataste el único.";
    }
    if (victorias === jugados) return `Ganaste los ${total}.`;
    if (derrotas === jugados) return `Perdiste los ${total}.`;
    if (victorias === 0) return `Ni una victoria en ${total}.`;
    return `Ganaste ${numeroPalabra(victorias)} de ${total}.`;
}

function diaISO(indiceDia: number): string {
    return new Date(indiceDia * MS_POR_DIA).toISOString().slice(0, 10);
}

/** Valor de un datetime-local en hora de Madrid: "2026-11-03T20:00". */
export function aValorLocal(fecha: Fecha): string {
    const { indiceDia, hora } = enMadrid(fecha);
    return `${diaISO(indiceDia)}T${hora}`;
}

/** Los próximos "n" días para elegir de un toque: { valor: "2026-11-03", etiqueta: "Mar", dia: 3 }. */
export function diasElegibles(ahora: Fecha, n: number): { valor: string; etiqueta: string; dia: number }[] {
    const hoy = enMadrid(ahora).indiceDia;
    return Array.from({ length: n }, (_, i) => {
        const fecha = new Date((hoy + i) * MS_POR_DIA);
        const corto = i === 0 ? "Hoy" : i === 1 ? "Mañ" : capitalizar(DIAS[fecha.getUTCDay()].slice(0, 3));
        return { valor: diaISO(hoy + i), etiqueta: corto, dia: fecha.getUTCDate() };
    });
}

/** Repetir partido: el mismo día de la semana a la misma hora, la próxima vez que toque. */
export function fechaRepetida(origen: Fecha, ahora: Fecha): string {
    const { diaSemana, hora } = enMadrid(origen);
    const hoy = enMadrid(ahora);
    const salto = (diaSemana - hoy.diaSemana + 7) % 7 || 7;
    return `${diaISO(hoy.indiceDia + salto)}T${hora}`;
}

function indiceDeValor(valor: string): number | null {
    const partes = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}/.exec(valor);
    if (!partes) return null;
    return Date.UTC(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3])) / MS_POR_DIA;
}

/** diaPartido para el valor de un datetime-local, que no lleva zona: "Martes 3, 20:00". */
export function diaElegido(valor: string, ahora: Fecha): string | null {
    const indice = indiceDeValor(valor);
    if (indice === null) return null;
    const hora = valor.slice(11, 16);
    const hoy = enMadrid(ahora).indiceDia;
    const dia = textoDia(indice, hoy, hora);
    return indice === hoy ? dia : `${dia}, ${hora}`;
}

/** Crear un partido en pasado se puede: es para apuntar uno ya jugado. Solo se avisa. */
export function elegidoPasado(valor: string, ahora: Fecha): boolean {
    const indice = indiceDeValor(valor);
    if (indice === null) return false;
    const { indiceDia, hora } = enMadrid(ahora);
    return indice < indiceDia || (indice === indiceDia && valor.slice(11, 16) < hora);
}

// ─── Detalle del partido ──────────────────────────────────────────────────────

/**
 * La línea enorme del partido. El peto solo manda cuando ya no falta nadie:
 * mientras haya huecos, lo que hay que saber es cuántos.
 */
export function respuestaPartido({
    status,
    faltan,
    equipo = null,
    pasado = false,
}: {
    status: Match["status"];
    faltan: number;
    equipo?: Equipo | null;
    pasado?: boolean;
}): string {
    if (status === "cancelled") return "Cancelado";
    if (pasado && status !== "finished") return "Falta el resultado";
    if (status === "closed") return equipo ? `De ${equipo}.` : "Cerrado";
    if (faltan <= 0 && equipo) return `De ${equipo}.`;
    return textoFaltan(faltan);
}

/** "Buscar 3 por WhatsApp", "Buscar 1 por WhatsApp". */
export function textoBuscar(faltan: number): string {
    return `Buscar ${faltan} por WhatsApp`;
}

/** "Debe Iván", "Deben Sergio, Óscar e Iván", "Deben Sergio, Óscar, Iván y 2 más". */
export function textoDeben(nombres: readonly string[], tope = 3): string | null {
    if (nombres.length === 0) return null;
    const verbo = nombres.length === 1 ? "Debe" : "Deben";
    if (nombres.length > tope) {
        return `${verbo} ${nombres.slice(0, tope).join(", ")} y ${nombres.length - tope} más`;
    }
    return `${verbo} ${listaNombres(nombres)}`;
}

/** Lo que le falta a la plantilla, en dos palabras. Null si no falta nada que contar. */
export function notaPlantilla(
    jugadores: readonly { nombre: string | null; posicion: Profile["position"] }[]
): string | null {
    if (jugadores.length === 0) return null;
    if (!jugadores.some((j) => j.posicion === "GK")) return "Sin portero";
    const delanteros = jugadores.filter((j) => j.posicion === "FWD");
    if (delanteros.length === 0) return "Arriba, nadie";
    const nombre = limpiarNombre(delanteros[0].nombre);
    return delanteros.length === 1 && nombre ? `Arriba, solo ${nombreCorto(nombre)}` : null;
}

/** El texto que se manda por WhatsApp. Terminado o cancelado no invita a nadie a venir. */
export function textoWhatsApp({
    status,
    location,
    date,
    url,
    faltan = 0,
    rojo,
    azul,
}: {
    status: Match["status"];
    location: string;
    date: Fecha;
    url: string;
    faltan?: number;
    rojo?: number | null;
    azul?: number | null;
}): string {
    const conResultado = rojo !== null && rojo !== undefined && azul !== null && azul !== undefined;
    const cabecera =
        status === "cancelled"
            ? ["Pachanga cancelada"]
            : status === "finished"
              ? [conResultado ? `Pachanga: Rojo ${rojo}, Azul ${azul}` : "Pachanga terminada"]
              : ["¡Únete a la pachanga!", ...(status === "open" && faltan > 0 ? [textoFaltan(faltan)] : [])];
    return [...cabecera, location, fechaCorta(date), `→ ${url}`].join("\n");
}

const CHISTES_CANCELADO = [
    "Se cayó. Como el 4-4-2.",
    "Cancelado. Mis rodillas, y las vuestras, lo agradecen.",
    "No hubo partido. Tampoco hubo fallos, mira tú.",
    "Se suspende. El fútbol seguirá sin vosotros, que es lo normal.",
];

export function fraseCancelado(id: string): string {
    return elegir(id, "cancelado", CHISTES_CANCELADO);
}

// ─── Vacíos ───────────────────────────────────────────────────────────────────

const VACIOS = {
    "sin-partido": [
        "Campo libre y ni un valiente. Yo sigo durmiendo.",
        "Nadie ha montado nada. Y eso que os gusta quejaros.",
        "Sin partido esta semana. El césped lo agradece.",
        "Cuando alguien se anime, me despertáis.",
        "No hay partido. Tampoco es que el fútbol lo vaya a notar.",
    ],
    apuntados: [
        "Faltan todos. Empezamos bien.",
        "De momento juego yo solo. Y no pienso correr.",
        "Apuntarse cuesta menos que correr, y aun así.",
        "Aquí no hay nadie. Todos esperando a que se apunte otro.",
    ],
    partidos: [
        "Aquí no hay nada. Como en la mediapunta.",
        "Ni un partido a la vista. Yo, encantado.",
        "La agenda está vacía. El nivel lo agradece.",
        "Nada por aquí. Montad algo, que me aburro.",
    ],
    historial: [
        "Sin historial. Nadie puede demostrar nada.",
        "Todavía no ha pasado nada. Lo bueno y lo malo.",
        "Página en blanco. No durará.",
        "Aquí irán los partidos. Y las excusas.",
    ],
    goles: [
        "Goles: nadie.",
        "Ni un gol apuntado. Las redes, tranquilas.",
        "Nadie ha marcado aquí. Se nota.",
        "Sin goles. Los delanteros, bien, gracias.",
    ],
    mvp: [
        "Sin MVP. Tampoco había muchos candidatos.",
        "Nadie ha votado. Es la opinión más sincera que habéis dado.",
        "El MVP sigue desierto. Merecido.",
        "Sin votos. Hubo partido, pero no para tanto.",
    ],
    fotos: [
        "Nadie hizo fotos. Mejor.",
        "Sin fotos. Las pruebas no existen.",
        "Ni una foto. El fútbol de aquí lo agradece.",
        "Cero fotos. Lo que pasó en el campo se queda en el campo.",
    ],
    chat: [
        "Nadie ha dicho nada. Disfrutad, que dura poco.",
        "Silencio. Se irá en cuanto alguien falle un gol.",
        "Aquí no habla nadie. Primera vez.",
        "Sin mensajes. Las excusas llegarán después del partido.",
    ],
    ranking: [
        "Tabla vacía. Todos líderes, por una vez.",
        "Sin partidos no hay tabla. Tampoco discusiones.",
        "Aquí aún no gana nadie. Aprovechad.",
        "La tabla está a cero. Es lo más igualado que veréis.",
    ],
    jugadores: [
        "No hay nadie. Ni para un rondo.",
        "Sin jugadores. Se juega peor, aunque cueste creerlo.",
        "Aquí no aparece nadie. Como un día de lluvia.",
        "Lista vacía. Yo no pienso salir al campo.",
    ],
    trofeos: [
        "Sin trofeos. La vitrina sale más barata.",
        "Vitrina vacía. Se limpia sola.",
        "Ni un trofeo. Sigue habiendo sitio.",
        "Nada que enseñar aquí. Todavía.",
    ],
    notificaciones: [
        "Nada nuevo. Esta liga no da para más.",
        "Todo en calma. No te acostumbres.",
        "Sin avisos. Yo tampoco tengo nada que decirte.",
        "Ninguna novedad. El grupo sigue igual, que ya es decir.",
    ],
    panenka: [
        "Pregunta. Tengo poco que hacer y menos ganas.",
        "Dime qué quieres saber. Lo vi todo, por desgracia.",
        "Tú dirás. Yo ya lo he visto.",
        "Pregunta. Con suerte, te contesto.",
    ],
} as const satisfies Record<string, readonly string[]>;

export type ContextoVacio = keyof typeof VACIOS;

/** Frase para un vacío. "id" la varía, por ejemplo con el id de la semana o del partido. */
export function fraseVacio(contexto: ContextoVacio, id: string = contexto): string {
    return elegir(id, `vacio-${contexto}`, VACIOS[contexto]);
}

// ─── La puerta ────────────────────────────────────────────────────────────────

/** Panenka de portero de discoteca: login, registro, acceso y cuando no te deja pasar. */
const PUERTA = {
    login: [
        "¿Nombre? Aquí no entra cualquiera.",
        "Hoy no. Bueno, a ver. ¿Estás en la lista?",
        "Con esas botas no entras. Prueba con la contraseña.",
        "Lista cerrada. Salvo que estés en ella.",
    ],
    registro: [
        "Otro que dice que juega bien. Apunta.",
        "Cuenta nueva. Sin historial, sin excusas.",
        "Rellena esto. Lo de jugar bien ya es otro tema.",
        "Primera vez. Aquí se entra y ya no se mejora.",
    ],
    acceso: [
        "Cuenta tienes. Código, no.",
        "Hasta aquí has llegado. Sin código no pasas.",
        "Sin código, a la grada.",
        "Esto es privado. Por el nivel no lo dirías.",
    ],
    rechazo: [
        "Ese no está en la lista.",
        "No me suena. Y tengo buena memoria.",
        "Así no entras. Ni con enchufe.",
        "Otra vez. Yo no tengo prisa.",
    ],
} as const satisfies Record<string, readonly string[]>;

export type ContextoPuerta = keyof typeof PUERTA;

export function frasePuerta(contexto: ContextoPuerta, id: string = contexto): string {
    return elegir(id, `puerta-${contexto}`, PUERTA[contexto]);
}

const PENSANDO = [
    "A ver. Estoy mirando.",
    "Un momento. Esto hay que buscarlo.",
    "Déjame mirarlo. Sin prisa.",
    "Buscando. Aquí no corre nadie, y yo menos.",
] as const;

/** Mientras Panenka contesta. "id" es el del último mensaje: cambia en cada pregunta. */
export function frasePensando(id: string): string {
    return elegir(id, "pensando", PENSANDO);
}

// ─── MVP ──────────────────────────────────────────────────────────────────────

export type VotoMvp = { voter_id: string; voted_for: string };

export type RecuentoMvp = {
    votos: Record<string, number>;
    /** Los que tienen más votos. Más de uno es empate, y en empate no hay MVP. */
    lideres: string[];
    maximo: number;
};

/** Mismo criterio que resolveMvp: gana el más votado y, si hay empate, nadie. */
export function recuentoMvp(votos: readonly VotoMvp[]): RecuentoMvp {
    const cuenta: Record<string, number> = {};
    for (const voto of votos) cuenta[voto.voted_for] = (cuenta[voto.voted_for] ?? 0) + 1;
    const maximo = Math.max(0, ...Object.values(cuenta));
    return {
        votos: cuenta,
        lideres: Object.keys(cuenta).filter((id) => cuenta[id] === maximo),
        maximo,
    };
}

/** "3 de 14 han votado", "1 de 14 ha votado", "Aún no ha votado nadie". */
export function textoVotantes(votos: number, total: number): string {
    if (votos <= 0) return "Aún no ha votado nadie";
    return `${votos} de ${total} ${votos === 1 ? "ha" : "han"} votado`;
}

/**
 * Lo justo para distinguir a cada uno en una baldosa: el primer nombre,
 * salvo que dos lo compartan, y entonces el nombre entero.
 */
export function nombresBaldosa(nombres: readonly (string | null | undefined)[]): string[] {
    const limpios = nombres.map((nombre) => limpiarNombre(nombre) ?? "Anónimo");
    const repetidos = (corto: string) => limpios.filter((n) => nombreCorto(n) === corto).length > 1;
    return limpios.map((nombre) => (repetidos(nombreCorto(nombre)) ? nombre : nombreCorto(nombre)));
}

const PANENKA_MVP = {
    ganador: [
        "Ganó la votación. El partido, ya veremos.",
        "Lo habéis votado vosotros. Luego no vengáis con quejas.",
        "Mejor del partido. El listón estaba donde estaba.",
        "Votación limpia. Que yo sepa.",
    ],
    ganaste: [
        "Te han votado a ti. Yo no hago preguntas.",
        "Disfrútalo. La semana que viene no se acuerda nadie.",
        "Alguien tenía que ganarlo. Esta vez te tocó.",
        "Ya puedes contarlo en el trabajo. Sin exagerar.",
    ],
    empate: [
        "Empate. Ni para esto os ponéis de acuerdo.",
        "Sin MVP. Votar tampoco se os da.",
        "Repartidos. Aquí no gana nadie, como de costumbre.",
        "Varios mejores del partido. O ninguno, que es lo que vi yo.",
    ],
    noJugaste: [
        "No jugaste, así que no votas. Desde la grada se opina gratis.",
        "Solo votan los que jugaron. Tú mirabas.",
        "No jugaste. Aquí vota quien se llevó las patadas.",
        "Sin partido no hay voto. Yo tampoco voto y aquí sigo.",
    ],
} as const;

export type DesenlaceMvp = {
    caso: "ganador" | "ganaste" | "empate" | "sin-votos";
    titular: string;
    frase: string;
};

/** Lo que se dice cuando la votación ha cerrado. "ganador" es null si no hay MVP. */
export function desenlaceMvp({
    id,
    ganador,
    esTuyo = false,
    empatados = 0,
    maximo = 0,
}: {
    id: string;
    ganador?: string | null;
    esTuyo?: boolean;
    empatados?: number;
    maximo?: number;
}): DesenlaceMvp {
    if (esTuyo) {
        return { caso: "ganaste", titular: "Eres el MVP.", frase: elegir(id, "mvp-ganaste", PANENKA_MVP.ganaste) };
    }
    if (ganador !== null && ganador !== undefined) {
        const nombre = limpiarNombre(ganador) ?? "Anónimo";
        return {
            caso: "ganador",
            titular: ajustar([`${nombre}, MVP`, `${nombreCorto(nombre)}, MVP`].map(conPunto)),
            frase: elegir(id, "mvp-ganador", PANENKA_MVP.ganador),
        };
    }
    if (empatados > 1) {
        return {
            caso: "empate",
            titular: `Empate a ${enPalabras(maximo, "voto")}.`,
            frase: elegir(id, "mvp-empate", PANENKA_MVP.empate),
        };
    }
    return { caso: "sin-votos", titular: "Sin MVP.", frase: fraseVacio("mvp", id) };
}

/** Por qué no puedes votar si no jugaste. Siempre dice el motivo. */
export function fraseNoJugaste(id: string): string {
    return elegir(id, "mvp-no-jugaste", PANENKA_MVP.noJugaste);
}

// ─── Tiempo ───────────────────────────────────────────────────────────────────

const RELOJ_DIA_MADRID = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
});

/** "2026-11-03": el día en Madrid, como lo devuelve la previsión. */
export function diaIsoMadrid(fecha: Fecha): string {
    const instante = new Date(fecha);
    if (Number.isNaN(instante.getTime())) throw new Error("La fecha no es válida");
    return RELOJ_DIA_MADRID.format(instante);
}

export type Cielo = "despejado" | "algo-nuboso" | "nublado" | "niebla" | "llovizna" | "lluvia" | "nieve" | "tormenta";

const NOMBRE_CIELO: Record<Cielo, string> = {
    despejado: "Despejado",
    "algo-nuboso": "Algo nuboso",
    nublado: "Nublado",
    niebla: "Niebla",
    llovizna: "Llovizna",
    lluvia: "Lluvia",
    nieve: "Nieve",
    tormenta: "Tormenta",
};

/** Códigos WMO de la previsión. Uno desconocido no dice nada, y mejor eso que un sol. */
export function cieloDeCodigo(codigo: number | null | undefined): Cielo | null {
    switch (codigo) {
        case 0:
            return "despejado";
        case 1:
        case 2:
            return "algo-nuboso";
        case 3:
            return "nublado";
        case 45:
        case 48:
            return "niebla";
        case 51:
        case 53:
        case 55:
        case 56:
        case 57:
            return "llovizna";
        case 61:
        case 63:
        case 65:
        case 66:
        case 67:
        case 80:
        case 81:
        case 82:
            return "lluvia";
        case 71:
        case 73:
        case 75:
        case 77:
        case 85:
        case 86:
            return "nieve";
        case 95:
        case 96:
        case 99:
            return "tormenta";
        default:
            return null;
    }
}

/** "Lluvia · 14° · 80 %", "Nublado · 9° · 20 % de lluvia". Lo que falta no se dice. Sin nada que decir, null. */
export function lineaTiempo({
    cielo,
    temperatura,
    probabilidadLluvia,
}: {
    cielo: Cielo | null;
    temperatura: number | null | undefined;
    probabilidadLluvia: number | null | undefined;
}): string | null {
    const partes: string[] = [];
    if (cielo) partes.push(NOMBRE_CIELO[cielo]);
    if (typeof temperatura === "number") partes.push(`${Math.round(temperatura)}°`);
    if (typeof probabilidadLluvia === "number") {
        const yaDiceLluvia = cielo === "lluvia" || cielo === "llovizna";
        partes.push(`${Math.round(probabilidadLluvia)} %${yaDiceLluvia ? "" : " de lluvia"}`);
    }
    return partes.length > 0 ? partes.join(" · ") : null;
}
