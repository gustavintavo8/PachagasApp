"use client";

import { useLayoutEffect } from "react";

const COLORES = { rojo: "#d8141e", azul: "#0a55d8" } as const;

function metaTema() {
    return document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
}

// Sin DOM propio: tiñe <html> y la barra del sistema mientras esté montado.
// Layout effect para que al navegar no se pinte un fotograma en negro.
export function Flood({ color }: { color: "rojo" | "azul" }) {
    useLayoutEffect(() => {
        const html = document.documentElement;
        const floodAntes = html.getAttribute("data-flood");
        const temaAntes = metaTema()?.getAttribute("content") ?? null;

        html.setAttribute("data-flood", color);
        metaTema()?.setAttribute("content", COLORES[color]);

        // Tras una Server Action, Next vuelve a pintar el viewport y deja el theme-color en negro
        const vigia = new MutationObserver(() => {
            const meta = metaTema();
            if (meta && meta.getAttribute("content") !== COLORES[color]) {
                meta.setAttribute("content", COLORES[color]);
            }
        });
        vigia.observe(document.head, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["content"],
        });

        return () => {
            vigia.disconnect();
            if (floodAntes === null) html.removeAttribute("data-flood");
            else html.setAttribute("data-flood", floodAntes);
            if (temaAntes !== null) metaTema()?.setAttribute("content", temaAntes);
        };
    }, [color]);

    return null;
}
