"use client";

import { Ban, CalendarClock, Shuffle, Trophy, Wallet } from "lucide-react";
import { Fila, Filas } from "@/components/Filas";
import { Hoja } from "@/components/Hoja";
import { fechaCorta } from "@/lib/titulares";
import type { Match } from "@/lib/types";
import type { HojaPartido, Permisos } from "./datos";

const ICONO = { size: 18, strokeWidth: 1.75, "aria-hidden": true } as const;

export function HojaOrganizar({
    open,
    onClose,
    match,
    puede,
    hayEquipos,
    total,
    pagos,
    pasado,
    generando,
    onGenerar,
    onAbrir,
}: {
    open: boolean;
    onClose: () => void;
    match: Match;
    puede: Permisos;
    hayEquipos: boolean;
    total: number;
    pagos: number;
    pasado: boolean;
    generando: boolean;
    onGenerar: () => void;
    onAbrir: (hoja: HojaPartido) => void;
}) {
    const pocos = total < 2;

    return (
        <Hoja open={open} onClose={onClose} title="Organizar" description={fechaCorta(match.date)}>
            <Filas aria-label="Acciones del organizador">
                {puede.generar && (
                    <Fila
                        inicio={<Shuffle {...ICONO} />}
                        nombre={hayEquipos ? "Barajar equipos" : "Generar equipos"}
                        detalle={
                            pocos
                                ? "Hacen falta dos jugadores"
                                : generando
                                  ? "Repartiendo…"
                                  : hayEquipos
                                    ? "Otro reparto igual de equilibrado"
                                    : `Equilibrados por RP entre ${total}`
                        }
                        onClick={generando || pocos ? undefined : onGenerar}
                    />
                )}
                {puede.resultado && hayEquipos && (
                    <Fila
                        inicio={<Trophy {...ICONO} />}
                        nombre="Poner resultado"
                        detalle="Marcador y goleadores. Termina el partido"
                        onClick={() => onAbrir("resultado")}
                    />
                )}
                {puede.cobros && total > 0 && (
                    <Fila
                        inicio={<Wallet {...ICONO} />}
                        nombre="Cobros"
                        detalle={`${pagos} / ${total} pagados`}
                        onClick={() => onAbrir("cobros")}
                    />
                )}
                {puede.fecha && (
                    <Fila
                        inicio={<CalendarClock {...ICONO} />}
                        nombre="Cambiar fecha"
                        onClick={() => onAbrir("fecha")}
                    />
                )}
                {puede.cancelar && (
                    <Fila
                        inicio={<Ban {...ICONO} className="text-tarjeta" />}
                        nombre={<span className="text-tarjeta">Cancelar partido</span>}
                        detalle={pasado && pocos ? "No se pudo jugar: así queda cerrado" : undefined}
                        onClick={() => onAbrir("cancelar")}
                    />
                )}
            </Filas>
        </Hoja>
    );
}
