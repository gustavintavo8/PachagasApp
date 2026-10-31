import Link from "next/link";
import { Peto, PetoFila } from "@/components/Peto";
import { cn } from "@/lib/utils";
import { diaPartido, estadoPartido, lineaPartido, textoPlazas, tuPlaza } from "@/lib/titulares";
import type { Match, MatchParticipant } from "@/lib/types";

export type PartidoProximo = Pick<Match, "id" | "date" | "location" | "max_players" | "status"> & {
    match_participants: Pick<MatchParticipant, "user_id" | "team">[];
};

/** El más cercano va más grande: es la respuesta de la pantalla. */
export function BloqueProximo({
    partido,
    yo,
    ahora,
    destacado = false,
}: {
    partido: PartidoProximo;
    yo: string;
    ahora: Date;
    destacado?: boolean;
}) {
    const ocupadas = partido.match_participants.length;
    // Tamaño fijo de peto: con pocas plazas, la fila no se estira ni engorda
    const columnas = partido.max_players > 14 ? Math.ceil(partido.max_players / 2) : partido.max_players;
    const plaza = tuPlaza({ partido: { ...partido, participants: partido.match_participants }, yo, ahora });

    return (
        <li className="border-b border-border">
            <Link
                href={`/matches/${partido.id}`}
                className={cn("block select-none px-4 active:bg-surface", destacado ? "pb-5 pt-4" : "py-4")}
            >
                <div className="flex items-start justify-between gap-3">
                    <p className={cn("min-w-0", destacado ? "t-titular" : "t-seccion text-[36px]")}>
                        {diaPartido(partido.date, ahora)}
                    </p>
                    <p className="flex flex-none items-center gap-2 pt-1">
                        <Peto
                            estado={plaza.dentro ? "lleno" : "libre"}
                            equipo={plaza.equipo}
                            tu={plaza.dentro}
                            size={18}
                        />
                        <span className="font-display text-[24px] font-extrabold leading-none">{plaza.texto}</span>
                    </p>
                </div>

                <div className="mt-1 flex items-baseline justify-between gap-3 text-[15px] leading-snug">
                    <span className="min-w-0 truncate font-medium">
                        {lineaPartido(partido.date, partido.location, ahora)}
                    </span>
                    <span className="flex-none text-muted">{estadoPartido(partido.status)}</span>
                </div>

                <div className="mt-3 flex items-end justify-between gap-4">
                    <div className="min-w-0 flex-1" style={{ maxWidth: columnas * 17 }}>
                        <PetoFila ocupadas={ocupadas} plazas={partido.max_players} />
                    </div>
                    <p className="t-cifra flex-none text-[30px]">
                        {textoPlazas({ ocupadas, plazas: partido.max_players, status: partido.status })}
                    </p>
                </div>
            </Link>
        </li>
    );
}
