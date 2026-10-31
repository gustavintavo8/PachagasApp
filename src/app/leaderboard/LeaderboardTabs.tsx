"use client";

import { useState } from "react";
import { Fila, Filas } from "@/components/Filas";
import { PanenkaDice } from "@/components/PanenkaDice";
import { PROVISIONAL_THRESHOLD } from "@/lib/elo";
import { elegirPlural, fraseVacio } from "@/lib/titulares";
import { cn } from "@/lib/utils";
import {
    ETIQUETAS,
    TITULARES,
    clasificados,
    ordenar,
    provisionales,
    type FilaRanking,
    type Orden,
} from "./tabla";

type Columna = { corta: string; larga: string; valor: (fila: FilaRanking) => number };

const PJ: Columna = { corta: "PJ", larga: "partidos", valor: (f) => f.matches_played };
const G: Columna = { corta: "G", larga: "goles", valor: (f) => f.goals_scored };
const MVP: Columna = { corta: "MVP", larga: "MVPs", valor: (f) => f.mvps };
const RP: Columna = { corta: "RP", larga: "RP", valor: (f) => f.elo_rating };
const V: Columna = { corta: "V", larga: "victorias", valor: (f) => f.wins };
const E: Columna = { corta: "E", larga: "empates", valor: (f) => f.draws };
const D: Columna = { corta: "D", larga: "derrotas", valor: (f) => f.losses };

// La última columna es siempre la que ordena
const COLUMNAS: Record<Orden, [Columna, Columna, Columna, Columna]> = {
    rp: [PJ, G, MVP, RP],
    goles: [PJ, MVP, RP, G],
    mvps: [PJ, G, RP, MVP],
    partidos: [V, E, D, PJ],
    victorias: [E, D, PJ, V],
};

const ORDENES = Object.keys(ETIQUETAS) as Orden[];

// Misma rejilla en la cabecera y en las filas. Una por pestaña: cambian las columnas y lo
// que pide cada una (MVP necesita 36px para su etiqueta, RP como secundaria 44px).
const REJILLA = "grid items-baseline text-right";
const ANCHOS: Record<Orden, string> = {
    rp: "grid-cols-[28px_30px_38px_52px]",
    goles: "grid-cols-[28px_38px_46px_40px]",
    mvps: "grid-cols-[28px_30px_46px_42px]",
    partidos: "grid-cols-[30px_30px_30px_44px]",
    victorias: "grid-cols-[30px_30px_34px_44px]",
};

function Cabecera({ titulo, orden, estrecha = false }: { titulo: string; orden: Orden; estrecha?: boolean }) {
    return (
        <div className="flex items-end justify-between gap-3 px-4 pb-1">
            <h2 className="t-seccion whitespace-nowrap">{titulo}</h2>
            <div
                aria-hidden="true"
                className={cn(
                    REJILLA,
                    ANCHOS[orden],
                    "text-[13px] leading-none text-muted",
                    // El título largo no cabe con las etiquetas en 320
                    estrecha && "max-[359px]:hidden"
                )}
            >
                {COLUMNAS[orden].map((columna, i) => (
                    <span key={columna.corta} className={cn(i === 3 && "text-foreground")}>
                        {columna.corta}
                    </span>
                ))}
            </div>
        </div>
    );
}

function FilaTabla({
    fila,
    puesto,
    orden,
    yo,
    detalle,
}: {
    fila: FilaRanking;
    puesto: number | null;
    orden: Orden;
    yo: string;
    detalle?: string;
}) {
    const tu = fila.id === yo;
    const nombre = fila.username || "Desconocido";

    return (
        <Fila
            href={`/players/${fila.id}`}
            tu={tu}
            className="min-h-11 py-1"
            aria-current={tu ? "true" : undefined}
            inicio={
                <span
                    className={cn("w-5 text-right text-[15px] font-medium tabular-nums", !tu && "text-muted")}
                >
                    {puesto ?? <span aria-hidden="true">–</span>}
                </span>
            }
            nombre={tu ? `${nombre}, tú` : nombre}
            detalle={detalle}
            cifra={
                <span className={cn(REJILLA, ANCHOS[orden])}>
                    {COLUMNAS[orden].map((columna, i) => (
                        <span
                            key={columna.corta}
                            className={cn(
                                i === 3
                                    ? "t-cifra text-[24px]"
                                    : cn("font-sans text-[15px] font-medium", !tu && "text-muted")
                            )}
                        >
                            <span className="sr-only">{columna.larga} </span>
                            {columna.valor(fila)}
                        </span>
                    ))}
                </span>
            }
        />
    );
}

