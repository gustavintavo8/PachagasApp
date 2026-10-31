import Link from "next/link";
import { conSigno, diaYMes } from "@/lib/titulares";
import { cn } from "@/lib/utils";

const SALIDA = 1000;
/** Cada celda es un enlace: no puede bajar de 44px. Con más partidos, la tira se desplaza. */
const ANCHO_CELDA = 46;
const CELDAS_VACIAS = 7;
const ALTO = 150;
const ALTO_VACIO = 64;

type Resultado = "V" | "E" | "D";

export type PuntoRP = {
    matchId: string;
    rp: number;
    delta: number;
    fecha: string;
    /** Del marcador y del equipo, no del signo del delta. Null si el partido no lo permite. */
    resultado: Resultado | null;
};

const NOMBRE_RESULTADO: Record<Resultado, string> = { V: "Victoria", E: "Empate", D: "Derrota" };

// Sin color: V encendida, E gris, D apagada
const ESTILO_CELDA: Record<Resultado, string> = {
    V: "bg-foreground text-background",
    E: "bg-surface-hover text-foreground",
    D: "border border-border text-muted",
};

function posicionEtiqueta(porcentaje: number) {
    if (porcentaje < 18) return "0%";
    if (porcentaje > 82) return "-100%";
    return "-50%";
}

/**
 * RP de la temporada, un punto por partido, centrado sobre su celda de la tira.
 * El SVG se estira con el ancho (por eso el trazo no escala) y las etiquetas son HTML
 * colocadas en porcentaje: se pinta en el servidor y sin medir nada.
 * Sin capa de hover: se usa con el pulgar y cada punto ya tiene su dato impreso debajo.
 */
