import assert from "node:assert/strict";
import test from "node:test";
import {
    fraseCancelado,
    notaPlantilla,
    respuestaPartido,
    textoBuscar,
    textoDeben,
    textoWhatsApp,
} from "../src/lib/titulares.ts";
import {
    cieloDeCodigo,
    desenlaceMvp,
    diaIsoMadrid,
    fraseNoJugaste,
    lineaTiempo,
    nombresBaldosa,
    recuentoMvp,
    textoVotantes,
} from "../src/lib/titulares.ts";
import {
    MAX_TITULAR,
    calcularRacha,
    charsRespuesta,
    cuandoEs,
    diaYMes,
    elegirPartidoPortada,
    elegirPlural,
    enPalabras,
    equipoDeTeam,
    estadoPortada,
    lineaPuesto,
    preguntaPortada,
    textoConEquipo,
    fechaCorta,
    fechaLarga,
    frasePanenkaJugador,
    frasePanenkaRanking,
    fraseVacio,
    frasePuerta,
    frasePensando,
    horaMadrid,
    leyendaPlazas,
    listaNombres,
    nombreDia,
    numeroPalabra,
    ordinal,
    participanteCronica,
    plazoVotacion,
    plural,
    textoFaltan,
    textoSinDecirNada,
    titularCronica,
    titularJugador,
    titularPetoJugador,
    titularRanking,
    aValorLocal,
    AVISO_FECHA_PASADA,
    SIN_RESULTADOS,
    preguntaCuando,
    recuentoResultados,
    detalleTerminado,
    diaElegido,
    diaPartido,
    diasElegibles,
    elegidoPasado,
    estadoPartido,
    fechaRepetida,
    lineaPartido,
    textoPlazas,
    titularHistorial,
    tuPlaza,
} from "../src/lib/titulares.ts";

const LARGO = "Cristian moreira s";

// Martes 3 de noviembre de 2026, 20:00 en Madrid (CET, UTC+1).
const MARTES = "2026-11-03T19:00:00.000Z";
const ANTES = "2026-10-31T12:00:00.000Z";

const ids = Array.from({ length: 400 }, (_, i) => `partido-${i}`);

function partidoDe(apuntados, overrides = {}) {
    return {
        id: "partido-1",
        date: MARTES,
        location: "Campus de Barredo",
        max_players: 14,
        status: "open",
        participants: Array.from({ length: apuntados }, (_, i) => ({ user_id: `u${i}`, team: null })),
        ...overrides,
    };
}

function jugador(nombre, equipo, goles = 0, posicion = "MID") {
    return { nombre, equipo, goles, posicion };
}

function plantilla(equipo, n, goles = 0) {
    return Array.from({ length: n }, (_, i) => jugador(`${equipo}${i}`, equipo, goles));
}

const FICHA = { nombre: "Xuan", partidos: 7, goles: 2, mvps: 1, victorias: 2, empates: 2, derrotas: 3 };

// ─── Portada ──────────────────────────────────────────────────────────────────

test("portada: apuntado sin equipos", () => {
    const estado = estadoPortada({ partido: partidoDe(11), yo: "u3", ahora: ANTES });
    assert.equal(estado.estado, "apuntado");
    assert.equal(estado.respuesta, "Juegas.");
    assert.equal(estado.linea, "Martes 3 nov, 20:00, Campus de Barredo");
    assert.equal(estado.faltan, 3);
    assert.equal(estado.textoSalida, "Si te vas, faltan 4");
    assert.equal(estado.equipo, null);
    assert.equal(estado.hoy, false);
});

test("portada: apuntado con equipos, en los dos colores", () => {
    const participants = [
        { user_id: "yo", team: "A" },
        { user_id: "otro", team: "B" },
    ];
    const rojo = estadoPortada({ partido: partidoDe(0, { participants }), yo: "yo", ahora: ANTES });
    assert.equal(rojo.estado, "con-equipo");
    assert.equal(rojo.respuesta, "De rojo.");
    assert.equal(rojo.equipo, "rojo");

    const azul = estadoPortada({ partido: partidoDe(0, { participants }), yo: "otro", ahora: ANTES });
    assert.equal(azul.respuesta, "De azul.");
    assert.equal(azul.equipo, "azul");
});

test("portada: apuntado sin peto aunque otros ya lo tengan sigue siendo Juegas", () => {
    const participants = [
        { user_id: "yo", team: null },
        { user_id: "otro", team: "B" },
    ];
    const estado = estadoPortada({ partido: partidoDe(0, { participants }), yo: "yo", ahora: ANTES });
    assert.equal(estado.respuesta, "Juegas.");
});

test("portada: sin apuntar y con plazas", () => {
    const estado = estadoPortada({ partido: partidoDe(11), yo: "fuera", ahora: ANTES });
    assert.equal(estado.estado, "libre");
    assert.equal(estado.respuesta, "¿Juegas?");
    assert.equal(estado.faltan, 3);
    assert.equal(estado.textoSalida, null);
});

test("portada: sin sesión se trata como sin apuntar", () => {
    assert.equal(estadoPortada({ partido: partidoDe(3), yo: null, ahora: ANTES }).respuesta, "¿Juegas?");
});

test("portada: lleno y sin apuntar", () => {
    const estado = estadoPortada({ partido: partidoDe(14), yo: "fuera", ahora: ANTES });
    assert.equal(estado.estado, "lleno");
    assert.equal(estado.respuesta, "Sin plaza.");
    assert.equal(estado.faltan, 0);
});

test("portada: cerrado con huecos no deja entrar, como joinMatch", () => {
    const estado = estadoPortada({ partido: partidoDe(10, { status: "closed" }), yo: "fuera", ahora: ANTES });
    assert.equal(estado.estado, "lleno");
    assert.equal(estado.respuesta, "Sin plaza.");
    assert.equal(estado.faltan, 0);
});

test("portada: dentro de un partido cerrado sigues jugando", () => {
    const estado = estadoPortada({ partido: partidoDe(10, { status: "closed" }), yo: "u1", ahora: ANTES });
    assert.equal(estado.respuesta, "Juegas.");
});

test("portada: el día del partido manda la hora y no se repite debajo", () => {
    const ahora = "2026-11-03T09:00:00.000Z";
    for (const [partido, yo, estadoEsperado] of [
        [partidoDe(11), "u1", "apuntado"],
        [partidoDe(11), "fuera", "libre"],
        [partidoDe(14), "fuera", "lleno"],
    ]) {
        const estado = estadoPortada({ partido, yo, ahora });
        assert.equal(estado.estado, estadoEsperado);
        assert.equal(estado.respuesta, "Hoy, 20:00.");
        assert.equal(estado.linea, "Campus de Barredo");
        assert.equal(estado.hoy, true);
    }
});

test("portada: el peto gana a la hora el día del partido", () => {
    const participants = [{ user_id: "yo", team: "B" }];
    const estado = estadoPortada({
        partido: partidoDe(0, { participants }),
        yo: "yo",
        ahora: "2026-11-03T09:00:00.000Z",
    });
    assert.equal(estado.respuesta, "De azul.");
    assert.equal(estado.linea, "Hoy, 20:00, Campus de Barredo");
    assert.equal(estado.hoy, true);
});

test("portada: sin partido, terminado, cancelado o de un día pasado", () => {
    const casos = [
        [null, ANTES],
        [undefined, ANTES],
        [partidoDe(14, { status: "finished" }), ANTES],
        [partidoDe(14, { status: "cancelled" }), ANTES],
        [partidoDe(14), "2026-11-04T12:00:00.000Z"],
    ];
    for (const [partido, ahora] of casos) {
        const estado = estadoPortada({ partido, yo: "u1", ahora });
        assert.equal(estado.estado, "sin-partido");
        assert.equal(estado.respuesta, "No hay pachanga.");
        assert.equal(estado.linea, null);
        assert.equal(estado.textoSalida, null);
    }
});

test("portada: empezado el mismo día sigue siendo hoy", () => {
    const estado = estadoPortada({ partido: partidoDe(11), yo: "u1", ahora: "2026-11-03T20:00:00.000Z" });
    assert.equal(estado.respuesta, "Hoy, 20:00.");
});

test("portada: no asume que se juegue en martes", () => {
    const viernes = "2026-11-06T19:30:00.000Z";
    const estado = estadoPortada({ partido: partidoDe(2, { date: viernes }), yo: "u1", ahora: ANTES });
    assert.equal(estado.linea, "Viernes 6 nov, 20:30, Campus de Barredo");
});

test("portada: singulares y exceso de apuntados en textoSalida", () => {
    assert.equal(estadoPortada({ partido: partidoDe(14), yo: "u1", ahora: ANTES }).textoSalida, "Si te vas, falta 1");
    const pasado = estadoPortada({ partido: partidoDe(16), yo: "u1", ahora: ANTES });
    assert.equal(pasado.textoSalida, "Si te vas, sigue lleno");
    assert.equal(pasado.faltan, 0);
});

test("portada: sitio vacío no deja una coma colgando", () => {
    const estado = estadoPortada({ partido: partidoDe(1, { location: "  " }), yo: "u0", ahora: ANTES });
    assert.equal(estado.linea, "Martes 3 nov, 20:00");
});

test("charsRespuesta: la línea más ancha de cada respuesta", () => {
    const esperados = [
        ["Juegas.", 6.4],
        ["¿Juegas?", 8],
        ["De azul.", 7.4],
        ["Sin plaza.", 9.4],
        ["Hoy, 20:00.", 10.4],
        ["No hay pachanga.", 9],
    ];
    for (const [respuesta, chars] of esperados) {
        assert.ok(Math.abs(charsRespuesta(respuesta) - chars) < 1e-9, respuesta);
    }
});