export function LeaderboardTabs({
    filas,
    yo,
    vacio,
}: {
    filas: FilaRanking[];
    yo: string;
    vacio: string;
}) {
    const [orden, setOrden] = useState<Orden>("rp");

    const tabla = orden === "rp" ? clasificados(filas) : ordenar(filas, orden);
    const titulares = tabla.slice(0, TITULARES);
    const banquillo = tabla.slice(TITULARES);
    const sinPuesto = orden === "rp" ? provisionales(filas) : [];

    return (
        <div data-testid="leaderboard" className="mt-1">
            <div
                role="group"
                aria-label="Ordenar la tabla"
                className="sticky top-0 z-10 flex justify-between border-b border-border bg-background px-4 pt-[env(safe-area-inset-top)]"
            >
                {ORDENES.map((clave) => {
                    const activo = clave === orden;
                    return (
                        <button
                            key={clave}
                            type="button"
                            aria-pressed={activo}
                            onClick={() => setOrden(clave)}
                            className={cn(
                                "min-h-11 min-w-11 font-display text-[length:min(22px,5.6vw)] leading-none",
                                activo
                                    ? "font-extrabold text-foreground underline decoration-2 underline-offset-[6px]"
                                    : "font-semibold text-muted active:text-foreground"
                            )}
                        >
                            {ETIQUETAS[clave]}
                        </button>
                    );
                })}
            </div>

            {tabla.length === 0 && sinPuesto.length === 0 && (
                <PanenkaDice className="px-4 py-8">{fraseVacio("ranking", vacio)}</PanenkaDice>
            )}

            {titulares.length > 0 && (
                <section className="pt-2">
                    <Cabecera titulo="Titulares" orden={orden} />
                    <Filas aria-label="Titulares">
                        {titulares.map((fila, i) => (
                            <FilaTabla key={fila.id} fila={fila} puesto={i + 1} orden={orden} yo={yo} />
                        ))}
                    </Filas>
                </section>
            )}

            {banquillo.length > 0 && (
                <section className="pt-8">
                    <Cabecera titulo="Banquillo" orden={orden} />
                    <Filas aria-label="Banquillo">
                        {banquillo.map((fila, i) => (
                            <FilaTabla
                                key={fila.id}
                                fila={fila}
                                puesto={i + 1 + TITULARES}
                                orden={orden}
                                yo={yo}
                            />
                        ))}
                    </Filas>
                </section>
            )}

            {sinPuesto.length > 0 && (
                <section className="pt-8">
                    <Cabecera titulo="Aún no cuentan" orden={orden} estrecha />
                    <Filas aria-label="Aún no cuentan">
                        {sinPuesto.map((fila) => {
                            const faltan = PROVISIONAL_THRESHOLD - fila.matches_played;
                            return (
                                <FilaTabla
                                    key={fila.id}
                                    fila={fila}
                                    puesto={null}
                                    orden={orden}
                                    yo={yo}
                                    detalle={`${elegirPlural(faltan, "Falta", "Faltan")} ${faltan}`}
                                />
                            );
                        })}
                    </Filas>
                </section>
            )}

            <Filas className="mt-8 border-t-0">
                <Fila href="/players" nombre="Todos los jugadores" cifra={filas.length} />
            </Filas>
        </div>
    );
}