export function GraficoRP({ inicio, puntos, resumen }: { inicio: number; puntos: PuntoRP[]; resumen: string }) {
    const n = puntos.length;
    const valores = [SALIDA, inicio, ...puntos.map((punto) => punto.rp)];
    const minimo = Math.min(...valores);
    const maximo = Math.max(...valores);
    const rango = Math.max(maximo - minimo, 20);
    // Arriba, sitio para la etiqueta del pico. Abajo, para la de la salida.
    const margenSuperior = rango * 0.3;
    const margenInferior = rango * 0.16;
    const y = (valor: number) =>
        100 - ((valor - minimo + margenInferior) / (rango + margenInferior + margenSuperior)) * 100;
    const x = (i: number) => ((i + 0.5) / n) * 100;

    const linea =
        n === 0
            ? `0,${y(SALIDA)} 100,${y(SALIDA)}`
            : [`0,${y(inicio)}`, ...puntos.map((punto, i) => `${x(i)},${y(punto.rp)}`)].join(" ");

    const pico = n > 0 ? puntos.reduce((mejor, punto, i) => (punto.rp >= puntos[mejor].rp ? i : mejor), 0) : -1;

    // Con la tira desplazable se empieza viendo el final: la referencia va a ese lado
    const aLaDerecha = n > CELDAS_VACIAS;
    const cercanos = aLaDerecha ? puntos.slice(-3) : puntos.slice(0, Math.max(1, Math.ceil(n / 3)));
    const porArriba = cercanos.filter((punto) => punto.rp >= SALIDA).length;
    const etiquetaAbajo = n > 0 && porArriba * 2 >= cercanos.length;

    return (
        <figure>
            {/* flex-row-reverse: sin JS, el scroll arranca en el último partido */}
            <div className="-mx-4 flex flex-row-reverse overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div
                    className="mx-4 flex-none"
                    style={{ width: `max(calc(100% - 32px), ${n * ANCHO_CELDA}px)` }}
                >
                    <div className="relative" style={{ height: n === 0 ? ALTO_VACIO : ALTO }}>
                        <svg
                            viewBox="0 0 100 100"
                            preserveAspectRatio="none"
                            role="img"
                            aria-label={resumen}
                            className="absolute inset-0 h-full w-full overflow-visible"
                        >
                            <line
                                x1="0"
                                x2="100"
                                y1={y(SALIDA)}
                                y2={y(SALIDA)}
                                stroke="currentColor"
                                strokeOpacity="0.4"
                                strokeWidth="1"
                                vectorEffect="non-scaling-stroke"
                            />
                            <polyline
                                points={linea}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinejoin="round"
                                strokeLinecap="round"
                                vectorEffect="non-scaling-stroke"
                            />
                        </svg>

                        <span
                            aria-hidden="true"
                            className="absolute text-xs leading-none font-medium whitespace-nowrap text-muted"
                            style={{
                                top: `${y(SALIDA)}%`,
                                [aLaDerecha ? "right" : "left"]: 0,
                                transform: etiquetaAbajo ? "translateY(5px)" : "translateY(calc(-100% - 5px))",
                            }}
                        >
                            {SALIDA}, salida
                        </span>

                        {n > 0 && (
                            <span
                                aria-hidden="true"
                                className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 bg-foreground"
                                style={{ left: `${x(n - 1)}%`, top: `${y(puntos[n - 1].rp)}%` }}
                            />
                        )}

                        {pico >= 0 && (
                            <>
                                {pico !== n - 1 && (
                                    <span
                                        aria-hidden="true"
                                        className="absolute size-2 -translate-x-1/2 -translate-y-1/2 bg-foreground"
                                        style={{ left: `${x(pico)}%`, top: `${y(puntos[pico].rp)}%` }}
                                    />
                                )}
                                <span
                                    aria-hidden="true"
                                    className="absolute text-[13px] leading-none font-bold whitespace-nowrap tabular-nums"
                                    style={{
                                        left: `${x(pico)}%`,
                                        top: `${y(puntos[pico].rp)}%`,
                                        transform: `translate(${posicionEtiqueta(x(pico))}, calc(-100% - 10px))`,
                                    }}
                                >
                                    Pico, {puntos[pico].rp}
                                </span>
                            </>
                        )}
                    </div>

                    <ol
                        className="mt-2 grid gap-0.5"
                        style={{ gridTemplateColumns: `repeat(${n || CELDAS_VACIAS}, minmax(0, 1fr))` }}
                    >
                        {n === 0 &&
                            Array.from({ length: CELDAS_VACIAS }, (_, i) => (
                                <li key={i} aria-hidden="true" className="h-[76px] border border-border" />
                            ))}
                        {puntos.map((punto) => {
                            const fecha = diaYMes(punto.fecha);
                            const delta = conSigno(punto.delta);
                            const nombre = punto.resultado ? NOMBRE_RESULTADO[punto.resultado] : "Sin resultado";
                            return (
                                <li key={punto.matchId}>
                                    <Link
                                        href={`/matches/${punto.matchId}`}
                                        aria-label={`${nombre}, ${delta} RP, ${fecha}`}
                                        className={cn(
                                            "pulsable flex h-[76px] flex-col items-center justify-center select-none",
                                            punto.resultado ? ESTILO_CELDA[punto.resultado] : "bg-surface text-muted"
                                        )}
                                    >
                                        <span className="t-cifra text-[26px] font-black">
                                            {punto.resultado ?? "–"}
                                        </span>
                                        <span className="mt-0.5 text-[13px] leading-none font-medium tabular-nums">
                                            {delta}
                                        </span>
                                        <span className="mt-1 text-xs leading-none tabular-nums">{fecha}</span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ol>
                </div>
            </div>
            <figcaption className="t-meta mt-2 text-muted">
                {n === 0 ? "Sin partidos todavía" : "Forma, el último a la derecha"}
            </figcaption>
        </figure>
    );
}

export type GolesMes = { clave: string; nombre: string; goles: number };

export function GolesPorMes({ meses }: { meses: GolesMes[] }) {
    const maximo = Math.max(...meses.map((mes) => mes.goles), 1);

    return (
        <ul className="mt-3 space-y-1" aria-label="Goles por mes">
            {meses.map((mes) => (
                <li key={mes.clave} className="grid h-8 grid-cols-[92px_1fr_32px] items-center gap-2">
                    <span className="t-meta text-muted">{mes.nombre}</span>
                    <span aria-hidden="true" className="block h-2">
                        <span
                            className="block h-full bg-foreground"
                            style={{ width: `${(mes.goles / maximo) * 100}%` }}
                        />
                    </span>
                    <span className="t-cifra text-right text-[22px]">{mes.goles}</span>
                </li>
            ))}
        </ul>
    );
}