test("textos de plazas", () => {
    assert.equal(textoFaltan(3), "Faltan 3");
    assert.equal(textoFaltan(1), "Falta 1");
    assert.equal(textoFaltan(0), "Completo");
    assert.equal(leyendaPlazas({ pagados: 8, deben: 3, libres: 3 }), "8 han pagado · 3 deben · 3 libres");
    assert.equal(leyendaPlazas({ pagados: 1, deben: 1, libres: 1 }), "1 ha pagado · 1 debe · 1 libre");
    assert.equal(leyendaPlazas({ pagados: 14, deben: 0, libres: 0 }), "14 han pagado");
    assert.equal(textoSinDecirNada([]), null);
    assert.equal(textoSinDecirNada(["Manolín"]), "Sin decir nada: Manolín");
    assert.equal(textoSinDecirNada(["Manolín", "Javi", "Iván"]), "Sin decir nada: Manolín, Javi e Iván");
    assert.equal(
        textoSinDecirNada(["Manolín", "Javi", "Hugo", "Álvaro"]),
        "Sin decir nada: Manolín, Javi, Hugo y Álvaro"
    );
    assert.equal(
        textoSinDecirNada(["Manolín", "Javi", "Hugo", "Álvaro", "Nacho", "Chus"]),
        "Sin decir nada: Manolín, Javi, Hugo y 3 más"
    );
});

test("portada: la pregunta sale de la fecha", () => {
    assert.equal(preguntaPortada(MARTES, ANTES), "¿Juego el martes?");
    assert.equal(preguntaPortada(MARTES, "2026-11-03T08:00:00.000Z"), "¿Juego hoy?");
    assert.equal(preguntaPortada(MARTES, "2026-11-02T08:00:00.000Z"), "¿Juego mañana?");
    assert.equal(preguntaPortada(null, ANTES), "¿Hay pachanga?");
});

test("portada: elige tu partido, y si no, el abierto más cercano", () => {
    const yo = "u0";
    const conmigo = partidoDe(2, { id: "mio", status: "closed", date: "2026-11-10T19:00:00.000Z" });
    const pronto = partidoDe(0, { id: "pronto", date: "2026-11-03T19:00:00.000Z" });
    const luego = partidoDe(0, { id: "luego", date: "2026-11-05T19:00:00.000Z" });
    const cerrado = partidoDe(0, { id: "cerrado", status: "closed", date: "2026-11-01T19:00:00.000Z" });
    const lista = [luego, conmigo, cerrado, pronto];

    const mio = elegirPartidoPortada(lista, yo, ANTES);
    assert.equal(mio.partido?.id, "mio");
    assert.deepEqual(mio.otros.map((p) => p.id), ["pronto", "luego"]);

    const ajeno = elegirPartidoPortada(lista, "otro", ANTES);
    assert.equal(ajeno.partido?.id, "pronto");
    assert.deepEqual(ajeno.otros.map((p) => p.id), ["luego"]);

    assert.equal(elegirPartidoPortada([cerrado], "otro", ANTES).partido, null);
    assert.equal(elegirPartidoPortada([], yo, ANTES).partido, null);
});

test("portada: dos abiertos no borran el partido", () => {
    const uno = partidoDe(0, { id: "uno" });
    const dos = partidoDe(0, { id: "dos", date: "2026-11-05T19:00:00.000Z" });
    assert.equal(elegirPartidoPortada([uno, dos], "yo", ANTES).partido?.id, "uno");
});

test("portada: el día del partido sigues dentro aunque haya empezado; los demás ya no entran", () => {
    const yaEmpezado = "2026-11-03T20:30:00.000Z";
    const conmigo = partidoDe(2);
    assert.equal(elegirPartidoPortada([conmigo], "u0", yaEmpezado).partido?.id, "partido-1");
    assert.equal(elegirPartidoPortada([conmigo], "otro", yaEmpezado).partido, null);
    // De un día anterior, ni aunque sigas apuntado.
    assert.equal(elegirPartidoPortada([conmigo], "u0", "2026-11-04T09:00:00.000Z").partido, null);
});

test("portada: compañeros y rivales bajo el peto", () => {
    assert.deepEqual(
        textoConEquipo({
            equipo: "rojo",
            companeros: ["Hugo", "Manolín", "Rubén M.", "Álvaro", "Óscar"],
            rivales: ["Adrián", "Marcos", "Iván"],
        }),
        {
            con: "Con Hugo y Manolín",
            resto: "Y Rubén M., Álvaro y Óscar.",
            enfrente: "Enfrente, de azul: Adrián, Marcos e Iván.",
        }
    );
    const azul = (companeros, rivales) => textoConEquipo({ equipo: "azul", companeros, rivales });
    assert.equal(azul(["Hugo"], []).con, "Con Hugo");
    assert.equal(azul(["Hugo"], []).enfrente, null);
    assert.equal(azul([], ["Rubén M."]).con, "De momento, tú solo");
    assert.equal(azul([], ["Rubén M."]).enfrente, "Enfrente, de rojo: Rubén M.");
    assert.equal(azul(["Hugo", "Javi", "Iván"], []).resto, "E Iván.");
    assert.equal(azul([LARGO, "Javi"], []).con, `Con ${LARGO} y Javi`);
});

test("portada: el puesto, con ordinal en palabra y sin puesto si no cuentas", () => {
    assert.equal(lineaPuesto({ posicion: 2, rp: 1087 }), "Segundo, 1087 RP");
    assert.equal(lineaPuesto({ posicion: 11, rp: 1000 }), "11.º, 1000 RP");
    assert.equal(lineaPuesto({ posicion: null, rp: 1000 }), "Aún no cuentas, 1000 RP");
});

// ─── Fechas ───────────────────────────────────────────────────────────────────

test("Madrid: las 23:30 UTC ya son el día siguiente", () => {
    assert.equal(fechaCorta("2026-11-03T23:30:00.000Z"), "Miércoles 4 nov, 00:30");
    assert.equal(fechaCorta("2026-07-14T23:30:00.000Z"), "Miércoles 15 jul, 01:30");
    assert.equal(nombreDia("2026-11-03T23:30:00.000Z"), "miércoles");
});

test("Madrid: las 23:30 UTC cuentan como el día de Madrid para saber si es hoy", () => {
    const estado = estadoPortada({ partido: partidoDe(3), yo: "u1", ahora: "2026-11-02T23:30:00.000Z" });
    assert.equal(estado.hoy, true);
    assert.equal(estado.respuesta, "Hoy, 20:00.");
    assert.equal(cuandoEs(MARTES, "2026-11-02T22:59:00.000Z"), "mañana");
});

test("Madrid: el cambio de hora no mueve las 20:00", () => {
    assert.equal(horaMadrid("2026-10-24T18:00:00.000Z"), "20:00");
    assert.equal(horaMadrid("2026-10-26T19:00:00.000Z"), "20:00");
});

test("Madrid: medianoche es 00:00, nunca 24:00", () => {
    assert.equal(horaMadrid("2026-11-03T23:00:00.000Z"), "00:00");
});

test("Madrid: no depende de la zona horaria del servidor", () => {
    const original = process.env.TZ;
    try {
        for (const zona of ["Pacific/Auckland", "America/Los_Angeles", "UTC"]) {
            process.env.TZ = zona;
            assert.equal(fechaCorta("2026-11-03T23:30:00.000Z"), "Miércoles 4 nov, 00:30");
            assert.equal(estadoPortada({ partido: partidoDe(3), yo: "u1", ahora: MARTES }).hoy, true);
        }
    } finally {
        if (original === undefined) delete process.env.TZ;
        else process.env.TZ = original;
    }
});

test("formatos de fecha", () => {
    assert.equal(fechaCorta(MARTES), "Martes 3 nov, 20:00");
    assert.equal(fechaLarga(MARTES), "Martes 3 de noviembre");
    assert.equal(diaYMes(MARTES), "3 nov");
    assert.equal(fechaCorta(new Date(MARTES)), "Martes 3 nov, 20:00");
    assert.equal(fechaCorta(new Date(MARTES).getTime()), "Martes 3 nov, 20:00");
    assert.throws(() => fechaCorta("sin-fecha"), /no es válida/);
});

test("cuandoEs", () => {
    assert.equal(cuandoEs(MARTES, "2026-11-03T08:00:00.000Z"), "hoy");
    assert.equal(cuandoEs(MARTES, "2026-11-02T08:00:00.000Z"), "mañana");
    assert.equal(cuandoEs(MARTES, ANTES), "el martes");
    assert.equal(cuandoEs("2026-11-17T19:00:00.000Z", ANTES), "el martes 17");
    assert.equal(cuandoEs("2026-10-20T18:00:00.000Z", ANTES), "el martes 20");
});

test("plazoVotacion: hoy, mañana y cerrada, a 24 horas de finished_at", () => {
    const fin = "2026-10-30T19:15:00.000Z";
    assert.equal(plazoVotacion(fin, "2026-10-30T20:00:00.000Z"), "Cierra mañana, 20:15");
    assert.equal(plazoVotacion(fin, "2026-10-31T10:00:00.000Z"), "Cierra hoy, 20:15");
    assert.equal(plazoVotacion(fin, "2026-10-31T19:15:00.000Z"), "Cierra hoy, 20:15");
    assert.equal(plazoVotacion(fin, "2026-10-31T19:15:00.001Z"), "Votación cerrada");
    assert.equal(plazoVotacion(null, ANTES), "Votación cerrada");
});

test("plazoVotacion: la ventana son 24 horas reales aunque cambie la hora", () => {
    // La noche del 24 al 25 de octubre tiene una hora más.
    assert.equal(plazoVotacion("2026-10-24T18:00:00.000Z", "2026-10-24T20:00:00.000Z"), "Cierra mañana, 19:00");
});

test("plazoVotacion: con la hora del cliente atrasada no se rompe", () => {
    assert.equal(plazoVotacion(MARTES, ANTES), "Cierra el miércoles, 20:00");
});

// ─── Crónica ──────────────────────────────────────────────────────────────────

test("crónica: marcó todo un equipo", () => {
    const participantes = [...plantilla("azul", 7, 1), ...plantilla("rojo", 7)];
    const cronica = titularCronica({ rojo: 5, azul: 10, participantes });
    assert.equal(cronica.titular, "Marcaron los siete del Azul");
    assert.equal(cronica.hecho, "equipo-entero");
});

