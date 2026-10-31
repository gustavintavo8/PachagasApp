"use client";

import { useLayoutEffect, type RefObject } from "react";

// Por debajo de esto son las barras del navegador al plegarse, no un teclado
const ALTURA_MINIMA = 120;

/**
 * Para pantallas con barra de escribir. Mientras el teclado está abierto:
 * - pone data-teclado en <html>, que quita la barra inferior (globals.css);
 * - pone --teclado en la raíz: lo que tapa el teclado sin que dvh se entere.
 *
 * Android con resizes-content encoge la página y dvh, así que --teclado se queda en 0.
 * iOS no encoge nada: ahí el teclado solo se ve en visualViewport.
 */
export function useTeclado(raizRef: RefObject<HTMLElement | null>) {
    useLayoutEffect(() => {
        const raiz = raizRef.current;
        const viewport = window.visualViewport;
        if (!raiz || !viewport) return;

        const html = document.documentElement;
        let alturaLibre = window.innerHeight;
        let ancho = window.innerWidth;

        const medir = () => {
            // La pestaña oculta no mide nada, y menos aún mueve la página
            if (raiz.getClientRects().length === 0) return;

            // Al girar el móvil la altura de antes ya no vale
            if (window.innerWidth !== ancho) {
                ancho = window.innerWidth;
                alturaLibre = window.innerHeight;
            }
            alturaLibre = Math.max(alturaLibre, window.innerHeight);

            const activo = document.activeElement;
            const escribiendo = raiz.contains(activo) && !!activo?.matches("input, textarea");
            const hayZoom = viewport.scale > 1.01;
            const abierto = escribiendo && !hayZoom && alturaLibre - viewport.height > ALTURA_MINIMA;
            const tapa = abierto ? Math.max(0, window.innerHeight - viewport.height) : 0;

            raiz.style.setProperty("--teclado", `${tapa}px`);
            html.toggleAttribute("data-teclado", abierto);
            // iOS desplaza la página para enseñar el input; con el chat ya encogido sobra
            if (tapa > 0 && window.scrollY > 0) window.scrollTo(0, 0);
        };

        medir();
        window.addEventListener("resize", medir);
        viewport.addEventListener("resize", medir);
        raiz.addEventListener("focusin", medir);
        raiz.addEventListener("focusout", medir);
        return () => {
            window.removeEventListener("resize", medir);
            viewport.removeEventListener("resize", medir);
            raiz.removeEventListener("focusin", medir);
            raiz.removeEventListener("focusout", medir);
            html.removeAttribute("data-teclado");
        };
    }, [raizRef]);
}
