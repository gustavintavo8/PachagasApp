import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GraficoRP } from "../src/components/PlayerCharts.tsx";

const punto = (i, rp) => ({ matchId: `m${i}`, rp, delta: 10, fecha: "2026-10-01T18:00:00.000Z", resultado: "V" });

test("«1000, salida» baja bajo la línea si la curva sube nada más salir y vuelve al final", () => {
    // Sube, se mantiene arriba y acaba cerca de 1000: arriba a los dos lados pasa la línea o el pico
    const rps = [1040, 1080, 1090, 1085, 1060, 1030, 1008];
    const html = renderToStaticMarkup(
        createElement(GraficoRP, { inicio: 1000, puntos: rps.map((rp, i) => punto(i, rp)), resumen: "RP" })
    );
    const etiqueta = /<span[^>]*style="([^"]*)"[^>]*>1000, salida/.exec(html);
    assert.ok(etiqueta, html);
    assert.match(etiqueta[1], /translateY\(5px\)/);
});