test("crónica: el caso del 30 de octubre, con el resto de hechos para Panenka", () => {
    const participantes = [
        jugador("Hugo", "rojo", 4),
        jugador("Dani", "rojo", 1),
        ...plantilla("rojo", 5),
        jugador("Chus", "azul", 1, "GK"),
        jugador("Diego", "azul", 1, "GK"),
        ...plantilla("azul", 5, 2),
    ];
    const cronica = titularCronica({ rojo: 5, azul: 10, participantes });
    assert.equal(cronica.titular, "Marcaron los siete del Azul");
    assert.equal(
        cronica.frasePanenka,
        "Los dos porteros también. Hugo metió cuatro de los cinco del Rojo y perdió por cinco."
    );
});

test("crónica: equipos desiguales cuentan a los suyos", () => {
    const participantes = [...plantilla("rojo", 6, 1), ...plantilla("azul", 8)];
    assert.equal(titularCronica({ rojo: 6, azul: 2, participantes }).titular, "Marcaron los seis del Rojo");
});

test("crónica: marcaron los dos equipos enteros", () => {
    const participantes = [...plantilla("rojo", 7, 1), ...plantilla("azul", 7, 1)];
    assert.equal(titularCronica({ rojo: 7, azul: 7, participantes }).titular, "Marcaron los 14");
});

test("crónica: un equipo de dos marcando no es noticia", () => {
    const participantes = plantilla("rojo", 2, 1);
    assert.notEqual(titularCronica({ rojo: 2, azul: 0, participantes }).hecho, "equipo-entero");
});

test("crónica: portero goleador", () => {
    const participantes = [jugador("Chus", "azul", 1, "GK"), ...plantilla("azul", 6), ...plantilla("rojo", 7)];
    const cronica = titularCronica({ rojo: 0, azul: 1, participantes });
    assert.equal(cronica.titular, "Marcó Chus, el portero");
    assert.equal(cronica.hecho, "portero-goleador");
});

test("crónica: portero con doblete, dos porteros y portero sin nombre", () => {
    const uno = [jugador("Chus", "azul", 2, "GK"), ...plantilla("rojo", 7)];
    assert.equal(titularCronica({ rojo: 0, azul: 2, participantes: uno }).titular, "Chus, portero, metió dos");

    const dos = [jugador("Chus", "azul", 1, "GK"), jugador("Diego", "rojo", 1, "GK"), ...plantilla("rojo", 7)];
    assert.equal(titularCronica({ rojo: 1, azul: 1, participantes: dos }).titular, "Marcaron los dos porteros");

    const anonimo = [jugador(null, "azul", 1, "GK"), ...plantilla("rojo", 7)];
    assert.equal(titularCronica({ rojo: 0, azul: 1, participantes: anonimo }).titular, "Gol desde la portería");
});

test("crónica: tres o más goles en derrota", () => {
    const participantes = [jugador("Hugo", "rojo", 4), ...plantilla("rojo", 6), ...plantilla("azul", 7)];
    const cronica = titularCronica({ rojo: 4, azul: 6, participantes });
    assert.equal(cronica.titular, "Hugo metió cuatro y perdió igual");
    assert.equal(cronica.hecho, "hat-trick-derrota");
});

test("crónica: dos goles en derrota o tres en victoria no cuentan", () => {
    const derrota = [jugador("Hugo", "rojo", 2), ...plantilla("rojo", 6), ...plantilla("azul", 7)];
    assert.notEqual(titularCronica({ rojo: 2, azul: 4, participantes: derrota }).hecho, "hat-trick-derrota");

    const victoria = [jugador("Hugo", "azul", 3), ...plantilla("azul", 6), ...plantilla("rojo", 7)];
    assert.notEqual(titularCronica({ rojo: 2, azul: 4, participantes: victoria }).hecho, "hat-trick-derrota");

    const empate = [jugador("Hugo", "azul", 3), ...plantilla("azul", 6), ...plantilla("rojo", 7)];
    assert.equal(titularCronica({ rojo: 3, azul: 3, participantes: empate }).hecho, "empate");
});

test("crónica: el que más metió en la derrota es el titular", () => {
    const participantes = [jugador("Dani", "rojo", 3), jugador("Hugo", "rojo", 5), ...plantilla("rojo", 5)];
    assert.match(titularCronica({ rojo: 8, azul: 9, participantes }).titular, /^Hugo/);
});

test("crónica: el orden de rareza se respeta", () => {
    const todo = [
        ...plantilla("azul", 6, 2),
        jugador("Chus", "azul", 1, "GK"),
        jugador("Hugo", "rojo", 3),
        ...plantilla("rojo", 6),
    ];
    assert.equal(titularCronica({ rojo: 3, azul: 13, participantes: todo }).hecho, "equipo-entero");

    const sinEquipoEntero = [jugador("Chus", "azul", 1, "GK"), jugador("Hugo", "rojo", 3), ...plantilla("azul", 6)];
    const cronica = titularCronica({ rojo: 3, azul: 10, participantes: sinEquipoEntero });
    assert.equal(cronica.hecho, "portero-goleador");
    assert.equal(cronica.frasePanenka, "Hugo metió los tres del Rojo y perdió por siete.");

    const sinPortero = [jugador("Hugo", "rojo", 3), ...plantilla("azul", 7)];
    assert.equal(titularCronica({ rojo: 3, azul: 10, participantes: sinPortero }).hecho, "hat-trick-derrota");

    const nada = plantilla("azul", 7);
    assert.equal(titularCronica({ rojo: 0, azul: 5, participantes: nada }).hecho, "goleada");
    assert.equal(titularCronica({ rojo: 2, azul: 2, participantes: nada }).hecho, "empate");
    assert.equal(titularCronica({ rojo: 2, azul: 3, participantes: nada }).hecho, "por-la-minima");
    assert.equal(titularCronica({ rojo: 2, azul: 5, participantes: nada }).hecho, "generico");
});

test("crónica: goleada a partir de cuatro de diferencia, como en el ELO", () => {
    assert.equal(titularCronica({ rojo: 1, azul: 4, participantes: [] }).hecho, "generico");
    assert.equal(titularCronica({ rojo: 1, azul: 5, participantes: [] }).hecho, "goleada");
    assert.equal(titularCronica({ rojo: 6, azul: 10, participantes: [] }).hecho, "goleada");
});

test("crónica: cada titular de resultado nombra al equipo correcto", () => {
    for (const id of ids) {
        const { titular } = titularCronica({ id, rojo: 3, azul: 2, participantes: [] });
        assert.match(titular, /Rojo|rojo/);
        assert.doesNotMatch(titular, /Azul/);
    }
    for (const id of ids) {
        const { titular } = titularCronica({ id, rojo: 10, azul: 1, participantes: [] });
        assert.match(titular, /Rojo|Azul/);
    }
});

test("crónica: 0-0", () => {
    const participantes = [...plantilla("rojo", 7), ...plantilla("azul", 7)];
    const titulares = new Set();
    for (const id of ids) {
        const cronica = titularCronica({ id, rojo: 0, azul: 0, participantes });
        assert.equal(cronica.hecho, "empate");
        assert.doesNotMatch(cronica.titular, /Empate a cero/);
        titulares.add(cronica.titular);
    }
    assert.ok(titulares.size >= 2);
});

test("crónica: empate a uno y a muchos", () => {
    const titulares = new Set(ids.map((id) => titularCronica({ id, rojo: 1, azul: 1, participantes: [] }).titular));
    assert.ok(titulares.has("Empate a uno"));
    const largo = titularCronica({ id: "x", rojo: 13, azul: 13, participantes: [] });
    assert.match(largo.titular, /13/);
});

test("crónica: sin goleadores apuntados no se inventa ninguno", () => {
    const participantes = [...plantilla("rojo", 7), ...plantilla("azul", 7)];
    const frases = new Set();
    for (const id of ids) {
        const cronica = titularCronica({ id, rojo: 4, azul: 2, participantes });
        assert.equal(cronica.hecho, "generico");
        frases.add(cronica.frasePanenka);
    }
    assert.ok(frases.size >= 4);
    assert.ok([...frases].some((frase) => /no consta/.test(frase)));
});

test("crónica: sin resultado", () => {
    for (const [rojo, azul] of [[null, null], [undefined, 2], [3, null]]) {
        const cronica = titularCronica({ rojo, azul, participantes: [] });
        assert.equal(cronica.titular, "Sin resultado");
        assert.equal(cronica.hecho, "sin-resultado");
    }
});

test("crónica: la lista vacía cae en el resultado", () => {
    assert.equal(titularCronica({ rojo: 2, azul: 1, participantes: [] }).hecho, "por-la-minima");
});

test("crónica: los goleadores que no coinciden con el marcador no rompen la frase", () => {
    const participantes = [jugador("Chus", "azul", 1, "GK"), jugador("Hugo", "rojo", 5), ...plantilla("azul", 7)];
    const { frasePanenka } = titularCronica({ rojo: 3, azul: 9, participantes });
    assert.equal(frasePanenka, "Hugo metió los tres del Rojo y perdió por seis.");
});

test("crónica: quien no tiene equipo no cuenta", () => {
    const participantes = [jugador("Chus", null, 2, "GK"), jugador("Hugo", null, 5), ...plantilla("rojo", 7)];
    assert.equal(titularCronica({ rojo: 2, azul: 1, participantes }).hecho, "por-la-minima");
});

test("crónica: nombres largos se recortan para caber", () => {
    const portero = [jugador(LARGO, "azul", 1, "GK")];
    assert.equal(titularCronica({ rojo: 0, azul: 1, participantes: portero }).titular, "Marcó Cristian, el portero");

    const derrota = [jugador(LARGO, "rojo", 4), ...plantilla("azul", 7)];
    const { titular } = titularCronica({ rojo: 4, azul: 6, participantes: derrota });
    assert.equal(titular, "Cristian, cuatro y perdió igual");
    assert.ok(titular.length <= MAX_TITULAR);
});

