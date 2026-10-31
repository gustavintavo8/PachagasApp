import assert from "node:assert/strict";
import test from "node:test";
import { conDestino, rutaInterna } from "../src/lib/destino.ts";
import { barajarEquipos, balanceTeams } from "../src/lib/team-balancer.ts";
import { puertaDeError, ERROR_CONEXION, ERROR_GENERICO } from "../src/app/login/errores.ts";
import {
    avisoBorrarse,
    frasePuerta,
    fraseVacio,
    respuestaPartido,
    titularCronica,
    titularHistorial,
} from "../src/lib/titulares.ts";

// ─── Destino tras entrar ──────────────────────────────────────────────────────

test("rutaInterna acepta rutas de la app con su consulta", () => {
    assert.equal(rutaInterna("/matches/123"), "/matches/123");
    assert.equal(rutaInterna("/matches/123?desde=historial"), "/matches/123?desde=historial");
});

test("rutaInterna no deja salir de la app", () => {
    for (const malo of ["https://evil.com", "//evil.com", "/\\evil.com", "\\\\evil.com", "evil.com", "", null, undefined, 3]) {
        assert.equal(rutaInterna(malo), null, String(malo));
    }
});

test("rutaInterna no manda a la puerta ni a Inicio", () => {
    for (const puerta of ["/", "/login", "/login?next=/x", "/access", "/auth/callback"]) {
        assert.equal(rutaInterna(puerta), null, puerta);
    }
    assert.equal(rutaInterna("/login-anything"), "/login-anything");
});

test("conDestino escapa el destino y sin destino deja la ruta", () => {
    assert.equal(conDestino("/login", "/matches/1?desde=x"), "/login?next=%2Fmatches%2F1%3Fdesde%3Dx");
    assert.equal(conDestino("/login", null), "/login");
});

// ─── Barajar ──────────────────────────────────────────────────────────────────

const POSICIONES = ["GK", "GK", "DEF", "DEF", "DEF", "DEF", "MID", "MID", "MID", "MID", "FWD", "FWD", "FWD", "FWD"];
const plantilla = POSICIONES.map((position, i) => ({
    user_id: `u${String(i).padStart(2, "0")}`,
    position,
    elo_rating: 950 + i * 11,
}));
const conEquipos = (reparto) => reparto.assignments.map(({ user_id, team }) => ({ user_id, team }));
const equipoDe = (reparto, equipo) => new Set(reparto.assignments.filter((a) => a.team === equipo).map((a) => a.user_id));
const mismoReparto = (a, b) => {
    const [a1, b1, b2] = [equipoDe(a, "A"), equipoDe(b, "A"), equipoDe(b, "B")];
    const igual = (x, y) => x.size === y.size && [...x].every((id) => y.has(id));
    return igual(a1, b1) || igual(a1, b2);
};

test("barajar da un reparto distinto aunque el balanceo sea determinista", () => {
    const actual = balanceTeams(plantilla);
    assert.ok(mismoReparto(actual, balanceTeams(plantilla)));
    for (let i = 0; i < 40; i++) {
        const nuevo = barajarEquipos(plantilla, conEquipos(actual));
        assert.ok(nuevo);
        assert.equal(mismoReparto(actual, nuevo), false);
    }
});

test("barajar varía entre una vez y la siguiente", () => {
    const actual = balanceTeams(plantilla);
    const huellas = new Set(
        Array.from({ length: 30 }, () => [...equipoDe(barajarEquipos(plantilla, conEquipos(actual)), "A")].sort().join())
    );
    assert.ok(huellas.size > 3);
});

test("barajar no descoloca: tamaños, posiciones y medias", () => {
    const actual = balanceTeams(plantilla);
    for (let i = 0; i < 40; i++) {
        const { teamA, teamB, eloDelta } = barajarEquipos(plantilla, conEquipos(actual));
        assert.ok(Math.abs(teamA.length - teamB.length) <= 1);
        for (const posicion of ["GK", "DEF", "MID", "FWD"]) {
            const cuantos = (equipo) => equipo.filter((p) => p.position === posicion).length;
            assert.ok(Math.abs(cuantos(teamA) - cuantos(teamB)) <= 1, posicion);
        }
        assert.ok(eloDelta <= actual.eloDelta + 25, `delta ${eloDelta}`);
    }
});

test("barajar cuenta a quien entró después de hacer los equipos", () => {
    const actual = conEquipos(balanceTeams(plantilla.slice(0, 13)));
    const nuevo = barajarEquipos(plantilla, [...actual, { user_id: "u13", team: null }]);
    assert.ok(nuevo.assignments.some((a) => a.user_id === "u13"));
    assert.equal(nuevo.assignments.length, 14);
});

test("barajar con dos no tiene otro reparto, y lo dice", () => {
    const dos = plantilla.slice(2, 4);
    assert.equal(barajarEquipos(dos, conEquipos(balanceTeams(dos))), null);
});

// ─── Textos ───────────────────────────────────────────────────────────────────

test("una goleada nunca suena a que ganó el que perdió", () => {
    for (let i = 0; i < 60; i++) {
        const { titular } = titularCronica({ id: `p${i}`, rojo: 9, azul: 1, participantes: [] });
        assert.doesNotMatch(titular, /se llevó/);
    }
});

test("pasado y sin rival no pide resultado", () => {
    assert.equal(respuestaPartido({ status: "open", faltan: 13, pasado: true, jugadores: 1 }), "No se jugó");
    assert.equal(respuestaPartido({ status: "open", faltan: 14, pasado: true, jugadores: 0 }), "No se jugó");
    assert.equal(respuestaPartido({ status: "open", faltan: 12, pasado: true, jugadores: 2 }), "Falta el resultado");
    assert.equal(respuestaPartido({ status: "open", faltan: 13, jugadores: 1 }), "Faltan 13");
});

test("en una temporada acabada no se dice «aún»", () => {
    const nada = { jugados: 0, victorias: 0, derrotas: 0 };
    assert.equal(titularHistorial({ ...nada, archivada: true }), "No jugaste esta temporada.");
    assert.equal(titularHistorial(nada), "Aún no has jugado partidos");
});

test("borrarse solo pregunta si cuesta algo", () => {
    assert.match(avisoBorrarse({ equipo: "azul", lleno: false }), /peto azul/);
    assert.match(avisoBorrarse({ equipo: null, lleno: true }), /plaza/);
    assert.equal(avisoBorrarse({ equipo: null, lleno: false }), null);
});

test("el portero no contesta «no me suena» a todo", () => {
    assert.equal(puertaDeError("Email o contraseña incorrectos."), "rechazo");
    assert.equal(puertaDeError("Este email ya está registrado. Inicia sesión."), "repetido");
    assert.equal(puertaDeError("Debes confirmar tu email antes de iniciar sesión. Revisa tu bandeja de entrada."), "confirmar");
    assert.equal(puertaDeError("Demasiados intentos. Espera un minuto."), "espera");
    assert.equal(puertaDeError(ERROR_CONEXION), "averia");
    assert.equal(puertaDeError(ERROR_GENERICO), "averia");
    for (const contexto of ["repetido", "confirmar", "espera", "averia"]) {
        assert.ok(frasePuerta(contexto));
    }
});

test("las fotos no dan por jugado un partido que aún no se ha jugado", () => {
    for (let i = 0; i < 40; i++) assert.doesNotMatch(fraseVacio("fotos", `p${i}`), /pasó|hizo/);
});
