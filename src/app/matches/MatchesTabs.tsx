"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const PESTANAS = [
    { id: "proximos", etiqueta: "Próximos" },
    { id: "terminados", etiqueta: "Terminados" },
] as const;

type Pestana = (typeof PESTANAS)[number]["id"];

interface MatchesTabsProps {
    proximos: ReactNode;
    terminados: ReactNode;
    /** Null si la lectura falló: mejor sin número que con un cero falso */
    totalProximos: number | null;
    totalTerminados: number | null;
}

/**
 * Las dos listas llegan pintadas del servidor: aquí solo se decide cuál se ve.
 * La pestaña vive en la URL para que volver de un partido deje donde estabas.
 */
export function MatchesTabs({ proximos, terminados, totalProximos, totalTerminados }: MatchesTabsProps) {
    const searchParams = useSearchParams();
    const activa: Pestana = searchParams.get("tab") === "terminados" ? "terminados" : "proximos";
    const botones = useRef<Partial<Record<Pestana, HTMLButtonElement | null>>>({});

    function elegir(pestana: Pestana) {
        const params = new URLSearchParams(searchParams.toString());
        if (pestana === "terminados") params.set("tab", pestana);
        else params.delete("tab");
        const consulta = params.toString();
        window.history.replaceState(null, "", consulta ? `?${consulta}` : window.location.pathname);
    }

    function alPulsarTecla(evento: KeyboardEvent<HTMLDivElement>) {
        if (evento.key !== "ArrowLeft" && evento.key !== "ArrowRight") return;
        evento.preventDefault();
        const otra: Pestana = activa === "proximos" ? "terminados" : "proximos";
        elegir(otra);
        botones.current[otra]?.focus();
    }

    const totales: Record<Pestana, number | null> = { proximos: totalProximos, terminados: totalTerminados };

    return (
        <>
            <div
                role="tablist"
                aria-label="Partidos"
                onKeyDown={alPulsarTecla}
                className="flex gap-6 border-b border-border px-4"
            >
                {PESTANAS.map(({ id, etiqueta }) => {
                    const seleccionada = id === activa;
                    return (
                        <button
                            key={id}
                            ref={(boton) => {
                                botones.current[id] = boton;
                            }}
                            type="button"
                            role="tab"
                            id={`pestana-${id}`}
                            aria-selected={seleccionada}
                            aria-controls={`panel-${id}`}
                            tabIndex={seleccionada ? 0 : -1}
                            onClick={() => elegir(id)}
                            className={cn(
                                "-mb-px flex min-h-11 items-center gap-1.5 border-b-2 text-[18px]",
                                seleccionada
                                    ? "border-foreground font-bold text-foreground"
                                    : "border-transparent text-muted"
                            )}
                        >
                            {etiqueta}
                            {totales[id] !== null && <span className="tabular-nums">{totales[id]}</span>}
                        </button>
                    );
                })}
            </div>

            <div role="tabpanel" id="panel-proximos" aria-labelledby="pestana-proximos" hidden={activa !== "proximos"}>
                {proximos}
            </div>
            <div
                role="tabpanel"
                id="panel-terminados"
                aria-labelledby="pestana-terminados"
                hidden={activa !== "terminados"}
            >
                {terminados}
            </div>
        </>
    );
}