test("crónica: sin nombre, frases sin género", () => {
    const participantes = [jugador(null, "rojo", 4), ...plantilla("azul", 7)];
    const cronica = titularCronica({ rojo: 4, azul: 6, participantes });
    assert.equal(cronica.titular, "Cuatro goles y derrota igual");

    const conPortero = [jugador("  ", "rojo", 3), jugador(null, "azul", 1, "GK"), ...plantilla("azul", 2)];
    const { titular, frasePanenka } = titularCronica({ rojo: 3, azul: 9, participantes: conPortero });
    assert.equal(titular, "Gol desde la portería");
    assert.equal(frasePanenka, "Alguien metió los tres del Rojo y perdió por seis.");
});

test("crónica: titular en mayúscula inicial aunque el nombre venga en minúscula", () => {
    const participantes = [jugador("hugo", "rojo", 3), ...plantilla("azul", 7)];
    assert.equal(titularCronica({ rojo: 3, azul: 5, participantes }).titular, "Hugo metió tres y perdió igual");
});

test("crónica: es determinista y el id cambia la variante", () => {
    const entrada = { id: "abc", rojo: 4, azul: 2, participantes: [] };
    assert.deepEqual(titularCronica(entrada), titularCronica(entrada));
    const frases = new Set(ids.map((id) => titularCronica({ ...entrada, id }).titular));
    assert.ok(frases.size >= 4);
    const sinId = { rojo: 4, azul: 2, participantes: [] };
    assert.deepEqual(titularCronica(sinId), titularCronica(sinId));
});

test("crónica: titulares de 32 caracteres o menos con nombres normales", () => {
    const marcadores = [[0, 0], [1, 1], [12, 12], [3, 2], [0, 12], [2, 8], [6, 3], [5, 1]];
    for (const id of ids) {
        for (const [rojo, azul] of marcadores) {
            const { titular } = titularCronica({ id, rojo, azul, participantes: [] });
            assert.ok(titular.length <= MAX_TITULAR, titular);
        }
    }
});

test("participanteCronica adapta las filas de match_participants", () => {
    assert.deepEqual(
        participanteCronica({ team: "B", goals: 2, profiles: { username: "Chus", position: "GK" } }),
        { nombre: "Chus", equipo: "azul", goles: 2, posicion: "GK" }
    );
    assert.deepEqual(
        participanteCronica({ team: null, goals: 0, profiles: null }),
        { nombre: null, equipo: null, goles: 0, posicion: null }
    );
    assert.equal(equipoDeTeam("A"), "rojo");
    assert.equal(equipoDeTeam("B"), "azul");
    assert.equal(equipoDeTeam(null), null);
});

// ─── Ranking ──────────────────────────────────────────────────────────────────

const RANKING = { totalEnTabla: 18, partidos: 7, umbralProvisional: 3 };

test("ranking: con rival por encima", () => {
    const anterior = { nombre: "Iván", distancia: 47 };
    assert.equal(titularRanking({ ...RANKING, posicion: 2, anterior }), "Segundo, a 47 de Iván.");
});

test("ranking: líder", () => {
    const siguiente = { nombre: "Pelayo", distancia: 33 };
    assert.equal(titularRanking({ ...RANKING, posicion: 1, siguiente }), "Líder, 33 por delante de Pelayo.");
});

test("ranking: último", () => {
    const anterior = { nombre: "Xuan", distancia: 12 };
    assert.equal(titularRanking({ ...RANKING, posicion: 18, anterior }), "Último. Alguien tiene que serlo.");
});

test("ranking: provisional, en plural y en singular", () => {
    assert.equal(
        titularRanking({ ...RANKING, partidos: 1, posicion: null }),
        "Aún no cuentas. Te faltan 2 partidos."
    );
    assert.equal(
        titularRanking({ ...RANKING, partidos: 2, posicion: 4 }),
        "Aún no cuentas. Te falta 1 partido."
    );
    assert.equal(
        titularRanking({ ...RANKING, partidos: 0, posicion: null }),
        "Aún no cuentas. Te faltan 3 partidos."
    );
});

test("ranking: el umbral por defecto es el del ELO", () => {
    assert.equal(
        titularRanking({ totalEnTabla: 5, partidos: 2, posicion: null }),
        "Aún no cuentas. Te falta 1 partido."
    );
});

test("ranking: ordinales en palabra hasta décimo y luego en cifra", () => {
    const anterior = { nombre: "Ana", distancia: 1 };
    const esperados = [
        [3, "Tercero"], [4, "Cuarto"], [5, "Quinto"], [6, "Sexto"],
        [7, "Séptimo"], [8, "Octavo"], [9, "Noveno"], [10, "Décimo"], [11, "11.º"], [17, "17.º"],
    ];
    for (const [posicion, palabra] of esperados) {
        assert.equal(titularRanking({ ...RANKING, posicion, anterior }), `${palabra}, a 1 de Ana.`);
    }
    assert.equal(ordinal(1), "primero");
    assert.equal(ordinal(10), "décimo");
    assert.equal(ordinal(11), "11.º");
});

test("ranking: empates a puntos no dicen a 0 de", () => {
    const empate = { nombre: "Iván", distancia: 0 };
    assert.equal(titularRanking({ ...RANKING, posicion: 2, anterior: empate }), "Segundo, a la par de Iván.");
    assert.equal(titularRanking({ ...RANKING, posicion: 1, siguiente: empate }), "Líder, a la par de Iván.");
    assert.equal(titularRanking({ ...RANKING, posicion: 18, anterior: empate }), "18.º, a la par de Iván.");
});

test("ranking: nombres largos caben con el nombre corto", () => {
    const anterior = { nombre: LARGO, distancia: 47 };
    const titular = titularRanking({ ...RANKING, posicion: 2, anterior });
    assert.equal(titular, "Segundo, a 47 de Cristian.");
    assert.ok(titular.length <= MAX_TITULAR);

    const siguiente = { nombre: LARGO, distancia: 3 };
    assert.equal(titularRanking({ ...RANKING, posicion: 1, siguiente }), "Líder, 3 por delante de Cristian.");
});

test("ranking: un nombre que acaba en punto no lo dobla", () => {
    const rival = { nombre: "Rubén M.", distancia: 14 };
    const siguiente = { nombre: "Rubén M.", distancia: 4 };
    const empate = { nombre: "Rubén M.", distancia: 0 };
    assert.equal(titularRanking({ ...RANKING, posicion: 14, anterior: rival }), "14.º, a 14 de Rubén M.");
    assert.equal(titularRanking({ ...RANKING, posicion: 2, anterior: empate }), "Segundo, a la par de Rubén M.");
    assert.equal(titularRanking({ ...RANKING, posicion: 1, siguiente }), "Líder, 4 por delante de Rubén M.");
    // Con dos cifras se pasa de 32 y entra el nombre corto, también con su punto.
    assert.equal(titularRanking({ ...RANKING, posicion: 1, siguiente: rival }), "Líder, 14 por delante de Rubén.");
    assert.equal(titularRanking({ ...RANKING, posicion: 1, siguiente: empate }), "Líder, a la par de Rubén M.");
});

test("ranking: sin nombre, frases sin género", () => {
    const anterior = { nombre: null, distancia: 47 };
    assert.equal(titularRanking({ ...RANKING, posicion: 5, anterior }), "Quinto, a 47 de subir.");
    assert.equal(titularRanking({ ...RANKING, posicion: 5, anterior: { nombre: " ", distancia: 0 } }), "Quinto, en empate.");
    assert.equal(
        titularRanking({ ...RANKING, posicion: 1, siguiente: { nombre: null, distancia: 8 } }),
        "Líder, 8 por delante."
    );
    assert.equal(
        titularRanking({ ...RANKING, posicion: 1, siguiente: { nombre: null, distancia: 0 } }),
        "Líder, en empate."
    );
});

test("ranking: casos sueltos", () => {
    assert.equal(titularRanking({ ...RANKING, totalEnTabla: 1, posicion: 1 }), "Líder. No hay nadie más.");
    assert.equal(titularRanking({ ...RANKING, posicion: null }), "Aún no cuentas.");
    assert.equal(titularRanking({ ...RANKING, posicion: 4 }), "Cuarto.");
    assert.equal(titularRanking({ ...RANKING, totalEnTabla: 2, posicion: 2 }), "Último. Alguien tiene que serlo.");
    assert.equal(
        titularRanking({ ...RANKING, posicion: 2, anterior: { nombre: "Iván", distancia: -46.6 } }),
        "Segundo, a 47 de Iván."
    );
});

test("Panenka ranking: los hechos de la tabla van primero", () => {
    assert.equal(
        frasePanenkaRanking({ id: "x", pichichi: { posicion: "DEF" }, segundoGoleador: { posicion: "GK" } }),
        "Pichichi, un defensa. Segundo, un portero. Así estamos."
    );
    assert.equal(
        frasePanenkaRanking({ id: "x", pichichi: { posicion: "MID" }, segundoGoleador: { posicion: "FWD" } }),
        "Pichichi, un medio. Los delanteros, bien, gracias."
    );
    assert.equal(
        frasePanenkaRanking({
            id: "x",
            pichichi: { posicion: "DEF" },
            rachaEquipo: { equipo: "azul", partidos: 3 },
        }),
        "Tres seguidas del Azul. El Rojo, ni está ni se le espera."
    );
    assert.notEqual(
        frasePanenkaRanking({ id: "x", rachaEquipo: { equipo: "rojo", partidos: 2 } }),
        "Dos seguidas del Rojo. El Azul, ni está ni se le espera."
    );
});

test("Panenka ranking: mitad de tabla solo en el tercio central", () => {
    const frases = (posicion, totalEnTabla) =>
        ids.map((id) => frasePanenkaRanking({ id, partidos: 7, posicion, totalEnTabla }));
    for (const posicion of [7, 9, 12]) {
        assert.ok(frases(posicion, 18).every((frase) => /[Mm]itad de (la )?tabla/.test(frase)), String(posicion));
    }
    for (const posicion of [2, 3, 6, 13, 17]) {
        assert.ok(frases(posicion, 18).every((frase) => !/[Mm]itad de (la )?tabla/.test(frase)), String(posicion));
    }
});

