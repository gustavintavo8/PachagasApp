"use client";

import { Hoja } from "@/components/Hoja";
import { Peto } from "@/components/Peto";
import { equipoDeTeam } from "@/lib/titulares";
import { nombreDe, type Participante } from "./datos";

function GrupoCobros({
    titulo,
    jugadores,
    ocupados,
    onAlternar,
}: {
    titulo?: string;
    jugadores: Participante[];
    ocupados: string[];
    onAlternar: (id: string) => void;
}) {
    if (jugadores.length === 0) return null;

    return (
        <section className="mt-5">
            {titulo && <h3 className="t-seccion px-4 pb-1 text-2xl">{titulo}</h3>}
            <ul className="border-t border-border">
                {jugadores.map((p) => (
                    <li key={p.user_id} className="border-b border-border">
                        <button
                            type="button"
                            title={p.has_paid ? "Marcar como no pagado" : "Marcar como pagado"}
                            aria-pressed={p.has_paid}
                            disabled={ocupados.includes(`pago-${p.user_id}`)}
                            onClick={() => onAlternar(p.user_id)}
                            className="flex min-h-14 w-full select-none items-center gap-3 px-4 py-2 text-left active:bg-surface"
                        >
                            <Peto
                                estado={p.has_paid ? "lleno" : "debe"}
                                equipo={equipoDeTeam(p.team)}
                                className="block flex-none"
                            />
                            <span className="min-w-0 flex-1 truncate font-medium">{nombreDe(p)}</span>
                            <span className={p.has_paid ? "t-meta text-muted" : "t-meta text-foreground"}>
                                {p.has_paid ? "Pagado" : "Debe"}
                            </span>
                        </button>
                    </li>
                ))}
            </ul>
        </section>
    );
}

export function HojaCobros({
    open,
    onClose,
    jugadores,
    pagos,
    ocupados,
    onAlternar,
}: {
    open: boolean;
    onClose: () => void;
    jugadores: Participante[];
    pagos: number;
    ocupados: string[];
    onAlternar: (id: string) => void;
}) {
    const hayEquipos = jugadores.some((p) => p.team !== null);
    const grupo = { ocupados, onAlternar };

    return (
        <Hoja open={open} onClose={onClose} title="Cobros" description="Toca a quien haya pagado">
            <p className="t-cifra px-4 text-[40px]">
                {pagos} / {jugadores.length} pagados
            </p>
            {hayEquipos ? (
                <>
                    <GrupoCobros {...grupo} titulo="Rojo" jugadores={jugadores.filter((p) => p.team === "A")} />
                    <GrupoCobros {...grupo} titulo="Azul" jugadores={jugadores.filter((p) => p.team === "B")} />
                    <GrupoCobros {...grupo} titulo="Sin equipo" jugadores={jugadores.filter((p) => p.team === null)} />
                </>
            ) : (
                <GrupoCobros {...grupo} jugadores={jugadores} />
            )}
        </Hoja>
    );
}
