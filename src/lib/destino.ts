/** Cookie que guarda el destino mientras se entra con Google: ida y vuelta por fuera de la app. */
export const COOKIE_DESTINO = "pachanga-destino";

const BASE = "http://pachanga.invalid";
const PUERTA = /^\/(login|access|auth)(\/|$)/;

/**
 * El destino llega en la URL: solo vale una ruta de la app, y nunca la propia puerta.
 * «/» tampoco es destino, porque es adonde se va de todos modos.
 */
export function rutaInterna(destino: unknown): string | null {
    if (typeof destino !== "string" || !destino.startsWith("/") || destino.includes("\\")) return null;
    try {
        const url = new URL(destino, BASE);
        if (url.origin !== BASE || url.pathname === "/" || PUERTA.test(url.pathname)) return null;
        return `${url.pathname}${url.search}`;
    } catch {
        return null;
    }
}

/** "/login?next=%2Fmatches%2F1". Sin destino, la ruta tal cual. */
export function conDestino(ruta: string, destino: string | null): string {
    return destino ? `${ruta}?next=${encodeURIComponent(destino)}` : ruta;
}