test("Panenka ranking: al menos cuatro variantes por caso", () => {
    const casos = [
        { partidos: 1 },
        { partidos: 7, posicion: 1, totalEnTabla: 10 },
        { partidos: 7, posicion: 10, totalEnTabla: 10 },
        { partidos: 7, posicion: 5, totalEnTabla: 10 },
        {},
    ];
    for (const caso of casos) {
        const frases = new Set(ids.map((id) => frasePanenkaRanking({ id, ...caso })));
        assert.ok(frases.size >= 4, JSON.stringify(caso));
    }
});

// ─── Jugador ──────────────────────────────────────────────────────────────────

test("jugador: goles sin MVP", () => {
    assert.equal(titularJugador({ ...FICHA, goles: 9, mvps: 0 }), "Nueve goles y ni un MVP");
    assert.equal(titularJugador({ ...FICHA, goles: 13, mvps: 0 }), "13 goles y ni un MVP");
    assert.notEqual(titularJugador({ ...FICHA, goles: 4, mvps: 0 }), "Cuatro goles y ni un MVP");
});

test("jugador: invicto", () => {
    assert.equal(titularJugador({ ...FICHA, racha: { sinPerder: 6 } }), "Invicto en seis partidos");
});

test("jugador: sin nombre no se dice invicto", () => {
    assert.equal(titularJugador({ ...FICHA, nombre: null, racha: { sinPerder: 6 } }), "Seis partidos sin perder");
    assert.equal(titularJugador({ ...FICHA, nombre: " ", racha: { sinPerder: 6 } }), "Seis partidos sin perder");
});

test("jugador: sin marcar, por racha o de toda la vida", () => {
    assert.equal(titularJugador({ ...FICHA, racha: { sinMarcar: 12 } }), "Doce partidos sin marcar");
    assert.equal(titularJugador({ ...FICHA, partidos: 12, goles: 0 }), "Doce partidos sin marcar");
    assert.equal(titularJugador({ ...FICHA, partidos: 14, goles: 0 }), "14 partidos sin marcar");
});

test("jugador: a un portero no se le reprocha no marcar", () => {
    const titular = titularJugador({ ...FICHA, partidos: 12, goles: 0, posicion: "GK" });
    assert.doesNotMatch(titular, /sin marcar/);
});

test("jugador: rachas", () => {
    assert.equal(titularJugador({ ...FICHA, racha: { victorias: 4 } }), "Cuatro victorias seguidas");
    assert.equal(titularJugador({ ...FICHA, racha: { derrotas: 3 } }), "Tres derrotas seguidas");
    assert.equal(titularJugador({ ...FICHA, racha: { sinGanar: 6 } }), "Seis partidos sin ganar");
});

test("jugador: MVPs, promedio y victorias", () => {
    assert.equal(titularJugador({ ...FICHA, goles: 1, mvps: 2 }), "Más MVPs que goles");
    assert.equal(titularJugador({ ...FICHA, goles: 4, mvps: 3 }), "Tres MVPs en siete partidos");
    assert.equal(titularJugador({ ...FICHA, goles: 9, mvps: 1 }), "Nueve goles en siete partidos");
    assert.equal(titularJugador({ ...FICHA, victorias: 0 }), "Siete partidos sin una victoria");
    assert.equal(titularJugador(FICHA), "Dos victorias en siete partidos");
    assert.equal(titularJugador({ ...FICHA, victorias: 1 }), "Una victoria en siete partidos");
});

test("jugador: se recorta para no pasar de 32", () => {
    const titular = titularJugador({ ...FICHA, partidos: 12, victorias: 4 });
    assert.equal(titular, "Cuatro victorias de doce");
    assert.ok(titular.length <= MAX_TITULAR);
});

test("jugador: nuevos", () => {
    assert.equal(titularJugador({ ...FICHA, partidos: 0, goles: 0, mvps: 0 }), "Sin partidos. Sin excusas.");
    assert.equal(titularJugador({ ...FICHA, partidos: 1, goles: 1 }), "Un partido y un gol");
    assert.equal(titularJugador({ ...FICHA, partidos: 1, goles: 0 }), "Un partido, nada que contar");
    assert.equal(titularJugador({ ...FICHA, partidos: 2, goles: 3 }), "Dos partidos y tres goles");
});

test("jugador: nunca dice uno goles", () => {
    assert.doesNotMatch(titularJugador({ ...FICHA, partidos: 1, goles: 1 }), /[Uu]no gol|un goles/);
});

test("jugador: mayúscula inicial y hasta 32 caracteres en una rejilla de fichas", () => {
    for (const partidos of [0, 1, 2, 3, 7, 12, 30]) {
        for (const goles of [0, 1, 5, 12, 40]) {
            for (const mvps of [0, 1, 3]) {
                for (const victorias of [0, 1, 3, 12]) {
                    const titular = titularJugador({ ...FICHA, partidos, goles, mvps, victorias });
                    assert.ok(titular.length <= MAX_TITULAR, titular);
                    assert.equal(titular[0], titular[0].toLocaleUpperCase("es-ES"), titular);
                }
            }
        }
    }
});

test("calcularRacha cuenta desde el último partido", () => {
    const historial = [
        { resultado: "V", goles: 0 },
        { resultado: "E", goles: 0 },
        { resultado: "D", goles: 2 },
        { resultado: "V", goles: 0 },
    ];
    assert.deepEqual(calcularRacha(historial), { victorias: 1, derrotas: 0, sinPerder: 2, sinGanar: 0, sinMarcar: 2 });
    assert.deepEqual(calcularRacha([]), { victorias: 0, derrotas: 0, sinPerder: 0, sinGanar: 0, sinMarcar: 0 });
    const todos = Array.from({ length: 3 }, () => ({ resultado: "D", goles: 0 }));
    assert.equal(calcularRacha(todos).derrotas, 3);
});

test("Panenka jugador: cada caso tiene al menos cuatro variantes", () => {
    const casos = [
        { ...FICHA, partidos: 0, goles: 0, mvps: 0 },
        { ...FICHA, racha: { sinPerder: 6 } },
        { ...FICHA, goles: 0, partidos: 8 },
        { ...FICHA, mvps: 0 },
        { ...FICHA, victorias: 0, derrotas: 7, empates: 0 },
        FICHA,
    ];
    for (const caso of casos) {
        const frases = new Set(ids.map((id) => frasePanenkaJugador({ id, ...caso })));
        assert.ok(frases.size >= 4, JSON.stringify(caso));
    }
    assert.ok(ids.some((id) => frasePanenkaJugador({ id, ...FICHA, mvps: 0 }) === "0 MVPs. Insiste."));
});

test("Panenka jugador: no repite el titular de jugador nuevo", () => {
    const nuevo = { ...FICHA, partidos: 0, goles: 0, mvps: 0 };
    for (const id of ids) {
        assert.notEqual(frasePanenkaJugador({ id, ...nuevo }), titularJugador(nuevo));
    }
});

test("titularPetoJugador", () => {
    assert.equal(titularPetoJugador({ equipo: "azul", fecha: MARTES, ahora: ANTES }), "El martes va de azul");
    assert.equal(
        titularPetoJugador({ equipo: "rojo", fecha: MARTES, ahora: "2026-11-03T09:00:00.000Z" }),
        "Hoy va de rojo"
    );
});

// ─── Vacíos y voz ─────────────────────────────────────────────────────────────

const CONTEXTOS = [
    "sin-partido", "apuntados", "partidos", "historial", "goles", "mvp", "fotos",
    "chat", "ranking", "jugadores", "trofeos", "notificaciones", "panenka",
];

test("fraseVacio: cuatro variantes por contexto y determinista", () => {
    for (const contexto of CONTEXTOS) {
        const frases = new Set(ids.map((id) => fraseVacio(contexto, id)));
        assert.ok(frases.size >= 4, contexto);
        assert.equal(fraseVacio(contexto, "x"), fraseVacio(contexto, "x"));
        assert.equal(typeof fraseVacio(contexto), "string");
    }
});

function todasLasFrases() {
    const frases = new Set();
    const participantes = [...plantilla("rojo", 7), ...plantilla("azul", 7)];
    const portero = [jugador("Chus", "azul", 1, "GK")];
    const derrota = [jugador("Hugo", "rojo", 4)];
    const equipo = plantilla("azul", 7, 1);
    for (const id of ids) {
        for (const contexto of CONTEXTOS) frases.add(fraseVacio(contexto, id));
        for (const [rojo, azul, lista] of [
            [0, 0, []], [2, 2, []], [3, 2, []], [4, 2, []], [9, 1, []],
            [4, 2, participantes], [null, null, []], [0, 1, portero], [4, 6, derrota], [1, 8, equipo],
        ]) {
            frases.add(titularCronica({ id, rojo, azul, participantes: lista }).frasePanenka);
            frases.add(titularCronica({ id, rojo, azul, participantes: lista }).titular);
        }
        for (const caso of [
            { partidos: 1 },
            { partidos: 7, posicion: 1, totalEnTabla: 10 },
            { partidos: 7, posicion: 10, totalEnTabla: 10 },
            { partidos: 7, posicion: 5, totalEnTabla: 10 },
        ]) {
            frases.add(frasePanenkaRanking({ id, ...caso }));
        }
        for (const caso of [
            { ...FICHA, partidos: 0, goles: 0, mvps: 0 },
            { ...FICHA, racha: { sinPerder: 6 } },
            { ...FICHA, goles: 0, partidos: 8 },
            { ...FICHA, mvps: 0 },
            { ...FICHA, victorias: 0, derrotas: 7, empates: 0 },
            FICHA,
        ]) {
            frases.add(frasePanenkaJugador({ id, ...caso }));
        }
    }
    return [...frases];
}

