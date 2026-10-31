"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Hoja } from "@/components/Hoja";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { setScore } from "../actions";
import type { Match } from "@/lib/types";
import { AvatarJugador } from "./jugadores";
import { nombreDe, type Participante } from "./datos";

const BOTON_CUENTA =
    "pulsable flex h-11 w-11 flex-none select-none items-center justify-center active:bg-foreground active:text-background";

function Tanteo({
    equipo,
    valor,
    onCambio,
}: {
    equipo: "Rojo" | "Azul";
    valor: number | "";
    onCambio: (valor: number | "") => void;
}) {
    const numero = valor === "" ? 0 : valor;
    return (
        <div className={cn("px-2 py-3 text-white", equipo === "Rojo" ? "bg-rojo" : "bg-azul")}>
            <label className="block">
                <span className="t-seccion block px-2 text-2xl">{equipo}</span>
                <input
                    type="number"
                    inputMode="numeric"
                    enterKeyHint="done"
                    min="0"
                    value={valor}
                    aria-label={`Goles del ${equipo}`}
                    onChange={(e) => {
                        const texto = e.target.value;
                        onCambio(texto === "" ? "" : Math.max(0, parseInt(texto, 10) || 0));
                    }}
                    onFocus={(e) => e.target.select()}
                    className="w-full appearance-none bg-transparent text-center font-display text-[96px] font-black leading-none tabular-nums text-white outline-none [-moz-appearance:textfield] focus-visible:bg-black/20 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
            </label>
            <div className="flex justify-between">
                <button
                    type="button"
                    aria-label={`Quitar un gol al ${equipo}`}
                    onClick={() => onCambio(Math.max(0, numero - 1))}
                    className={BOTON_CUENTA}
                >
                    <Minus size={18} strokeWidth={1.75} aria-hidden="true" />
                </button>
                <button
                    type="button"
                    aria-label={`Sumar un gol al ${equipo}`}
                    onClick={() => onCambio(numero + 1)}
                    className={BOTON_CUENTA}
                >
                    <Plus size={18} strokeWidth={1.75} aria-hidden="true" />
                </button>
            </div>
        </div>
    );
}

