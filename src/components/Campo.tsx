import type { ReactNode } from "react";
import { Peto, type EstadoPeto } from "@/components/Peto";
import { cn } from "@/lib/utils";
import type { Equipo } from "@/lib/titulares";
import type { Profile } from "@/lib/types";

/** Una plaza ocupada del campo. El id es el del jugador. */
export type JugadorCampo = {
    id: string;
    nombre: string;
    posicion: Profile["position"];
    estado: Exclude<EstadoPeto, "libre">;
    tu?: boolean;
    mvp?: boolean;
};

type Plaza = JugadorCampo | null;

const POR_FILA = 5;

/** Línea de cal: grosor y color salen de la spec. */
const CAL = "border-cal [border-width:1.5px]";

// El nombre entero solo si cabe bajo el peto. «Rubén M.» se queda, «Cristian Moreira Suárez» no.
export function nombreEnCampo(nombre: string): string {
    return nombre.length <= 9 ? nombre : nombre.trim().split(/\s+/)[0];
}

function trocear<T>(lista: T[], tamano: number): T[][] {
    const filas: T[][] = [];
    for (let i = 0; i < lista.length; i += tamano) filas.push(lista.slice(i, i + tamano));
    return filas;
}

function porPosicion(jugadores: JugadorCampo[], posicion: Profile["position"]) {
    return jugadores.filter((j) => (j.posicion ?? "MID") === posicion);
}

/** Filas de una mitad, de la portería al centro. Lo desconocido juega en el medio. */
function filasDeEquipo(jugadores: JugadorCampo[]): JugadorCampo[][] {
    return (["GK", "DEF", "MID", "FWD"] as const).flatMap((posicion) =>
        trocear(porPosicion(jugadores, posicion), POR_FILA)
    );
}

// Tamaños de las filas de campo, sin contar las porterías. Número impar de filas
// para que la central caiga sobre la línea de medio campo.
function tamanosFilas(enCampo: number): number[] {
    const minimas = Math.max(3, Math.ceil(enCampo / POR_FILA));
    const filas = minimas % 2 === 0 ? minimas + 1 : minimas;
    const base = Math.floor(enCampo / filas);
    const tamanos = Array.from({ length: filas }, () => base);
    const centro = Math.floor(filas / 2);

    // Lo que sobra va del centro hacia fuera
    for (let i = 0; i < enCampo - base * filas; i++) {
        const salto = Math.ceil(i / 2) * (i % 2 === 0 ? -1 : 1);
        tamanos[centro + salto] += 1;
    }
    // La fila central un poco más larga que la de arriba: si no, parece una parrilla
    if (tamanos[centro] < POR_FILA && tamanos[0] > 2) {
        tamanos[centro] += 1;
        tamanos[0] -= 1;
    }
    return tamanos.filter((n) => n > 0);
}

/**
 * Sin equipos: todas las plazas sobre el campo entero. Los porteros van a la portería, el
 * resto por posición, y los huecos salen donde faltan: si no hay portero, en la portería.
 */
function filasDePlantilla(jugadores: JugadorCampo[], plazas: number, conLibres: boolean): Plaza[][] {
    const total = conLibres ? Math.max(plazas, jugadores.length) : jugadores.length;
    if (total === 0) return [];

    const porteros = jugadores.filter((j) => j.posicion === "GK");
    const cola: Plaza[] = [
        ...porteros.slice(2),
        ...porPosicion(jugadores, "DEF"),
        ...porPosicion(jugadores, "MID"),
        ...porPosicion(jugadores, "FWD"),
    ];

    const enCampo = Math.max(total - 2, 0);
    const delCampo = cola.slice(0, enCampo);
    while (delCampo.length < enCampo) delCampo.push(null);
    // Si el campo se llena, el que sobra se pone de portero
    const [puertaArriba = null, puertaAbajo = null] = [...porteros.slice(0, 2), ...cola.slice(enCampo)];

    const filas: Plaza[][] = [[puertaArriba]];
    let desde = 0;
    for (const n of tamanosFilas(enCampo)) {
        filas.push(delCampo.slice(desde, desde + n));
        desde += n;
    }
    if (total > 1) filas.push([puertaAbajo]);
    return filas;
}

/** Las líneas, sin nadie encima. También las usa la pantalla de carga. */
export function LineasCampo({ aSangre = false }: { aSangre?: boolean }) {
    return (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className={cn("absolute inset-0", CAL, aSangre && "border-x-0")} />
            <div className={cn("absolute inset-x-0 top-1/2 border-x-0 border-b-0", CAL)} />
            <div
                className={cn(
                    "absolute left-1/2 top-1/2 h-[84px] w-[84px] -translate-x-1/2 -translate-y-1/2 rounded-full",
                    CAL
                )}
            />
            <div className={cn("absolute inset-x-1/4 top-0 h-[68px] border-t-0", CAL)} />
            <div className={cn("absolute inset-x-1/4 bottom-0 h-[68px] border-b-0", CAL)} />
        </div>
    );
}