test("voz: sin exclamaciones, sin fumar, sin tacos y sin dar por hecho el martes", () => {
    const frases = todasLasFrases();
    assert.ok(frases.length > 80);
    for (const frase of frases) {
        assert.doesNotMatch(frase, /[!¡]/, frase);
        assert.doesNotMatch(frase, /fum|humo|tabaco|cigarr|pitillo|colilla/i, frase);
        assert.doesNotMatch(frase, /joder|mierda|cabr[oó]n|coñ[oa]|hostia|gilipollas|puta/i, frase);
        assert.doesNotMatch(frase, /martes/i, frase);
        assert.doesNotMatch(frase, /\b(gord|calv|feo|fea|bajit|viej)/i, frase);
    }
});

test("voz: todo en mayúscula inicial de frase, nada en mayúsculas", () => {
    for (const frase of todasLasFrases()) {
        assert.equal(frase[0], frase[0].toLocaleUpperCase("es-ES"), frase);
        assert.notEqual(frase, frase.toLocaleUpperCase("es-ES"), frase);
    }
});

// ─── Plurales y números ───────────────────────────────────────────────────────

test("plurales", () => {
    assert.equal(plural(1, "gol"), "1 gol");
    assert.equal(plural(2, "gol"), "2 goles");
    assert.equal(plural(0, "gol"), "0 goles");
    assert.equal(plural(1, "partido"), "1 partido");
    assert.equal(plural(3, "partido"), "3 partidos");
    assert.equal(plural(3, "MVP", "MVPs"), "3 MVPs");
    assert.equal(elegirPlural(1, "falta", "faltan"), "falta");
    assert.equal(elegirPlural(2, "falta", "faltan"), "faltan");
});

test("números en palabra hasta doce", () => {
    assert.equal(numeroPalabra(0), "cero");
    assert.equal(numeroPalabra(1), "uno");
    assert.equal(numeroPalabra(1, "f"), "una");
    assert.equal(numeroPalabra(12), "doce");
    assert.equal(numeroPalabra(13), "13");
    assert.equal(numeroPalabra(2.5), "2.5");
    assert.equal(enPalabras(1, "gol"), "un gol");
    assert.equal(enPalabras(1, "victoria", "victorias", "f"), "una victoria");
    assert.equal(enPalabras(9, "gol"), "nueve goles");
    assert.equal(enPalabras(13, "gol"), "13 goles");
});

test("listaNombres usa e antes de i", () => {
    assert.equal(listaNombres([]), "");
    assert.equal(listaNombres(["Hugo"]), "Hugo");
    assert.equal(listaNombres(["Hugo", "Dani"]), "Hugo y Dani");
    assert.equal(listaNombres(["Sergio", "Óscar", "Iván"]), "Sergio, Óscar e Iván");
    assert.equal(listaNombres(["Sergio", "Hilario"]), "Sergio e Hilario");
    assert.equal(listaNombres(["Sergio", "Iago"]), "Sergio y Iago");
});

test("puerta: cada contexto tiene su frase, estable y en la voz de Panenka", () => {
    for (const contexto of ["login", "registro", "acceso", "rechazo"]) {
        const frase = frasePuerta(contexto);
        assert.equal(frase, frasePuerta(contexto));
        assert.match(frase, /[.?]$/);
        assert.doesNotMatch(frase, /[¡!]/);
        const variantes = new Set(Array.from({ length: 60 }, (_, i) => frasePuerta(contexto, `id-${i}`)));
        assert.ok(variantes.size >= 4);
    }
    assert.notEqual(frasePuerta("login"), frasePuerta("rechazo"));
});

test("pensando: cambia con el mensaje y no grita", () => {
    assert.equal(frasePensando("m1"), frasePensando("m1"));
    const variantes = new Set(Array.from({ length: 60 }, (_, i) => frasePensando(`m${i}`)));
    assert.ok(variantes.size >= 4);
    for (const frase of variantes) assert.doesNotMatch(frase, /[¡!]/);
});

// ─── Tabla y ficha ───────────────────────────────────────────────────────────

import {
    conSigno,
    fraseError,
    lineaPorDetras,
    lineasCartel,
    mesMadrid,
    ordinalCorto,
    rachaDeEquipo,
    resultadoDe,
} from "../src/lib/titulares.ts";

test("cifras con signo y ordinal corto", () => {
    assert.equal(conSigno(17), "+17");
    assert.equal(conSigno(-15), "−15");
    assert.equal(conSigno(0), "0");
    assert.equal(ordinalCorto(2), "2.º");
    assert.equal(ordinalCorto(11), "11.º");
});

test("quién viene por detrás", () => {
    assert.equal(lineaPorDetras({ nombre: "Diego", distancia: 16 }), "Diego, 16 por detrás.");
    assert.equal(lineaPorDetras({ nombre: "Diego", distancia: -16 }), "Diego, 16 por detrás.");
    assert.equal(lineaPorDetras({ nombre: "Rubén M.", distancia: 0 }), "Rubén M., a la par.");
    assert.equal(lineaPorDetras(null), null);
    assert.equal(lineaPorDetras({ nombre: "  ", distancia: 3 }), null);
});

test("el resultado sale del marcador y del equipo", () => {
    assert.equal(resultadoDe("A", 3, 1), "V");
    assert.equal(resultadoDe("B", 3, 1), "D");
    assert.equal(resultadoDe("A", 1, 3), "D");
    assert.equal(resultadoDe("B", 1, 3), "V");
    assert.equal(resultadoDe("A", 2, 2), "E");
    assert.equal(resultadoDe("A", 0, 0), "E");
    assert.equal(resultadoDe(null, 3, 1), null);
    assert.equal(resultadoDe("A", null, 1), null);
    assert.equal(resultadoDe("B", 1, undefined), null);
});

test("racha de un equipo: la corta un empate o un partido sin marcador", () => {
    const rojo = { rojo: 3, azul: 1 };
    const azul = { rojo: 1, azul: 3 };
    const empate = { rojo: 2, azul: 2 };
    assert.deepEqual(rachaDeEquipo([azul, azul, azul, rojo]), { equipo: "azul", partidos: 3 });
    assert.deepEqual(rachaDeEquipo([rojo, rojo]), { equipo: "rojo", partidos: 2 });
    assert.deepEqual(rachaDeEquipo([azul, empate, azul]), { equipo: "azul", partidos: 1 });
    assert.deepEqual(rachaDeEquipo([rojo, { rojo: null, azul: null }, rojo]), { equipo: "rojo", partidos: 1 });
    assert.equal(rachaDeEquipo([empate, azul]), null);
    assert.equal(rachaDeEquipo([]), null);
});

test("cartel: los nombres largos van en dos líneas por el mejor corte", () => {
    assert.deepEqual(lineasCartel("Lu"), ["Lu"]);
    assert.deepEqual(lineasCartel("Rubén M."), ["Rubén M."]);
    assert.deepEqual(lineasCartel("Cristian Moreira Suárez"), ["Cristian", "Moreira Suárez"]);
    assert.deepEqual(lineasCartel("Cristian moreira s"), ["Cristian", "moreira s"]);
    assert.deepEqual(lineasCartel("  Maximilianoaugusto  "), ["Maximilianoaugusto"]);
    assert.deepEqual(lineasCartel("Ana   de   la Torre Bermúdez"), ["Ana de la", "Torre Bermúdez"]);
});

test("el mes es el de Madrid, no el del servidor", () => {
    assert.deepEqual(mesMadrid("2026-10-31T23:30:00.000Z"), { clave: "2026-11", nombre: "Noviembre" });
    assert.deepEqual(mesMadrid("2026-12-31T23:30:00.000Z"), { clave: "2027-01", nombre: "Enero" });
    assert.deepEqual(mesMadrid(MARTES), { clave: "2026-11", nombre: "Noviembre" });
});

test("los errores no gritan", () => {
    for (const contexto of ["ranking", "jugadores"]) assert.doesNotMatch(fraseError(contexto), /[¡!]/);
});

// ─── Partidos e historial ─────────────────────────────────────────────────────

test("diaPartido: hoy con hora, mañana, día de la semana y mes si queda lejos", () => {
    const ahora = "2026-10-31T10:00:00Z"; // sábado
    assert.equal(diaPartido("2026-10-31T19:00:00Z", ahora), "Hoy, 20:00");
    assert.equal(diaPartido("2026-11-01T19:00:00Z", ahora), "Mañana");
    assert.equal(diaPartido("2026-11-03T19:00:00Z", ahora), "Martes 3");
    assert.equal(diaPartido("2026-12-05T19:00:00Z", ahora), "Sábado 5 dic");
    assert.equal(diaPartido("2026-10-20T18:00:00Z", ahora), "Martes 20 oct");
});

test("diaPartido cuenta el día en Madrid, no en UTC", () => {
    assert.equal(diaPartido("2026-10-31T23:30:00Z", "2026-10-31T10:00:00Z"), "Mañana");
});

test("lineaPartido no repite la hora el mismo día", () => {
    const ahora = "2026-10-31T10:00:00Z";
    assert.equal(lineaPartido("2026-11-03T19:00:00Z", " Campus de Barredo ", ahora), "20:00 · Campus de Barredo");
    assert.equal(lineaPartido("2026-10-31T19:00:00Z", "Campus de Barredo", ahora), "Campus de Barredo");
});

test("tuPlaza dice lo mismo que la portada", () => {
    const ahora = "2026-10-31T10:00:00Z";
    const partido = {
        id: "m1", date: "2026-11-03T19:00:00Z", location: "Campus", max_players: 2, status: "open",
        participants: [{ user_id: "yo", team: null }],
    };
    assert.deepEqual(tuPlaza({ partido, yo: "yo", ahora }), { texto: "Juegas", dentro: true, equipo: null });
    assert.deepEqual(tuPlaza({ partido, yo: "otro", ahora }), { texto: "¿Juegas?", dentro: false, equipo: null });
    assert.equal(tuPlaza({ partido: { ...partido, status: "closed" }, yo: "otro", ahora }).texto, "Sin plaza");
    assert.deepEqual(
        tuPlaza({ partido: { ...partido, participants: [{ user_id: "yo", team: "B" }] }, yo: "yo", ahora }),
        { texto: "De azul", dentro: true, equipo: "azul" }
    );
    assert.equal(
        tuPlaza({ partido: { ...partido, participants: [{ user_id: "a", team: null }, { user_id: "b", team: null }] }, yo: "yo", ahora }).texto,
        "Sin plaza"
    );
});