function GrupoGoleadores({
    equipo,
    jugadores,
    goles,
    objetivo,
    onCambio,
}: {
    equipo: string;
    jugadores: Participante[];
    goles: Record<string, number>;
    objetivo: number;
    onCambio: (id: string, goles: number) => void;
}) {
    const asignados = jugadores.reduce((suma, p) => suma + (goles[p.user_id] ?? 0), 0);
    return (
        <div>
            <p className="flex items-baseline justify-between gap-3 px-4 pb-1">
                <span className="t-seccion text-2xl">{equipo}</span>
                {asignados !== objetivo && (
                    <span className="t-meta tabular-nums text-tarjeta">
                        {asignados}/{objetivo} asignados
                    </span>
                )}
            </p>
            <ul className="border-t border-border">
                {jugadores.map((p) => {
                    const nombre = nombreDe(p);
                    const cuenta = goles[p.user_id] ?? 0;
                    return (
                        <li key={p.user_id} className="flex min-h-14 items-center gap-3 border-b border-border px-4">
                            <AvatarJugador jugador={p} />
                            <span className="min-w-0 flex-1 truncate font-medium">{nombre}</span>
                            <button
                                type="button"
                                aria-label={`Quitar un gol a ${nombre}`}
                                onClick={() => onCambio(p.user_id, cuenta - 1)}
                                className={BOTON_CUENTA}
                            >
                                <Minus size={18} strokeWidth={1.75} aria-hidden="true" />
                            </button>
                            <span aria-live="polite" className="t-cifra w-7 text-center text-[26px]">
                                {cuenta}
                            </span>
                            <button
                                type="button"
                                aria-label={`Sumar un gol a ${nombre}`}
                                onClick={() => onCambio(p.user_id, cuenta + 1)}
                                className={BOTON_CUENTA}
                            >
                                <Plus size={18} strokeWidth={1.75} aria-hidden="true" />
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

export function HojaResultado({
    open,
    onClose,
    match,
    jugadores,
}: {
    open: boolean;
    onClose: () => void;
    match: Match;
    jugadores: Participante[];
}): ReactNode {
    const { toast } = useToast();
    const [rojo, setRojo] = useState<number | "">(match.team_a_score ?? 0);
    const [azul, setAzul] = useState<number | "">(match.team_b_score ?? 0);
    // Aquí y no dentro de la hoja: cerrarla no borra lo que ya has apuntado
    const [goles, setGoles] = useState<Record<string, number>>({});
    const [verGoleadores, setVerGoleadores] = useState(false);
    const [guardando, setGuardando] = useState(false);

    const delRojo = jugadores.filter((p) => p.team === "A");
    const delAzul = jugadores.filter((p) => p.team === "B");
    const golesRojo = rojo === "" ? 0 : rojo;
    const golesAzul = azul === "" ? 0 : azul;

    async function guardar() {
        setGuardando(true);
        const goleadores = Object.entries(goles)
            .filter(([, g]) => g > 0)
            .map(([userId, g]) => ({ userId, goals: g }));
        try {
            const resultado = await setScore(
                match.id,
                golesRojo,
                golesAzul,
                goleadores.length > 0 ? goleadores : undefined
            );
            if (!resultado.success) {
                // La hoja se queda abierta: el dato sigue ahí para corregirlo
                toast(resultado.error, "error");
                return;
            }
            toast("¡Partido finalizado! Resultado guardado.", "success");
            onClose();
            // El partido pasa a ser su marcador: se ve desde arriba
            window.scrollTo(0, 0);
        } catch {
            toast("No se ha guardado. Revisa la conexión e inténtalo otra vez.", "error");
        } finally {
            setGuardando(false);
        }
    }

    return (
        <Hoja open={open} onClose={onClose} title="Poner resultado">
            <div className="grid grid-cols-2 gap-1 bg-white">
                <Tanteo equipo="Rojo" valor={rojo} onCambio={setRojo} />
                <Tanteo equipo="Azul" valor={azul} onCambio={setAzul} />
            </div>

            {golesRojo + golesAzul > 0 && (
                <div>
                    <button
                        type="button"
                        aria-expanded={verGoleadores}
                        onClick={() => setVerGoleadores(!verGoleadores)}
                        className="flex min-h-14 w-full select-none items-center justify-between gap-3 border-b border-border px-4 text-left font-medium active:bg-surface"
                    >
                        Asignar goleadores (opcional)
                        <ChevronDown
                            size={18}
                            strokeWidth={1.75}
                            aria-hidden="true"
                            className={cn("flex-none transition-transform duration-200 ease-out", verGoleadores && "rotate-180")}
                        />
                    </button>
                    {verGoleadores && (
                        <div className="space-y-5 pt-4">
                            {delRojo.length > 0 && (
                                <GrupoGoleadores
                                    equipo="Rojo"
                                    jugadores={delRojo}
                                    goles={goles}
                                    objetivo={golesRojo}
                                    onCambio={(id, g) => setGoles((previos) => ({ ...previos, [id]: Math.max(0, g) }))}
                                />
                            )}
                            {delAzul.length > 0 && (
                                <GrupoGoleadores
                                    equipo="Azul"
                                    jugadores={delAzul}
                                    goles={goles}
                                    objetivo={golesAzul}
                                    onCambio={(id, g) => setGoles((previos) => ({ ...previos, [id]: Math.max(0, g) }))}
                                />
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Siempre al alcance. Baja sobre el relleno de la hoja para que no asomen filas por debajo. */}
            <div className="sticky bottom-[calc(-16px-env(safe-area-inset-bottom,0px))] -mb-[calc(16px+env(safe-area-inset-bottom,0px))] bg-background px-4 pb-[calc(16px+env(safe-area-inset-bottom,0px))] pt-3">
                <Button type="button" size="lg" className="w-full" loading={guardando} onClick={guardar}>
                    Guardar resultado y finalizar
                </Button>
            </div>
        </Hoja>
    );
}