function Marca({
    plaza,
    equipo,
    onPulsar,
}: {
    plaza: Plaza;
    equipo: Equipo | null;
    onPulsar?: (id: string) => void;
}) {
    const celda = "flex min-h-[58px] min-w-0 max-w-[72px] flex-1 flex-col items-center gap-0.5";

    if (!plaza) {
        return (
            <div className={celda}>
                <span className="block bg-background p-0.5">
                    <Peto estado="libre" className="block" />
                </span>
                <span className="bg-background px-[3px] text-[13px] font-medium leading-[1.25] text-muted">Libre</span>
            </div>
        );
    }

    const contenido = (
        <>
            <span className="block bg-background p-0.5">
                <Peto estado={plaza.estado} equipo={equipo} tu={plaza.tu} className="block" />
            </span>
            <span
                className={cn(
                    // Puede salirse un poco de su celda: a 320px cinco en fila no dan para «Rubén M.»
                    "max-w-[calc(100%+6px)] truncate bg-background px-[2px] text-[13px] leading-[1.25]",
                    plaza.tu ? "font-bold" : "font-medium"
                )}
            >
                {nombreEnCampo(plaza.nombre)}
            </span>
            {plaza.mvp && <span className="bg-background px-[3px] text-xs font-bold leading-[1.25]">MVP</span>}
        </>
    );

    if (!onPulsar) return <div className={celda}>{contenido}</div>;

    return (
        <button
            type="button"
            onClick={() => onPulsar(plaza.id)}
            aria-label={`Ver ficha de ${plaza.nombre}`}
            className={cn(celda, "pulsable select-none")}
        >
            {contenido}
        </button>
    );
}

function Linea({
    plazas,
    equipo = null,
    onPulsar,
}: {
    plazas: Plaza[];
    equipo?: Equipo | null;
    onPulsar?: (id: string) => void;
}) {
    return (
        <div className="relative flex justify-evenly">
            {plazas.map((plaza, i) => (
                // Por sitio y no por jugador: el peto libre se llena en su lugar
                <Marca key={i} plaza={plaza} equipo={equipo} onPulsar={onPulsar} />
            ))}
        </div>
    );
}

function Banda({ equipo, children }: { equipo: Equipo; children: ReactNode }) {
    return (
        <div
            className={cn(
                "flex min-h-11 items-center justify-between gap-4 px-4 py-2 text-white",
                equipo === "rojo" ? "bg-rojo" : "bg-azul"
            )}
        >
            <span className="t-seccion text-[26px]">{equipo === "rojo" ? "Rojo" : "Azul"}</span>
            <span className="t-meta text-right tabular-nums">{children}</span>
        </div>
    );
}

/** Con equipos: el Rojo arriba y el Azul abajo, cada uno en su mitad y entre sus dos bandas. */
export function CampoEquipos({
    rojo,
    azul,
    bandaRojo,
    bandaAzul,
    onPulsar,
}: {
    rojo: JugadorCampo[];
    azul: JugadorCampo[];
    bandaRojo: ReactNode;
    bandaAzul: ReactNode;
    onPulsar?: (id: string) => void;
}) {
    const filasRojo = filasDeEquipo(rojo);
    const filasAzul = filasDeEquipo(azul).reverse();

    return (
        <div role="group" aria-label="Equipos sobre el campo">
            <Banda equipo="rojo">{bandaRojo}</Banda>
            <div className="relative grid [grid-template-rows:1fr_1fr]">
                <LineasCampo aSangre />
                <div className="relative flex min-h-[176px] flex-col justify-between gap-2 px-2 pb-5 pt-1.5">
                    {filasRojo.map((fila, i) => (
                        <Linea key={i} plazas={fila} equipo="rojo" onPulsar={onPulsar} />
                    ))}
                </div>
                <div className="relative flex min-h-[176px] flex-col justify-between gap-2 px-2 pb-1.5 pt-5">
                    {filasAzul.map((fila, i) => (
                        <Linea key={i} plazas={fila} equipo="azul" onPulsar={onPulsar} />
                    ))}
                </div>
            </div>
            <Banda equipo="azul">{bandaAzul}</Banda>
        </div>
    );
}

/** Sin equipos: una sola plantilla sobre el campo entero, con los huecos a la vista. */
export function CampoPlantilla({
    jugadores,
    plazas,
    conLibres = true,
    onPulsar,
}: {
    jugadores: JugadorCampo[];
    plazas: number;
    /** Un partido cerrado no tiene huecos que ofrecer */
    conLibres?: boolean;
    onPulsar?: (id: string) => void;
}) {
    const filas = filasDePlantilla(jugadores, plazas, conLibres);

    return (
        <div role="group" aria-label="Plazas sobre el campo" className="relative">
            <LineasCampo />
            <div className="relative flex min-h-[374px] flex-col justify-between gap-2 px-1 py-1">
                {filas.map((fila, i) => (
                    <Linea key={i} plazas={fila} onPulsar={onPulsar} />
                ))}
            </div>
        </div>
    );
}