test("textoPlazas: cerrado con huecos no pide gente", () => {
    assert.equal(textoPlazas({ ocupadas: 11, plazas: 14, status: "open" }), "Faltan 3");
    assert.equal(textoPlazas({ ocupadas: 13, plazas: 14, status: "open" }), "Falta 1");
    assert.equal(textoPlazas({ ocupadas: 14, plazas: 14, status: "open" }), "Completo");
    assert.equal(textoPlazas({ ocupadas: 15, plazas: 14, status: "closed" }), "Completo");
    assert.equal(textoPlazas({ ocupadas: 11, plazas: 14, status: "closed" }), "11 de 14");
});

test("estadoPartido en español", () => {
    assert.deepEqual(["open", "closed", "finished", "cancelled"].map(estadoPartido), ["Abierto", "Cerrado", "Terminado", "Cancelado"]);
});

test("detalleTerminado: lo tuyo antes que el sitio, y dice si no jugaste", () => {
    const base = { fecha: "2026-10-20T18:00:00Z", lugar: "Campus", jugado: true, team: "A", goles: 0, mvp: false };
    assert.equal(detalleTerminado(base), "20 oct · De rojo · Campus");
    assert.equal(detalleTerminado({ ...base, team: "B" }), "20 oct · De azul · Campus");
    assert.equal(detalleTerminado({ ...base, goles: 1 }), "20 oct · De rojo · 1 gol · Campus");
    assert.equal(detalleTerminado({ ...base, goles: 2, mvp: true }), "20 oct · De rojo · MVP · 2 goles · Campus");
    assert.equal(detalleTerminado({ ...base, jugado: false, team: null }), "20 oct · No jugaste · Campus");
    assert.equal(detalleTerminado({ ...base, team: null }), "20 oct · Sin equipo · Campus");
});

test("titularHistorial responde cómo te fue", () => {
    assert.equal(titularHistorial({ jugados: 0, victorias: 0, derrotas: 0 }), "Aún no has jugado partidos");
    assert.equal(titularHistorial({ jugados: 6, victorias: 3, derrotas: 1 }), "Ganaste tres de seis.");
    assert.equal(titularHistorial({ jugados: 6, victorias: 1, derrotas: 3 }), "Ganaste uno de seis.");
    assert.equal(titularHistorial({ jugados: 6, victorias: 6, derrotas: 0 }), "Ganaste los seis.");
    assert.equal(titularHistorial({ jugados: 6, victorias: 0, derrotas: 6 }), "Perdiste los seis.");
    assert.equal(titularHistorial({ jugados: 6, victorias: 0, derrotas: 2 }), "Ni una victoria en seis.");
    assert.equal(titularHistorial({ jugados: 20, victorias: 13, derrotas: 2 }), "Ganaste 13 de 20.");
    assert.equal(titularHistorial({ jugados: 1, victorias: 1, derrotas: 0 }), "Ganaste el único.");
    assert.equal(titularHistorial({ jugados: 1, victorias: 0, derrotas: 1 }), "Perdiste el único.");
    assert.equal(titularHistorial({ jugados: 1, victorias: 0, derrotas: 0 }), "Empataste el único.");
});

test("titularHistorial no mezcla palabras y cifras pasado de doce", () => {
    assert.equal(titularHistorial({ jugados: 13, victorias: 8, derrotas: 2 }), "Ganaste 8 de 13.");
    assert.equal(titularHistorial({ jugados: 30, victorias: 10, derrotas: 10 }), "Ganaste 10 de 30.");
    assert.equal(titularHistorial({ jugados: 13, victorias: 1, derrotas: 2 }), "Ganaste 1 de 13.");
    assert.equal(titularHistorial({ jugados: 12, victorias: 8, derrotas: 2 }), "Ganaste ocho de doce.");
});

test("recuentoResultados cuenta lo que hay en las filas", () => {
    assert.deepEqual(recuentoResultados([]), { jugados: 0, victorias: 0, empates: 0, derrotas: 0 });
    assert.deepEqual(recuentoResultados(["V", "V", "E", "D", "V"]), { jugados: 5, victorias: 3, empates: 1, derrotas: 1 });
});

test("preguntaCuando responde lo elegido o lo que falta", () => {
    const ahora = "2026-10-31T10:00:00Z";
    assert.equal(preguntaCuando("", false, ahora), "¿Cuándo?");
    assert.equal(preguntaCuando("", true, ahora), "¿Qué día?");
    assert.equal(preguntaCuando("2026-11-03T21:00", true, ahora), "Martes 3, 21:00");
    assert.equal(preguntaCuando("2026-11-03T20:00", false, ahora), "Martes 3, 20:00");
});

test("los textos fijos de partidos no gritan", () => {
    for (const texto of [SIN_RESULTADOS, AVISO_FECHA_PASADA]) assert.doesNotMatch(texto, /!/);
});

test("aValorLocal da la hora de Madrid, también con el horario de verano", () => {
    assert.equal(aValorLocal("2026-11-03T19:00:00Z"), "2026-11-03T20:00");
    assert.equal(aValorLocal("2026-07-03T19:00:00Z"), "2026-07-03T21:00");
    assert.equal(aValorLocal("2026-10-31T23:30:00Z"), "2026-11-01T00:30");
});

test("diasElegibles empieza hoy y cruza de mes", () => {
    const dias = diasElegibles("2026-10-31T10:00:00Z", 5);
    assert.deepEqual(dias.map((d) => d.etiqueta), ["Hoy", "Mañ", "Lun", "Mar", "Mié"]);
    assert.deepEqual(dias.map((d) => d.dia), [31, 1, 2, 3, 4]);
    assert.equal(dias[3].valor, "2026-11-03");
});

test("fechaRepetida busca el mismo día de la semana a la misma hora", () => {
    const sabado = "2026-10-31T10:00:00Z";
    assert.equal(fechaRepetida("2026-10-27T19:00:00Z", sabado), "2026-11-03T20:00"); // martes
    assert.equal(fechaRepetida("2026-10-24T18:00:00Z", sabado), "2026-11-07T20:00"); // sábado: el siguiente, no hoy
});

test("diaElegido no depende de la zona del dispositivo", () => {
    const ahora = "2026-10-31T10:00:00Z";
    assert.equal(diaElegido("2026-11-03T20:00", ahora), "Martes 3, 20:00");
    assert.equal(diaElegido("2026-10-31T21:30", ahora), "Hoy, 21:30");
    assert.equal(diaElegido("2026-11-01T20:00", ahora), "Mañana, 20:00");
    assert.equal(diaElegido("", ahora), null);
});

test("elegidoPasado avisa solo de lo que ya pasó", () => {
    const ahora = "2026-10-31T10:00:00Z"; // 11:00 en Madrid
    assert.equal(elegidoPasado("2026-10-31T10:59", ahora), true);
    assert.equal(elegidoPasado("2026-10-31T11:30", ahora), false);
    assert.equal(elegidoPasado("2026-10-30T23:00", ahora), true);
    assert.equal(elegidoPasado("2026-11-03T20:00", ahora), false);
    assert.equal(elegidoPasado("", ahora), false);
});

// ─── MVP ──────────────────────────────────────────────────────────────────────

test("recuentoMvp da un líder, varios en empate y ninguno sin votos", () => {
    const voto = (voter_id, voted_for) => ({ voter_id, voted_for });
    const unico = recuentoMvp([voto("a", "x"), voto("b", "x"), voto("c", "y")]);
    assert.deepEqual(unico.lideres, ["x"]);
    assert.equal(unico.maximo, 2);
    assert.equal(unico.votos.y, 1);

    assert.deepEqual(recuentoMvp([voto("a", "x"), voto("b", "y")]).lideres.sort(), ["x", "y"]);

    const vacio = recuentoMvp([]);
    assert.deepEqual(vacio.lideres, []);
    assert.equal(vacio.maximo, 0);
});

test("textoVotantes concuerda en singular y plural, y no dice cero", () => {
    assert.equal(textoVotantes(3, 14), "3 de 14 han votado");
    assert.equal(textoVotantes(1, 14), "1 de 14 ha votado");
    assert.equal(textoVotantes(0, 14), "Aún no ha votado nadie");
});

test("nombresBaldosa acorta salvo que dos compartan nombre", () => {
    assert.deepEqual(nombresBaldosa(["Cristian moreira s", "Hugo"]), ["Cristian", "Hugo"]);
    assert.deepEqual(nombresBaldosa(["Rubén M.", "Rubén G.", "Hugo"]), ["Rubén M.", "Rubén G.", "Hugo"]);
    assert.deepEqual(nombresBaldosa([null, "  "]), ["Anónimo", "Anónimo"]);
});

test("desenlaceMvp distingue ganador, tú, empate y sin votos", () => {
    const ganador = desenlaceMvp({ id: "m", ganador: "Hugo" });
    assert.equal(ganador.caso, "ganador");
    assert.equal(ganador.titular, "Hugo, MVP.");

    assert.equal(desenlaceMvp({ id: "m", ganador: "Rubén M." }).titular, "Rubén M., MVP.");
    assert.ok(desenlaceMvp({ id: "m", ganador: `${LARGO} ${LARGO}` }).titular.length <= MAX_TITULAR);

    const tuyo = desenlaceMvp({ id: "m", ganador: "Hugo", esTuyo: true });
    assert.equal(tuyo.caso, "ganaste");
    assert.equal(tuyo.titular, "Eres el MVP.");

    const empate = desenlaceMvp({ id: "m", empatados: 2, maximo: 3 });
    assert.equal(empate.caso, "empate");
    assert.equal(empate.titular, "Empate a tres votos.");
    assert.equal(desenlaceMvp({ id: "m", empatados: 2, maximo: 1 }).titular, "Empate a un voto.");

    const nadie = desenlaceMvp({ id: "m" });
    assert.equal(nadie.caso, "sin-votos");
    assert.equal(nadie.titular, "Sin MVP.");
    assert.ok(nadie.frase.length > 0);
});

