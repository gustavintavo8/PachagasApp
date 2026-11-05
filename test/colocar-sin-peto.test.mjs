import assert from "node:assert/strict";
import test from "node:test";
import { colocarSinPeto } from "../src/lib/team-balancer.ts";

const elo = (tabla) => (id) => tabla[id] ?? 1000;
const plaza = (user_id, team) => ({ user_id, team });

test("sin equipos hechos no coloca a nadie", () => {
    assert.deepEqual(colocarSinPeto([plaza("a", null), plaza("b", null)], elo({})), []);
});

test("con 7 contra 6, el que llega entra en el de 6", () => {
    const plazas = [
        ...Array.from({ length: 7 }, (_, i) => plaza(`r${i}`, "A")),
        ...Array.from({ length: 6 }, (_, i) => plaza(`z${i}`, "B")),
        plaza("nuevo", null),
    ];
    assert.deepEqual(colocarSinPeto(plazas, elo({})), [{ user_id: "nuevo", team: "B" }]);
});

test("si van iguales, entra en el de media de ELO más baja", () => {
    const plazas = [plaza("r1", "A"), plaza("z1", "B"), plaza("nuevo", null)];
    assert.deepEqual(colocarSinPeto(plazas, elo({ r1: 1200, z1: 900 })), [{ user_id: "nuevo", team: "B" }]);
    assert.deepEqual(colocarSinPeto(plazas, elo({ r1: 900, z1: 1200 })), [{ user_id: "nuevo", team: "A" }]);
});

test("varios sin peto se reparten hasta igualar", () => {
    const plazas = [
        plaza("r1", "A"), plaza("r2", "A"), plaza("r3", "A"),
        plaza("z1", "B"),
        plaza("n1", null), plaza("n2", null), plaza("n3", null),
    ];
    const colocados = colocarSinPeto(plazas, elo({}));
    assert.equal(colocados.length, 3);
    assert.equal(colocados.filter((c) => c.team === "B").length, 2);
    assert.equal(colocados.filter((c) => c.team === "A").length, 1);
});

test("con equipos hechos y nadie sin peto no cambia nada", () => {
    assert.deepEqual(colocarSinPeto([plaza("r1", "A"), plaza("z1", "B")], elo({})), []);
});
