import type { CSSProperties } from "react";
import Link from "next/link";
import { Peto, PetoFila } from "@/components/Peto";
import { diaPartido, estadoPartido, lineaPartido, textoPlazas, tuPlaza } from "@/lib/titulares";
import type { Match, MatchParticipant } from "@/lib/types";

export type PartidoProximo = Pick<Match, "id" | "date" | "location" | "max_players" | "status"> & {
    match_participants: Pick<MatchParticipant, "user_id" | "team">[];
};

interface ProximoProps {
    partido: PartidoProximo;
    yo: string;
    ahora: Date;
}

function datosDe({ partido, yo, ahora }: ProximoProps) {
    const ocupadas = partido.match_participants.length;
    return {
        ocupadas,
        plaza: tuPlaza({ partido: { ...partido, participants: partido.match_participants }, yo, ahora }),
        plazas: textoPlazas({ ocupadas, plazas: partido.max_players, status: partido.status }),
    };
}

/** El más cercano es la respuesta de la pantalla: la fecha a tamaño de «Juegas.», en una línea. */
export function HeroProximo(props: ProximoProps) {
    const { partido, ahora } = props;
    const { ocupadas, plaza, plazas } = datosDe(props);
    const dia = diaPartido(partido.date, ahora);

    return (
        <Link
            href={`/matches/${partido.id}`}
            className="block select-none px-4 pb-6 pt-5 active:bg-surface"
        >
            <p
                className="t-respuesta whitespace-nowrap"
                // La única que mide más que sus letras: M y ñ son anchas y no lleva ninguna i ni espacio
                style={{ "--chars": dia === "Mañana" ? 6.8 : dia.length } as CSSProperties}
            >
                {dia}
            </p>
            <p className="mt-3 truncate text-lg font-medium leading-snug">
                {lineaPartido(partido.date, partido.location, ahora)}
            </p>

            <div className="mt-5 flex items-end justify-between gap-3">
                <p className="t-titular min-w-0 whitespace-nowrap text-[length:min(80px,20vw)]">{plazas}</p>
                <div className="flex-none pb-1 text-right">
                    <p className="flex items-center justify-end gap-2 font-display text-[26px] font-extrabold leading-none">
                        {plaza.dentro && <Peto estado="lleno" equipo={plaza.equipo} tu size={16} />}
                        {plaza.texto}
                    </p>
                    <p className="t-meta mt-1 text-muted">{estadoPartido(partido.status)}</p>
                </div>
            </div>

            <PetoFila className="mt-3" ocupadas={ocupadas} plazas={partido.max_players} />
        </Link>
    );
}

/** Los siguientes ceden: fecha, cuántos faltan y tu sitio, a una fila. */
export function FilaProximo(props: ProximoProps) {
    const { partido, ahora } = props;
    const { ocupadas, plaza, plazas } = datosDe(props);
    // Tamaño fijo de peto: con pocas plazas, la fila no se estira
    const columnas = partido.max_players > 14 ? Math.ceil(partido.max_players / 2) : partido.max_players;

    return (
        <li className="border-b border-border">
            <Link
                href={`/matches/${partido.id}`}
                className="flex select-none items-start gap-3 px-4 py-3 active:bg-surface"
            >
                <span className="min-w-0 flex-1">
                    <span className="t-seccion block truncate">{diaPartido(partido.date, ahora)}</span>
                    <span className="t-meta block truncate text-muted">
                        {lineaPartido(partido.date, partido.location, ahora)}
                    </span>
                    <span className="mt-2 block" style={{ maxWidth: columnas * 14 }}>
                        <PetoFila ocupadas={ocupadas} plazas={partido.max_players} />
                    </span>
                </span>
                <span className="flex-none text-right">
                    <span className="t-cifra block text-[30px] leading-[1.05]">{plazas}</span>
                    <span className="t-meta flex items-center justify-end gap-1.5">
                        {plaza.dentro && <Peto estado="lleno" equipo={plaza.equipo} tu size={12} />}
                        {plaza.texto}
                    </span>
                    {partido.status === "closed" && (
                        <span className="t-meta block text-muted">{estadoPartido(partido.status)}</span>
                    )}
                </span>
            </Link>
        </li>
    );
}