test("las frases del MVP no gritan y son estables por partido", () => {
    for (const id of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
        for (const caso of [{ ganador: "Hugo" }, { ganador: "Hugo", esTuyo: true }, { empatados: 2, maximo: 2 }, {}]) {
            const { frase } = desenlaceMvp({ id, ...caso });
            assert.ok(!frase.includes("!"), frase);
            assert.equal(frase, desenlaceMvp({ id, ...caso }).frase);
        }
        assert.ok(!fraseNoJugaste(id).includes("!"));
        assert.match(fraseNoJugaste(id), /jug|partido/i);
    }
});

// ─── Tiempo ───────────────────────────────────────────────────────────────────

test("diaIsoMadrid usa el día de Madrid y no el de UTC", () => {
    // 00:30 del 1 de noviembre en Madrid: en UTC aún es 31 de octubre.
    assert.equal(diaIsoMadrid("2026-10-31T23:30:00.000Z"), "2026-11-01");
    assert.equal(diaIsoMadrid(MARTES), "2026-11-03");
    // Horario de verano: 00:30 en Madrid son las 22:30 UTC del día anterior.
    assert.equal(diaIsoMadrid("2026-06-30T22:30:00.000Z"), "2026-07-01");
    assert.throws(() => diaIsoMadrid("no es una fecha"));
});

test("cieloDeCodigo cubre todos los códigos WMO y no se inventa ninguno", () => {
    const esperados = {
        despejado: [0],
        "algo-nuboso": [1, 2],
        nublado: [3],
        niebla: [45, 48],
        llovizna: [51, 53, 55, 56, 57],
        lluvia: [61, 63, 65, 66, 67, 80, 81, 82],
        nieve: [71, 73, 75, 77, 85, 86],
        tormenta: [95, 96, 99],
    };
    for (const [cielo, codigos] of Object.entries(esperados)) {
        for (const codigo of codigos) assert.equal(cieloDeCodigo(codigo), cielo, String(codigo));
    }
    for (const raro of [4, 50, 100, -1, null, undefined]) assert.equal(cieloDeCodigo(raro), null);
});

test("lineaTiempo omite lo que falta y nunca dice null", () => {
    assert.equal(
        lineaTiempo({ cielo: "lluvia", temperatura: 13.6, probabilidadLluvia: 80 }),
        "Lluvia · 14° · 80 %"
    );
    assert.equal(lineaTiempo({ cielo: "nublado", temperatura: 9, probabilidadLluvia: null }), "Nublado · 9°");
    assert.equal(
        lineaTiempo({ cielo: "nublado", temperatura: 9, probabilidadLluvia: 20 }),
        "Nublado · 9° · 20 % de lluvia"
    );
    assert.equal(lineaTiempo({ cielo: "nieve", temperatura: 1, probabilidadLluvia: 30 }), "Nieve · 1° · 30 %");
    assert.equal(lineaTiempo({ cielo: "tormenta", temperatura: 22, probabilidadLluvia: 70 }), "Tormenta · 22° · 70 %");
    assert.equal(lineaTiempo({ cielo: null, temperatura: 0, probabilidadLluvia: undefined }), "0°");
    assert.equal(lineaTiempo({ cielo: null, temperatura: null, probabilidadLluvia: null }), null);
});

test("respuestaPartido dice lo que falta, y el peto solo cuando no falta nadie", () => {
    assert.equal(respuestaPartido({ status: "open", faltan: 3 }), "Faltan 3");
    assert.equal(respuestaPartido({ status: "open", faltan: 1 }), "Falta 1");
    assert.equal(respuestaPartido({ status: "open", faltan: 0 }), "Completo");
    assert.equal(respuestaPartido({ status: "open", faltan: 2, equipo: "rojo" }), "Faltan 2");
    assert.equal(respuestaPartido({ status: "open", faltan: 0, equipo: "azul" }), "De azul.");
    assert.equal(respuestaPartido({ status: "closed", faltan: 3 }), "Cerrado");
    assert.equal(respuestaPartido({ status: "closed", faltan: 3, equipo: "rojo" }), "De rojo.");
    assert.equal(respuestaPartido({ status: "cancelled", faltan: 3, equipo: "rojo" }), "Cancelado");
    assert.equal(respuestaPartido({ status: "open", faltan: 3, pasado: true }), "Falta el resultado");
    assert.equal(respuestaPartido({ status: "closed", faltan: 0, pasado: true }), "Falta el resultado");
    assert.equal(respuestaPartido({ status: "cancelled", faltan: 3, pasado: true }), "Cancelado");
});

test("textoBuscar y textoDeben cuadran el plural y cortan la lista", () => {
    assert.equal(textoBuscar(3), "Buscar 3 por WhatsApp");
    assert.equal(textoDeben([]), null);
    assert.equal(textoDeben(["Iván"]), "Debe Iván");
    assert.equal(textoDeben(["Sergio", "Óscar", "Iván"]), "Deben Sergio, Óscar e Iván");
    assert.equal(textoDeben(["Sergio", "Óscar", "Iván", "Xuan", "Dani"]), "Deben Sergio, Óscar, Iván y 2 más");
});

test("notaPlantilla avisa de lo que falta y calla si no falta nada", () => {
    const j = (nombre, posicion) => ({ nombre, posicion });
    assert.equal(notaPlantilla([]), null);
    assert.equal(notaPlantilla([j("Xuan", "FWD")]), "Sin portero");
    assert.equal(notaPlantilla([j("Chus", "GK"), j("Nacho", "DEF")]), "Arriba, nadie");
    assert.equal(notaPlantilla([j("Chus", "GK"), j("Xuan", "FWD")]), "Arriba, solo Xuan");
    assert.equal(
        notaPlantilla([j("Chus", "GK"), j("Cristian Moreira Suárez", "FWD")]),
        "Arriba, solo Cristian"
    );
    assert.equal(notaPlantilla([j("Chus", "GK"), j("Xuan", "FWD"), j("Hugo", "FWD")]), null);
});

test("textoWhatsApp invita solo cuando hay partido por jugar", () => {
    const base = {
        location: "Campus de Barredo",
        date: "2026-11-03T19:00:00.000Z",
        url: "https://pachanga.app/matches/1",
    };
    assert.equal(
        textoWhatsApp({ ...base, status: "open", faltan: 3 }),
        "¡Únete a la pachanga!\nFaltan 3\nCampus de Barredo\nMartes 3 nov, 20:00\n→ https://pachanga.app/matches/1"
    );
    assert.equal(
        textoWhatsApp({ ...base, status: "open", faltan: 0 }),
        "¡Únete a la pachanga!\nCampus de Barredo\nMartes 3 nov, 20:00\n→ https://pachanga.app/matches/1"
    );
    assert.match(textoWhatsApp({ ...base, status: "finished", rojo: 5, azul: 10 }), /^Pachanga: Rojo 5, Azul 10\n/);
    assert.match(textoWhatsApp({ ...base, status: "finished", rojo: 0, azul: 0 }), /^Pachanga: Rojo 0, Azul 0\n/);
    assert.match(textoWhatsApp({ ...base, status: "finished" }), /^Pachanga terminada\n/);
    assert.match(textoWhatsApp({ ...base, status: "cancelled", faltan: 3 }), /^Pachanga cancelada\nCampus/);
});

test("fraseCancelado es estable por partido y no exclama", () => {
    assert.equal(fraseCancelado("x"), fraseCancelado("x"));
    for (const id of ["a", "b", "c", "d", "e", "f"]) assert.doesNotMatch(fraseCancelado(id), /[!¡]/);
});

import { charsCartel } from "../src/lib/titulares.ts";

test("charsCartel: mide el nombre, no cuenta caracteres", () => {
    // Lo que de verdad ocupa cada caso, en em, medido en la fuente a peso 900
    const medidos = [
        ["WWWWWWWWWW", 6.49],
        ["M".repeat(30), 17.46],
        ["MANOLÍN", 3.06],
        ["Cristian moreira s", 5.77],
        ["Panenka", 2.77],
        ["🔥🔥🔥 Pelayín 🔥🔥", 9.4],
    ];
    for (const [nombre, em] of medidos) {
        assert.ok(charsCartel(nombre) * 0.42 >= em, nombre);
    }
});

test("charsCartel: un nombre normal no encoge, y lo ancho ocupa más que su longitud", () => {
    assert.ok(charsCartel("Pelayo") <= "Pelayo".length + 0.5);
    assert.ok(charsCartel("Lu") < 3);
    assert.ok(charsCartel("MANOLÍN") > charsCartel("Manolín"));
    assert.ok(charsCartel("🔥🔥🔥 Pelayín 🔥🔥") > "🔥🔥🔥 Pelayín 🔥🔥".length);
});

test("charsCartel: un emoji compuesto es un solo grafema", () => {
    assert.equal(charsCartel("👨‍👩‍👧"), charsCartel("🔥"));
    assert.equal(charsCartel("🇪🇸"), charsCartel("🔥"));
    assert.equal(charsCartel("á"), charsCartel("a"));
});

test("cuerpoCifras: una fila normal se queda en su tope y una larga baja para caber", async () => {
    const { cuerpoCifras } = await import("../src/lib/titulares.ts");
    assert.equal(cuerpoCifras([9, 2, "4-1-1"], "14vw"), "min(56px, 14vw, calc((min(100vw, 640px) - 64px) / 3.29))");
    assert.match(cuerpoCifras([1234, 99, "120-30-50"], "13vw"), /\/ 7\.05\)\)$/);
});
