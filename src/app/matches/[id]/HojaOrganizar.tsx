"use client";

import { Ban, CalendarClock, Copy, Shuffle, Trophy, Wallet } from "lucide-react";
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
    generando: boolean;
    onGenerar: () => void;
    onAbrir: (hoja: HojaPartido) => void;
}) {
    const copiaNueva = `/matches/new?location=${encodeURIComponent(match.location)}&max_players=${match.max_players}`;

    return (
        <Hoja open={open} onClose={onClose} title="Organizar" description={fechaCorta(match.date)}>
            <Filas aria-label="Acciones del organizador">
                {puede.generar && (
                    <Fila
                        inicio={<Shuffle {...ICONO} />}
                        nombre={hayEquipos ? "Barajar equipos" : "Generar equipos"}
                        detalle={
                            generando
                                ? "Repartiendo…"
                                : hayEquipos
                                  ? "Rehace los dos equipos"
                                  : `Equilibrados por RP entre ${total}`
                        }
                        onClick={generando ? undefined : onGenerar}
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
                {puede.repetir && (
                    <Fila
                        inicio={<Copy {...ICONO} />}
                        nombre="Repetir partido"
                        detalle="Mismo sitio y mismas plazas"
                        href={copiaNueva}
                    />
                )}
                {puede.cancelar && (
                    <Fila
                        inicio={<Ban {...ICONO} className="text-tarjeta" />}
                        nombre={<span className="text-tarjeta">Cancelar partido</span>}
                        onClick={() => onAbrir("cancelar")}
                    />
                )}
            </Filas>
        </Hoja>
    );
}
